// src/lib/weather/exchange-weather.ts
/**
 * Barrel export for weather types and demo data.
 *
 * Re-exports from src/data/weather/exchange-weather.demo.ts so imports like
 * `@/lib/weather/exchange-weather` resolve correctly.
 *
 * @module lib/weather/exchange-weather
 */

export {
  DEMO_EXCHANGE_WEATHER,
  type ExchangeWeather,
  type ExchangeWeatherCondition,
} from '@/data/weather/exchange-weather.demo';

export { default } from '@/data/weather/exchange-weather.demo';
