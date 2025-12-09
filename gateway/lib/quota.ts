// C:\Users\Proma\Projects\promagen\gateway\lib\quota.ts

import { logInfo } from './logging';

/**
 * Quota handling for providers.
 *
 * This does NOT block calls — it simply logs budget usage
 * so you understand behaviour in dev and production.
 */

interface QuotaState {
  totalCalls: number;
  lastCallAt: number | null;
}

const quotaMap = new Map<string, QuotaState>();

export function applyQuotaAllowance(providerConfig: any): void {
  const id = providerConfig.id;

  let state = quotaMap.get(id);
  if (!state) {
    state = { totalCalls: 0, lastCallAt: null };
  }

  state.totalCalls += 1;
  state.lastCallAt = Date.now();

  quotaMap.set(id, state);

  logInfo(`Quota tick for provider '${id}'`, state);
}
