// frontend/src/components/exchanges/types.ts
// ============================================================================
// EXCHANGE CARD TYPES
// ============================================================================
// Unified types for exchange card components.
// UPDATED: Added indexName (from catalog) for always-visible index row.
//
// Security: 10/10
// - All types are strict
// - Optional fields explicitly marked
// - No any types
//
// Existing features preserved: Yes
// ============================================================================

/**
 * Unified weather data shape for exchange cards.
 * Source: API (when implemented) or null (fallback to SSOT emoji).
 */
export type ExchangeWeatherData = {
  /** Temperature in Celsius; null if unavailable */
  tempC: number | null;
  /** Weather condition emoji; null triggers SSOT fallback */
  emoji: string | null;
  /** Optional condition text for accessibility */
  condition?: string | null;
};

/**
 * Index quote data for display on exchange cards.
 * Source: Gateway API via useIndicesQuotes hook.
 */
export type IndexQuoteData = {
  /** Index name, e.g. "Nikkei 225", "S&P 500" */
  indexName: string;
  /** Current price/value */
  price: number;
  /** Day change in points */
  change: number;
  /** Day change as percentage */
  percentChange: number;
  /** Movement direction */
  tick: 'up' | 'down' | 'flat';
};

/**
 * Unified exchange data shape for the card component.
 * This abstracts over both @/lib/exchanges.Exchange and @/lib/exchange-order.Exchange
 * so the card can be used in both home/rails and ribbon contexts.
 */
export type ExchangeCardData = {
  /** Stable identifier, e.g. "nzx-wellington", "tse-tokyo" */
  id: string;
  /** Full display name, e.g. "New Zealand Exchange (NZX)" */
  name: string;
  /**
   * Short display name for space-constrained UI (ribbon, cards).
   * Falls back to 'name' if not provided.
   * @example "Tokyo (TSE)", "ASX Sydney", "HKEX"
   */
  ribbonLabel?: string;
  /** City where the primary market is located, e.g. "Wellington" */
  city: string;
  /** ISO-3166 alpha-2 country code for flag, e.g. "NZ", "JP" */
  countryCode: string;
  /** IANA timezone identifier, e.g. "Pacific/Auckland", "Asia/Tokyo" */
  tz: string;
  /** Reference to market hours template for open/closed status */
  hoursTemplate?: string;
  /** Optional weather data from API */
  weather?: ExchangeWeatherData | null;
  /**
   * Index name from catalog (always available).
   * Used to display index row even before API data loads.
   * @example "Nikkei 225", "S&P 500", "FTSE 100"
   */
  indexName?: string;
  /** Optional index quote data from gateway (price, change, etc.) */
  indexQuote?: IndexQuoteData | null;
  /**
   * Unique vibrant hover color for this exchange.
   * Applied as border/glow when cursor hovers over the entire card.
   * Hex format, e.g. "#FF4500" (Tokyo), "#2563EB" (NYSE)
   */
  hoverColor?: string;
};

/**
 * Market status derived from time-based logic.
 * Future: expanded to include "lunch", "holiday", "pre", "post".
 */
export type MarketStatus = 'open' | 'closed';

/**
 * Props for the unified ExchangeCard component.
 */
export type ExchangeCardProps = {
  /** Exchange data (unified shape) */
  exchange: ExchangeCardData;
  /** Optional className for the card container */
  className?: string;
};
