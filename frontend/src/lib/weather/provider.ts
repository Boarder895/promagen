// src/lib/weather/provider.ts
import type { Exchange } from '../market/types';
import type { WeatherSummary } from '../market/types';

// Stage-1 mock: deterministic pseudo-random temp/condition from city name.
export function getWeatherFor(exchange: Exchange): WeatherSummary {
  const seed = [...exchange.city].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tempC = Math.round((((seed % 300) / 10) - 10)); // ~-10..20C
  const conditions: WeatherSummary['condition'][] = [
    'Clear', 'Cloudy', 'Partly Cloudy', 'Rain', 'Haze', 'Fog', 'Drizzle', 'Thunder'
  ];
  const condition = conditions[seed % conditions.length];
  return { tempC, condition };
}

