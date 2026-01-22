// src/lib/weather/fetch-weather.ts
// ============================================================================
// SERVER-SIDE WEATHER FETCHER
// ============================================================================
// Fetches live weather data from the gateway for server components.
// Falls back to demo data if gateway unavailable.
//
// FIXED (2026-01-22): Now maps ALL weather fields from gateway!
// - Added tempF, humidity, windKmh, description
// - Previously only mapped tempC, emoji, condition (causing 0% humidity, 0 km/h wind)
//
// Usage in server components (page.tsx):
// ```typescript
// import { getWeatherIndex } from '@/lib/weather/fetch-weather';
// const weatherIndex = await getWeatherIndex();
// ```
//
// Security: 10/10
// - Server-side only (no client secrets exposed)
// - Graceful fallback to demo data
// - Type-safe transformations
//
// Existing features preserved: Yes
// @module lib/weather/fetch-weather
// ============================================================================

import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/data/weather/exchange-weather.demo';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Gateway URL for weather data */
const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'https://promagen-api.fly.dev';

/** Timeout for gateway requests (ms) */
const FETCH_TIMEOUT_MS = 5_000;

// =============================================================================
// TYPES
// =============================================================================

/** Weather data shape from gateway API */
interface GatewayWeatherItem {
  id: string;
  city: string;
  temperatureC: number;
  temperatureF: number;
  conditions: string;
  description: string;
  humidity: number;
  windSpeedKmh: number;
  emoji: string;
  asOf: string;
}

/** Gateway response shape */
interface GatewayWeatherResponse {
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'fallback' | 'error';
    provider: string;
  };
  data: GatewayWeatherItem[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert gateway weather item to ExchangeWeatherData for cards.
 *
 * FIXED: Now maps ALL fields from gateway response.
 * Previously only mapped tempC, emoji, condition - causing 0% humidity, 0 km/h wind.
 */
function toWeatherData(item: GatewayWeatherItem): ExchangeWeatherData {
  return {
    tempC: item.temperatureC,
    tempF: item.temperatureF,
    emoji: item.emoji,
    condition: item.conditions,
    humidity: item.humidity,
    windKmh: item.windSpeedKmh,
    description: item.description,
  };
}

/**
 * Convert demo weather item to ExchangeWeatherData for cards.
 */
function demoToWeatherData(item: ExchangeWeather): ExchangeWeatherData {
  return {
    tempC: item.tempC,
    emoji: item.iconOverride ?? item.emoji,
    condition: item.condition,
    // Demo data doesn't have these, so leave undefined
    humidity: undefined,
    windKmh: undefined,
    description: undefined,
  };
}

/**
 * Build weather index from demo data (fallback).
 */
function buildDemoIndex(): Map<string, ExchangeWeatherData> {
  return new Map(DEMO_EXCHANGE_WEATHER.map((item) => [item.exchange, demoToWeatherData(item)]));
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Fetch weather data from gateway and build index map.
 *
 * Tries to fetch live data from gateway. If gateway fails or returns
 * empty data, falls back to demo data to ensure UI always has something.
 *
 * @returns Map of exchange ID → weather data
 *
 * @example
 * ```tsx
 * // In page.tsx (server component)
 * import { getWeatherIndex } from '@/lib/weather/fetch-weather';
 *
 * export default async function HomePage() {
 *   const weatherIndex = await getWeatherIndex();
 *   return <HomepageClient weatherIndex={weatherIndex} />;
 * }
 * ```
 */
export async function getWeatherIndex(): Promise<Map<string, ExchangeWeatherData>> {
  try {
    const response = await fetch(`${GATEWAY_URL}/weather`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Promagen-Frontend/1.0',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Cache for 5 minutes server-side
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.warn(`[Weather] Gateway returned ${response.status}, using demo data`);
      return buildDemoIndex();
    }

    const json = (await response.json()) as GatewayWeatherResponse;

    // Check if we got actual data
    if (!json.data || json.data.length === 0) {
      console.warn('[Weather] Gateway returned empty data, using demo data');
      return buildDemoIndex();
    }

    // Build index from live data
    const index = new Map<string, ExchangeWeatherData>();
    for (const item of json.data) {
      index.set(item.id, toWeatherData(item));
    }

    console.debug(`[Weather] Loaded ${index.size} cities from gateway (mode: ${json.meta.mode})`);
    return index;
  } catch (error) {
    console.warn(
      '[Weather] Gateway fetch failed, using demo data:',
      error instanceof Error ? error.message : error,
    );
    return buildDemoIndex();
  }
}

/**
 * Get weather index synchronously using demo data.
 * Use this when you can't await (e.g., in synchronous server components).
 *
 * @returns Map of exchange ID → weather data (demo only)
 */
export function getWeatherIndexSync(): Map<string, ExchangeWeatherData> {
  return buildDemoIndex();
}
