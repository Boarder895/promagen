// src/lib/weather/weather.ts

import type { ExchangeWeather } from '@/data/weather/exchange-weather.demo';

/**
 * Normalised shape for weather shown in the UI.
 *
 * Both demo data and any future live data are projected into this shape so
 * components never have to care where the values came from.
 */
export type MarketWeather = {
  /**
   * Exchange id (e.g. "lse-london") — must match exchanges.catalog.json.
   */
  id: string;

  /**
   * Human-readable city name — e.g. "London".
   *
   * This is passed in from the exchanges catalog so weather does not need to
   * know about geo logic.
   */
  city: string;

  /**
   * Temperature in °C as provided by the source.
   */
  temperatureC: number;

  /**
   * Optional "feels like" temperature. If missing, the UI should fall back
   * to temperatureC without crashing.
   */
  feelsLikeC?: number;

  /**
   * Free-form condition string, e.g. "Clear", "Rain", "Cloudy".
   *
   * In demo mode this comes from the ExchangeWeather condition; for live
   * mode it should follow the same vocabulary.
   */
  conditions: string;

  /**
   * ISO 8601 timestamp when this observation was taken, in the user's
   * local time zone or a clearly documented reference zone.
   *
   * UI code is responsible for turning this into the
   * "As of HH:mm (local)" label required by the Promagen standard.
   */
  updatedISO: string;
};

/**
 * Default cache duration for live weather: 30 minutes.
 *
 * With 12–16 exchanges this keeps you comfortably inside a ~1000 calls
 * per-day free tier even with retries and cold starts.
 */
export const DEFAULT_WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Resolve the icon to display for a given exchange weather entry.
 *
 * - If an explicit iconOverride is present, that always wins.
 * - Otherwise we fall back to the base emoji mapped from the condition.
 *
 * This keeps tests simple: you can assert override behaviour by setting
 * iconOverride and never touching the core mapping.
 */
export function resolveWeatherIcon(entry: Pick<ExchangeWeather, 'emoji' | 'iconOverride'>): string {
  if (entry.iconOverride && entry.iconOverride.trim().length > 0) {
    return entry.iconOverride;
  }

  return entry.emoji;
}

/**
 * Decide which temperature to show as "feels like".
 *
 * If feelsLikeC is present and finite, use that; otherwise fall back to
 * tempC. This guarantees a numeric value without forcing the caller to
 * duplicate the safety checks.
 */
export function resolveFeelsLike(tempC: number, feelsLikeC: number | undefined): number {
  if (typeof feelsLikeC === 'number' && Number.isFinite(feelsLikeC)) {
    return feelsLikeC;
  }

  return tempC;
}

/**
 * Project demo ExchangeWeather data into the richer MarketWeather shape.
 *
 * This keeps all demo-specific quirks (e.g. missing feelsLikeC) here so
 * UI components can treat MarketWeather as a clean, predictable contract.
 */
export function projectDemoToMarketWeather(
  exchange: ExchangeWeather,
  city: string,
  updatedISO: string = new Date().toISOString()
): MarketWeather {
  return {
    id: exchange.exchange,
    city,
    temperatureC: exchange.tempC,
    feelsLikeC: exchange.feelsLikeC,
    conditions: exchange.condition,
    updatedISO,
  };
}
