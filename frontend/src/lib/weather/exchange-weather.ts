// frontend/src/lib/exchange-weather.ts

import DEMO_EXCHANGE_WEATHER, {
  ExchangeWeather,
} from '@/data/exchange-weather.demo';

/**
 * Simple lookup table from exchange code (e.g. "LSE") to weather data.
 */
const WEATHER_BY_EXCHANGE = new Map<string, ExchangeWeather>(
  DEMO_EXCHANGE_WEATHER.map((item) => [item.exchange, item]),
);

export function getExchangeWeather(
  exchangeCode: string | undefined,
): ExchangeWeather | undefined {
  if (!exchangeCode) return undefined;
  return WEATHER_BY_EXCHANGE.get(exchangeCode);
}
