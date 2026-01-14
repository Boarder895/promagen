// src/data/exchanges/types.ts
// ============================================================================
// CANONICAL EXCHANGE TYPE - Single Source of Truth
// ============================================================================
// All exchange type definitions consolidated here.
// Other files (src/lib/exchanges.ts, src/lib/exchange-order.ts) re-export from here.
// Data source: ./exchanges.catalog.json
// ============================================================================

/**
 * Exchange operational status.
 */
export type ExchangeStatus = 'active' | 'inactive';

/**
 * Broad geographic region grouping.
 */
export type ExchangeRegion = 'APAC' | 'EMEA' | 'AMERICAS';

/**
 * Geographic hemisphere indicator.
 * - NE: North-East (e.g., Tokyo, Seoul)
 * - NW: North-West (e.g., New York, Toronto)
 * - SE: South-East (e.g., Sydney, Wellington)
 * - SW: South-West (e.g., São Paulo)
 */
export type Hemisphere = 'NE' | 'NW' | 'SE' | 'SW' | '';

/**
 * Marketstack configuration for benchmark index data.
 */
export interface MarketstackConfig {
  /**
   * Marketstack benchmark key for /v2/indexinfo endpoint.
   * @example "nikkei_225", "sp500", "ftse_100"
   */
  benchmark: string;

  /**
   * Human-readable index name.
   * @example "Nikkei 225", "S&P 500", "FTSE 100"
   */
  indexName: string;
}

/**
 * Canonical Exchange type representing a stock exchange.
 *
 * This is the Single Source of Truth for exchange data shapes across Promagen.
 * Required fields match the exchanges.catalog.json schema.
 * Optional fields support UI display and additional metadata.
 *
 * @example
 * ```ts
 * const tokyo: Exchange = {
 *   id: 'tse-tokyo',
 *   city: 'Tokyo',
 *   exchange: 'Tokyo Stock Exchange (TSE)',
 *   country: 'Japan',
 *   iso2: 'JP',
 *   tz: 'Asia/Tokyo',
 *   longitude: 139.6503,
 *   latitude: 35.6762,
 *   hoursTemplate: 'asia-break',
 *   holidaysRef: 'tse-tokyo',
 *   hemisphere: 'NE',
 *   ribbonLabel: 'Tokyo (TSE)',
 *   marketstack: {
 *     benchmark: 'nikkei_225',
 *     indexName: 'Nikkei 225',
 *   },
 *   hoverColor: '#FF3B5C',
 * };
 * ```
 */
export type Exchange = {
  // =========================================================================
  // Required fields (from exchanges.catalog.json)
  // =========================================================================

  /**
   * Stable identifier for the exchange.
   * Format: lowercase-kebab-case, e.g. "nzx-wellington", "tse-tokyo"
   */
  id: string;

  /**
   * City where the exchange is located.
   * @example "Tokyo", "Wellington", "New York"
   */
  city: string;

  /**
   * Full exchange display name.
   * @example "Tokyo Stock Exchange (TSE)", "New Zealand Exchange (NZX)"
   */
  exchange: string;

  /**
   * Country name.
   * @example "Japan", "New Zealand", "United States"
   */
  country: string;

  /**
   * ISO-3166 alpha-2 country code (uppercase).
   * Used for flag display and regional grouping.
   * @example "JP", "NZ", "US"
   */
  iso2: string;

  /**
   * IANA timezone identifier.
   * Used for clock display and market hours calculation.
   * @example "Asia/Tokyo", "Pacific/Auckland", "America/New_York"
   */
  tz: string;

  /**
   * Geographic longitude in decimal degrees.
   * East is positive, West is negative.
   * Used for east-to-west ordering of exchange rails.
   * @example 139.6503 (Tokyo), -74.006 (New York)
   */
  longitude: number;

  /**
   * Geographic latitude in decimal degrees.
   * North is positive, South is negative.
   * @example 35.6762 (Tokyo), -41.2866 (Wellington)
   */
  latitude: number;

  /**
   * Reference key to market hours template in market-hours.templates.json.
   * @example "asia-break", "us-standard", "australasia-standard"
   */
  hoursTemplate: string;

  /**
   * Reference key to holidays calendar.
   * Typically matches the exchange id.
   * @example "tse-tokyo", "nyse-new-york"
   */
  holidaysRef: string;

  /**
   * Geographic hemisphere indicator.
   * Used for weather/season logic.
   */
  hemisphere: Hemisphere;

  /**
   * Marketstack API configuration for index data.
   * Links exchange to its benchmark index.
   */
  marketstack: MarketstackConfig;

  /**
   * Vibrant hover color for exchange card UI.
   * Hex format, unique per exchange.
   * Applied when cursor enters the exchange card.
   * @example "#FF3B5C", "#3B82F6", "#10B981"
   */
  hoverColor: string;

  // =========================================================================
  // Optional fields (UI/display convenience, future expansion)
  // =========================================================================

  /**
   * Short display name for space-constrained UI (ribbon, cards).
   * Should be 2-3 words max for reliable line-clamp behavior.
   * Falls back to 'exchange' if not provided.
   *
   * @example "Tokyo (TSE)", "ASX Sydney", "HKEX", "JSE"
   */
  ribbonLabel?: string;

  /**
   * Alternative name field.
   * Some catalog entries may include this as an alias for 'exchange'.
   * @deprecated Prefer using 'exchange' field directly
   */
  name?: string;

  /**
   * Alternative country code field.
   * Alias for 'iso2' to support legacy UI code.
   * @deprecated Prefer using 'iso2' field directly
   */
  countryCode?: string;

  /**
   * Pre-computed GMT offset in minutes.
   * E.g., 540 for GMT+9 (Tokyo).
   * Optional since it can be derived from tz.
   */
  offsetMinutes?: number | null;

  /**
   * Broad region grouping for analytics and filtering.
   */
  region?: ExchangeRegion;

  /**
   * Primary trading currency code.
   * @example "JPY", "USD", "NZD"
   */
  tradingCurrency?: string;

  /**
   * Active/inactive status in the Promagen app.
   */
  status?: ExchangeStatus;

  /**
   * Market Identifier Code (ISO 10383).
   * @example "XJPX", "XNZE", "XNYS"
   */
  micCode?: string;

  /**
   * Free-form notes about the exchange.
   * @example "Part of JPX Group", "Merged with Osaka Exchange in 2013"
   */
  notes?: string;
};

/**
 * Type guard to check if an unknown value is a valid Exchange.
 * Validates required fields only.
 */
export function isExchange(value: unknown): value is Exchange {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    typeof record.city === 'string' &&
    typeof record.exchange === 'string' &&
    typeof record.country === 'string' &&
    typeof record.iso2 === 'string' &&
    typeof record.tz === 'string' &&
    typeof record.longitude === 'number' &&
    typeof record.latitude === 'number' &&
    typeof record.hoursTemplate === 'string' &&
    typeof record.holidaysRef === 'string' &&
    typeof record.hemisphere === 'string' &&
    typeof record.marketstack === 'object' &&
    record.marketstack !== null &&
    typeof (record.marketstack as Record<string, unknown>).benchmark === 'string' &&
    typeof (record.marketstack as Record<string, unknown>).indexName === 'string' &&
    typeof record.hoverColor === 'string'
  );
}
