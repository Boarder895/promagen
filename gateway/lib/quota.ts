// gateway/lib/quota.ts

import { logInfo } from './logging';

export type QuotaDecision = {
  allowed: boolean;
  reason?: string;
};

/**
 * Placeholder quota logic.
 * Keep the signature explicit so callers must pass both params.
 */
export function applyQuotaAllowance(providerId: string, units: number): QuotaDecision {
  logInfo('quota check', { providerId, units });
  return { allowed: true };
}
