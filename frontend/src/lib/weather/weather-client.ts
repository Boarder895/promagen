// src/lib/weather/weather-client.ts

import type { MarketWeather } from './weather';
import { DEFAULT_WEATHER_REFRESH_INTERVAL_MS } from './weather';

const VISUAL_CROSSING_BASE_URL =
  'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';

/**
 * Minimal subset of the Visual Crossing Timeline response that we care about.
 * We intentionally keep this narrow and defensive.
 */
interface VisualCrossingCurrentConditions {
  temp?: number;
  feelslike?: number;
  conditions?: string;
  datetimeEpoch?: number;
}

interface VisualCrossingResponse {
  address?: string;
  timezone?: string;
  currentConditions?: VisualCrossingCurrentConditions;
}

type CacheEntry = {
  value: MarketWeather;
  expiresAt: number;
};

const CACHE = new Map<string, CacheEntry>();

function cacheKeyFor(id: string): string {
  return `weather:${id}`;
}

/**
 * Fetch fresh weather for an exchange from Visual Crossing.
 */
async function fetchLiveWeather(
  id: string,
  city: string,
  latitude: number,
  longitude: number,
): Promise<MarketWeather> {
  const apiKey = process.env.VISUAL_CROSSING_API_KEY;
  if (!apiKey) {
    throw new Error('VISUAL_CROSSING_API_KEY is not configured in the server environment.');
  }

  const url = new URL(
    `${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`,
    VISUAL_CROSSING_BASE_URL,
  );

  url.searchParams.set('unitGroup', 'metric');
  url.searchParams.set('include', 'current');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('contentType', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Visual Crossing request failed with status ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as VisualCrossingResponse;

  const current = json.currentConditions ?? {};
  const temperatureC = typeof current.temp === 'number' ? current.temp : 0;
  const feelsLikeC = typeof current.feelslike === 'number' ? current.feelslike : temperatureC;
  const conditions = current.conditions ?? 'Unknown';

  const updatedISO =
    typeof current.datetimeEpoch === 'number'
      ? new Date(current.datetimeEpoch * 1000).toISOString()
      : new Date().toISOString();

  return {
    id,
    city,
    temperatureC,
    feelsLikeC,
    conditions,
    updatedISO,
  };
}

/**
 * Get (and lazily cache) MarketWeather for an exchange.
 *
 * - If we have a fresh cache entry, return that.
 * - Otherwise, fetch from Visual Crossing and populate the cache.
 */
export async function getOrFetchMarketWeather(
  id: string,
  city: string,
  latitude: number,
  longitude: number,
  ttlMs: number = DEFAULT_WEATHER_REFRESH_INTERVAL_MS,
): Promise<MarketWeather> {
  const key = cacheKeyFor(id);
  const now = Date.now();

  const existing = CACHE.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const fresh = await fetchLiveWeather(id, city, latitude, longitude);

  CACHE.set(key, {
    value: fresh,
    expiresAt: now + ttlMs,
  });

  return fresh;
}

/**
 * For tests: clear the internal cache.
 */
export function __resetWeatherCache(): void {
  CACHE.clear();
}
