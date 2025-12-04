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
  provider: ProviderConfig;
  endpointId: string;
}

/**
 * Resolved representation of a role, ready for the gateway to use.
 */
export interface ResolvedRole {
  /**
   * Role name, e.g. "fx-ribbon-realtime".
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
   * (Market-hours logic will use this later.)
   */
  onlyWhenOpen: boolean;

  /**
   * Primary provider + endpoint for this role.
   */
  primary: ResolvedRoleEndpoint;

  /**
   * Ordered list of backup providers + endpoints used for fallbacks.
   */
  backups: ResolvedRoleEndpoint[];

  /**
   * The original policy entry from roles.policies.json.
   * Exposed for logging/diagnostics.
   */
  policy: RolePolicy;

  /**
   * The underlying API Brain snapshot at the time of resolution.
   * Useful for debugging and advanced scenarios.
   */
  brain: ApiBrain;
}

/**
 * Parse a cadence string into milliseconds.
 *
 * Supported formats (based on current config):
 * - "60s"      =>  60 seconds
 * - "300s"     => 300 seconds
 * - "86400s"   => 86400 seconds (one day)
 *
 * The parser is intentionally conservative so misconfigurations fail loudly.
 */
export function parseCadenceToMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Expected patterns in current config are plain seconds, e.g. "60s".
  // We also support simple "Xs", "Xm", "Xh", "Xd" forms for future flexibility.
  const match = /^(\d+)([smhd])?s?$/.exec(trimmed);

  if (!match) {
    throw new ApiConfigError(
      `Invalid default_cadence value "${value}". Expected something like "60s", "300s", or "86400s".`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiConfigError(
      `Invalid default_cadence amount in "${value}". Expected a non-negative number.`,
    );
  }

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      // This should be unreachable because of the regex, but keep TypeScript happy.
      throw new ApiConfigError(
        `Unsupported cadence unit in "${value}". Only s, m, h, d are supported.`,
      );
  }
}

/**
 * Resolve a RolePolicy into a ResolvedRole structure.
 */
function buildResolvedRole(policy: RolePolicy, brain: ApiBrain): ResolvedRole {
  const primaryProvider = getProviderOrThrow(policy.primary.provider_id);

  const primary: ResolvedRoleEndpoint = {
    provider: primaryProvider,
    endpointId: policy.primary.endpoint_id,
  };

  const backups: ResolvedRoleEndpoint[] = policy.backups.map((backup) => {
    const backupProvider = getProviderOrThrow(backup.provider_id);

    return {
      provider: backupProvider,
      endpointId: backup.endpoint_id,
    };
  });

  const defaultCadenceMs = parseCadenceToMs(policy.default_cadence);

  return {
    role: policy.role,
    kind: policy.kind,
    defaultCadenceMs,
    onlyWhenOpen: policy.only_when_open,
    primary,
    backups,
    policy,
    brain,
  };
}

/**
 * Look up and resolve a role by name, or throw a clear configuration error.
 */
export function getResolvedRoleOrThrow(roleName: string): ResolvedRole {
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
