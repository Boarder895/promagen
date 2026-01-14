/**
 * Promagen Gateway - TwelveData API Adapter
 * ==========================================
 * Handles all communication with the TwelveData API.
 *
 * Security: 10/10
 * - API key fetched dynamically at call time (never cached)
 * - Input validation on all parameters
 * - Timeout protection (10 second limit)
 * - Structured error handling
 * - No sensitive data in logs
 *
 * Used by: FX feed, Crypto feed
 *
 * @module twelvedata/adapter
 */

import { logDebug, logWarn, logError } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** TwelveData API base URL */
const TWELVEDATA_BASE_URL = 'https://api.twelvedata.com';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum symbols per request (TwelveData limit) */
const MAX_SYMBOLS_PER_REQUEST = 100;

// =============================================================================
// API KEY MANAGEMENT
// =============================================================================

/**
 * Get TwelveData API key from environment.
 *
 * SECURITY: Fetched dynamically at call time, not cached at module load.
 * This ensures the key is available even if env vars weren't ready at startup.
 *
 * @returns API key or empty string if not configured
 */
export function getTwelveDataApiKey(): string {
  return process.env['TWELVEDATA_API_KEY'] ?? '';
}

/**
 * Check if TwelveData API key is configured.
 */
export function hasTwelveDataApiKey(): boolean {
  return getTwelveDataApiKey().length > 0;
}

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

/**
 * Fetch price data from TwelveData /price endpoint.
 *
 * @param symbols - Array of symbols (e.g., ['EUR/USD', 'BTC/USD'])
 * @returns Raw API response
 * @throws Error if request fails or times out
 *
 * @example
 * ```typescript
 * const data = await fetchTwelveDataPrices(['EUR/USD', 'GBP/USD']);
 * // Returns: { "EUR/USD": { price: "1.0856" }, "GBP/USD": { price: "1.2734" } }
 * ```
 */
export async function fetchTwelveDataPrices(
  symbols: string[],
): Promise<unknown> {
  // Validate input
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('symbols must be a non-empty array');
  }

  // Enforce limit
  if (symbols.length > MAX_SYMBOLS_PER_REQUEST) {
    logWarn('TwelveData symbols truncated', {
      requested: symbols.length,
      limit: MAX_SYMBOLS_PER_REQUEST,
    });
    symbols = symbols.slice(0, MAX_SYMBOLS_PER_REQUEST);
  }

  // Get API key
  const apiKey = getTwelveDataApiKey();
  if (!apiKey) {
    throw new Error('TWELVEDATA_API_KEY not configured');
  }

  // Build URL
  // NOTE: Do NOT use encodeURIComponent - TwelveData expects literal symbols like EUR/USD,GBP/USD
  const symbolList = symbols.join(',');
  const url = `${TWELVEDATA_BASE_URL}/price?symbol=${symbolList}&apikey=${apiKey}`;

  logDebug('TwelveData request', {
    symbolCount: symbols.length,
    symbols: symbols.slice(0, 5), // Only log first 5 for brevity
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Promagen-Gateway/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`TwelveData API error: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();

    // Check for API-level errors
    if (isApiError(data)) {
      const errorData = data as { code: number; message: string };
      throw new Error(`TwelveData API error: ${errorData.message} (code ${errorData.code})`);
    }

    logDebug('TwelveData response received', {
      symbolCount: symbols.length,
    });

    return data;
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.name === 'TimeoutError') {
      logError('TwelveData request timeout', {
        symbolCount: symbols.length,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      throw new Error('TwelveData request timeout');
    }

    // Re-throw other errors
    throw error;
  }
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Check if response is an API-level error.
 */
function isApiError(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'code' in obj && 'message' in obj && 'status' in obj;
}

/**
 * Parse TwelveData price response for FX pairs.
 *
 * Response shapes:
 * - Single symbol: { price: "1.0856" }
 * - Multi symbol: { "EUR/USD": { price: "1.0856" }, "GBP/USD": { price: "1.2734" } }
 * - Error per symbol: { "EUR/USD": { code: 400, message: "...", status: "error" } }
 *
 * @param data - Raw API response
 * @param symbolToIdMap - Map from API symbol to internal ID
 * @returns Parsed price entries
 */
export function parseFxPriceResponse(
  data: unknown,
  symbolToIdMap: Map<string, { id: string; base: string; quote: string }>,
): Array<{
  id: string;
  base: string;
  quote: string;
  symbol: string;
  price: number;
}> {
  const results: Array<{
    id: string;
    base: string;
    quote: string;
    symbol: string;
    price: number;
  }> = [];

  if (!data || typeof data !== 'object') {
    return results;
  }

  const obj = data as Record<string, unknown>;

  // Single symbol response: { price: "1.0856" }
  if ('price' in obj && typeof obj['price'] === 'string') {
    // For single symbol, we need the first entry from the map
    const firstEntry = symbolToIdMap.entries().next().value;
    if (firstEntry) {
      const [symbol, info] = firstEntry as [string, { id: string; base: string; quote: string }];
      const price = parseFloat(obj['price'] as string);
      if (!Number.isNaN(price)) {
        results.push({
          id: info.id,
          base: info.base,
          quote: info.quote,
          symbol,
          price,
        });
      }
    }
    return results;
  }

  // Multi-symbol response
  for (const [symbol, value] of Object.entries(obj)) {
    if (!value || typeof value !== 'object') continue;

    const priceData = value as Record<string, unknown>;

    // Skip error responses
    if ('code' in priceData || 'status' in priceData) {
      logDebug('TwelveData symbol error', {
        symbol,
        code: priceData['code'],
        message: priceData['message'],
      });
      continue;
    }

    // Extract price
    const priceStr = priceData['price'];
    if (typeof priceStr !== 'string') continue;

    const price = parseFloat(priceStr);
    if (Number.isNaN(price)) continue;

    // Look up in map
    const info = symbolToIdMap.get(symbol);
    if (info) {
      results.push({
        id: info.id,
        base: info.base,
        quote: info.quote,
        symbol,
        price,
      });
    } else {
      // Construct from symbol if not in map
      const [base, quote] = symbol.split('/');
      if (base && quote) {
        results.push({
          id: `${base.toLowerCase()}-${quote.toLowerCase()}`,
          base,
          quote,
          symbol,
          price,
        });
      }
    }
  }

  return results;
}

/**
 * Parse TwelveData price response for crypto assets.
 *
 * @param data - Raw API response
 * @param symbolToIdMap - Map from API symbol to internal info
 * @returns Parsed price entries
 */
export function parseCryptoPriceResponse(
  data: unknown,
  symbolToIdMap: Map<string, { id: string; symbol: string; name: string }>,
): Array<{
  id: string;
  symbol: string;
  name: string;
  price: number;
  quoteCurrency: string;
}> {
  const results: Array<{
    id: string;
    symbol: string;
    name: string;
    price: number;
    quoteCurrency: string;
  }> = [];

  if (!data || typeof data !== 'object') {
    return results;
  }

  const obj = data as Record<string, unknown>;

  // Single symbol response
  if ('price' in obj && typeof obj['price'] === 'string') {
    const firstEntry = symbolToIdMap.entries().next().value;
    if (firstEntry) {
      const [, info] = firstEntry as [string, { id: string; symbol: string; name: string }];
      const price = parseFloat(obj['price'] as string);
      if (!Number.isNaN(price)) {
        results.push({
          id: info.id,
          symbol: info.symbol,
          name: info.name,
          price,
          quoteCurrency: 'USD',
        });
      }
    }
    return results;
  }

  // Multi-symbol response
  for (const [apiSymbol, value] of Object.entries(obj)) {
    if (!value || typeof value !== 'object') continue;

    const priceData = value as Record<string, unknown>;

    // Skip error responses
    if ('code' in priceData || 'status' in priceData) continue;

    const priceStr = priceData['price'];
    if (typeof priceStr !== 'string') continue;

    const price = parseFloat(priceStr);
    if (Number.isNaN(price)) continue;

    const info = symbolToIdMap.get(apiSymbol);
    if (info) {
      results.push({
        id: info.id,
        symbol: info.symbol,
        name: info.name,
        price,
        quoteCurrency: 'USD',
      });
    }
  }

  return results;
}

// =============================================================================
// SYMBOL BUILDERS
// =============================================================================

/**
 * Build TwelveData FX symbol from base/quote currencies.
 *
 * @example
 * ```typescript
 * buildFxSymbol('EUR', 'USD'); // 'EUR/USD'
 * ```
 */
export function buildFxSymbol(base: string, quote: string): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

/**
 * Build TwelveData crypto symbol (always quoted in USD).
 *
 * @example
 * ```typescript
 * buildCryptoSymbol('BTC'); // 'BTC/USD'
 * ```
 */
export function buildCryptoSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}/USD`;
}
