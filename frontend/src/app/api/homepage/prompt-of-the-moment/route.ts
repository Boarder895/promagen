// src/app/api/homepage/prompt-of-the-moment/route.ts
// ============================================================================
// PROMPT OF THE MOMENT — API Route (v2.0 — Shared Generator)
// ============================================================================
// Generates the live prompt showcase for the homepage centre column.
// Rotates through 102 cities from city-vibes.json on a 3-minute cadence.
//
// v2.0: Core generation logic extracted to lib/homepage/generate-potm-data.ts.
// This route is now a thin wrapper that:
//   1. Manages the in-memory weather gateway cache
//   2. Calls the shared generatePotmData() function
//   3. Logs to Community Pulse DB (fire-and-forget)
//   4. Returns the response with cache headers
//
// The shared generator is also called by page.tsx during SSR, so the POTM
// appears in the initial HTML. This route handles 3-minute client refreshes.
//
// Cache: 3-minute stale-while-revalidate (aligned to rotation cadence)
//
// Authority: docs/authority/homepage.md §4, §6.2
// Existing features preserved: Yes
// ============================================================================

import { NextResponse } from 'next/server';
import type { ExchangeWeatherFull } from '@/lib/weather/weather-types';
import type { PromptOfTheMoment } from '@/types/homepage';
import type { WeatherCategoryMap } from '@/types/prompt-builder';
import { generatePotmData } from '@/lib/homepage/generate-potm-data';

// Phase 5: DB imports for Community Pulse auto-logging
import { hasDatabaseConfigured, db } from '@/lib/db';
import { ensureShowcaseTables } from '@/lib/showcase/database';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Gateway URL — same resolution chain as fetch-weather.ts */
const GATEWAY_URL =
  process.env['GATEWAY_URL'] ??
  process.env['NEXT_PUBLIC_GATEWAY_URL'] ??
  process.env['FX_GATEWAY_URL'] ??
  'https://promagen-api.fly.dev';

// ============================================================================
// GATEWAY WEATHER CACHE
// ============================================================================
// The API route maintains its own in-memory weather cache because it runs
// server-side on every 3-minute client refresh. The SSR path in page.tsx
// uses the weatherIndex it already fetched for the page.

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
  sunriseUtc?: number | null;
  sunsetUtc?: number | null;
  timezoneOffset?: number | null;
  isDayTime?: boolean;
  cloudCover?: number | null;
  visibility?: number | null;
  pressure?: number | null;
  rainMm1h?: number | null;
  snowMm1h?: number | null;
  windDegrees?: number | null;
  windGustKmh?: number | null;
  weatherId?: number | null;
}

let _weatherCache: Map<string, ExchangeWeatherFull> | null = null;
let _weatherCacheAge = 0;
const WEATHER_CACHE_TTL = 600_000; // 10 minutes

async function refreshWeatherCache(): Promise<Map<string, ExchangeWeatherFull>> {
  // Return from cache if fresh
  if (_weatherCache && Date.now() - _weatherCacheAge < WEATHER_CACHE_TTL) {
    return _weatherCache;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${GATEWAY_URL}/weather`, {
      signal: controller.signal,
      next: { revalidate: 600 },
    });

    clearTimeout(timeout);
    if (!res.ok) return _weatherCache ?? new Map();

    const json: { data: GatewayWeatherItem[] } = await res.json();
    const newCache = new Map<string, ExchangeWeatherFull>();

    for (const item of json.data ?? []) {
      if (item.temperatureC == null) continue;
      newCache.set(item.id, {
        temperatureC: item.temperatureC,
        temperatureF: item.temperatureF ?? (item.temperatureC * 9) / 5 + 32,
        conditions: item.conditions ?? 'Unknown',
        description: item.description ?? '',
        humidity: item.humidity ?? 50,
        windSpeedKmh: item.windSpeedKmh ?? 5,
        emoji: item.emoji ?? '🌤️',
        sunriseUtc: item.sunriseUtc ?? null,
        sunsetUtc: item.sunsetUtc ?? null,
        timezoneOffset: item.timezoneOffset ?? null,
        isDayTime: item.isDayTime ?? null,
        cloudCover: item.cloudCover ?? null,
        visibility: item.visibility ?? null,
        pressure: item.pressure ?? null,
        rainMm1h: item.rainMm1h ?? null,
        snowMm1h: item.snowMm1h ?? null,
        windDegrees: item.windDegrees ?? null,
        windGustKmh: item.windGustKmh ?? null,
        weatherId: item.weatherId ?? null,
      });
    }

    _weatherCache = newCache;
    _weatherCacheAge = Date.now();
    return newCache;
  } catch {
    return _weatherCache ?? new Map();
  }
}

// ============================================================================
// LAST SUCCESSFUL RESPONSE (never show error state)
// ============================================================================

let _lastSuccessful: PromptOfTheMoment | null = null;

// ============================================================================
// COMMUNITY PULSE AUTO-LOGGING (Phase 5 — Step 5.4)
// ============================================================================

const _loggedRotations = new Set<number>();

async function logShowcaseEntry(
  response: PromptOfTheMoment,
  categoryMap?: WeatherCategoryMap,
): Promise<void> {
  try {
    if (!hasDatabaseConfigured()) return;
    if (_loggedRotations.has(response.rotationIndex)) return;

    _loggedRotations.add(response.rotationIndex);

    if (_loggedRotations.size > 200) {
      const oldest = [..._loggedRotations].slice(0, _loggedRotations.size - 100);
      for (const idx of oldest) _loggedRotations.delete(idx);
    }

    await ensureShowcaseTables();
    const sql = db();

    const description = response.city.slice(0, 60);

    const conditions = response.conditions.toLowerCase();
    let score = 82;
    if (conditions.includes('storm') || conditions.includes('thunder')) score = 93;
    else if (conditions.includes('snow') || conditions.includes('blizzard')) score = 91;
    else if (conditions.includes('fog') || conditions.includes('mist') || conditions.includes('haze')) score = 90;
    else if (conditions.includes('rain') || conditions.includes('drizzle')) score = 87;
    else if (conditions.includes('overcast') || conditions.includes('cloud')) score = 84;
    else score = 78;

    const promptsJson = categoryMap ? JSON.stringify(categoryMap) : null;
    const weatherJson = response.weather ? JSON.stringify(response.weather) : null;

    await sql`
      INSERT INTO prompt_showcase_entries
        (city, country_code, venue, mood, tier, platform_id, prompt_text, description, score, source, prompts_json, weather_json)
      VALUES
        (${response.city}, ${response.countryCode}, ${response.venue}, '',
         'tier3', NULL, ${response.prompts.tier3}, ${description}, ${score}, 'weather', ${promptsJson}, ${weatherJson})
    `;
  } catch (error) {
    console.warn('[prompt-of-the-moment] Showcase entry log failed:', error);
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<PromptOfTheMoment | { error: string }>> {
  try {
    // ── 1. Refresh weather cache from gateway ─────────────────────────────
    const weatherMap = await refreshWeatherCache();

    // ── 2. Generate POTM using shared function ────────────────────────────
    const result = generatePotmData({
      weatherLookup: (exchangeId) => weatherMap.get(exchangeId) ?? null,
    });

    _lastSuccessful = result.data;

    // ── 3. Auto-log to Community Pulse feed (fire-and-forget) ─────────────
    void logShowcaseEntry(result.data, result.categoryMap);

    return NextResponse.json(result.data, {
      headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[prompt-of-the-moment] Error:', error);

    if (_lastSuccessful) {
      return NextResponse.json(_lastSuccessful, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
      });
    }

    return NextResponse.json({ error: 'Failed to generate prompt' } as { error: string }, {
      status: 500,
    });
  }
}
