// frontend/src/data/exchanges/types.ts
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

  // =========================================================================
  // Optional fields (UI/display convenience, future expansion)
  // =========================================================================

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
    typeof record.hemisphere === 'string'
  );
}
