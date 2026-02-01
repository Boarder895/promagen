// src/data/exchanges/types.ts
// ============================================================================
// CANONICAL EXCHANGE TYPE - Single Source of Truth
// ============================================================================
// All exchange type definitions consolidated here.
// Other files (src/lib/exchanges.ts, src/lib/exchange-order.ts) re-export from here.
// Data source: ./exchanges.catalog.json
//
// UPDATED v2.0.0 (30 Jan 2026):
// - Multi-index support: exchanges can now have multiple available indices
// - MarketstackConfig restructured with defaultBenchmark + availableIndices
// - Backward compatible: getActiveBenchmark() helper for existing code
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
 * Single index option within an exchange.
 * @example { benchmark: "de40", indexName: "DAX 40" }
 */
export interface IndexOption {
  /**
   * Marketstack benchmark key for /v2/indexinfo endpoint.
   * @example "nikkei_225", "de40", "us500"
   */
  benchmark: string;

  /**
   * Human-readable index name.
   * @example "Nikkei 225", "DAX 40", "S&P 500"
   */
  indexName: string;
}

/**
 * Marketstack configuration for benchmark index data.
 * Supports multiple indices per exchange (Pro Promagen feature).
 *
 * @example
 * ```ts
 * // Single index exchange
 * const tokyo: MarketstackConfig = {
 *   defaultBenchmark: 'nikkei_225',
 *   defaultIndexName: 'Nikkei 225',
 *   availableIndices: [
 *     { benchmark: 'nikkei_225', indexName: 'Nikkei 225' }
 *   ]
 * };
 *
 * // Multi-index exchange
 * const frankfurt: MarketstackConfig = {
 *   defaultBenchmark: 'de40',
 *   defaultIndexName: 'DAX 40',
 *   availableIndices: [
 *     { benchmark: 'de40', indexName: 'DAX 40' },
 *     { benchmark: 'mdax', indexName: 'MDAX' },
 *     { benchmark: 'sdax', indexName: 'SDAX' },
 *     { benchmark: 'eu50', indexName: 'Euro Stoxx 50' }
 *   ]
 * };
 * ```
 */
export interface MarketstackConfig {
  /**
   * Default benchmark key used when no user preference is set.
   * Always the first/primary index for this exchange.
   * @example "nikkei_225", "de40", "us500"
   */
  defaultBenchmark: string;

  /**
   * Default index display name matching defaultBenchmark.
   * @example "Nikkei 225", "DAX 40", "S&P 500"
   */
  defaultIndexName: string;

  /**
   * All available indices for this exchange.
   * Pro users can choose which index to display.
   * Array always contains at least the default index.
   */
  availableIndices: IndexOption[];
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
 *     defaultBenchmark: 'nikkei_225',
 *     defaultIndexName: 'Nikkei 225',
 *     availableIndices: [
 *       { benchmark: 'nikkei_225', indexName: 'Nikkei 225' },
 *       { benchmark: 'jp225', indexName: 'Nikkei 225 (Alt)' },
 *       { benchmark: 'jpvix', indexName: 'Japan VIX' }
 *     ]
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
   * Links exchange to its benchmark indices.
   * Supports multiple indices per exchange (Pro Promagen).
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an exchange has multiple indices available.
 * Pro users can switch between indices for multi-index exchanges.
 *
 * @param exchange - The exchange to check
 * @returns true if exchange has more than one available index
 */
export function hasMultipleIndices(exchange: Exchange): boolean {
  return exchange.marketstack.availableIndices.length > 1;
}

/**
 * Get the active benchmark for an exchange.
 * Uses user preference if set, otherwise returns default.
 *
 * @param exchange - The exchange
 * @param userPreference - Optional user-selected benchmark
 * @returns The benchmark to use for API calls
 */
export function getActiveBenchmark(
  exchange: Exchange,
  userPreference?: string,
): string {
  if (userPreference) {
    // Validate user preference exists in available indices
    const isValid = exchange.marketstack.availableIndices.some(
      (idx) => idx.benchmark === userPreference,
    );
    if (isValid) return userPreference;
  }
  return exchange.marketstack.defaultBenchmark;
}

/**
 * Get the active index name for display.
 * Uses user preference if set, otherwise returns default.
 *
 * @param exchange - The exchange
 * @param userPreference - Optional user-selected benchmark
 * @returns The index name to display
 */
export function getActiveIndexName(
  exchange: Exchange,
  userPreference?: string,
): string {
  const activeBenchmark = getActiveBenchmark(exchange, userPreference);
  const index = exchange.marketstack.availableIndices.find(
    (idx) => idx.benchmark === activeBenchmark,
  );
  return index?.indexName ?? exchange.marketstack.defaultIndexName;
}

/**
 * Type guard to check if an unknown value is a valid Exchange.
 * Validates required fields including new multi-index structure.
 */
export function isExchange(value: unknown): value is Exchange {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;

  // Basic field checks
  if (
    typeof record.id !== 'string' ||
    typeof record.city !== 'string' ||
    typeof record.exchange !== 'string' ||
    typeof record.country !== 'string' ||
    typeof record.iso2 !== 'string' ||
    typeof record.tz !== 'string' ||
    typeof record.longitude !== 'number' ||
    typeof record.latitude !== 'number' ||
    typeof record.hoursTemplate !== 'string' ||
    typeof record.holidaysRef !== 'string' ||
    typeof record.hemisphere !== 'string' ||
    typeof record.hoverColor !== 'string'
  ) {
    return false;
  }

  // Marketstack config check
  if (typeof record.marketstack !== 'object' || record.marketstack === null) {
    return false;
  }

  const ms = record.marketstack as Record<string, unknown>;

  // Check for new multi-index structure
  if (
    typeof ms.defaultBenchmark === 'string' &&
    typeof ms.defaultIndexName === 'string' &&
    Array.isArray(ms.availableIndices)
  ) {
    // Validate availableIndices array
    return ms.availableIndices.every(
      (idx: unknown) =>
        typeof idx === 'object' &&
        idx !== null &&
        typeof (idx as Record<string, unknown>).benchmark === 'string' &&
        typeof (idx as Record<string, unknown>).indexName === 'string',
    );
  }

  // Legacy check (backward compatibility) - single benchmark/indexName
  return (
    typeof ms.benchmark === 'string' &&
    typeof ms.indexName === 'string'
  );
}

/**
 * Type guard to check if MarketstackConfig has multiple indices.
 */
export function isMultiIndexConfig(
  config: MarketstackConfig,
): config is MarketstackConfig & { availableIndices: IndexOption[] } {
  return Array.isArray(config.availableIndices) && config.availableIndices.length > 1;
}
