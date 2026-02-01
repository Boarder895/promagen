// src/lib/pro-promagen/types.ts
// ============================================================================
// PRO PROMAGEN PAGE - Types
// ============================================================================
// Type definitions for the /pro-promagen feature showcase/configuration page.
//
// UPDATED: Added indices selection limits for stock index display on cards.
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

/**
 * Selection limits for Pro Promagen features.
 * UPDATED: Added INDICES limits for stock index selection.
 * Min changed to 0 to allow "start fresh" workflow.
 * Users can deselect all, then build their selection from scratch.
 */
export const PRO_SELECTION_LIMITS = {
  FX_MIN: 0,
  FX_MAX: 16,
  EXCHANGE_MIN: 0,
  EXCHANGE_MAX: 16,
  INDICES_MIN: 0,
  INDICES_MAX: 16,
} as const;

/**
 * Free tier defaults (SSOT).
 * UPDATED: Added INDICES default count.
 */
export const FREE_TIER_DEFAULTS = {
  FX_PAIRS: 8,
  EXCHANGES: 16,
  INDICES: 16, // All selected exchanges show their index by default
  MARKET_PULSE_CITIES: 4,
  DAILY_PROMPTS: 10,
  VOTE_WEIGHT: 1.0,
} as const;

/**
 * Pro tier features.
 * UPDATED: Added indices selection range.
 */
export const PRO_TIER_FEATURES = {
  FX_PAIRS_MIN: 0,
  FX_PAIRS_MAX: 16,
  EXCHANGES_MIN: 0,
  EXCHANGES_MAX: 16,
  INDICES_MIN: 0,
  INDICES_MAX: 16,
  MARKET_PULSE_CITIES: 16,
  DAILY_PROMPTS: Infinity,
  VOTE_WEIGHT: 1.5,
  PROMPT_STACKING_BONUS: 1,
} as const;

/**
 * Regional preset for exchanges.
 */
export interface ExchangePreset {
  id: string;
  label: string;
  description: string;
  exchangeIds: string[];
  gradient: string;
  glow: string;
  accent: string;
}

/**
 * FX pair preset for quick selection.
 */
export interface FxPreset {
  id: string;
  label: string;
  description: string;
  pairIds: string[];
  gradient: string;
  glow: string;
  accent: string;
}

/**
 * Feature comparison row for the comparison table.
 */
export interface FeatureComparison {
  feature: string;
  standard: string;
  pro: string;
  highlight?: boolean;
}

/**
 * Pro Promagen page state.
 * UPDATED: Added selectedIndices for index display control.
 */
export interface ProPromagenState {
  selectedFxPairs: string[];
  selectedExchanges: string[];
  selectedIndices: string[];
  referenceFrame: 'user' | 'greenwich';
  region: 'global' | 'east' | 'west';
}

/**
 * FX pair from UNIFIED catalog (fx-pairs.json).
 *
 * This is the single source of truth for all FX pair data.
 * Contains everything needed for:
 * - Homepage ribbon (isDefaultFree, precision, demo prices)
 * - Pro Promagen dropdown (countryLabel, baseCountryCode, quoteCountryCode)
 * - Pro Promagen demo ribbon (demo values)
 */
export interface FxPairCatalogEntry {
  /** Unique pair ID, e.g. "gbp-usd" */
  id: string;
  /** Base currency code, e.g. "GBP" */
  base: string;
  /** Quote currency code, e.g. "USD" */
  quote: string;
  /** Display label, e.g. "GBP/USD" */
  label: string;
  /** ISO 2-letter country code for base currency flag, e.g. "GB" */
  baseCountryCode?: string;
  /** ISO 2-letter country code for quote currency flag, e.g. "US" */
  quoteCountryCode?: string;
  /** Human-readable country names, e.g. "United Kingdom / United States" */
  countryLabel?: string;
  /** Decimal precision for price display */
  precision: number;
  /** FX category: major, cross, or emerging */
  category?: 'major' | 'cross' | 'emerging';
  /** Liquidity rank (1 = most liquid) */
  rank?: number;
  /** Whether this pair is shown by default for free users */
  isDefaultFree?: boolean;
  /** Whether this pair is shown by default for paid users */
  isDefaultPaid?: boolean;
  /** Pair group for categorization */
  group?: string;
  /** Home longitude for geographic ordering (degrees, east positive) */
  homeLongitude?: number | null;
  /** Demo price data for preview/fallback */
  demo: {
    value: number;
    prevClose: number;
  };
}

/**
 * Exchange from catalog.
 * hemisphere uses Promagen's 4-quadrant system: NE, NW, SE, SW
 * UPDATED v2.1.0: marketstack supports both legacy and multi-index formats.
 */
export interface ExchangeCatalogEntry {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
  latitude: number;
  hemisphere: string; // 'NE' | 'NW' | 'SE' | 'SW' | ''
  hoursTemplate: string;
  holidaysRef: string;
  /** 
   * Marketstack benchmark data for stock indices.
   * Supports both legacy (benchmark/indexName) and new multi-index format.
   */
  marketstack?: LegacyMarketstackConfig | MultiIndexMarketstackConfig;
  /** Vibrant hover color for exchange card UI */
  hoverColor?: string;
}

/**
 * Legacy marketstack format (single index).
 */
export interface LegacyMarketstackConfig {
  benchmark: string;
  indexName: string;
  status?: 'active' | 'coming-soon' | 'unavailable';
}

/**
 * New multi-index marketstack format.
 */
export interface MultiIndexMarketstackConfig {
  defaultBenchmark: string;
  defaultIndexName: string;
  availableIndices: Array<{
    benchmark: string;
    indexName: string;
    status?: 'active' | 'coming-soon' | 'unavailable';
  }>;
}

/**
 * Type guard to check if marketstack config is multi-index format.
 */
export function isMultiIndexConfig(
  config: LegacyMarketstackConfig | MultiIndexMarketstackConfig | undefined
): config is MultiIndexMarketstackConfig {
  return config !== undefined && 'availableIndices' in config;
}

/**
 * Index catalog entry for dropdown selection.
 * Derived from exchanges that have marketstack benchmarks.
 */
export interface IndicesCatalogEntry {
  /** Exchange ID this index belongs to */
  id: string;
  /** Index name, e.g. "Nikkei 225" */
  indexName: string;
  /** Marketstack benchmark symbol */
  benchmark: string;
  /** Exchange name for context */
  exchangeName: string;
  /** Country for sub-label */
  country: string;
  /** Whether data is available (active) or coming soon */
  status: 'active' | 'coming-soon' | 'unavailable';
}

// ============================================================================
// CURRENCY TO COUNTRY CODE MAPPING
// ============================================================================

/**
 * Maps 3-letter ISO currency codes to 2-letter ISO country codes for flags.
 * Most currencies map to their country (USD → US), with exceptions for:
 * - EUR (Eurozone) → EU
 * - GBP (Great Britain) → GB
 * - Special cases like offshore yuan (CNH)
 */
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  // Majors
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  JPY: 'JP',
  CHF: 'CH',
  AUD: 'AU',
  CAD: 'CA',
  NZD: 'NZ',
  
  // Asia Pacific
  CNY: 'CN',
  CNH: 'CN', // Offshore yuan
  HKD: 'HK',
  SGD: 'SG',
  KRW: 'KR',
  TWD: 'TW',
  THB: 'TH',
  MYR: 'MY',
  IDR: 'ID',
  PHP: 'PH',
  VND: 'VN',
  INR: 'IN',
  PKR: 'PK',
  
  // Europe
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  PLN: 'PL',
  CZK: 'CZ',
  HUF: 'HU',
  RON: 'RO',
  BGN: 'BG',
  HRK: 'HR',
  ISK: 'IS',
  RUB: 'RU',
  TRY: 'TR',
  UAH: 'UA',
  
  // Middle East
  AED: 'AE',
  SAR: 'SA',
  QAR: 'QA',
  KWD: 'KW',
  BHD: 'BH',
  OMR: 'OM',
  JOD: 'JO',
  ILS: 'IL',
  EGP: 'EG',
  
  // Africa
  ZAR: 'ZA',
  NGN: 'NG',
  KES: 'KE',
  GHS: 'GH',
  MAD: 'MA',
  TND: 'TN',
  MUR: 'MU',
  
  // Americas
  MXN: 'MX',
  BRL: 'BR',
  ARS: 'AR',
  CLP: 'CL',
  COP: 'CO',
  PEN: 'PE',
  UYU: 'UY',
  
  // Precious metals (use neutral flags or skip)
  XAU: '', // Gold
  XAG: '', // Silver
  XPT: '', // Platinum
  XPD: '', // Palladium
};

/**
 * Get ISO 2-letter country code for a currency code.
 * Falls back to first 2 letters if not in mapping.
 */
export function getCountryCodeForCurrency(currency: string): string {
  const upper = currency.toUpperCase();
  return CURRENCY_TO_COUNTRY[upper] ?? upper.slice(0, 2);
}

/**
 * Derive country codes for a pair from base/quote currencies.
 * Used when FxPairCatalogEntry doesn't have explicit country codes.
 */
export function deriveCountryCodes(base: string, quote: string): {
  baseCountryCode: string;
  quoteCountryCode: string;
} {
  return {
    baseCountryCode: getCountryCodeForCurrency(base),
    quoteCountryCode: getCountryCodeForCurrency(quote),
  };
}

/**
 * Build indices catalog from exchange catalog.
 * Filters exchanges that have marketstack benchmarks.
 * Handles both legacy and multi-index formats.
 */
export function buildIndicesCatalog(
  exchanges: ExchangeCatalogEntry[]
): IndicesCatalogEntry[] {
  const result: IndicesCatalogEntry[] = [];
  
  for (const e of exchanges) {
    if (!e.marketstack) continue;
    
    if (isMultiIndexConfig(e.marketstack)) {
      // New multi-index format - add all available indices
      for (const idx of e.marketstack.availableIndices) {
        result.push({
          id: e.id,
          indexName: idx.indexName,
          benchmark: idx.benchmark,
          exchangeName: e.exchange,
          country: e.country,
          status: idx.status ?? 'active',
        });
      }
    } else {
      // Legacy single-index format
      result.push({
        id: e.id,
        indexName: e.marketstack.indexName,
        benchmark: e.marketstack.benchmark,
        exchangeName: e.exchange,
        country: e.country,
        status: e.marketstack.status ?? 'active',
      });
    }
  }
  
  return result.sort((a, b) => a.indexName.localeCompare(b.indexName));
}
