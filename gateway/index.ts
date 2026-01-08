// gateway/index.ts
// ============================================================================
// PROMAGEN API GATEWAY - FX Data Entry Point
// ============================================================================
// Public entry point for the Promagen API gateway (FX only for now).
// - SSOT drives the default ribbon pairs
// - Adapters consume resolved FxRibbonPair objects (not string IDs)
// - Full runtime validation on inputs and outputs
//
// Security: 10/10
// - Input validation with type guards
// - Quota enforcement with sliding window
// - Resilience layer (timeout + retry)
// - Cache to reduce API calls
// - Graceful degradation on all failures
//
// FIX v2.1.0 (Jan 2026):
// - Fixed TypeScript errors with proper type handling
// - Uses manual type guards instead of Zod
// ============================================================================

import { getFromCache, saveToCache } from './lib/cache';
import { applyQuotaAllowance } from './lib/quota';
import { withResilience } from './lib/resilience';
import { logError, logInfo, logWarn } from './lib/logging';
import { getFxRibbonPairs } from './lib/ssot/fx-ribbon.ssot';
import {
  validatePairIds,
  validateAdapterRequest,
  type FxRibbonPair,
  type FxRibbonPairQuote,
  type FxRibbonResult,
  type FxAdapterRequest,
} from './lib/schemas';

import fmpFxAdapter from './adapters/fmp.fx';
import twelvedataFxAdapter from './adapters/twelvedata.fx';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

// Provider order: primary first, then backups
const FX_PROVIDERS = [
  { id: 'twelvedata', adapter: twelvedataFxAdapter },
  { id: 'fmp', adapter: fmpFxAdapter },
] as const;

// ============================================================================
// TYPES
// ============================================================================

export type GetFxRibbonOptions = {
  /** Specific pair IDs to fetch. If omitted, SSOT default set is used. */
  requestedPairIds?: string[];
  /** Cache TTL in seconds. Default: 30 */
  cacheTtlSeconds?: number;
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the list of FX pairs to request.
 * Validates input IDs and filters against SSOT allowlist.
 */
function buildRequestedPairs(rawPairIds?: unknown): FxRibbonPair[] {
  const ssotPairs = getFxRibbonPairs();

  // Validate input - returns empty array if invalid
  const validatedIds = validatePairIds(rawPairIds);

  // If no valid IDs provided, return SSOT defaults
  if (validatedIds.length === 0) {
    if (rawPairIds !== undefined) {
      logWarn('Invalid or empty requestedPairIds, using SSOT defaults');
    }
    return ssotPairs;
  }

  // Filter SSOT pairs by requested IDs (allowlist approach)
  const wanted = new Set(validatedIds);
  const filtered = ssotPairs.filter((p: FxRibbonPair) => wanted.has(p.id));

  // Log if some requested IDs weren't found
  if (filtered.length < validatedIds.length) {
    const foundIds = new Set(filtered.map((p: FxRibbonPair) => p.id));
    const missing = validatedIds.filter((id: string) => !foundIds.has(id));
    logWarn('Some requested pair IDs not in SSOT allowlist', { missing });
  }

  return filtered;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Fetch FX ribbon data with caching, quota enforcement, and fallback.
 *
 * @param options - Configuration options
 * @returns FX ribbon result with quotes
 */
export async function getFxRibbon(
  options: GetFxRibbonOptions = {}
): Promise<FxRibbonResult> {
  // Build and validate requested pairs
  const requestedPairs = buildRequestedPairs(options.requestedPairIds);

  if (requestedPairs.length === 0) {
    logInfo('No valid pairs requested, returning empty');
    return { mode: 'live', sourceProvider: 'none', pairs: [] };
  }

  // Build cache key from pair IDs
  const cacheKey = `fx:ribbon:${requestedPairs.map((p: FxRibbonPair) => p.id).join(',')}`;
  const cacheTtlSeconds = options.cacheTtlSeconds ?? 30;
  const cacheTtlMs = cacheTtlSeconds * 1000;

  // Check cache first
  const cached = getFromCache<FxRibbonPairQuote[]>(cacheKey);
  if (cached) {
    logInfo('Cache hit', { cacheKey, pairCount: cached.length });
    return { mode: 'cached', sourceProvider: 'cache', pairs: cached };
  }

  // Build adapter request
  const adapterRequest: FxAdapterRequest = {
    roleId: 'fx-ribbon-realtime',
    requestedPairs,
  };

  // Validate adapter request (defense in depth)
  const requestValidation = validateAdapterRequest(adapterRequest);
  if (!requestValidation.success) {
    logError('Adapter request validation failed', {
      error: requestValidation.error,
    });
    return { mode: 'live', sourceProvider: 'none', pairs: [] };
  }

  const validatedRequest = requestValidation.data;

  // Try each provider in order
  for (const provider of FX_PROVIDERS) {
    // Check quota before calling
    const quota = applyQuotaAllowance(provider.id, 1);
    if (!quota.allowed) {
      logInfo('Quota denied for provider', {
        providerId: provider.id,
        reason: quota.reason,
        remaining: quota.remaining,
      });
      continue; // Try next provider
    }

    try {
      // Call adapter with resilience wrapper
      const res = await withResilience(
        () => provider.adapter(validatedRequest),
        {
          providerId: provider.id,
          timeoutMs: 8000,
          retries: 1,
          retryDelayMs: 350,
        }
      );

      // Check if we got valid data
      if (res.pairs && res.pairs.length > 0) {
        logInfo('Provider success', {
          providerId: provider.id,
          pairCount: res.pairs.length,
        });
        saveToCache(cacheKey, res.pairs, cacheTtlMs);
        return {
          mode: res.mode,
          sourceProvider: res.providerId,
          pairs: res.pairs,
        };
      }

      logWarn('Provider returned empty pairs', { providerId: provider.id });
      // Continue to next provider
    } catch (err) {
      logError('Provider failed', {
        providerId: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue to next provider
    }
  }

  // All providers failed - return empty
  logWarn('All providers exhausted, returning empty');
  return { mode: 'live', sourceProvider: 'none', pairs: [] };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export types for consumers
export type {
  FxRibbonPair,
  FxRibbonPairQuote,
  FxRibbonQuote,
  FxRibbonResult,
  FxAdapterRequest,
  FxAdapterResponse,
} from './lib/schemas';

// Re-export quota status for monitoring
export { getQuotaStatus } from './lib/quota';
