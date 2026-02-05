/**
 * Promagen Gateway - FX Feed Configuration (TwelveData)
 * =======================================================
 * FX-specific configuration using shared TwelveData infrastructure.
 *
 * v3.1: BOTH ROWS ALWAYS POPULATED
 * - Top row (pairs 0-4): EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY
 * - Bottom row (pairs 5-9): USD/INR, USD/BRL, USD/AUD, USD/NOK, USD/MYR
 * - Startup: Top row fetches immediately, bottom row after 1 minute
 * - After startup: Each row refreshes hourly (alternating)
 * - Total: ~120 API calls/day
 *
 * CRITICAL FIX: rowQuoteCache now properly stores and merges both rows.
 * getData() returns ALL 10 pairs, not just the last-fetched row.
 *
 * Security: 10/10
 * - Input validation for all catalog data
 * - Secure API key handling (via adapter)
 * - No sensitive data in responses
 * - Enterprise-grade input sanitization
 *
 * @module twelvedata/fx
 */

import { createFeedHandler } from '../lib/feed-handler.js';
import { logInfo, logDebug, logWarn } from '../lib/logging.js';
import type { FeedConfig, FxPair, FxQuote, FeedHandler } from '../lib/types.js';

import { fetchTwelveDataPrices, parseFxPriceResponse, buildFxSymbol } from './adapter.js';
import {
  fxScheduler,
  getCurrentFxRow,
  getFxRowIndices,
  recordFxRowRefresh,
  getFxRowState,
  getMsUntilSecondRowFetch,
  type FxRow,
} from './scheduler.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FX_CONFIG_URL = process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';
const FX_TTL_SECONDS = parseInt(process.env['FX_RIBBON_TTL_SECONDS'] ?? '3600', 10); // 1 hour TTL
const FX_BUDGET_DAILY = parseInt(process.env['FX_RIBBON_BUDGET_DAILY_ALLOWANCE'] ?? '800', 10);
const FX_BUDGET_MINUTE = parseInt(process.env['FX_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ?? '8', 10);

// =============================================================================
// ROW-AWARE QUOTE CACHE (CRITICAL: This persists both rows)
// =============================================================================

/**
 * Separate cache for each row's quotes.
 * This allows us to return ALL 10 pairs even when only one row was just refreshed.
 */
interface RowQuoteCache {
  top: { quotes: FxQuote[]; fetchedAt: Date | null };
  bottom: { quotes: FxQuote[]; fetchedAt: Date | null };
}

const rowQuoteCache: RowQuoteCache = {
  top: { quotes: [], fetchedAt: null },
  bottom: { quotes: [], fetchedAt: null },
};

/**
 * Update the cache for a specific row.
 * Called after each successful fetch.
 */
export function updateRowCache(row: FxRow, quotes: FxQuote[]): void {
  rowQuoteCache[row].quotes = quotes;
  rowQuoteCache[row].fetchedAt = new Date();

  logDebug('Row cache updated', {
    row,
    quoteCount: quotes.length,
    pairIds: quotes.map((q) => q.id),
    fetchedAt: rowQuoteCache[row].fetchedAt?.toISOString(),
  });
}

/**
 * Get cached quotes for a specific row.
 */
export function getCachedRowQuotes(row: FxRow): FxQuote[] {
  return rowQuoteCache[row].quotes;
}

/**
 * Get all cached quotes (both rows combined).
 * This is the key function that ensures both rows are always returned.
 */
export function getAllCachedQuotes(): FxQuote[] {
  return [...rowQuoteCache.top.quotes, ...rowQuoteCache.bottom.quotes];
}

/**
 * Check if both rows have been populated at least once.
 */
export function areBothRowsPopulated(): boolean {
  return rowQuoteCache.top.quotes.length > 0 && rowQuoteCache.bottom.quotes.length > 0;
}

/**
 * Get cache status for trace/debug.
 */
export function getRowCacheStatus(): Record<string, unknown> {
  return {
    top: {
      quoteCount: rowQuoteCache.top.quotes.length,
      fetchedAt: rowQuoteCache.top.fetchedAt?.toISOString() ?? null,
      pairIds: rowQuoteCache.top.quotes.map((q) => q.id),
    },
    bottom: {
      quoteCount: rowQuoteCache.bottom.quotes.length,
      fetchedAt: rowQuoteCache.bottom.fetchedAt?.toISOString() ?? null,
      pairIds: rowQuoteCache.bottom.quotes.map((q) => q.id),
    },
    totalQuotes: rowQuoteCache.top.quotes.length + rowQuoteCache.bottom.quotes.length,
    bothRowsPopulated: areBothRowsPopulated(),
  };
}

// =============================================================================
// CATALOG CACHE (for building symbols from pair IDs)
// =============================================================================

let catalogCache: FxPair[] = [];

function setCatalogCache(catalog: FxPair[]): void {
  catalogCache = catalog;
}

function _getCatalogCache(): FxPair[] {
  return catalogCache;
}

// =============================================================================
// FEED CONFIGURATION
// =============================================================================

/**
 * FX feed configuration for the generic feed handler.
 * Uses clock-aligned scheduler with startup sequence + row alternation.
 */
const fxConfig: FeedConfig<FxPair, FxQuote> = {
  id: 'fx',
  provider: 'twelvedata',
  ttlSeconds: FX_TTL_SECONDS,
  budgetDaily: FX_BUDGET_DAILY,
  budgetMinute: FX_BUDGET_MINUTE,
  ssotUrl: FX_CONFIG_URL,
  cacheKey: 'fx:ribbon',

  // Clock-aligned scheduler with startup sequence
  scheduler: fxScheduler,

  /**
   * Parse SSOT catalog response.
   */
  parseCatalog(data: unknown): FxPair[] {
    if (!data || typeof data !== 'object') throw new Error('Invalid FX SSOT payload');

    const obj = data as Record<string, unknown>;
    let pairsArray: unknown[] = [];

    // Handle various response shapes
    if (Array.isArray(obj['pairs'])) {
      pairsArray = obj['pairs'];
    } else if (Array.isArray(obj['data'])) {
      pairsArray = obj['data'];
    } else if (Array.isArray(data)) {
      pairsArray = data as unknown[];
    }

    const pairs: FxPair[] = [];

    for (const item of pairsArray) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Record<string, unknown>;

      // Validate and sanitize ID
      const id = typeof raw['id'] === 'string' ? raw['id'].toLowerCase().trim().slice(0, 20) : '';

      // Validate currency codes (must be 3 uppercase letters)
      const base =
        typeof raw['base'] === 'string' ? raw['base'].toUpperCase().trim().slice(0, 3) : '';
      const quote =
        typeof raw['quote'] === 'string' ? raw['quote'].toUpperCase().trim().slice(0, 3) : '';

      // Skip invalid entries
      if (!id || !base || !quote) continue;
      if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) continue;

      pairs.push({
        id,
        base,
        quote,
        label: typeof raw['label'] === 'string' ? raw['label'].trim().slice(0, 50) : undefined,
        precision:
          typeof raw['precision'] === 'number' && raw['precision'] >= 0 && raw['precision'] <= 8
            ? raw['precision']
            : undefined,
        isDefaultFree: typeof raw['isDefaultFree'] === 'boolean' ? raw['isDefaultFree'] : undefined,
        isDefaultPaid: typeof raw['isDefaultPaid'] === 'boolean' ? raw['isDefaultPaid'] : undefined,
      });
    }

    if (pairs.length === 0) throw new Error('FX SSOT payload contained no valid pairs');

    // Cache the catalog for later symbol building
    setCatalogCache(pairs);

    return pairs;
  },

  /**
   * Get default pair IDs from catalog.
   */
  getDefaults(catalog: FxPair[], ssotPayload: unknown): string[] {
    // Prefer explicit ordered default IDs if the frontend provides them
    const payload =
      ssotPayload && typeof ssotPayload === 'object'
        ? (ssotPayload as Record<string, unknown>)
        : null;
    const candidates = ['defaultPairIds', 'defaultPairs', 'defaultIds', 'pairIds'];
    for (const key of candidates) {
      const v = payload ? payload[key] : undefined;
      if (Array.isArray(v)) {
        const ids = v
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.toLowerCase().trim());
        const set = new Set(catalog.map((p) => p.id));
        const filtered = ids.filter((id) => set.has(id));
        if (filtered.length > 0) return filtered;
      }
    }

    // Otherwise use SSOT flags in catalog (order preserved)
    const flagged = catalog.filter((p) => p.isDefaultFree === true).map((p) => p.id);
    if (flagged.length > 0) return flagged;

    // Pure SSOT: no hardcoded or "first N" defaults
    throw new Error('FX defaults not defined in SSOT (no default IDs or isDefaultFree flags)');
  },

  /**
   * Parse API response to quotes AND update row cache.
   */
  parseQuotes(data: unknown, catalog: FxPair[]): FxQuote[] {
    // Build symbol -> pair map
    const symbolToIdMap = new Map<string, { id: string; base: string; quote: string }>();
    for (const pair of catalog) {
      symbolToIdMap.set(buildFxSymbol(pair.base, pair.quote), {
        id: pair.id,
        base: pair.base,
        quote: pair.quote,
      });
    }

    // Parse response
    const parsed = parseFxPriceResponse(data, symbolToIdMap);

    // Convert to FxQuote format
    const quotes = parsed.map((entry) => ({
      id: entry.id,
      base: entry.base,
      quote: entry.quote,
      symbol: entry.symbol,
      price: entry.price,
    }));

    // CRITICAL FIX: Determine row from ACTUAL pair IDs received, not scheduler state
    // The scheduler state may have already advanced by the time parseQuotes is called
    const receivedPairIds = new Set(quotes.map((q) => q.id));

    // Get expected pair IDs for each row
    const topRowIndices = getFxRowIndices('top');
    const bottomRowIndices = getFxRowIndices('bottom');
    const topRowPairIds = catalog.slice(topRowIndices.start, topRowIndices.end).map((p) => p.id);
    const bottomRowPairIds = catalog
      .slice(bottomRowIndices.start, bottomRowIndices.end)
      .map((p) => p.id);

    // Count matches for each row
    const topMatchCount = topRowPairIds.filter((id) => receivedPairIds.has(id)).length;
    const bottomMatchCount = bottomRowPairIds.filter((id) => receivedPairIds.has(id)).length;

    // Determine which row this data belongs to based on best match
    let detectedRow: FxRow;
    if (topMatchCount > bottomMatchCount) {
      detectedRow = 'top';
    } else if (bottomMatchCount > topMatchCount) {
      detectedRow = 'bottom';
    } else {
      // Equal matches - use scheduler state as tiebreaker (but this shouldn't happen)
      detectedRow = getCurrentFxRow();
      logWarn('parseQuotes: Equal row matches, using scheduler state as tiebreaker', {
        topMatchCount,
        bottomMatchCount,
        schedulerRow: detectedRow,
      });
    }

    // Update the cache for the detected row
    if (topMatchCount >= 3 || bottomMatchCount >= 3) {
      updateRowCache(detectedRow, quotes);
      logInfo('Row cache updated after fetch (detected from pair IDs)', {
        detectedRow,
        topMatchCount,
        bottomMatchCount,
        receivedPairs: Array.from(receivedPairIds),
      });
    } else {
      logWarn('Received quotes do not match either row well', {
        topMatchCount,
        bottomMatchCount,
        topRowPairIds,
        bottomRowPairIds,
        receivedPairIds: Array.from(receivedPairIds),
      });
    }

    // CRITICAL: Return ALL cached quotes from both rows
    // This ensures getData() returns all 10 pairs, not just the last 5 fetched
    const allCachedQuotes = getAllCachedQuotes();

    if (allCachedQuotes.length > 0) {
      logInfo('Returning merged quotes from both rows', {
        topRowCount: rowQuoteCache.top.quotes.length,
        bottomRowCount: rowQuoteCache.bottom.quotes.length,
        totalCount: allCachedQuotes.length,
      });
      return allCachedQuotes;
    }

    // Fallback: return just the parsed quotes if cache is empty
    return quotes;
  },

  /**
   * Fetch quotes from TwelveData with ROW ALTERNATION.
   * Only fetches the current row's pairs (top 5 or bottom 5).
   */
  async fetchQuotes(symbols: string[]): Promise<unknown> {
    // Determine which row to fetch based on scheduler state
    const currentRow = getCurrentFxRow();
    const { start, end } = getFxRowIndices(currentRow);

    // Slice symbols for current row only
    const rowSymbols = symbols.slice(start, end);

    const rowState = getFxRowState();
    logInfo('FX fetchQuotes with row alternation', {
      currentRow,
      totalSymbols: symbols.length,
      rowSymbols: rowSymbols.length,
      rowIndices: { start, end },
      symbols: rowSymbols,
      startupComplete: rowState.startupComplete,
      nextSlot: fxScheduler.getNextSlotTime().toISOString(),
    });

    // Record this row refresh
    recordFxRowRefresh(currentRow);

    // Fetch only the current row's symbols
    const data = await fetchTwelveDataPrices(rowSymbols);

    return data;
  },

  /**
   * Generate fallback quotes (NO demo prices per docs).
   * Returns null prices which render as "—" on frontend.
   */
  getFallback(catalog: FxPair[]): FxQuote[] {
    return catalog.map((pair) => ({
      id: pair.id,
      base: pair.base,
      quote: pair.quote,
      symbol: buildFxSymbol(pair.base, pair.quote),
      price: null, // NEVER return demo prices - docs mandate "—" display
    }));
  },

  /**
   * Get pair by ID.
   */
  getById(catalog: FxPair[], id: string): FxPair | undefined {
    const normalizedId = id.toLowerCase().trim();
    return catalog.find((p) => p.id === normalizedId);
  },

  /**
   * Get TwelveData symbol from pair.
   */
  getSymbol(pair: FxPair): string {
    return buildFxSymbol(pair.base, pair.quote);
  },
};

// =============================================================================
// HANDLER INSTANCE
// =============================================================================

/**
 * FX feed handler instance.
 * Uses shared TwelveData budget and clock-aligned scheduler with row alternation.
 *
 * Row schedule (v3.1):
 * - T+0 (startup): Top row (EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY)
 * - T+1 min: Bottom row (USD/INR, USD/BRL, USD/AUD, USD/NOK, USD/MYR)
 * - T+1 hour: Top row refreshes
 * - T+2 hours: Bottom row refreshes
 * - Continues alternating hourly...
 *
 * Ready to use after calling init().
 */
export const fxHandler: FeedHandler<FxPair, FxQuote> = createFeedHandler(fxConfig);

// =============================================================================
// EXTENDED TRACE INFO (for debugging row alternation)
// =============================================================================

/**
 * Get extended trace info including row state and cache status.
 */
export function getFxTraceInfoWithRows(): Record<string, unknown> {
  const baseTrace = fxHandler.getTraceInfo();
  const rowState = getFxRowState();
  const currentRow = getCurrentFxRow();
  const cacheStatus = getRowCacheStatus();

  return {
    ...baseTrace,
    rowAlternation: {
      enabled: true,
      currentRow,
      lastRefreshedRow: rowState.lastRefreshedRow,
      lastRefreshTime: rowState.lastRefreshTime?.toISOString() ?? null,
      startupComplete: rowState.startupComplete,
      startupTime: rowState.startupTime?.toISOString() ?? null,
      topRowFetchedAtStartup: rowState.topRowFetchedAtStartup,
      bottomRowFetchedAtStartup: rowState.bottomRowFetchedAtStartup,
      topRowPairs: '0-4 (EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY)',
      bottomRowPairs: '5-9 (USD/INR, USD/BRL, USD/AUD, USD/NOK, USD/MYR)',
      schedule: 'Startup: both rows within 1 min. Then: hourly alternation',
      apiCallsPerDay: '~120 (5 pairs × 12 calls × 2 rows)',
    },
    rowCache: cacheStatus,
    bothRowsPopulated: areBothRowsPopulated(),
  };
}

// =============================================================================
// STARTUP HELPER (for triggering second row fetch)
// =============================================================================

/**
 * Check if the second row fetch should be triggered.
 * Call this periodically during startup to trigger the bottom row fetch.
 */
export function shouldFetchSecondRow(): boolean {
  const rowState = getFxRowState();
  if (rowState.startupComplete) return false;
  if (!rowState.topRowFetchedAtStartup) return false;
  if (rowState.bottomRowFetchedAtStartup) return false;

  const msUntil = getMsUntilSecondRowFetch();
  return msUntil <= 0;
}

/**
 * Get milliseconds until second row should be fetched.
 * Returns 0 if already fetched or not applicable.
 */
export function getMsUntilSecondRow(): number {
  return getMsUntilSecondRowFetch();
}

// =============================================================================
// SELECTION VALIDATION (Pro users)
// =============================================================================

const FX_SELECTION_LIMITS = {
  MIN_PAIRS: 6,
  MAX_PAIRS: 16,
} as const;

/**
 * ISO 4217 currency code format: exactly 3 uppercase letters
 */
const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

/**
 * Check if a pair ID has valid format (xxx-yyy).
 */
function isValidPairIdFormat(id: string): boolean {
  const parts = id.toUpperCase().split('-');
  if (parts.length !== 2) return false;
  const [base, quote] = parts;
  return (
    CURRENCY_CODE_REGEX.test(base ?? '') && CURRENCY_CODE_REGEX.test(quote ?? '') && base !== quote
  );
}

/**
 * Validate FX selection from Pro user request.
 *
 * Security: 10/10
 * - Validates tier before processing
 * - Normalizes and dedupes input
 * - Validates format of all pair IDs
 * - Enforces min/max limits
 */
export function validateFxSelection(
  pairIds: string[],
  tier: 'free' | 'paid',
  catalogMap: Map<string, FxPair>,
): {
  valid: boolean;
  errors: string[];
  allowedPairIds: string[];
} {
  const errors: string[] = [];

  // Tier check
  if (tier !== 'paid') {
    return {
      valid: false,
      errors: ['FX selection requires Pro tier'],
      allowedPairIds: [],
    };
  }

  // Must have pairIds array
  if (!Array.isArray(pairIds)) {
    return {
      valid: false,
      errors: ['pairIds must be an array'],
      allowedPairIds: [],
    };
  }

  // Normalize and dedupe
  const normalizedIds = [
    ...new Set(
      pairIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.toLowerCase().trim())
        .filter((id) => id.length > 0 && id.length <= 20),
    ),
  ];

  // Check count limits
  if (normalizedIds.length < FX_SELECTION_LIMITS.MIN_PAIRS) {
    errors.push(
      `Minimum ${FX_SELECTION_LIMITS.MIN_PAIRS} pairs required, got ${normalizedIds.length}`,
    );
  }

  if (normalizedIds.length > FX_SELECTION_LIMITS.MAX_PAIRS) {
    errors.push(
      `Maximum ${FX_SELECTION_LIMITS.MAX_PAIRS} pairs allowed, got ${normalizedIds.length}`,
    );
  }

  // Validate format + SSOT membership
  const allowedPairIds: string[] = [];
  const malformedIds: string[] = [];
  const unknownIds: string[] = [];

  for (const id of normalizedIds) {
    if (isValidPairIdFormat(id)) {
      if (catalogMap.has(id)) {
        allowedPairIds.push(id);
      } else {
        unknownIds.push(id);
      }
    } else {
      malformedIds.push(id);
    }
  }

  if (malformedIds.length > 0) {
    errors.push(
      `Malformed pair IDs (expected format: xxx-yyy): ${malformedIds.slice(0, 5).join(', ')}${
        malformedIds.length > 5 ? '...' : ''
      }`,
    );
  }

  if (unknownIds.length > 0) {
    errors.push(
      `Unknown pair IDs (not in SSOT catalog): ${unknownIds.slice(0, 5).join(', ')}${
        unknownIds.length > 5 ? '...' : ''
      }`,
    );
  }

  return {
    valid: errors.length === 0 && allowedPairIds.length >= FX_SELECTION_LIMITS.MIN_PAIRS,
    errors,
    allowedPairIds: allowedPairIds.slice(0, FX_SELECTION_LIMITS.MAX_PAIRS),
  };
}
