// gateway/lib/config.ts

import fs from 'node:fs';
import path from 'node:path';

export type ProviderEndpointConfig = {
  id: string;
  baseUrl: string;
  apiKeyEnv?: string;
  // Optional override for quote endpoint path (default: "/quote")
  quotePath?: string;
};

export type RolePolicy = {
  id: string; // e.g. "fx"
  primaryProviderId: string; // e.g. "twelvedata"
  backupProviderIds: string[]; // e.g. ["fmp"]
};

export type ApiBrain = {
  providers: ProviderEndpointConfig[];
  roles: RolePolicy[];
};

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i += 1) {
    if (exists(path.join(dir, 'pnpm-workspace.yaml')) || exists(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function normaliseProvider(p: any): ProviderEndpointConfig {
  const id = String(p.id ?? p.providerId ?? p.name ?? '').trim();
  if (!id) throw new Error('Provider missing id');

  const baseUrl = String(p.baseUrl ?? p.base_url ?? p.baseURL ?? p.url ?? '').trim();
  if (!baseUrl) throw new Error(`Provider "${id}" missing baseUrl`);

  const apiKeyEnv =
    p.apiKeyEnv ?? p.api_key_env ?? p.apiKeyENV ?? p.key_env
      ? String(p.apiKeyEnv ?? p.api_key_env ?? p.apiKeyENV ?? p.key_env)
      : undefined;

  const quotePath =
    p.quotePath ?? p.quote_path ?? p.quote_endpoint
      ? String(p.quotePath ?? p.quote_path ?? p.quote_endpoint)
      : undefined;

  return { id, baseUrl, apiKeyEnv, quotePath };
}

function normaliseRole(r: any): RolePolicy {
  const id = String(r.id ?? r.roleId ?? r.role ?? '').trim();
  if (!id) throw new Error('Role policy missing id');

  const primaryProviderId = String(
    r.primaryProviderId ?? r.primary ?? r.provider ?? r.primary_provider_id ?? '',
  ).trim();
  if (!primaryProviderId) throw new Error(`Role "${id}" missing primary provider`);

  const backupsRaw =
    r.backupProviderIds ?? r.backups ?? r.backupProviders ?? r.backup_provider_ids ?? [];
  const backupProviderIds = Array.isArray(backupsRaw)
    ? backupsRaw.map((x: unknown) => String(x)).filter(Boolean)
    : [];

  return { id, primaryProviderId, backupProviderIds };
}

/**
 * Loads the API brain from repo-root/config/api.
 * Expected files:
 *  - providers.registry.json
 *  - roles.policies.json
 *
 * The parser is deliberately tolerant to field naming differences.
 */
export function getApiBrain(cwd: string = process.cwd()): ApiBrain {
  const repoRoot = findRepoRoot(cwd);
  const apiDir = path.join(repoRoot, 'config', 'api');

  const providersPath = path.join(apiDir, 'providers.registry.json');
  const rolesPath = path.join(apiDir, 'roles.policies.json');

  if (!exists(providersPath)) throw new Error(`Missing providers registry: ${providersPath}`);
  if (!exists(rolesPath)) throw new Error(`Missing roles policies: ${rolesPath}`);

  const providersJson: any = readJsonFile<any>(providersPath);
  const rolesJson: any = readJsonFile<any>(rolesPath);

  const providersArr = Array.isArray(providersJson)
    ? providersJson
    : providersJson.providers ?? providersJson.registry ?? [];
  const rolesArr = Array.isArray(rolesJson)
    ? rolesJson
    : rolesJson.roles ?? rolesJson.policies ?? [];

  if (!Array.isArray(providersArr) || providersArr.length === 0)
    throw new Error('providers.registry.json produced no providers');
  if (!Array.isArray(rolesArr) || rolesArr.length === 0)
    throw new Error('roles.policies.json produced no roles');

  return {
    providers: providersArr.map(normaliseProvider),
    roles: rolesArr.map(normaliseRole),
  };
}

export function getProviderOrThrow(brain: ApiBrain, providerId: string): ProviderEndpointConfig {
  const p = brain.providers.find((x) => x.id === providerId);
  if (!p) throw new Error(`Unknown provider "${providerId}"`);
  return p;
}

export function getRoleOrThrow(brain: ApiBrain, roleId: string): RolePolicy {
  const r = brain.roles.find((x) => x.id === roleId);
  if (!r) throw new Error(`Unknown role "${roleId}"`);
  return r;
}

export function resolveEndpointForProvider(
  providerId: string,
  brain: ApiBrain,
): ProviderEndpointConfig {
  return getProviderOrThrow(brain, providerId);
}
