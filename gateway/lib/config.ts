// gateway/lib/config.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration error thrown when the API Brain JSON is missing,
 * malformed, or internally inconsistent.
 */
export class ApiConfigError extends Error {
  public readonly code = 'API_CONFIG_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

// Helpful trace so we KNOW which file is actually running.
console.log('[API-CONFIG] config.ts loaded from:', __filename);

/**
 * Authentication configuration for a provider.
 *
 * This mirrors the shapes used in providers.registry.json but keeps the
 * fields that the gateway actually needs.
 */
export type ProviderAuthConfig =
  | {
      /**
       * No authentication – purely public endpoint.
       */
      type: 'none';
    }
  | {
      /**
       * API key passed as a query parameter, e.g. ?apikey=XYZ.
       */
      type: 'query_param';
      key_name: string;
      env: string;
    }
  | {
      /**
       * API key passed via HTTP header, e.g. `Authorization: Token XYZ`.
       */
      type: 'header_token';
      header_name: string;
      env: string;
      /**
       * Optional fixed prefix to prepend before the key value.
       * Common examples: "Token " or "Bearer ".
       */
      prefix?: string;
    }
  | {
      /**
       * Escape hatch for future provider-specific auth shapes.
       * The config validator keeps this opaque.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };

/**
 * API provider entry in providers.registry.json.
 *
 * This is intentionally a minimal view – we only expose the fields the
 * gateway actually needs to route traffic. The JSON file is free to
 * contain extra documentation fields that the frontend can use.
 */
export interface ProviderConfig {
  /**
   * Internal identifier, e.g. "fmp" or "twelvedata".
   */
  id: string;

  /**
   * Human readable display name.
   */
  display_name?: string;

  /**
   * Optional short code used in URLs or logs, if different from id.
   */
  code?: string;

  /**
   * Free-form description.
   */
  description?: string;

  /**
   * High level capabilities advertised by this provider, e.g.
   * ["fx_ribbon", "fx_mini_widget"].
   */
  capabilities?: string[];

  /**
   * Map of logical endpoint identifiers to real URLs.
   *
   * Example:
   *   {
   *     "fx_quotes": "https://financialmodelingprep.com/api/v3/fx"
   *   }
   */
  endpoints?: Record<string, string>;

  /**
   * Map of logical endpoint identifiers to adapter ids.
   *
   * Example:
   *   {
   *     "fx_quotes": "fmp_fx_v1"
   *   }
   */
  adapters?: Record<string, string>;

  /**
   * Optional map of role → endpoint identifiers this provider supports.
   *
   * Older versions of the config used this; newer versions prefer
   * role-local endpoint ids. We keep it optional for backwards compat.
   */
  roles?: Record<string, string>;

  /**
   * Authentication configuration, if required.
   */
  auth?: ProviderAuthConfig;

  /**
   * Bag of provider-specific metadata used by the frontend only.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Role policy entry in roles.policies.json.
 *
 * This is the normalised in-memory shape after validation; the on-disk
 * JSON is slightly different and is handled by validateRolesPoliciesFile.
 */
export interface RolePolicy {
  /**
   * Role identifier, e.g. "fx_ribbon".
   */
  role: string;

  /**
   * High-level kind, e.g. "fx", "crypto", "commodities".
   */
  kind: string;

  /**
   * Ordered list of provider ids for this role.
   * The first entry is treated as primary; any remaining entries are
   * considered backups in order of preference.
   */
  providers: string[];

  /**
   * Optional default cadence in milliseconds.
   */
  default_cadence_ms?: number;

  /**
   * Whether this role should only run while the underlying market is open.
   */
  only_when_open?: boolean;

  /**
   * Optional cache TTL in seconds for the upstream data.
   */
  cache_ttl_seconds?: number;

  /**
   * Strategy to use when upstream quality degrades.
   * Example values: "fallback", "cached".
   */
  quality_degradation_mode?: string;

  /**
   * The provider id that is considered primary in the policy.
   * Kept for traceability; `providers[0]` will always equal this.
   */
  primary_provider: string;

  /**
   * Any backup provider ids, in order of preference.
   * Kept for traceability; must match providers.slice(1).
   */
  backup_providers: string[];

  /**
   * Logical endpoint identifier to use for this role, e.g. "fx_quotes".
   * If omitted, the gateway will infer a sensible default from the kind.
   */
  endpoint_id?: string;
}

/**
 * Shape of providers.registry.json on disk.
 */
interface ProvidersRegistryFileOnDisk {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers: Record<string, any> | Array<Record<string, unknown>>;
}

/**
 * Shape of roles.policies.json on disk.
 */
interface RolesPoliciesFileOnDisk {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roles: Record<string, any> | Array<Record<string, unknown>>;
}

/**
 * In-memory API Brain – this is what the rest of the gateway talks to.
 */
export interface ApiBrain {
  providers: ProviderConfig[];
  roles: RolePolicy[];

  /**
   * Convenience lookups to avoid repeatedly scanning arrays.
   */
  providersById: Record<string, ProviderConfig>;
  rolesByName: Record<string, RolePolicy>;
}

/**
 * Cached API Brain instance so we only hit the filesystem once per
 * cold start in serverless environments.
 */
let cachedBrain: ApiBrain | null = null;
let providersByIdCache: Record<string, ProviderConfig> | null = null;
let rolesByNameCache: Record<string, RolePolicy> | null = null;

/**
 * Resolve a path that is *relative to the frontend root* no matter
 * where process.cwd() is.
 */
function resolveFrontendRelativePath(relativeToFrontendRoot: string): string {
  const cwd = process.cwd();

  const candidates = [
    // Monorepo root → prefer frontend subfolder
    path.resolve(cwd, 'frontend', relativeToFrontendRoot),
    // CWD already is frontend
    path.resolve(cwd, relativeToFrontendRoot),
    // Compiled into .next/server – walk up from dist to project
    path.resolve(__dirname, '..', '..', 'frontend', relativeToFrontendRoot),
    path.resolve(__dirname, '..', '..', relativeToFrontendRoot),
  ];

  console.log(`[API-CONFIG] Resolving "${relativeToFrontendRoot}" with cwd="${cwd}"`);

  const existing: string[] = [];

  for (const candidate of candidates) {
    const exists = fs.existsSync(candidate);
    console.log(`[API-CONFIG]   candidate: ${candidate} exists=${exists}`);
    if (exists) {
      existing.push(candidate);
    }
  }

  if (existing.length === 0) {
    throw new ApiConfigError(
      `Unable to locate "${relativeToFrontendRoot}". Tried:\n` +
        candidates.map((p) => ` - ${p}`).join('\n'),
    );
  }

  // Prefer anything under "\frontend\" if available.
  const preferred =
    existing.find((p) => p.includes(`${path.sep}frontend${path.sep}`)) ?? existing[0];

  console.log('[API-CONFIG] Using file:', preferred);
  return preferred;
}

/**
 * Read and parse a JSON file using resolveFrontendRelativePath().
 */
function readJsonFile<T>(relativeToFrontendRoot: string): T {
  const filePath = resolveFrontendRelativePath(relativeToFrontendRoot);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiConfigError(
      `Failed to read JSON config "${relativeToFrontendRoot}" at "${filePath}": ${message}`,
    );
  }
}

/**
 * Validate providers.registry.json and normalise it into our ProviderConfig
 * model. This catches common config mistakes early.
 */
function validateProvidersRegistryFile(file: ProvidersRegistryFileOnDisk): {
  providers: ProviderConfig[];
} {
  if (!file || typeof file !== 'object') {
    throw new ApiConfigError('providers.registry.json must be an object.');
  }

  // Normalise object-or-array into entries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let entries: Array<[string, any]> = [];

  if (Array.isArray(file.providers)) {
    const arr = file.providers as Array<Record<string, unknown>>;
    entries = arr.map((raw) => {
      const rawId = (raw as { id?: unknown }).id;
      const id = typeof rawId === 'string' ? rawId : String(rawId ?? '');
      return [id, raw] as [string, Record<string, unknown>];
    });
  } else {
    const map = file.providers as Record<string, unknown>;
    entries = Object.entries(map);
  }

  if (entries.length === 0) {
    throw new ApiConfigError('providers.registry.json must contain at least one provider.');
  }

  const seenIds = new Set<string>();
  const providers: ProviderConfig[] = [];

  for (const [idFromKey, raw] of entries) {
    if (!raw || typeof raw !== 'object') {
      throw new ApiConfigError('Each provider in providers.registry.json must be an object.');
    }

    const rawId = (raw as { id?: unknown }).id;
    const id = typeof rawId === 'string' && rawId.length > 0 ? rawId : idFromKey;

    if (!id || typeof id !== 'string') {
      throw new ApiConfigError(
        'Every provider in providers.registry.json must have a string "id".',
      );
    }

    if (seenIds.has(id)) {
      throw new ApiConfigError(`Duplicate provider id "${id}" in providers.registry.json.`);
    }

    seenIds.add(id);

    const provider: ProviderConfig = {
      id,
      display_name: (raw as { display_name?: string }).display_name,
      code: (raw as { code?: string }).code,
      description: (raw as { description?: string }).description,
      capabilities: (raw as { capabilities?: string[] }).capabilities,
      endpoints: (raw as { endpoints?: Record<string, string> }).endpoints,
      adapters: (raw as { adapters?: Record<string, string> }).adapters,
      roles: (raw as { roles?: Record<string, string> }).roles,
      auth: (raw as { auth?: ProviderAuthConfig }).auth,
      metadata: (raw as { metadata?: Record<string, unknown> }).metadata,
    };

    providers.push(provider);
  }

  return { providers };
}

/**
 * On-disk role policy shape before normalisation.
 * This matches the JSON under roles.policies.json.
 */
interface RolePolicyOnDisk {
  role?: string;
  kind?: string;
  primary_provider: string;
  backup_providers?: string[];
  cache_ttl_seconds?: number;
  quality_degradation_mode?: string;
  default_cadence_ms?: number;
  only_when_open?: boolean;
  endpoint_id?: string;
}

/**
 * Infer a sensible "kind" field from the role name when the JSON
 * does not specify it explicitly.
 */
function inferKindFromRoleName(roleName: string): string {
  if (roleName.startsWith('fx_')) {
    return 'fx';
  }

  if (roleName.includes('commodities')) {
    return 'commodities';
  }

  return 'generic';
}

/**
 * Normalise roles.policies.json into RolePolicy objects.
 */
function validateRolesPoliciesFile(file: RolesPoliciesFileOnDisk): {
  roles: RolePolicy[];
} {
  if (!file || typeof file !== 'object') {
    throw new ApiConfigError('roles.policies.json must be an object.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRoles = file.roles as Record<string, any> | any[];

  const entries: Array<[string, RolePolicyOnDisk]> = Array.isArray(rawRoles)
    ? (rawRoles as RolePolicyOnDisk[]).map((raw) => [raw.role ?? '', raw])
    : Object.entries(rawRoles as Record<string, RolePolicyOnDisk>);

  if (entries.length === 0) {
    throw new ApiConfigError('roles.policies.json must declare at least one role.');
  }

  const roles: RolePolicy[] = [];
  const seenRoles = new Set<string>();

  for (const [key, raw] of entries) {
    if (!raw || typeof raw !== 'object') {
      throw new ApiConfigError('Each role in roles.policies.json must be an object.');
    }

    const roleName = raw.role || key;
    if (!roleName || typeof roleName !== 'string') {
      throw new ApiConfigError('Every role in roles.policies.json must have a string "role".');
    }

    if (seenRoles.has(roleName)) {
      throw new ApiConfigError(`Duplicate role "${roleName}" in roles.policies.json.`);
    }
    seenRoles.add(roleName);

    if (!raw.primary_provider || typeof raw.primary_provider !== 'string') {
      throw new ApiConfigError(
        `Role "${roleName}" must declare a string "primary_provider" in roles.policies.json.`,
      );
    }

    const backupProviders: string[] = Array.isArray(raw.backup_providers)
      ? raw.backup_providers.filter((p): p is string => typeof p === 'string')
      : [];

    const providers: string[] = [raw.primary_provider, ...backupProviders];

    const defaultCadenceMs =
      typeof raw.default_cadence_ms === 'number'
        ? raw.default_cadence_ms
        : typeof raw.cache_ttl_seconds === 'number'
        ? raw.cache_ttl_seconds * 1000
        : undefined;

    const role: RolePolicy = {
      role: roleName,
      kind: raw.kind || inferKindFromRoleName(roleName),
      providers,
      default_cadence_ms: defaultCadenceMs,
      only_when_open: raw.only_when_open,
      cache_ttl_seconds: raw.cache_ttl_seconds,
      quality_degradation_mode: raw.quality_degradation_mode,
      primary_provider: raw.primary_provider,
      backup_providers: backupProviders,
      endpoint_id: raw.endpoint_id,
    };

    roles.push(role);
  }

  return { roles };
}

/**
 * Build the API Brain from the JSON config files.
 *
 * This is the single place that knows how to read providers.registry.json
 * and roles.policies.json from disk.
 */
function buildApiBrain(): ApiBrain {
  const providersFile = validateProvidersRegistryFile(
    readJsonFile<ProvidersRegistryFileOnDisk>('config/api/providers.registry.json'),
  );

  const rolesFile = validateRolesPoliciesFile(
    readJsonFile<RolesPoliciesFileOnDisk>('config/api/roles.policies.json'),
  );

  const providersById: Record<string, ProviderConfig> = {};
  for (const provider of providersFile.providers) {
    providersById[provider.id] = provider;
  }

  const rolesByName: Record<string, RolePolicy> = {};
  for (const role of rolesFile.roles) {
    rolesByName[role.role] = role;
  }

  const brain: ApiBrain = {
    providers: providersFile.providers,
    roles: rolesFile.roles,
    providersById,
    rolesByName,
  };

  cachedBrain = brain;
  providersByIdCache = providersById;
  rolesByNameCache = rolesByName;

  return brain;
}

/**
 * Public accessor for the API Brain. This lazily builds and caches the
 * configuration on first use.
 */
export function getApiBrain(): ApiBrain {
  if (cachedBrain) {
    return cachedBrain;
  }

  return buildApiBrain();
}

/**
 * Helper to look up a provider by id or throw a descriptive error.
 */
export function getProviderOrThrow(providerId: string): ProviderConfig {
  if (!providersByIdCache || !cachedBrain) {
    buildApiBrain();
  }

  const map = providersByIdCache as Record<string, ProviderConfig>;
  const provider = map[providerId];

  if (!provider) {
    throw new ApiConfigError(`Unknown provider "${providerId}" in API Brain configuration.`);
  }

  return provider;
}

/**
 * Helper to look up a role policy by name or throw a descriptive error.
 */
export function getRoleOrThrow(roleName: string): RolePolicy {
  if (!rolesByNameCache || !cachedBrain) {
    buildApiBrain();
  }

  const map = rolesByNameCache as Record<string, RolePolicy>;
  const role = map[roleName];

  if (!role) {
    throw new ApiConfigError(`Unknown role "${roleName}" in API Brain configuration.`);
  }

  return role;
}

/**
 * Testing helper: clear the cached API Brain so tests can reload
 * the API Brain after modifying the JSON files.
 */
export function clearApiBrainCacheForTests(): void {
  cachedBrain = null;
  providersByIdCache = null;
  rolesByNameCache = null;
}
