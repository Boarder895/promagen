// gateway/lib/config.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration error thrown when the API Brain JSON is missing,
 * malformed, or internally inconsistent.
 */
export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

/**
 * Provider-level auth configuration, as defined in providers.registry.json.
 */
export interface ProviderAuthConfig {
  type: string;
  location: string;
  field_name?: string;
  notes?: string;
}

/**
 * One quota window (e.g. per_day, per_month).
 */
export interface ProviderQuotaWindow {
  max_calls: number | null;
  notes?: string;
}

/**
 * Quota configuration for a provider.
 */
export interface ProviderQuotaResetWindow {
  kind: string;
  notes?: string;
}

export interface ProviderQuota {
  per_day?: ProviderQuotaWindow | null;
  per_month?: ProviderQuotaWindow | null;
  per_minute?: ProviderQuotaWindow | null;
  per_second?: ProviderQuotaWindow | null;
  reset_window?: ProviderQuotaResetWindow | null;
}

/**
 * Credit/charging model for a provider.
 */
export interface ProviderCreditsModel {
  type: string;
  default_credits_per_request: number;
  notes?: string;
}

/**
 * Full shape of one provider entry from providers.registry.json.
 * This mirrors api.providers.catalog.json.
 */
export interface ProviderConfig {
  id: string;
  name: string;
  label: string;
  ui_label: string;
  short_label: string;
  website: string;
  dashboard_url: string;
  docs_url: string;
  base_url_rest: string;
  status: string;
  plan_name: string;
  plan_tier: string;
  kinds_supported: string[];
  roles_supported: string[];
  auth: ProviderAuthConfig;
  quota: ProviderQuota;
  credits_model: ProviderCreditsModel;
  tags: string[];
  notes?: string;
}

/**
 * Target provider + endpoint used by a role.
 */
export interface RoleEndpointConfig {
  provider_id: string;
  endpoint_id: string;
}

/**
 * One role policy from roles.policies.json (based on api.policies.json).
 */
export interface RolePolicy {
  role: string;
  kind: string;
  default_cadence: string;
  only_when_open: boolean;
  primary: RoleEndpointConfig;
  backups: RoleEndpointConfig[];
  notes?: string;
}

/**
 * In-memory representation of the API Brain.
 */
export interface ApiBrain {
  version: number;
  providers: ProviderConfig[];
  roles: RolePolicy[];
}

interface ProvidersRegistryFile {
  version: number;
  providers: ProviderConfig[];
}

interface RolesPoliciesFile {
  version: number;
  roles: RolePolicy[];
}

let cachedBrain: ApiBrain | null = null;
let providersById: Record<string, ProviderConfig> | null = null;
let rolesByName: Record<string, RolePolicy> | null = null;

/**
 * Low-level helper to read a JSON file relative to the repo root.
 *
 * Next.js sometimes runs API route code with process.cwd() pointing at
 * a deep path like:
 *   .../frontend/.next/server/app/api/fx
 *
 * but the JSON config lives in the monorepo root:
 *   .../promagen/config/api/...
 *
 * To make this robust, we walk up the directory tree until we find the
 * "promagen" folder and then resolve the JSON path from there.
 */
function readJsonFile<T>(relativePath: string): T {
  const cwd = process.cwd();

  let dir = cwd;
  for (let i = 0; i < 10; i += 1) {
    const base = path.basename(dir).toLowerCase();
    if (base === 'promagen') {
      // We’ve reached the repo root.
      break;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root without finding "promagen"; bail out.
      break;
    }

    // Walk one level up and keep going.
    dir = parent;
  }

  const absolutePath = path.resolve(dir, relativePath);

  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiConfigError(
      `Failed to read JSON config at "${relativePath}" (resolved to "${absolutePath}"): ${reason}`,
    );
  }
}

function validateProvidersRegistryFile(raw: ProvidersRegistryFile): ProvidersRegistryFile {
  if (typeof raw.version !== 'number') {
    throw new ApiConfigError('providers.registry.json is missing numeric "version".');
  }

  if (raw.version !== 1) {
    throw new ApiConfigError(
      `Unsupported providers.registry.json version: ${raw.version}. Expected version 1.`,
    );
  }

  if (!Array.isArray(raw.providers)) {
    throw new ApiConfigError('providers.registry.json is missing "providers" array.');
  }

  return raw;
}

function validateRolesPoliciesFile(raw: RolesPoliciesFile): RolesPoliciesFile {
  if (typeof raw.version !== 'number') {
    throw new ApiConfigError('roles.policies.json is missing numeric "version".');
  }

  if (raw.version !== 1) {
    throw new ApiConfigError(
      `Unsupported roles.policies.json version: ${raw.version}. Expected version 1.`,
    );
  }

  if (!Array.isArray(raw.roles)) {
    throw new ApiConfigError('roles.policies.json is missing "roles" array.');
  }

  return raw;
}

/**
 * Build the in-memory ApiBrain and the fast lookup maps.
 * This is only called once per process; subsequent calls use the cache.
 */
function buildApiBrain(): ApiBrain {
  const providersFile = validateProvidersRegistryFile(
    readJsonFile<ProvidersRegistryFile>('config/api/providers.registry.json'),
  );

  const rolesFile = validateRolesPoliciesFile(
    readJsonFile<RolesPoliciesFile>('config/api/roles.policies.json'),
  );

  const providersByIdLocal: Record<string, ProviderConfig> = Object.create(null);

  for (const provider of providersFile.providers) {
    if (!provider.id) {
      throw new ApiConfigError('Found provider without an id in providers.registry.json.');
    }

    if (providersByIdLocal[provider.id]) {
      throw new ApiConfigError(
        `Duplicate provider id "${provider.id}" in providers.registry.json.`,
      );
    }

    providersByIdLocal[provider.id] = provider;
  }

  const rolesByNameLocal: Record<string, RolePolicy> = Object.create(null);

  for (const role of rolesFile.roles) {
    if (!role.role) {
      throw new ApiConfigError('Found role without a role name in roles.policies.json.');
    }

    if (rolesByNameLocal[role.role]) {
      throw new ApiConfigError(`Duplicate role "${role.role}" in roles.policies.json.`);
    }

    const primaryProvider = providersByIdLocal[role.primary.provider_id];

    if (!primaryProvider) {
      throw new ApiConfigError(
        `Role "${role.role}" references unknown primary provider "${role.primary.provider_id}".`,
      );
    }

    for (const backup of role.backups) {
      const backupProvider = providersByIdLocal[backup.provider_id];
      if (!backupProvider) {
        throw new ApiConfigError(
          `Role "${role.role}" references unknown backup provider "${backup.provider_id}".`,
        );
      }
    }

    rolesByNameLocal[role.role] = role;
  }

  providersById = providersByIdLocal;
  rolesByName = rolesByNameLocal;

  // Version is currently identical between files; take the max for safety.
  const combinedVersion = Math.max(providersFile.version, rolesFile.version);

  cachedBrain = {
    version: combinedVersion,
    providers: providersFile.providers,
    roles: rolesFile.roles,
  };

  return cachedBrain;
}

/**
 * Public entry point: get the cached ApiBrain (or build it on first use).
 */
export function getApiBrain(): ApiBrain {
  if (cachedBrain) {
    return cachedBrain;
  }

  return buildApiBrain();
}

/**
 * Look up a provider by id, or throw a clear configuration error.
 */
export function getProviderOrThrow(providerId: string): ProviderConfig {
  if (!providersById || !cachedBrain) {
    buildApiBrain();
  }

  const localProvidersById = providersById;

  if (!localProvidersById) {
    // Should be impossible, but keeps TypeScript happy.
    throw new ApiConfigError('Providers map not initialised when calling getProviderOrThrow.');
  }

  const provider = localProvidersById[providerId];

  if (!provider) {
    throw new ApiConfigError(`Unknown provider "${providerId}" requested from API Brain.`);
  }

  return provider;
}

/**
 * Look up a role policy by role name, or throw a clear configuration error.
 */
export function getRoleOrThrow(roleName: string): RolePolicy {
  if (!rolesByName || !cachedBrain) {
    buildApiBrain();
  }

  const localRolesByName = rolesByName;

  if (!localRolesByName) {
    throw new ApiConfigError('Roles map not initialised when calling getRoleOrThrow.');
  }

  const role = localRolesByName[roleName];

  if (!role) {
    throw new ApiConfigError(`Unknown role "${roleName}" requested from API Brain.`);
  }

  return role;
}

/**
 * Test-only helper: clear the in-memory cache so tests can reload
 * the API Brain after modifying the JSON files.
 */
export function clearApiBrainCacheForTests(): void {
  cachedBrain = null;
  providersById = null;
  rolesByName = null;
}
