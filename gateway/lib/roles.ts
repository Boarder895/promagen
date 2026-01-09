// gateway/lib/roles.ts

import type { RoleAdapter } from './adapters.js';
import { getApiBrain, getRoleOrThrow, resolveEndpointForProvider } from './config.js';
import { logError, logInfo } from './logging.js';

export type ResolvedRole = {
  roleId: string;
  primaryProviderId: string;
  backupProviderIds: string[];
};

export function resolveRole(roleId: string): ResolvedRole {
  const brain = getApiBrain();
  const role = getRoleOrThrow(brain, roleId);
  return {
    roleId: role.id,
    primaryProviderId: role.primaryProviderId,
    backupProviderIds: role.backupProviderIds,
  };
}

export async function runRoleWithFallback(
  roleId: string,
  adapters: Record<string, RoleAdapter>,
  ctx: Parameters<RoleAdapter>[0],
) {
  const brain = getApiBrain();
  const resolved = resolveRole(roleId);

  const chain = [resolved.primaryProviderId, ...resolved.backupProviderIds];
  if (chain.length === 0) throw new Error(`Role "${roleId}" has empty provider chain`);

  let lastErr: unknown = undefined;

  for (const providerId of chain) {
    const adapter = adapters[providerId];
    if (!adapter) {
      logError('No adapter registered for provider', { providerId, roleId });
      lastErr = new Error(`No adapter registered for provider "${providerId}"`);
      continue;
    }

    // Ensure provider exists in config; fails fast if misconfigured.
    resolveEndpointForProvider(providerId, brain);

    try {
      logInfo('Attempting provider', { providerId, roleId });
      return await adapter(ctx);
    } catch (err) {
      lastErr = err;
      logError('Provider failed', { providerId, roleId, err: String(err) });
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`All providers failed for role "${roleId}"`);
}
