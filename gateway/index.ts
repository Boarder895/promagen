// C:\Users\Proma\Projects\promagen\gateway\index.ts
// Public entry point for the Promagen API gateway (FX only for now).
// - Demo adapter removed.
// - SSOT drives the default ribbon pairs.
// - Adapters consume resolved FxRibbonPair objects (not string IDs).

import { getFromCache, saveToCache } from './lib/cache';
import { applyQuotaAllowance } from './lib/quota';
import { withResilience } from './lib/resilience';
import { logError, logInfo } from './lib/logging';

import type { FxRibbonPair, FxRibbonPairQuote, FxRibbonResult } from './lib/types';
import { getFxRibbonPairs } from './lib/ssot/fx-ribbon.ssot';

import fmpFxAdapter from './adapters/fmp.fx';
import twelvedataFxAdapter from './adapters/twelvedata.fx';

// Provider order: primary first, then backups.
const FX_PROVIDERS = [
  { id: 'twelvedata', adapter: twelvedataFxAdapter },
  { id: 'fmp', adapter: fmpFxAdapter },
] as const;

export type GetFxRibbonOptions = {
  requestedPairIds?: string[]; // if omitted, SSOT default set is used
  cacheTtlSeconds?: number;
};

function buildRequestedPairs(requestedPairIds?: string[]): FxRibbonPair[] {
  const ssotPairs = getFxRibbonPairs();

  if (!requestedPairIds || requestedPairIds.length === 0) return ssotPairs;

  const wanted = new Set(requestedPairIds);
  return ssotPairs.filter((p) => wanted.has(p.id));
}

export async function getFxRibbon(options: GetFxRibbonOptions = {}): Promise<FxRibbonResult> {
  const requestedPairs = buildRequestedPairs(options.requestedPairIds);

  if (requestedPairs.length === 0) {
    return { mode: 'live', sourceProvider: 'none', pairs: [] };
  }

  const cacheKey = `fx:ribbon:${requestedPairs.map((p) => p.id).join(',')}`;
  const cacheTtlSeconds = options.cacheTtlSeconds ?? 30;
  const cacheTtlMs = cacheTtlSeconds * 1000;

  const cached = getFromCache<FxRibbonPairQuote[]>(cacheKey);
  if (cached) {
    return { mode: 'cached', sourceProvider: 'cache', pairs: cached };
  }

  for (const provider of FX_PROVIDERS) {
    // Quota: for multi-symbol quote calls this is 1 unit (1 HTTP request).
    const quota = applyQuotaAllowance(provider.id, 1);
    if (!quota.allowed) {
      logInfo('Quota denied for provider', { providerId: provider.id, reason: quota.reason });
      continue;
    }

    try {
      const res = await withResilience(
        () =>
          provider.adapter({
            roleId: 'fx-ribbon-realtime',
            requestedPairs,
          }),
        {
          providerId: provider.id,
          timeoutMs: 8000,
          retries: 1,
          retryDelayMs: 350,
        },
      );

      if (res.pairs && res.pairs.length > 0) {
        saveToCache(cacheKey, res.pairs, cacheTtlMs);
        return { mode: res.mode, sourceProvider: res.providerId, pairs: res.pairs };
      }
    } catch (err) {
      logError('Provider failed', { providerId: provider.id, err });
      // keep trying backups
    }
  }

  // Nothing worked: return empty (caller decides UI behaviour).
  return { mode: 'live', sourceProvider: 'none', pairs: [] };
}

// Re-export gateway types for consumers.
export type * from './lib/types';
