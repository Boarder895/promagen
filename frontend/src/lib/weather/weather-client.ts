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
  icon?: string;
  datetimeEpoch?: number;
}

interface VisualCrossingTimelineResponse {
  resolvedAddress?: string;
  timezone?: string;
  currentConditions?: VisualCrossingCurrentConditions;
}

/**
 * Simple in-memory cache keyed by an arbitrary string, typically the
 * exchange id ("lse-london" etc.).
 *
 * This is process-local and is mainly to enforce "no more than ~2 calls
 * per day per exchange" in dev and on a single Node process. When you
 * deploy Promagen to serverless, you will want a more durable cache
 * (KV / Redis / ISR), but this is a clean starting point.
 */
type CacheKey = string;

type CachedWeather = {
  weather: MarketWeather;
  fetchedAt: number;
};

const cache = new Map<CacheKey, CachedWeather>();

function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    // Hard fail rather than silently leaking the key into the client bundle.
    throw new Error(
      'weather-client must only be used server-side (API route or server component).',
    );
  }
}

/**
 * Fetch weather for an exchange, using a simple time-based cache.
 *
 * - key: stable id for the cache (e.g. exchange id)
 * - city: human city name (for display)
 * - latitude / longitude: taken from exchanges.catalog.json
 * - refreshIntervalMs: defaults to 30 minutes; you can tune this later
 *   for paid tiers if needed.
 */
export async function getOrFetchMarketWeather(
  key: string,
  city: string,
  latitude: number,
  longitude: number,
  refreshIntervalMs: number = DEFAULT_WEATHER_REFRESH_INTERVAL_MS,
): Promise<MarketWeather> {
  assertServerSide();

  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.fetchedAt < refreshIntervalMs) {
    return cached.weather;
  }

  const fresh = await fetchVisualCrossingWeather(key, city, latitude, longitude);

  cache.set(key, {
    weather: fresh,
    fetchedAt: now,
  });

  return fresh;
}

/**
 * Low-level Visual Crossing call.
 *
 * This does a single Timeline query for "now", metric units, JSON.
 * It assumes you have VISUAL_CROSSING_API_KEY set in the server env
 * (never client-side).
 */
async function fetchVisualCrossingWeather(
  id: string,
  city: string,
  latitude: number,
  longitude: number,
): Promise<MarketWeather> {
  const apiKey = process.env.VISUAL_CROSSING_API_KEY;

  if (!apiKey) {
    throw new Error(
      'VISUAL_CROSSING_API_KEY is not configured in the server environment.',
    );
  }

  const searchParams = new URLSearchParams({
    key: apiKey,
    unitGroup: 'metric',
    include: 'current',
    elements: 'temp,feelslike,conditions,icon,datetimeEpoch',
    contentType: 'json',
  });

  const url = `${VISUAL_CROSSING_BASE_URL}/${latitude},${longitude}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    // The homepage really doesn’t need to hang on weather.
    cache: 'no-store',
  });

  if (!response.ok) {
    // We surface a clear, typed error here so the caller can decide whether
    // to fall back to demo data or a generic "no weather" state.
    throw new Error(
      `Visual Crossing request failed with status ${response.status}`,
    );
  }

  const json = (await response.json()) as VisualCrossingTimelineResponse;
  const current = json.currentConditions ?? {};

  const temperatureC =
    typeof current.temp === 'number' ? current.temp : Number.NaN;

  const feelsLikeC =
    typeof current.feelslike === 'number' ? current.feelslike : Number.NaN;

  const conditions = typeof current.conditions === 'string'
    ? current.conditions
    : 'Unknown';

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
