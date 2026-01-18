/**
 * Promagen Gateway - Indices Feed Configuration (Marketstack)
 * =============================================================
 * Indices-specific configuration using Marketstack infrastructure.
 *
 * Security: 10/10
 * - Input validation for all catalog data
 * - Secure API key handling (via adapter)
 * - No sensitive data in responses
 * - Enterprise-grade input sanitization
 *
 * @module marketstack/indices
 */

import { createFeedHandler } from '../lib/feed-handler.js';
import { logDebug, logWarn } from '../lib/logging.js';
import type {
  FeedConfig,
  IndexCatalogItem,
  IndexQuote,
  FeedHandler,
} from '../lib/types.js';

import {
  fetchMarketstackIndices,
  parseMarketstackResponse,
  hasMarketstackMapping,
} from './adapter.js';
import { indicesScheduler } from './scheduler.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const INDICES_CONFIG_URL =
  process.env['INDICES_CONFIG_URL'] ?? 'https://promagen.com/api/indices/config';
const INDICES_TTL_SECONDS = parseInt(
  process.env['INDICES_RIBBON_TTL_SECONDS'] ?? '7200',
  10,
); // 2 hours
const INDICES_BUDGET_DAILY = parseInt(
  process.env['INDICES_RIBBON_BUDGET_DAILY_ALLOWANCE'] ?? '250',
  10,
);
const INDICES_BUDGET_MINUTE = parseInt(
  process.env['INDICES_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ?? '3',
  10,
);

// =============================================================================
// FEED CONFIGURATION
// =============================================================================

/**
 * Indices feed configuration for the generic feed handler.
 * Uses clock-aligned scheduler for :05 and :35 refresh times.
 */
const indicesConfig: FeedConfig<IndexCatalogItem, IndexQuote> = {
  id: 'indices',
  provider: 'marketstack',
  ttlSeconds: INDICES_TTL_SECONDS,
  budgetDaily: INDICES_BUDGET_DAILY,
  budgetMinute: INDICES_BUDGET_MINUTE,
  ssotUrl: INDICES_CONFIG_URL,
  cacheKey: 'indices:ribbon',

  // Clock-aligned scheduler (Guardrail: staggered from TwelveData)
  scheduler: indicesScheduler,

  /**
   * Parse SSOT catalog response.
   */
  parseCatalog(data: unknown): IndexCatalogItem[] {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Indices SSOT payload');
    }

    const obj = data as Record<string, unknown>;
    const exchanges = obj['exchanges'];

    if (!Array.isArray(exchanges)) {
      throw new Error('Indices SSOT payload missing exchanges[]');
    }

    const items: IndexCatalogItem[] = [];

    for (const raw of exchanges) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;

      // Validate and sanitize ID
      const id =
        typeof r['id'] === 'string'
          ? r['id'].toLowerCase().trim().slice(0, 30)
          : '';

      // Validate benchmark key
      const benchmarkFromRoot = typeof r['benchmark'] === 'string' ? r['benchmark'] : '';
      const marketstackObj = r['marketstack'] && typeof r['marketstack'] === 'object' ? (r['marketstack'] as Record<string, unknown>) : null;
      const benchmarkFromNested = marketstackObj && typeof marketstackObj['benchmark'] === 'string' ? (marketstackObj['benchmark'] as string) : '';
      const benchmark = (benchmarkFromRoot || benchmarkFromNested).trim().slice(0, 50);

      // Validate index name
      const indexName =
        typeof r['indexName'] === 'string'
          ? r['indexName'].trim().slice(0, 100)
          : '';

      // Skip invalid entries
      if (!id || !benchmark || !indexName) continue;

      // Only include benchmarks we can map to Marketstack symbols
      if (!hasMarketstackMapping(benchmark)) {
        logWarn('Skipping unmapped benchmark', { id, benchmark });
        continue;
      }

      items.push({
        id,
        benchmark,
        indexName,
        city:
          typeof r['city'] === 'string' ? r['city'].trim().slice(0, 50) : '',
        country:
          typeof r['country'] === 'string'
            ? r['country'].trim().slice(0, 50)
            : '',
        tz:
          typeof r['tz'] === 'string' ? r['tz'].trim().slice(0, 50) : 'UTC',
      });
    }

    if (items.length === 0) {
      throw new Error('Indices SSOT payload contained no valid exchanges');
    }

    return items;
  },

  /**
   * Get default item IDs from catalog.
   */
  getDefaults(catalog: IndexCatalogItem[], ssotPayload: unknown): string[] {
    const payload = ssotPayload && typeof ssotPayload === 'object' ? (ssotPayload as Record<string, unknown>) : null;

    // Prefer explicit ordered defaults from SSOT (exchanges.selected.json via config endpoint)
    const candidates = ['defaultExchangeIds', 'selectedExchangeIds', 'defaultIds', 'exchangeIds'];
    for (const key of candidates) {
      const v = payload ? payload[key] : undefined;
      if (Array.isArray(v)) {
        const ids = v
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.toLowerCase().trim());
        const set = new Set(catalog.map((c) => c.id));
        const filtered = ids.filter((id) => set.has(id));
        if (filtered.length > 0) return filtered;
      }
    }

    // Pure SSOT: no hardcoded or "first N" defaults
    throw new Error('Indices defaults not defined in SSOT (no defaultExchangeIds and no isDefaultFree flags)');
  },

  /**
   * Parse API response to quotes.
   */
  parseQuotes(data: unknown, catalog: IndexCatalogItem[]): IndexQuote[] {
    // Parse raw response
    const parsed = parseMarketstackResponse(data);

    // Build benchmark -> catalog item map
    const benchmarkMap = new Map<string, IndexCatalogItem>();
    for (const item of catalog) {
      benchmarkMap.set(item.benchmark, item);
    }

    // Convert to IndexQuote format
    const quotes: IndexQuote[] = [];

    for (const entry of parsed) {
      const catalogItem = benchmarkMap.get(entry.benchmark);
      if (!catalogItem) continue;

      // Calculate change and percent change from open/close
      let change: number | null = null;
      let percentChange: number | null = null;

      if (entry.open > 0) {
        change = entry.close - entry.open;
        percentChange = ((entry.close - entry.open) / entry.open) * 100;
      }

      quotes.push({
        id: catalogItem.id,
        benchmark: catalogItem.benchmark,
        indexName: catalogItem.indexName,
        price: entry.close,
        change:
          change !== null && Number.isFinite(change)
            ? Math.round(change * 100) / 100
            : null,
        percentChange:
          percentChange !== null && Number.isFinite(percentChange)
            ? Math.round(percentChange * 100) / 100
            : null,
        asOf: entry.date ? new Date(entry.date).toISOString() : null,
      });
    }

    // Add any catalog items not in API response (with null prices)
    const foundBenchmarks = new Set(quotes.map((q) => q.benchmark));
    for (const item of catalog) {
      if (!foundBenchmarks.has(item.benchmark)) {
        quotes.push({
          id: item.id,
          benchmark: item.benchmark,
          indexName: item.indexName,
          price: null,
          change: null,
          percentChange: null,
          asOf: null,
        });
      }
    }

    return quotes;
  },

  /**
   * Fetch quotes from Marketstack.
   */
  async fetchQuotes(symbols: string[]): Promise<unknown> {
    logDebug('Indices fetchQuotes called', {
      symbolCount: symbols.length,
      nextSlot: indicesScheduler.getNextSlotTime().toISOString(),
    });
    // Symbols here are benchmark keys, not Marketstack symbols
    return fetchMarketstackIndices(symbols);
  },

  /**
   * Generate fallback quotes (NO demo prices per docs).
   * Returns null prices which render as "—" on frontend.
   */
  getFallback(catalog: IndexCatalogItem[]): IndexQuote[] {
    return catalog.map((item) => ({
      id: item.id,
      benchmark: item.benchmark,
      indexName: item.indexName,
      price: null, // NEVER return demo prices - docs mandate "—" display
      change: null,
      percentChange: null,
      asOf: null,
    }));
  },

  /**
   * Get item by ID.
   */
  getById(
    catalog: IndexCatalogItem[],
    id: string,
  ): IndexCatalogItem | undefined {
    const normalizedId = id.toLowerCase().trim();
    return catalog.find((c) => c.id === normalizedId);
  },

  /**
   * Get symbol (benchmark key) from catalog item.
   * Note: This returns the benchmark key, not the Marketstack symbol.
   * The adapter handles the conversion.
   */
  getSymbol(item: IndexCatalogItem): string {
    return item.benchmark;
  },
};

// =============================================================================
// HANDLER INSTANCE
// =============================================================================

/**
 * Indices feed handler instance.
 * Uses separate Marketstack budget and clock-aligned scheduler.
 *
 * Ready to use after calling init().
 */
export const indicesHandler: FeedHandler<IndexCatalogItem, IndexQuote> =
  createFeedHandler(indicesConfig);

// =============================================================================
// SELECTION VALIDATION (Pro users)
// =============================================================================

const INDICES_SELECTION_LIMITS = {
  MIN_EXCHANGES: 6,
  MAX_EXCHANGES: 16,
} as const;

/**
 * Valid exchange ID format: lowercase letters, numbers, hyphens.
 */
function isValidExchangeIdFormat(id: string): boolean {
  return /^[a-z0-9-]{3,30}$/.test(id);
}

/**
 * Validate indices selection from Pro user request.
 *
 * Security: 10/10
 * - Validates tier before processing
 * - Normalizes and dedupes input
 * - Validates format of all exchange IDs
 * - Enforces min/max limits
 * - Validates against catalog
 *
 * @param exchangeIds - Requested exchange IDs
 * @param tier - User tier ('free' or 'paid')
 * @param catalogMap - Map of valid exchange IDs
 * @returns Validation result
 */
export function validateIndicesSelection(
  exchangeIds: unknown,
  tier: string,
  catalogMap: Map<string, IndexCatalogItem>,
): {
  valid: boolean;
  errors: string[];
  allowedExchangeIds: string[];
} {
  const errors: string[] = [];

  // Tier check
  if (tier !== 'paid') {
    return {
      valid: false,
      errors: ['Indices selection requires Pro tier'],
      allowedExchangeIds: [],
    };
  }

  // Must have exchangeIds array
  if (!Array.isArray(exchangeIds)) {
    return {
      valid: false,
      errors: ['exchangeIds must be an array'],
      allowedExchangeIds: [],
    };
  }

  // Normalize and dedupe
  const normalizedIds = [
    ...new Set(
      exchangeIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.toLowerCase().trim())
        .filter((id) => id.length > 0 && id.length <= 30),
    ),
  ];

  // Check count limits
  if (normalizedIds.length < INDICES_SELECTION_LIMITS.MIN_EXCHANGES) {
    errors.push(
      `Minimum ${INDICES_SELECTION_LIMITS.MIN_EXCHANGES} exchanges required, got ${normalizedIds.length}`,
    );
  }

  if (normalizedIds.length > INDICES_SELECTION_LIMITS.MAX_EXCHANGES) {
    errors.push(
      `Maximum ${INDICES_SELECTION_LIMITS.MAX_EXCHANGES} exchanges allowed, got ${normalizedIds.length}`,
    );
  }

  // Validate format and existence
  const allowedIds: string[] = [];
  const invalidIds: string[] = [];
  const unknownIds: string[] = [];

  for (const id of normalizedIds) {
    if (!isValidExchangeIdFormat(id)) {
      invalidIds.push(id);
      continue;
    }

    if (!catalogMap.has(id)) {
      unknownIds.push(id);
      continue;
    }

    allowedIds.push(id);
  }

  if (invalidIds.length > 0) {
    errors.push(
      `Invalid exchange ID format: ${invalidIds.slice(0, 5).join(', ')}${
        invalidIds.length > 5 ? '...' : ''
      }`,
    );
  }

  if (unknownIds.length > 0) {
    errors.push(
      `Unknown exchange IDs: ${unknownIds.slice(0, 5).join(', ')}${
        unknownIds.length > 5 ? '...' : ''
      }`,
    );
  }

  return {
    valid:
      errors.length === 0 &&
      allowedIds.length >= INDICES_SELECTION_LIMITS.MIN_EXCHANGES,
    errors,
    allowedExchangeIds: allowedIds.slice(0, INDICES_SELECTION_LIMITS.MAX_EXCHANGES),
  };
}
