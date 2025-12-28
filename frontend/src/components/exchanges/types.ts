// frontend/src/components/exchanges/types.ts

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
 * Unified exchange data shape for the card component.
 * This abstracts over both @/lib/exchanges.Exchange and @/lib/exchange-order.Exchange
 * so the card can be used in both home/rails and ribbon contexts.
 */
export type ExchangeCardData = {
  /** Stable identifier, e.g. "nzx-wellington", "tse-tokyo" */
  id: string;
  /** Full display name, e.g. "New Zealand Exchange (NZX)" */
  name: string;
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
