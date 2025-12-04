import fs from 'node:fs';
import path from 'node:path';

export type ApiBrainHealthSeverity = 'error' | 'warning';

export interface ApiBrainIssue {
  severity: ApiBrainHealthSeverity;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface RequiredFeature {
  /**
   * A stable identifier used only for error messages and snapshots.
   * Example: "fx.ribbon.realtime.free"
   */
  id: string;

  /**
   * High level kind of data.
   *
   * Examples:
   * - "fx" – FX rates for the ribbon.
   * - "weather" – simple weather widget.
   * - "holidays" – calendar / holidays information.
   */
  kind: string;

  /**
   * A logical "role" in the application: one of the things a human could point
   * at and say "that broke".
   *
   * For example: "fx-ribbon-realtime" or "calendar-home".
   */
  role: string;

  /**
   * Plan / tier that this feature belongs to: for now usually "free" or "pro".
   */
  plan?: string;
}

export interface ProviderRow {
  id: string;
  name?: string;
  kind?: string;
  safety?: string;
  speed?: string;
  cost?: string;
  reliability?: string;
  [key: string]: unknown;
}

export interface EndpointRow {
  id: string;
  provider_id?: string;
  kind?: string;
  role?: string;
  url?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface QuotaBlockRow {
  id: string;
  provider_id?: string;
  max_calls_per_day?: number;
  max_calls_per_month?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface PolicyRow {
  id: string;
  kind?: string;
  role?: string;
  plan?: string;
  // Which endpoints this policy may use.
  endpoint_ids?: string[];
  // Which quota blocks those endpoints are expected to draw from.
  quota_block_ids?: string[];
  [key: string]: unknown;
}

export interface ApiBrainFeatureSnapshot {
  kind: string;
  role: string;
  plan?: string;
  policyId?: string;
  providerIds?: string[];
  quotaBlockId?: string;
}

export interface ApiBrainSnapshot {
  features: ApiBrainFeatureSnapshot[];
}

export interface ApiBrainReport {
  issues: ApiBrainIssue[];
  snapshot: ApiBrainSnapshot;
}

/**
 * Utility: safe JSON load with explicit "missing file" / "invalid JSON" issues.
 */
function readJsonFile(relativePath: string, issues: ApiBrainIssue[], codePrefix: string): unknown {
  const resolvedPath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(resolvedPath)) {
    issues.push({
      severity: 'warning',
      code: `${codePrefix}.missing_file`,
      message: `JSON file not found at ${resolvedPath}`,
      context: { path: resolvedPath },
    });
    return undefined;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    issues.push({
      severity: 'error',
      code: `${codePrefix}.invalid_json`,
      message: `Failed to parse JSON at ${resolvedPath}`,
      context: { path: resolvedPath, error },
    });
    return undefined;
  }
}

/**
 * Utility: normalise a value to an array. Missing becomes [].
 */
function asArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  return [value as T];
}

/**
 * Utility: build a stable "feature key" for maps: kind|role|plan
 */
function featureKey(kind: string, role: string, plan?: string): string {
  return `${kind}|${role}|${plan ?? ''}`;
}

/**
 * REQUIRED_FEATURES is intentionally empty while the API configuration is
 * still being wired together. The healthcheck still validates that the JSON
 * catalogues load correctly, but it does not yet enforce that specific
 * features (FX ribbon, weather, holidays, etc.) have active policies.
 *
 * As those features go live and their policies stabilise, we will reintroduce
 * concrete entries here so the healthcheck can guard against regressions.
 */
export const REQUIRED_FEATURES: RequiredFeature[] = [
  // Currently empty while the API configuration is being wired up.
  // We still validate that the JSON catalogues load correctly, but we do not
  // yet enforce that specific features (FX ribbon, weather, holidays, etc.)
  // have active policies. As those features go live, we will reintroduce
  // concrete entries here so the healthcheck can guard against regressions.
];

/**
 * Runtime views of the JSON rows. These are intentionally loose; the
 * healthcheck asserts presence of the fields it cares about.
 */

export interface ProviderRec {
  id: string;
  raw: ProviderRow;
}

export interface EndpointRec {
  id: string;
  provider_id: string;
  kind?: string;
  role?: string;
  raw: EndpointRow;
}

export interface QuotaBlockRec {
  id: string;
  provider_id: string;
  max_calls_per_day?: number;
  max_calls_per_month?: number;
  raw: QuotaBlockRow;
}

export interface PolicyRec {
  id: string;
  kind?: string;
  role?: string;
  plan?: string;
  endpoint_ids: string[];
  quota_block_ids: string[];
  raw: PolicyRow;
}

/**
 * Load providers catalogue.
 *
 * Expected shape:
 *
 * {
 *   "version": 1,
 *   "providers": [ ... ProviderRow ... ]
 * }
 */
export function loadProviders(issues: ApiBrainIssue[]): ProviderRec[] {
  const json = readJsonFile('src/data/api.providers.catalog.json', issues, 'providers');

  if (!json || typeof json !== 'object') {
    issues.push({
      severity: 'warning',
      code: 'providers.missing_or_invalid',
      message: 'Providers catalogue missing or not an object.',
      context: { json },
    });
    return [];
  }

  const root = json as { providers?: unknown };
  const rows = asArray<ProviderRow>(root.providers);

  const providers: ProviderRec[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      issues.push({
        severity: 'warning',
        code: 'providers.invalid_row',
        message: 'Provider row is not an object.',
        context: { row },
      });
      continue;
    }

    const id = (row as ProviderRow).id;
    if (!id) {
      issues.push({
        severity: 'warning',
        code: 'providers.missing_id',
        message: 'Provider row is missing id.',
        context: { row },
      });
      continue;
    }

    providers.push({
      id,
      raw: row,
    });
  }

  return providers;
}

/**
 * Load endpoints catalogue.
 *
 * Expected shape:
 *
 * {
 *   "version": 1,
 *   "endpoints": [ ... EndpointRow ... ]
 * }
 */
export function loadEndpoints(issues: ApiBrainIssue[]): EndpointRec[] {
  const json = readJsonFile('src/data/api.endpoints.catalog.json', issues, 'endpoints');

  if (!json || typeof json !== 'object') {
    issues.push({
      severity: 'warning',
      code: 'endpoints.missing_or_invalid',
      message: 'Endpoints catalogue missing or not an object.',
      context: { json },
    });
    return [];
  }

  const root = json as { endpoints?: unknown };
  const rows = asArray<EndpointRow>(root.endpoints);

  const endpoints: EndpointRec[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      issues.push({
        severity: 'warning',
        code: 'endpoints.invalid_row',
        message: 'Endpoint row is not an object.',
        context: { row },
      });
      continue;
    }

    const id = (row as EndpointRow).id;
    const provider_id = (row as EndpointRow).provider_id;

    if (!id) {
      issues.push({
        severity: 'warning',
        code: 'endpoints.missing_id',
        message: 'Endpoint row is missing id.',
        context: { row },
      });
      continue;
    }

    if (!provider_id) {
      issues.push({
        severity: 'warning',
        code: 'endpoints.missing_provider_id',
        message: `Endpoint ${id} is missing provider_id.`,
        context: { row },
      });
      continue;
    }

    endpoints.push({
      id,
      provider_id,
      kind: (row as EndpointRow).kind,
      role: (row as EndpointRow).role,
      raw: row,
    });
  }

  return endpoints;
}

/**
 * Load quota blocks catalogue.
 *
 * Expected shape:
 *
 * {
 *   "version": 1,
 *   "quota_blocks": [ ... QuotaBlockRow ... ]
 * }
 */
export function loadQuotaBlocks(issues: ApiBrainIssue[]): QuotaBlockRec[] {
  const json = readJsonFile('src/data/api.policies.json', issues, 'quotas-or-policies');

  if (!json || typeof json !== 'object') {
    issues.push({
      severity: 'warning',
      code: 'quota_blocks.missing_or_invalid',
      message: 'Quota / policies file missing or not an object.',
      context: { json },
    });
    return [];
  }

  // For now we only care that the top-level shape is not completely wrong.
  const root = json as { quota_blocks?: unknown };
  const rows = asArray<QuotaBlockRow>(root.quota_blocks);

  const blocks: QuotaBlockRec[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      issues.push({
        severity: 'warning',
        code: 'quota_blocks.invalid_row',
        message: 'Quota block row is not an object.',
        context: { row },
      });
      continue;
    }

    const id = (row as QuotaBlockRow).id;
    const provider_id = (row as QuotaBlockRow).provider_id;

    if (!id) {
      issues.push({
        severity: 'warning',
        code: 'quota_blocks.missing_id',
        message: 'Quota block row is missing id.',
        context: { row },
      });
      continue;
    }

    if (!provider_id) {
      issues.push({
        severity: 'warning',
        code: 'quota_blocks.missing_provider_id',
        message: `Quota block ${id} is missing provider_id.`,
        context: { row },
      });
      continue;
    }

    blocks.push({
      id,
      provider_id,
      max_calls_per_day: (row as QuotaBlockRow).max_calls_per_day,
      max_calls_per_month: (row as QuotaBlockRow).max_calls_per_month,
      raw: row,
    });
  }

  return blocks;
}

/**
 * Load policies catalogue.
 *
 * This is intentionally very forgiving: until the JSON is fully stabilised,
 * the healthcheck will only assert the fields it actually uses.
 *
 * Expected shape:
 *
 * {
 *   "version": 1,
 *   "policies": [ ... PolicyRow ... ]
 * }
 */
export function loadPolicies(issues: ApiBrainIssue[]): PolicyRec[] {
  const json = readJsonFile('src/data/api.policies.json', issues, 'policies');

  if (!json || typeof json !== 'object') {
    issues.push({
      severity: 'warning',
      code: 'policies.missing_or_invalid',
      message: 'Policies file missing or not an object.',
      context: { json },
    });
    return [];
  }

  const root = json as { policies?: unknown };
  const rows = asArray<PolicyRow>(root.policies);

  const policies: PolicyRec[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      issues.push({
        severity: 'warning',
        code: 'policies.invalid_row',
        message: 'Policy row is not an object.',
        context: { row },
      });
      continue;
    }

    const id = (row as PolicyRow).id;
    if (!id) {
      issues.push({
        severity: 'warning',
        code: 'policies.missing_id',
        message: 'Policy row is missing id.',
        context: { row },
      });
      continue;
    }

    const endpoint_ids = asArray<string>((row as PolicyRow).endpoint_ids);
    const quota_block_ids = asArray<string>((row as PolicyRow).quota_block_ids);

    policies.push({
      id,
      kind: (row as PolicyRow).kind,
      role: (row as PolicyRow).role,
      plan: (row as PolicyRow).plan,
      endpoint_ids,
      quota_block_ids,
      raw: row,
    });
  }

  return policies;
}

/**
 * Validate the overall "API brain" and produce a report.
 *
 * This intentionally does not yet try to be clever about quotas or costs; it
 * just ensures the three catalogues exist and roughly line up with each other.
 */
export function validateApiBrain(requiredFeatures: RequiredFeature[]): ApiBrainReport {
  const issues: ApiBrainIssue[] = [];

  const providers = loadProviders(issues);
  const endpoints = loadEndpoints(issues);
  const quotaBlocks = loadQuotaBlocks(issues);
  const policies = loadPolicies(issues);

  const providerMap = new Map<string, ProviderRec>();
  for (const p of providers) {
    providerMap.set(p.id, p);
  }

  const quotaBlockMap = new Map<string, QuotaBlockRec>();
  for (const qb of quotaBlocks) {
    quotaBlockMap.set(qb.id, qb);
  }

  const policyMap = new Map<string, PolicyRec>();
  const featurePolicyMap = new Map<string, PolicyRec>();

  for (const policy of policies) {
    policyMap.set(policy.id, policy);

    if (policy.kind && policy.role) {
      const key = featureKey(policy.kind, policy.role, policy.plan);
      featurePolicyMap.set(key, policy);
    }
  }

  // Check that every policy references existing endpoints and quota blocks.
  for (const policy of policies) {
    for (const endpointId of policy.endpoint_ids) {
      const endpoint = endpoints.find((e) => e.id === endpointId);
      if (!endpoint) {
        issues.push({
          severity: 'warning',
          code: 'policy_missing_endpoint',
          message: `Policy ${policy.id} references unknown endpoint ${endpointId}`,
          context: { policyId: policy.id, endpointId },
        });
      } else {
        const provider = providerMap.get(endpoint.provider_id);
        if (!provider) {
          issues.push({
            severity: 'warning',
            code: 'policy_endpoint_missing_provider',
            message: `Endpoint ${endpointId} used by policy ${policy.id} has unknown provider ${endpoint.provider_id}`,
            context: {
              policyId: policy.id,
              endpointId,
              providerId: endpoint.provider_id,
            },
          });
        }
      }
    }

    for (const quotaBlockId of policy.quota_block_ids) {
      const qb = quotaBlockMap.get(quotaBlockId);
      if (!qb) {
        issues.push({
          severity: 'warning',
          code: 'policy_missing_quota_block',
          message: `Policy ${policy.id} references unknown quota block ${quotaBlockId}`,
          context: { policyId: policy.id, quotaBlockId },
        });
      } else {
        const provider = providerMap.get(qb.provider_id);
        if (!provider) {
          issues.push({
            severity: 'warning',
            code: 'policy_quota_block_missing_provider',
            message: `Quota block ${quotaBlockId} used by policy ${policy.id} has unknown provider ${qb.provider_id}`,
            context: {
              policyId: policy.id,
              quotaBlockId,
              providerId: qb.provider_id,
            },
          });
        }
      }
    }
  }

  // Check that required features have at least one matching policy.
  const snapshotFeatures: ApiBrainFeatureSnapshot[] = [];

  for (const feature of requiredFeatures) {
    const key = featureKey(feature.kind, feature.role, feature.plan);
    const policy = featurePolicyMap.get(key);

    if (!policy) {
      issues.push({
        severity: 'error',
        code: 'feature_missing_policy',
        message: `No active policy found for required feature ${feature.id}`,
        context: { feature, kind: feature.kind, role: feature.role, plan: feature.plan },
      });
      continue;
    }

    snapshotFeatures.push({
      kind: feature.kind,
      role: feature.role,
      plan: feature.plan,
      policyId: policy.id,
      providerIds: policy.endpoint_ids
        .map((endpointId) => endpoints.find((e) => e.id === endpointId))
        .filter((e): e is EndpointRec => !!e)
        .map((e) => e.provider_id),
      quotaBlockId: policy.quota_block_ids[0],
    });
  }

  const snapshot: ApiBrainSnapshot = {
    features: snapshotFeatures.sort((a, b) => {
      const keyA = `${a.kind}|${a.role}|${a.plan ?? ''}`;
      const keyB = `${b.kind}|${b.role}|${b.plan ?? ''}`;
      return keyA.localeCompare(keyB);
    }),
  };

  return { issues, snapshot };
}
