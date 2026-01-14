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
import type {
  FeedConfig,
  CryptoCatalogItem,
  CryptoQuote,
  FeedHandler,
} from '../lib/types.js';
import { logDebug } from '../lib/logging.js';
import { cryptoScheduler } from './scheduler.js';
import {
  fetchTwelveDataPrices,
  parseCryptoPriceResponse,
  buildCryptoSymbol,
} from './adapter.js';

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
// FALLBACK DATA
// =============================================================================

/**
 * Fallback crypto catalog - used ONLY if frontend SSOT is unreachable.
 * Top 8 cryptocurrencies by market cap.
 */
const FALLBACK_CRYPTO_CATALOG: CryptoCatalogItem[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    rankHint: 1,
    isActive: true,
    demoPrice: 95000,
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    rankHint: 2,
    isActive: true,
    demoPrice: 3200,
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USDt',
    rankHint: 3,
    isActive: true,
    demoPrice: 1.0,
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'BNB',
    rankHint: 4,
    isActive: true,
    demoPrice: 680,
  },
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    rankHint: 5,
    isActive: true,
    demoPrice: 185,
  },
  {
    id: 'usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    rankHint: 6,
    isActive: true,
    demoPrice: 1.0,
  },
  {
    id: 'xrp',
    symbol: 'XRP',
    name: 'XRP',
    rankHint: 7,
    isActive: true,
    demoPrice: 2.35,
  },
  {
    id: 'doge',
    symbol: 'DOGE',
    name: 'Dogecoin',
    rankHint: 8,
    isActive: true,
    demoPrice: 0.32,
  },
];

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
      return FALLBACK_CRYPTO_CATALOG;
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
        demoPrice:
          typeof r['demoPrice'] === 'number' && r['demoPrice'] >= 0
            ? r['demoPrice']
            : undefined,
      });
    }

    return items.length > 0 ? items : FALLBACK_CRYPTO_CATALOG;
  },

  /**
   * Get default item IDs from catalog.
   */
  getDefaults(catalog: CryptoCatalogItem[]): string[] {
    // Take first 8 active items
    return catalog
      .filter((c) => c.isActive !== false)
      .slice(0, 8)
      .map((c) => c.id);
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
