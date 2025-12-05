// gateway/lib/roles.ts

import {
  ApiConfigError,
  ApiBrain,
  ProviderConfig,
  RolePolicy,
  getApiBrain,
  getProviderOrThrow,
  getRoleOrThrow,
} from './config';

/**
 * Provider + endpoint resolved for a role.
 */
export interface ResolvedRoleEndpoint {
  /**
   * Full provider configuration from providers.registry.json.
   */
  provider: ProviderConfig;

  /**
   * Logical endpoint identifier for this role, as declared in the
   * provider's endpoints/adapters maps (e.g. "fx_quotes").
   */
  endpointId: string;
}

/**
 * Fully-resolved role that the gateway can execute.
 */
export interface ResolvedRole {
  /**
   * Role name, e.g. "fx_ribbon".
   */
  role: string;

  /**
   * High-level kind, e.g. "fx", "crypto", "commodities".
   */
  kind: string;

  /**
   * Default cadence (polling period) in milliseconds, or null if not defined.
   */
  defaultCadenceMs: number | null;

  /**
   * Whether this role should only run when the underlying market is open.
   * (Market-hours integration can use this flag.)
   */
  onlyWhenOpen: boolean;

  /**
   * Primary provider + endpoint for this role.
   */
  primary: ResolvedRoleEndpoint;

  /**
   * Backup providers in order of preference.
   */
  backups: ResolvedRoleEndpoint[];

  /**
   * Raw policy from roles.policies.json for debugging.
   */
  policy: RolePolicy;

  /**
   * Reference to the full API Brain in case callers need extra metadata.
   */
  brain: ApiBrain;
}

/**
 * Infer the logical endpoint id that should be used for a given role.
 *
 * The configuration file may specify this explicitly via `endpoint_id`.
 * When it is omitted we fall back to a simple convention so that the
 * JSON can stay terse:
 *
 *   - FX roles → "fx_quotes"
 *   - Commodities roles → "commodities_latest"
 *   - Otherwise → role name itself
 */
function inferEndpointIdForRole(policy: RolePolicy): string {
  if (policy.endpoint_id && typeof policy.endpoint_id === 'string') {
    return policy.endpoint_id;
  }

  const kind = policy.kind;

  if (kind === 'fx' || policy.role.startsWith('fx_')) {
    return 'fx_quotes';
  }

  if (kind === 'commodities' || policy.role.includes('commodities')) {
    return 'commodities_latest';
  }

  return policy.role;
}

/**
 * Resolve a single provider id + role into a concrete endpoint.
 */
function resolveEndpointForProvider(providerId: string, policy: RolePolicy): ResolvedRoleEndpoint {
  const provider = getProviderOrThrow(providerId);

  const endpointId = inferEndpointIdForRole(policy);

  // Sanity check that the provider advertises this endpoint. We only
  // throw when the endpoints map is present; older providers may rely
  // entirely on adapter indirection.
  if (provider.endpoints && !provider.endpoints[endpointId]) {
    throw new ApiConfigError(
      `Provider "${provider.id}" does not declare endpoint "${endpointId}" in providers.registry.json.`,
    );
  }

  return {
    provider,
    endpointId,
  };
}

/**
 * Resolve a RolePolicy into a fully-wired ResolvedRole.
 */
function buildResolvedRole(policy: RolePolicy, brain: ApiBrain): ResolvedRole {
  if (!policy.providers || policy.providers.length === 0) {
    throw new ApiConfigError(
      `Role "${policy.role}" has no providers configured in roles.policies.json.`,
    );
  }

  const [primaryId, ...backupIds] = policy.providers;

  const primary = resolveEndpointForProvider(primaryId, policy);
  const backups = backupIds.map((id) => resolveEndpointForProvider(id, policy));

  const defaultCadenceMs =
    typeof policy.default_cadence_ms === 'number'
      ? policy.default_cadence_ms
      : policy.cache_ttl_seconds
      ? policy.cache_ttl_seconds * 1000
      : null;

  return {
    role: policy.role,
    kind: policy.kind,
    defaultCadenceMs,
    onlyWhenOpen: policy.only_when_open ?? false,
    primary,
    backups,
    policy,
    brain,
  };
}

/**
 * Public helper: resolve a role by name using the current API Brain.
 */
export function resolveRoleByName(roleName: string): ResolvedRole {
  const brain = getApiBrain();
  const policy = getRoleOrThrow(roleName);

  return buildResolvedRole(policy, brain);
}

/**
 * Convenience helper: resolve all roles in the API Brain.
 * Useful for diagnostics, validation, or admin tooling.
 */
export function getAllResolvedRoles(): ResolvedRole[] {
  const brain = getApiBrain();

  return brain.roles.map((role) => buildResolvedRole(role, brain));
}
