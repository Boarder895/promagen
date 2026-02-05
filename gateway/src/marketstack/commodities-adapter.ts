/**
 * Promagen Gateway - Marketstack Commodities API Adapter
 * ========================================================
 * Handles all communication with the Marketstack Commodities API.
 *
 * CRITICAL: Commodities endpoint only supports 1 commodity per call.
 * This adapter fetches a SINGLE commodity per invocation.
 * The scheduler is responsible for cycling through the queue.
 *
 * API Endpoint: GET /v2/commodities?commodity_name=X
 * Rate Limit: 1 call/minute (hard endpoint limit)
 * Our cadence: 1 call every 2 minutes (safely within limit)
 *
 * Mapping: Catalog ID → Marketstack commodity_name
 *   catalog: "iron_ore"      → API: "iron ore"
 *   catalog: "crude_oil"     → API: "crude oil"
 *   catalog: "ttf_gas"       → API: "ttf gas"
 *
 * Security: 10/10
 * - API key fetched dynamically at call time (never cached)
 * - Input validation on all parameters
 * - Timeout protection (15 second limit)
 * - Structured error handling
 * - No sensitive data in logs
 *
 * @module marketstack/commodities-adapter
 */

import { logDebug, logWarn, logError } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Marketstack API base URL.
 * Professional tier supports HTTPS.
 */
const MARKETSTACK_BASE_URL = 'https://api.marketstack.com';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

// =============================================================================
// CATALOG ID → MARKETSTACK NAME MAPPING
// =============================================================================

/**
 * Explicit mapping from catalog IDs to Marketstack commodity_name values.
 *
 * CRITICAL: Marketstack uses specific commodity names that don't always match
 * our catalog IDs. This mapping ensures we call the API with correct names.
 *
 * VERIFIED AGAINST: marketstack-commodities.xlsx (78 commodities)
 *
 * Example mismatches:
 *   - "brent_crude" → "brent" (NOT "brent crude")
 *   - "aluminium" → "aluminum" (US spelling)
 *   - "ttf_natural_gas" → "ttf gas" (NOT "natural gas" - separate commodity!)
 *   - "wti_crude" → "crude oil" (Marketstack calls it "crude oil")
 */
const CATALOG_TO_MARKETSTACK: Record<string, string> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENERGY (single-word and special mappings)
  // ═══════════════════════════════════════════════════════════════════════════
  brent_crude: 'brent',
  brent: 'brent',
  wti_crude: 'crude oil', // Marketstack name is "crude oil"
  coal: 'coal',
  ethanol: 'ethanol',
  gasoline: 'gasoline',
  propane: 'propane',
  naphtha: 'naphtha',
  uranium: 'uranium',
  bitumen: 'bitumen',
  methanol: 'methanol',

  // ═══════════════════════════════════════════════════════════════════════════
  // ENERGY (double-word)
  // ═══════════════════════════════════════════════════════════════════════════
  crude_oil: 'crude oil',
  natural_gas: 'natural gas',
  ttf_natural_gas: 'ttf gas', // FIXED: was 'natural gas', should be 'ttf gas'
  ttf_gas: 'ttf gas',
  uk_gas: 'uk gas',
  heating_oil: 'heating oil',

  // ═══════════════════════════════════════════════════════════════════════════
  // METALS (single-word)
  // ═══════════════════════════════════════════════════════════════════════════
  gold: 'gold',
  silver: 'silver',
  copper: 'copper',
  aluminum: 'aluminum',
  aluminium: 'aluminum', // UK → US spelling
  platinum: 'platinum',
  palladium: 'palladium',
  rhodium: 'rhodium',
  zinc: 'zinc',
  nickel: 'nickel',
  tin: 'tin',
  lead: 'lead',
  cobalt: 'cobalt',
  lithium: 'lithium',
  steel: 'steel',
  lumber: 'lumber',
  titanium: 'titanium',
  magnesium: 'magnesium',
  manganese: 'manganese',
  molybdenum: 'molybdenum',
  gallium: 'gallium',
  germanium: 'germanium',
  indium: 'indium',
  neodymium: 'neodymium',
  tellurium: 'tellurium',

  // ═══════════════════════════════════════════════════════════════════════════
  // METALS (double-word)
  // ═══════════════════════════════════════════════════════════════════════════
  iron_ore: 'iron ore',
  iron_ore_cny: 'iron ore cny',
  hrc_steel: 'hrc steel',
  soda_ash: 'soda ash',
  kraft_pulp: 'kraft pulp',

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE (single-word)
  // ═══════════════════════════════════════════════════════════════════════════
  coffee: 'coffee',
  sugar: 'sugar',
  corn: 'corn',
  wheat: 'wheat',
  soybeans: 'soybeans',
  cotton: 'cotton',
  cocoa: 'cocoa',
  rice: 'rice',
  oat: 'oat',
  barley: 'barley',
  canola: 'canola',
  rapeseed: 'rapeseed',
  rubber: 'rubber',
  wool: 'wool',
  tea: 'tea',
  milk: 'milk',
  cheese: 'cheese',
  butter: 'butter',
  beef: 'beef',
  poultry: 'poultry',
  salmon: 'salmon',
  potatoes: 'potatoes',
  urea: 'urea',

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE (double-word)
  // ═══════════════════════════════════════════════════════════════════════════
  orange_juice: 'orange juice',
  palm_oil: 'palm oil',
  sunflower_oil: 'sunflower oil',
  lean_hogs: 'lean hogs',
  live_cattle: 'live cattle',
  feeder_cattle: 'feeder cattle',
  eggs_ch: 'eggs ch',
  eggs_us: 'eggs us',
  di_ammonium: 'di-ammonium', // Note: hyphen in Marketstack name

  // ═══════════════════════════════════════════════════════════════════════════
  // PLASTICS/CHEMICALS
  // ═══════════════════════════════════════════════════════════════════════════
  polyethylene: 'polyethylene',
  polypropylene: 'polypropylene',
  polyvinyl: 'polyvinyl',
};

/**
 * Convert a catalog commodity ID to the Marketstack commodity_name parameter.
 *
 * Uses explicit mapping first, falls back to underscore→space replacement.
 *
 * @param catalogId - Commodity ID from the SSOT catalog (e.g., "brent_crude")
 * @returns Marketstack commodity_name parameter value (e.g., "brent")
 */
export function catalogIdToMarketstackName(catalogId: string): string {
  if (!catalogId || typeof catalogId !== 'string') {
    return '';
  }

  const normalized = catalogId.toLowerCase().trim();

  // Check explicit mapping first (handles special cases)
  if (CATALOG_TO_MARKETSTACK[normalized]) {
    return CATALOG_TO_MARKETSTACK[normalized];
  }

  // Fallback: replace underscores with spaces
  return normalized.replace(/_/g, ' ');
}

/**
 * Convert a Marketstack commodity name back to catalog ID format.
 * Inverse of catalogIdToMarketstackName.
 *
 * @param marketstackName - Name from API response (e.g., "Iron Ore")
 * @returns Catalog ID format (e.g., "iron_ore")
 */
export function marketstackNameToCatalogId(marketstackName: string): string {
  if (!marketstackName || typeof marketstackName !== 'string') {
    return '';
  }
  return marketstackName.trim().toLowerCase().replace(/\s+/g, '_');
}

// =============================================================================
// PARSED RESPONSE TYPE
// =============================================================================

/**
 * Parsed commodity data from a single Marketstack API call.
 */
export interface ParsedCommodityData {
  /** Catalog ID (lowercase, underscored - e.g., "iron_ore") */
  readonly catalogId: string;
  /** Marketstack commodity name (e.g., "Iron Ore") */
  readonly name: string;
  /** Latest price */
  readonly price: number;
  /** Daily price change — absolute (from Marketstack "price_change_day") */
  readonly change: number | null;
  /** Daily percentage change (from Marketstack "percentage_day") */
  readonly percentChange: number | null;
  /** High price (if available) */
  readonly high: number | null;
  /** Low price (if available) */
  readonly low: number | null;
  /** Price currency */
  readonly currency: string;
  /** Date/timestamp of the price data */
  readonly date: string;
}

// =============================================================================
// FETCH FUNCTION
// =============================================================================

/**
 * Fetch a single commodity from Marketstack v2 API.
 *
 * @param catalogId - Commodity ID from catalog (e.g., "iron_ore")
 * @param apiKey - Marketstack API key (fetched dynamically)
 * @returns Parsed commodity data, or null if commodity not found
 * @throws Error if request fails, times out, or API returns an error
 *
 * @example
 * ```typescript
 * const data = await fetchSingleCommodity('iron_ore', apiKey);
 * // Returns: { catalogId: 'iron_ore', name: 'Iron Ore', price: 108.5, ... }
 * ```
 */
export async function fetchSingleCommodity(
  catalogId: string,
  apiKey: string,
): Promise<ParsedCommodityData | null> {
  // ── Input validation ──────────────────────────────────────────────────────
  if (!catalogId || typeof catalogId !== 'string') {
    throw new Error('catalogId must be a non-empty string');
  }

  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('MARKETSTACK_API_KEY not configured');
  }

  // Sanitize: only allow a-z, 0-9, underscores, hyphens (max 64 chars)
  const sanitizedId = catalogId.toLowerCase().trim().slice(0, 64);
  if (!/^[a-z0-9_-]+$/.test(sanitizedId)) {
    throw new Error(`Invalid commodity ID format: ${sanitizedId.slice(0, 20)}`);
  }

  // ── Convert catalog ID to API name ────────────────────────────────────────
  const commodityName = catalogIdToMarketstackName(sanitizedId);

  if (!commodityName) {
    throw new Error(`Empty commodity name for ID: ${sanitizedId}`);
  }

  // ── Build URL ─────────────────────────────────────────────────────────────
  // Marketstack v2 commodities endpoint: /v2/commodities?commodity_name=X
  // Docs: https://marketstack.com/documentation_v2
  // Rate limit: 1 call/minute on this endpoint
  //
  // CRITICAL: Marketstack expects multi-word commodity names to use underscores
  // in the commodity_name parameter (e.g. "crude_oil"), not spaces.
  // If we send "crude oil" (or "crude+oil"), the API returns 404.
  const commodityParam = commodityName.trim().toLowerCase().replace(/\s+/g, '_');

  const url = `${MARKETSTACK_BASE_URL}/v2/commodities?access_key=${encodeURIComponent(
    apiKey,
  )}&commodity_name=${encodeURIComponent(commodityParam)}`;

  logDebug('Marketstack commodities request', {
    catalogId: sanitizedId,
    commodityName,
    url: url.replace(/access_key=[^&]+/, 'access_key=***REDACTED***'),
    endpoint: `/v2/commodities?commodity_name=${commodityParam}`,
  });

  // ── Fetch ─────────────────────────────────────────────────────────────────
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
      const text = await response.text().catch(() => '');

      // ✨ DEBUGGING: Show full error details
      console.error('❌ MARKETSTACK 404 DEBUG:', {
        catalogId: sanitizedId,
        commodityName,
        status: response.status,
        statusText: response.statusText,
        url: url.replace(/access_key=[^&]+/, 'access_key=***'),
        responseBody: text,
        headers: Object.fromEntries(response.headers.entries()),
      });

      logError('Marketstack commodities API error', {
        status: response.status,
        statusText: response.statusText,
        catalogId: sanitizedId,
        body: text.slice(0, 200),
      });
      throw new Error(`Marketstack commodities API error: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();

    // ── Parse response ──────────────────────────────────────────────────────
    return parseSingleCommodityResponse(data, sanitizedId);
  } catch (error) {
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'TimeoutError') {
      logError('Marketstack commodities request timeout', {
        catalogId: sanitizedId,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      throw new Error('Marketstack commodities request timeout');
    }

    // Re-throw all other errors
    throw error;
  }
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Parse a single-commodity Marketstack v2 response.
 *
 * Actual v2 response shape (confirmed 2026-02-02):
 * {
 *   "data": [{
 *     "commodity_name": "coffee",
 *     "commodity_unit": "usd/lbs",
 *     "commodity_price": "330.72",
 *     "price_change_day": "75.697",
 *     "percentage_day": "0.86",
 *     "percentage_week": "-5.706",
 *     "percentage_month": "-5.384",
 *     "percentage_year": "-22.08",
 *     "quantity_oz": "100.037",
 *     "date/time": "2026-02-02T00:00:00.000"
 *   }]
 * }
 *
 * Field mapping:
 *   commodity_price  → price (string, must parseFloat)
 *   commodity_unit   → currency (e.g., "usd/lbs" → extract "USD")
 *   price_change_day → daily price change (absolute)
 *   percentage_day   → daily percentage change
 *   date/time        → date/timestamp
 *
 * @param data - Raw API response
 * @param catalogId - The catalog ID we requested (for mapping)
 * @returns Parsed commodity data, or null if empty/invalid
 */
function parseSingleCommodityResponse(
  data: unknown,
  catalogId: string,
): ParsedCommodityData | null {
  if (!data || typeof data !== 'object') {
    logWarn('Marketstack commodities: empty response', { catalogId });
    return null;
  }

  const obj = data as Record<string, unknown>;

  // ── Check for API-level errors ────────────────────────────────────────────
  if (obj['error']) {
    const errorObj = obj['error'] as Record<string, unknown>;
    const code = typeof errorObj['code'] === 'string' ? errorObj['code'] : 'unknown';
    const message = typeof errorObj['message'] === 'string' ? errorObj['message'] : 'unknown';
    logError('Marketstack commodities API returned error', {
      catalogId,
      code,
      message: message.slice(0, 200),
    });
    throw new Error(`Marketstack commodities API error: ${message} (${code})`);
  }

  // ── Extract data payload ──────────────────────────────────────────────────
  let record: Record<string, unknown> | null = null;

  const dataField = obj['data'];
  if (Array.isArray(dataField)) {
    // Array form: take first element (confirmed v2 always returns array)
    if (dataField.length === 0) {
      logDebug('Marketstack commodities: empty data array', { catalogId });
      return null;
    }
    if (dataField[0] && typeof dataField[0] === 'object') {
      record = dataField[0] as Record<string, unknown>;
    }
  } else if (dataField && typeof dataField === 'object') {
    // Object form: use directly (defensive fallback)
    record = dataField as Record<string, unknown>;
  }

  if (!record) {
    logWarn('Marketstack commodities: no parseable data', { catalogId });
    return null;
  }

  // ── Extract fields (v2 actual field names) ────────────────────────────────
  // Primary: "commodity_price" (v2 confirmed)
  // Fallback: "price" (in case v2 changes or for forward-compatibility)
  const price = parseFloat(String(record['commodity_price'] ?? record['price'] ?? ''));
  if (!Number.isFinite(price) || price <= 0) {
    logDebug('Marketstack commodities: invalid price', {
      catalogId,
      rawPrice: String(record['commodity_price'] ?? record['price']).slice(0, 20),
    });
    return null;
  }

  const name =
    typeof record['commodity_name'] === 'string'
      ? record['commodity_name']
      : catalogId.replace(/_/g, ' ');

  // v2 doesn't provide high/low — these fields don't exist in the response
  const highRaw = parseFloat(String(record['price_high'] ?? record['high'] ?? ''));
  const lowRaw = parseFloat(String(record['price_low'] ?? record['low'] ?? ''));

  // Daily change: "price_change_day" (v2 confirmed — absolute price change)
  const changeRaw = parseFloat(String(record['price_change_day'] ?? ''));
  const change = Number.isFinite(changeRaw) ? changeRaw : null;

  // Daily percentage: "percentage_day" (v2 confirmed — e.g., "0.86" means +0.86%)
  const pctRaw = parseFloat(String(record['percentage_day'] ?? ''));
  const percentChange = Number.isFinite(pctRaw) ? pctRaw : null;

  // Currency: extract from "commodity_unit" (e.g., "usd/lbs" → "USD")
  // Fallback to "currency" field, then default "USD"
  let currency = 'USD';
  const unit = typeof record['commodity_unit'] === 'string' ? record['commodity_unit'] : '';
  if (unit) {
    // Extract currency code from unit string (e.g., "usd/lbs" → "USD", "eur/mwh" → "EUR")
    const currencyMatch = unit.match(/^([a-zA-Z]{3})/);
    if (currencyMatch) {
      currency = currencyMatch[1]!.toUpperCase();
    }
  } else if (typeof record['currency'] === 'string') {
    currency = record['currency'].toUpperCase();
  }

  // Date: "date/time" field (v2 confirmed), fallback to "date"
  const date =
    typeof record['date/time'] === 'string'
      ? record['date/time']
      : typeof record['date'] === 'string'
        ? record['date']
        : '';

  logDebug('Marketstack commodities: parsed', {
    catalogId,
    price,
    change,
    percentChange,
    currency,
  });

  return {
    catalogId,
    name,
    price,
    change,
    percentChange,
    high: Number.isFinite(highRaw) && highRaw > 0 ? highRaw : null,
    low: Number.isFinite(lowRaw) && lowRaw > 0 ? lowRaw : null,
    currency,
    date,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get Marketstack API key from environment.
 *
 * SECURITY: Fetched dynamically at call time, not cached at module load.
 */
export function getMarketstackApiKeyForCommodities(): string {
  return process.env['MARKETSTACK_API_KEY'] ?? '';
}

/**
 * Check if Marketstack API key is configured.
 */
export function hasMarketstackApiKeyForCommodities(): boolean {
  return getMarketstackApiKeyForCommodities().length > 0;
}
