// src/lib/weather/exchange-weather.ts

import DEMO_EXCHANGE_WEATHER, {
  type ExchangeWeather,
  type ExchangeWeatherCondition,
} from '../../data/weather/exchange-weather.demo';

/**
 * In-memory lookup for demo exchange weather.
 *
 * This stays completely side-effect free at module level: we build the map
 * once from the canonical demo dataset so that both the API route and tests
 * can exercise predictable behaviour.
 */
const WEATHER_BY_EXCHANGE = new Map<string, ExchangeWeather>(
  DEMO_EXCHANGE_WEATHER.map((entry) => [entry.exchange, entry]),
);

/**
 * Resolve demo weather for a given exchange id.
 *
 * Returns:
 * - the ExchangeWeather entry if we have demo data for that id
 * - null otherwise (no throwing on unknown ids – callers stay simple)
 */
export function getExchangeWeather(exchangeId: string): ExchangeWeather | null {
  if (!exchangeId) {
    return null;
  }

  return WEATHER_BY_EXCHANGE.get(exchangeId) ?? null;
}

/**
 * Convenience helper for tests or debugging – returns all demo entries
 * in a stable order.
 */
export function listExchangeWeather(): ExchangeWeather[] {
  return DEMO_EXCHANGE_WEATHER.slice();
}

/**
 * Upper-camel alias for compatibility with any existing imports that
 * used `ListExchangeWeather`. Both names reference the same function.
 */
export const ListExchangeWeather = listExchangeWeather;

export type { ExchangeWeather, ExchangeWeatherCondition };

export { DEMO_EXCHANGE_WEATHER };
