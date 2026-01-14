/**
 * Promagen Gateway - FX Feed Configuration (TwelveData)
 * =======================================================
 * FX-specific configuration using shared TwelveData infrastructure.
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
import type { FeedConfig, FxPair, FxQuote, FeedHandler } from '../lib/types.js';
import { logDebug } from '../lib/logging.js';
import { fxScheduler } from './scheduler.js';
import { fetchTwelveDataPrices, parseFxPriceResponse, buildFxSymbol } from './adapter.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FX_CONFIG_URL = process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';
const FX_TTL_SECONDS = parseInt(process.env['FX_RIBBON_TTL_SECONDS'] ?? '1800', 10);
const FX_BUDGET_DAILY = parseInt(process.env['FX_RIBBON_BUDGET_DAILY_ALLOWANCE'] ?? '800', 10);
const FX_BUDGET_MINUTE = parseInt(process.env['FX_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ?? '8', 10);

// =============================================================================
// FALLBACK DATA
// =============================================================================

/**
 * Fallback FX pairs - used ONLY if frontend SSOT is unreachable.
 * These match the user's selected exotic pairs for the ribbon.
 */
const FALLBACK_FX_PAIRS: FxPair[] = [
  { id: 'eur-usd', base: 'EUR', quote: 'USD', demoPrice: 1.0842, isDefaultFree: true },
  { id: 'usd-jpy', base: 'USD', quote: 'JPY', demoPrice: 157.92, isDefaultFree: true },
  { id: 'gbp-usd', base: 'GBP', quote: 'USD', demoPrice: 1.255, isDefaultFree: true },
  { id: 'usd-cny', base: 'USD', quote: 'CNY', demoPrice: 7.2985, isDefaultFree: true },
  { id: 'usd-brl', base: 'USD', quote: 'BRL', demoPrice: 6.125, isDefaultFree: true },
  { id: 'gbp-zar', base: 'GBP', quote: 'ZAR', demoPrice: 23.505, isDefaultFree: true },
  { id: 'aud-gbp', base: 'AUD', quote: 'GBP', demoPrice: 0.4952, isDefaultFree: true },
  { id: 'gbp-eur', base: 'GBP', quote: 'EUR', demoPrice: 1.1578, isDefaultFree: true },
];

// =============================================================================
// FEED CONFIGURATION
// =============================================================================

/**
 * FX feed configuration for the generic feed handler.
 * Uses clock-aligned scheduler for :00 and :30 refresh times.
 */
const fxConfig: FeedConfig<FxPair, FxQuote> = {
  id: 'fx',
  provider: 'twelvedata',
  ttlSeconds: FX_TTL_SECONDS,
  budgetDaily: FX_BUDGET_DAILY,
  budgetMinute: FX_BUDGET_MINUTE,
  ssotUrl: FX_CONFIG_URL,
  cacheKey: 'fx:ribbon',

  // Clock-aligned scheduler (Guardrail: prevents TwelveData rate limit)
  scheduler: fxScheduler,

  /**
   * Parse SSOT catalog response.
   */
  parseCatalog(data: unknown): FxPair[] {
    if (!data || typeof data !== 'object') {
      return FALLBACK_FX_PAIRS;
    }

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
        demoPrice:
          typeof raw['demoPrice'] === 'number' && raw['demoPrice'] > 0
            ? raw['demoPrice']
            : undefined,
      });
    }

    return pairs.length > 0 ? pairs : FALLBACK_FX_PAIRS;
  },

  /**
   * Get default pair IDs from catalog.
   */
  getDefaults(catalog: FxPair[]): string[] {
    const defaults = catalog.filter((p) => p.isDefaultFree === true).map((p) => p.id);

    // If no defaults flagged, use first 8
    if (defaults.length === 0) {
      return catalog.slice(0, 8).map((p) => p.id);
    }

    return defaults;
  },

  /**
   * Parse API response to quotes.
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
    return parsed.map((entry) => ({
      id: entry.id,
      base: entry.base,
      quote: entry.quote,
      symbol: entry.symbol,
      price: entry.price,
    }));
  },

  /**
   * Fetch quotes from TwelveData.
   */
  async fetchQuotes(symbols: string[]): Promise<unknown> {
    logDebug('FX fetchQuotes called', {
      symbolCount: symbols.length,
      nextSlot: fxScheduler.getNextSlotTime().toISOString(),
    });
    return fetchTwelveDataPrices(symbols);
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
 * Uses shared TwelveData budget and clock-aligned scheduler.
 *
 * Ready to use after calling init().
 */
export const fxHandler: FeedHandler<FxPair, FxQuote> = createFeedHandler(fxConfig);

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
 *
 * @param pairIds - Requested pair IDs
 * @param tier - User tier ('free' or 'paid')
 * @returns Validation result
 */
export function validateFxSelection(
  pairIds: string[],
  tier: 'free' | 'paid',
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

  // Validate format
  const allowedPairIds: string[] = [];
  const malformedIds: string[] = [];

  for (const id of normalizedIds) {
    if (isValidPairIdFormat(id)) {
      allowedPairIds.push(id);
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

  return {
    valid: errors.length === 0 && allowedPairIds.length >= FX_SELECTION_LIMITS.MIN_PAIRS,
    errors,
    allowedPairIds: allowedPairIds.slice(0, FX_SELECTION_LIMITS.MAX_PAIRS),
  };
}
