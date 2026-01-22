// frontend/src/components/exchanges/types.ts
// ============================================================================
// EXCHANGE CARD TYPES
// ============================================================================
// Unified types for exchange card components.
// UPDATED: Extended weather data for prompt generation.
// UPDATED: Added promptTier and isPro for weather tooltip.
// UPDATED (19 Jan 2026): Added railPosition for tooltip direction control.
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
 * Extended to include all fields needed for prompt generation.
 */
export type ExchangeWeatherData = {
  /** Temperature in Celsius; null if unavailable */
  tempC: number | null;
  /** Temperature in Fahrenheit; null if unavailable */
  tempF?: number | null;
  /** Weather condition emoji; null triggers SSOT fallback */
  emoji: string | null;
  /** Optional condition text for accessibility */
  condition?: string | null;
  /** Humidity percentage (for display and prompt) */
  humidity?: number | null;
  /** Wind speed in km/h (for display and prompt) */
  windKmh?: number | null;
  /** Wind speed in km/h (alternative field name from API) */
  windSpeedKmh?: number | null;
  /** Full weather description (for prompt generation) */
  description?: string | null;
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
  /** Optional weather data from API (extended for prompts) */
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
 * Rail position for tooltip direction control.
 * - 'left': Card is in the left rail (eastern exchanges) → tooltip opens right
 * - 'right': Card is in the right rail (western exchanges) → tooltip opens left
 */
export type RailPosition = 'left' | 'right';

/**
 * Props for the unified ExchangeCard component.
 */
export type ExchangeCardProps = {
  /** Exchange data (unified shape) */
  exchange: ExchangeCardData;
  /** Optional className for the card container */
  className?: string;
  /** Prompt tier for weather tooltip (1-4). Default: 4 (free) */
  promptTier?: 1 | 2 | 3 | 4;
  /** Whether user is Pro tier */
  isPro?: boolean;
  /**
   * Which rail the card is in - controls tooltip direction.
   * - 'left' (default): Tooltip opens to the RIGHT
   * - 'right': Tooltip opens to the LEFT (to prevent viewport clipping)
   */
  railPosition?: RailPosition;
};
