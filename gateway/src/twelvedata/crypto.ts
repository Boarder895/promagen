/**
 * Promagen Gateway - Crypto Feed Configuration (TwelveData)
 * ===========================================================
 * Crypto-specific configuration using shared TwelveData infrastructure.
 *
 * Security: 10/10
 * - Input validation for all catalog data
 * - Secure API key handling (via adapter)
 * - No sensitive data in responses
 * - Enterprise-grade input sanitization
 *
 * @module twelvedata/crypto
 */

import { createFeedHandler } from '../lib/feed-handler.js';
import { logDebug } from '../lib/logging.js';
import type {
  FeedConfig,
  CryptoCatalogItem,
  CryptoQuote,
  FeedHandler,
} from '../lib/types.js';

import {
  fetchTwelveDataPrices,
  parseCryptoPriceResponse,
  buildCryptoSymbol,
} from './adapter.js';
import { cryptoScheduler } from './scheduler.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CRYPTO_CONFIG_URL =
  process.env['CRYPTO_CONFIG_URL'] ?? 'https://promagen.com/api/crypto/config';
const CRYPTO_TTL_SECONDS = parseInt(
  process.env['CRYPTO_RIBBON_TTL_SECONDS'] ?? '1800',
  10,
);
const CRYPTO_BUDGET_DAILY = parseInt(
  process.env['CRYPTO_RIBBON_BUDGET_DAILY_ALLOWANCE'] ?? '800',
  10,
);
const CRYPTO_BUDGET_MINUTE = parseInt(
  process.env['CRYPTO_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ?? '8',
  10,
);

// =============================================================================
// FEED CONFIGURATION
// =============================================================================

/**
 * Crypto feed configuration for the generic feed handler.
 * Uses clock-aligned scheduler for :20 and :50 refresh times.
 */
const cryptoConfig: FeedConfig<CryptoCatalogItem, CryptoQuote> = {
  id: 'crypto',
  provider: 'twelvedata',
  ttlSeconds: CRYPTO_TTL_SECONDS,
  budgetDaily: CRYPTO_BUDGET_DAILY,
  budgetMinute: CRYPTO_BUDGET_MINUTE,
  ssotUrl: CRYPTO_CONFIG_URL,
  cacheKey: 'crypto:ribbon',

  // Clock-aligned scheduler (Guardrail: prevents TwelveData rate limit)
  scheduler: cryptoScheduler,

  /**
   * Parse SSOT catalog response.
   */
  parseCatalog(data: unknown): CryptoCatalogItem[] {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Crypto SSOT payload');
    }

    const obj = data as Record<string, unknown>;
    let itemsArray: unknown[] = [];

    // Handle various response shapes
    if (Array.isArray(obj['crypto'])) {
      itemsArray = obj['crypto'];
    } else if (Array.isArray(obj['data'])) {
      itemsArray = obj['data'];
    } else if (Array.isArray(obj['assets'])) {
      itemsArray = obj['assets'];
    } else if (Array.isArray(data)) {
      itemsArray = data as unknown[];
    }

    const items: CryptoCatalogItem[] = [];

    for (const raw of itemsArray) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;

      // Validate and sanitize ID
      const id =
        typeof r['id'] === 'string'
          ? r['id'].toLowerCase().trim().slice(0, 20)
          : '';

      // Validate symbol (1-10 uppercase letters)
      const symbol =
        typeof r['symbol'] === 'string'
          ? r['symbol'].toUpperCase().trim().slice(0, 10)
          : '';

      // Skip invalid entries
      if (!id || !symbol) continue;
      if (!/^[A-Z0-9]{1,10}$/.test(symbol)) continue;

      // Skip inactive items
      if (r['isActive'] === false) continue;
      if (r['isSelectableInRibbon'] === false) continue;

      items.push({
        id,
        symbol,
        name:
          typeof r['name'] === 'string'
            ? r['name'].trim().slice(0, 50)
            : symbol,
        rankHint:
          typeof r['rankHint'] === 'number' &&
          r['rankHint'] >= 1 &&
          r['rankHint'] <= 1000
            ? r['rankHint']
            : undefined,
        isActive: typeof r['isActive'] === 'boolean' ? r['isActive'] : true,
        isSelectableInRibbon:
          typeof r['isSelectableInRibbon'] === 'boolean'
            ? r['isSelectableInRibbon']
            : true,
        // Demo/synthetic prices are intentionally NOT consumed by the gateway.
      });
    }

    if (items.length === 0) {
      throw new Error('Crypto SSOT payload contained no valid assets');
    }

    return items;
  },

  /**
   * Get default item IDs from catalog.
   */
  getDefaults(catalog: CryptoCatalogItem[], ssotPayload: unknown): string[] {
    const payload = ssotPayload && typeof ssotPayload === 'object' ? (ssotPayload as Record<string, unknown>) : null;

    // Prefer explicit ordered default IDs if provided
    const candidates = ['defaultCryptoIds', 'defaultAssetIds', 'defaultIds', 'assetIds', 'cryptoIds'];
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

    throw new Error('Crypto defaults not defined in SSOT (no default IDs or isDefaultFree flags)');
  },

  /**
   * Parse API response to quotes.
   */
  parseQuotes(data: unknown, catalog: CryptoCatalogItem[]): CryptoQuote[] {
    // Build symbol -> catalog item map
    const symbolToIdMap = new Map<
      string,
      { id: string; symbol: string; name: string }
    >();
    for (const item of catalog) {
      symbolToIdMap.set(buildCryptoSymbol(item.symbol), {
        id: item.id,
        symbol: item.symbol,
        name: item.name,
      });
    }

    // Parse response
    const parsed = parseCryptoPriceResponse(data, symbolToIdMap);

    // Convert to CryptoQuote format
    return parsed.map((entry) => ({
      id: entry.id,
      symbol: entry.symbol,
      name: entry.name,
      price: entry.price,
      quoteCurrency: entry.quoteCurrency,
    }));
  },

  /**
   * Fetch quotes from TwelveData.
   */
  async fetchQuotes(symbols: string[]): Promise<unknown> {
    logDebug('Crypto fetchQuotes called', {
      symbolCount: symbols.length,
      nextSlot: cryptoScheduler.getNextSlotTime().toISOString(),
    });
    return fetchTwelveDataPrices(symbols);
  },

  /**
   * Generate fallback quotes (NO demo prices per docs).
   * Returns null prices which render as "—" on frontend.
   */
  getFallback(catalog: CryptoCatalogItem[]): CryptoQuote[] {
    return catalog.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      price: null, // NEVER return demo prices - docs mandate "—" display
      quoteCurrency: 'USD',
    }));
  },

  /**
   * Get item by ID.
   */
  getById(
    catalog: CryptoCatalogItem[],
    id: string,
  ): CryptoCatalogItem | undefined {
    const normalizedId = id.toLowerCase().trim();
    return catalog.find((c) => c.id === normalizedId);
  },

  /**
   * Get TwelveData symbol from catalog item.
   */
  getSymbol(item: CryptoCatalogItem): string {
    return buildCryptoSymbol(item.symbol);
  },
};

// =============================================================================
// HANDLER INSTANCE
// =============================================================================

/**
 * Crypto feed handler instance.
 * Uses shared TwelveData budget and clock-aligned scheduler.
 *
 * Ready to use after calling init().
 */
export const cryptoHandler: FeedHandler<CryptoCatalogItem, CryptoQuote> =
  createFeedHandler(cryptoConfig);

// =============================================================================
// SELECTION VALIDATION (Pro users)
// =============================================================================

const CRYPTO_SELECTION_LIMITS = {
  MIN_ASSETS: 6,
  MAX_ASSETS: 16,
} as const;

/**
 * Validate crypto selection from Pro user request.
 *
 * Rules:
 * - Paid tier only
 * - IDs must exist in the current SSOT catalog (no silent fallback)
 * - Order preserved
 */
export function validateCryptoSelection(
  assetIds: string[],
  tier: 'free' | 'paid',
  catalogMap: Map<string, CryptoCatalogItem>,
): {
  valid: boolean;
  errors: string[];
  allowedAssetIds: string[];
} {
  const errors: string[] = [];

  if (tier !== 'paid') {
    return { valid: false, errors: ['Crypto selection requires Pro tier'], allowedAssetIds: [] };
  }

  if (!Array.isArray(assetIds)) {
    return { valid: false, errors: ['assetIds must be an array'], allowedAssetIds: [] };
  }

  // Normalise, dedupe (preserve first-seen order)
  const seen = new Set<string>();
  const normalised: string[] = [];
  for (const raw of assetIds) {
    if (typeof raw !== 'string') continue;
    const id = raw.toLowerCase().trim().slice(0, 32);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    normalised.push(id);
  }

  if (normalised.length < CRYPTO_SELECTION_LIMITS.MIN_ASSETS) {
    errors.push(`Minimum ${CRYPTO_SELECTION_LIMITS.MIN_ASSETS} assets required, got ${normalised.length}`);
  }
  if (normalised.length > CRYPTO_SELECTION_LIMITS.MAX_ASSETS) {
    errors.push(`Maximum ${CRYPTO_SELECTION_LIMITS.MAX_ASSETS} assets allowed, got ${normalised.length}`);
  }

  const allowed: string[] = [];
  const unknown: string[] = [];
  for (const id of normalised) {
    if (catalogMap.has(id)) allowed.push(id);
    else unknown.push(id);
  }

  if (unknown.length > 0) {
    errors.push(
      `Unknown crypto IDs (not in SSOT catalog): ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '...' : ''}`,
    );
  }

  return {
    valid: errors.length === 0 && allowed.length >= CRYPTO_SELECTION_LIMITS.MIN_ASSETS,
    errors,
    allowedAssetIds: allowed.slice(0, CRYPTO_SELECTION_LIMITS.MAX_ASSETS),
  };
}
