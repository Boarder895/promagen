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
import { logDebug } from '../lib/logging.js';
import type { FeedConfig, FxPair, FxQuote, FeedHandler } from '../lib/types.js';

import { fetchTwelveDataPrices, parseFxPriceResponse, buildFxSymbol } from './adapter.js';
import { fxScheduler } from './scheduler.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FX_CONFIG_URL = process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';
const FX_TTL_SECONDS = parseInt(process.env['FX_RIBBON_TTL_SECONDS'] ?? '1800', 10);
const FX_BUDGET_DAILY = parseInt(process.env['FX_RIBBON_BUDGET_DAILY_ALLOWANCE'] ?? '800', 10);
const FX_BUDGET_MINUTE = parseInt(process.env['FX_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ?? '8', 10);

// =============================================================================
// PURE SSOT NOTE
// =============================================================================
// This gateway must not embed fallback catalogs or demo prices.
// The ONLY allowed fallback is a previously saved SSOT snapshot.

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
        // Demo/synthetic prices are intentionally NOT consumed by the gateway.
      });
    }

    if (pairs.length === 0) throw new Error('FX SSOT payload contained no valid pairs');
    return pairs;
  },

  /**
   * Get default pair IDs from catalog.
   */
  getDefaults(catalog: FxPair[], ssotPayload: unknown): string[] {
    // Prefer explicit ordered default IDs if the frontend provides them
    const payload = ssotPayload && typeof ssotPayload === 'object' ? (ssotPayload as Record<string, unknown>) : null;
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
