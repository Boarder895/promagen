// src/app/api/homepage/prompt-of-the-moment/route.ts
// ============================================================================
// PROMPT OF THE MOMENT — API Route
// ============================================================================
// Generates the live prompt showcase for the homepage centre column.
// Rotates through 102 cities from city-vibes.json on a 10-minute cadence.
//
// Data flow:
// 1. Deterministic rotation selects city: floor(now / 10min) % 102
// 2. Weather fetched from gateway (same /weather endpoint as exchange cards)
// 3. Demo fallback if gateway unavailable (15°C, partly cloudy)
// 4. generateWeatherPrompt() produces all 4 tier prompts
// 5. Top providers per tier resolved from PLATFORM_TIERS + providers.json
//
// Cache: 10-minute stale-while-revalidate (aligned to rotation cadence)
//
// Phase 5 addition: Auto-logs each new rotation as a prompt_showcase_entries
// row (weather-seeded). This populates the Community Pulse feed. Only one
// insert per rotation index (tracked in-memory).
//
// Authority: docs/authority/homepage.md §4, §6.2
// Existing features preserved: Yes
// ============================================================================

import { NextResponse } from 'next/server';
import { generateWeatherPrompt } from '@/lib/weather/weather-prompt-generator';
import type { PromptTier } from '@/lib/weather/prompt-types';
import type { ExchangeWeatherFull } from '@/lib/weather/weather-types';
import { PLATFORM_TIERS } from '@/data/platform-tiers';
import { getProviders } from '@/lib/providers/api';
import type { PromptOfTheMoment, ProviderShortcut } from '@/types/homepage';
import type { WeatherCategoryMap } from '@/types/prompt-builder';
import { hashCategoryMap } from '@/lib/prompt-dna';

// Phase 5: DB imports for Community Pulse auto-logging
import { hasDatabaseConfigured, db } from '@/lib/db';
import { ensureShowcaseTables } from '@/lib/showcase/database';

import cityVibesData from '@/data/vocabulary/weather/city-vibes.json';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Rotation cadence in milliseconds (10 minutes) */
const ROTATION_MS = 10 * 60 * 1000;

/** Gateway URL — same resolution chain as fetch-weather.ts */
const GATEWAY_URL =
  process.env['GATEWAY_URL'] ??
  process.env['NEXT_PUBLIC_GATEWAY_URL'] ??
  process.env['FX_GATEWAY_URL'] ??
  'https://promagen-api.fly.dev';

/** All providers per tier are returned — frontend handles overflow */

// ============================================================================
// DATA STRUCTURES (computed once at module load)
// ============================================================================

interface CityVibe {
  country: string;
  venues: Array<{ name: string; setting: string }>;
}

const CITIES: Record<string, CityVibe> = (cityVibesData as { cities: Record<string, CityVibe> })
  .cities;
const CITY_KEYS = Object.keys(CITIES).sort(); // deterministic alphabetical
const TOTAL_CITIES = CITY_KEYS.length; // 102

interface ExchangeEntry {
  id: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  tz?: string;
  iso2?: string;
  countryCode?: string;
}

const EXCHANGES: ExchangeEntry[] = exchangesCatalog as ExchangeEntry[];

/** city (lowercase) → first matching exchange. */
const CITY_TO_EXCHANGE = new Map<string, ExchangeEntry>();
for (const ex of EXCHANGES) {
  const city = (ex.city ?? '').toLowerCase();
  if (city && !CITY_TO_EXCHANGE.has(city)) {
    CITY_TO_EXCHANGE.set(city, ex);
  }
}

// Country name → ISO alpha-2 (covers all 102 city-vibes countries)
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  Argentina: 'AR',
  Australia: 'AU',
  Austria: 'AT',
  Bahrain: 'BH',
  Bangladesh: 'BD',
  Belgium: 'BE',
  'Bosnia and Herzegovina': 'BA',
  Botswana: 'BW',
  Brazil: 'BR',
  Canada: 'CA',
  Chile: 'CL',
  China: 'CN',
  Colombia: 'CO',
  Croatia: 'HR',
  Cyprus: 'CY',
  'Czech Republic': 'CZ',
  Denmark: 'DK',
  Ecuador: 'EC',
  Egypt: 'EG',
  Finland: 'FI',
  France: 'FR',
  Germany: 'DE',
  Ghana: 'GH',
  Greece: 'GR',
  'Hong Kong': 'HK',
  Hungary: 'HU',
  India: 'IN',
  Indonesia: 'ID',
  Ireland: 'IE',
  Israel: 'IL',
  Italy: 'IT',
  Japan: 'JP',
  Jordan: 'JO',
  Kazakhstan: 'KZ',
  Kenya: 'KE',
  Kuwait: 'KW',
  Laos: 'LA',
  Latvia: 'LV',
  Lebanon: 'LB',
  Malaysia: 'MY',
  Mauritius: 'MU',
  Mexico: 'MX',
  Mongolia: 'MN',
  Montenegro: 'ME',
  Morocco: 'MA',
  Namibia: 'NA',
  Netherlands: 'NL',
  'New Zealand': 'NZ',
  Nigeria: 'NG',
  'North Macedonia': 'MK',
  Norway: 'NO',
  Oman: 'OM',
  Pakistan: 'PK',
  Peru: 'PE',
  Philippines: 'PH',
  Poland: 'PL',
  Portugal: 'PT',
  Qatar: 'QA',
  Romania: 'RO',
  Russia: 'RU',
  'Saudi Arabia': 'SA',
  Serbia: 'RS',
  Singapore: 'SG',
  Slovakia: 'SK',
  Slovenia: 'SI',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  Spain: 'ES',
  'Sri Lanka': 'LK',
  Sweden: 'SE',
  Switzerland: 'CH',
  Taiwan: 'TW',
  Tanzania: 'TZ',
  Thailand: 'TH',
  Turkey: 'TR',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'United States': 'US',
  Venezuela: 'VE',
  Vietnam: 'VN',
};

// ============================================================================
// PROVIDER SHORTCUTS
// ============================================================================

/** Cache provider shortcuts per tier (computed once, stable for server lifetime). */
let _providerShortcutCache: Record<string, ProviderShortcut[]> | null = null;

function getProviderShortcutsAllTiers(): Record<string, ProviderShortcut[]> {
  if (_providerShortcutCache) return _providerShortcutCache;

  const allProviders = getProviders();
  const cache: Record<string, ProviderShortcut[]> = {};

  for (const tierNum of [1, 2, 3, 4] as const) {
    const tierDef = PLATFORM_TIERS[tierNum];
    if (!tierDef) {
      cache[`tier${tierNum}`] = [];
      continue;
    }

    const tierProviderIds = new Set(tierDef.platforms);
    const shortcuts: ProviderShortcut[] = [];

    for (const provider of allProviders) {
      if (tierProviderIds.has(provider.id) && provider.localIcon) {
        shortcuts.push({
          id: provider.id,
          name: provider.name,
          iconPath: provider.localIcon,
        });
      }
    }

    cache[`tier${tierNum}`] = shortcuts;
  }

  _providerShortcutCache = cache;
  return cache;
}

// ============================================================================
// DEMO WEATHER FALLBACK
// ============================================================================

function getDemoWeather(): ExchangeWeatherFull {
  // Realistic defaults so tooltip always generates a complete sentence.
  // sunriseUtc/sunsetUtc/timezoneOffset set to null intentionally:
  //   - Hardcoded UTC values (e.g., 06:30 UTC) display as nonsensical local
  //     times when formatted in non-UTC timezones (Tokyo sunrise "15:30").
  //   - null forces getNextSunEvent() Tier 2 (NOAA astronomical calc from lat/lon)
  //     which gives ±5 min accuracy with no fake data.
  //   - null forces resolveIsNight() Tier 2 (IANA timezone → local hour) which
  //     is always correct regardless of gateway availability.
  return {
    temperatureC: 15,
    temperatureF: 59,
    conditions: 'Partly Cloudy',
    description: 'partly cloudy',
    humidity: 55,
    windSpeedKmh: 12,
    emoji: '⛅',
    sunriseUtc: null,
    sunsetUtc: null,
    timezoneOffset: null,
    isDayTime: null,
    cloudCover: 40,
    visibility: 10000,
    pressure: 1013,
    rainMm1h: null,
    snowMm1h: null,
    windDegrees: 180, // southerly
    windGustKmh: 18, // realistic gust above 12 km/h base
    weatherId: null,
  };
}

// ============================================================================
// GATEWAY WEATHER FETCH
// ============================================================================

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

/** In-memory weather cache (refreshed every 10 min by gateway call). */
let _weatherCache: Map<string, ExchangeWeatherFull> | null = null;
let _weatherCacheAge = 0;
const WEATHER_CACHE_TTL = 600_000; // 10 minutes

async function getWeatherForExchange(exchangeId: string): Promise<ExchangeWeatherFull | null> {
  // Serve from cache if fresh
  if (_weatherCache && Date.now() - _weatherCacheAge < WEATHER_CACHE_TTL) {
    return _weatherCache.get(exchangeId) ?? null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${GATEWAY_URL}/weather`, {
      signal: controller.signal,
      next: { revalidate: 600 },
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

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

    return newCache.get(exchangeId) ?? null;
  } catch {
    return _weatherCache?.get(exchangeId) ?? null;
  }
}

// ============================================================================
// LOCAL TIME HELPER
// ============================================================================

function getLocalTime(tz: string): { hour: number; formatted: string } {
  try {
    const now = new Date();
    const hourNum = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(
        now,
      ),
      10,
    );
    // HH:MM — matches provider clock in leaderboard column 1 (no timezone suffix)
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return { hour: isNaN(hourNum) ? 12 : hourNum, formatted };
  } catch {
    return { hour: 12, formatted: '12:00' };
  }
}

// ============================================================================
// TITLE-CASE HELPER
// ============================================================================

/** Known abbreviations that must remain fully uppercase after title-casing. */
const UPPERCASE_TOKENS = new Set(['dc', 'uk', 'us', 'usa', 'uae', 'nyc', 'hk', 'la', 'sf', 'nz']);

function toTitleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => {
      if (UPPERCASE_TOKENS.has(w.toLowerCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

// ============================================================================
// LAST SUCCESSFUL RESPONSE (never show error state)
// ============================================================================

let _lastSuccessful: PromptOfTheMoment | null = null;

// ============================================================================
// COMMUNITY PULSE AUTO-LOGGING (Phase 5 — Step 5.4)
// ============================================================================
// Logs each rotation as a prompt_showcase_entries row (weather-seeded).
// Only one insert per rotation index — tracked in-memory to avoid duplicates.
// Fire-and-forget: never blocks or errors the main response.
// ============================================================================

/** Set of rotation indices already logged this process lifetime. */
const _loggedRotations = new Set<number>();

/**
 * Auto-log a weather-seeded entry to prompt_showcase_entries.
 * Stores the WeatherCategoryMap so the Community Pulse tooltip can run
 * the One Brain pipeline client-side for any platform on hover.
 */
async function logShowcaseEntry(
  response: PromptOfTheMoment,
  categoryMap?: WeatherCategoryMap,
): Promise<void> {
  try {
    if (!hasDatabaseConfigured()) return;
    if (_loggedRotations.has(response.rotationIndex)) return;

    // Mark as logged immediately (prevent parallel duplicates)
    _loggedRotations.add(response.rotationIndex);

    // Prune old entries from set (keep memory bounded)
    if (_loggedRotations.size > 200) {
      const oldest = [..._loggedRotations].slice(0, _loggedRotations.size - 100);
      for (const idx of oldest) _loggedRotations.delete(idx);
    }

    await ensureShowcaseTables();
    const sql = db();

    // Description: just the city name (max 60 chars)
    const description = response.city.slice(0, 60);

    // Score: weather-seeded prompts get a synthetic score 78–93 based on conditions
    const conditions = response.conditions.toLowerCase();
    let score = 82;
    if (conditions.includes('storm') || conditions.includes('thunder')) score = 93;
    else if (conditions.includes('snow') || conditions.includes('blizzard')) score = 91;
    else if (conditions.includes('fog') || conditions.includes('mist') || conditions.includes('haze')) score = 90;
    else if (conditions.includes('rain') || conditions.includes('drizzle')) score = 87;
    else if (conditions.includes('overcast') || conditions.includes('cloud')) score = 84;
    else score = 78;

    // Store full WeatherCategoryMap — tooltip runs One Brain pipeline client-side
    const promptsJson = categoryMap ? JSON.stringify(categoryMap) : null;

    // Store weather snapshot — tooltip emoji + meteorological sentence
    const weatherJson = response.weather ? JSON.stringify(response.weather) : null;

    await sql`
      INSERT INTO prompt_showcase_entries
        (city, country_code, venue, mood, tier, platform_id, prompt_text, description, score, source, prompts_json, weather_json)
      VALUES
        (${response.city}, ${response.countryCode}, ${response.venue}, '',
         'tier3', NULL, ${response.prompts.tier3}, ${description}, ${score}, 'weather', ${promptsJson}, ${weatherJson})
    `;
  } catch (error) {
    // Fire-and-forget: never block the main response
    console.warn('[prompt-of-the-moment] Showcase entry log failed:', error);
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<PromptOfTheMoment | { error: string }>> {
  try {
    // ── 1. Determine rotation city ──────────────────────────────────────
    const now = Date.now();
    const rotationIndex = Math.floor(now / ROTATION_MS) % TOTAL_CITIES;
    const cityKey = CITY_KEYS[rotationIndex]!;
    const cityData = CITIES[cityKey]!;
    const cityName = toTitleCase(cityKey);

    // Pick venue (second-level rotation within the city)
    const venueRotation = Math.floor(now / ROTATION_MS / TOTAL_CITIES);
    const venueIndex = venueRotation % cityData.venues.length;
    const venue = cityData.venues[venueIndex] ?? cityData.venues[0]!;

    // ── 2. Resolve country code ─────────────────────────────────────────
    const exchange = CITY_TO_EXCHANGE.get(cityKey);
    const countryCode =
      COUNTRY_NAME_TO_CODE[cityData.country] ?? exchange?.iso2 ?? exchange?.countryCode ?? 'XX';

    // ── 3. Get weather data ─────────────────────────────────────────────
    let weather: ExchangeWeatherFull;
    if (exchange) {
      const live = await getWeatherForExchange(exchange.id);
      weather = live ?? getDemoWeather();
    } else {
      weather = getDemoWeather();
    }

    // ── 4. Resolve coordinates + timezone ───────────────────────────────
    const latitude = exchange?.latitude ?? null;
    const longitude = exchange?.longitude ?? null;
    const tz = exchange?.tz ?? 'UTC';
    const { hour: localHour, formatted: localTime } = getLocalTime(tz);

    // ── 5. Generate all 4 tier prompts ──────────────────────────────────
    // Phase D: categoryMap is shared across tiers (same city/weather/venue).
    // Only the text assembly differs by tier. Capture it from the first call.
    const prompts: Record<string, string> = {};
    let sharedCategoryMap: WeatherCategoryMap | undefined;

    for (const tier of [1, 2, 3, 4] as PromptTier[]) {
      const result = generateWeatherPrompt({
        city: cityName,
        weather,
        localHour,
        tier,
        latitude,
        longitude,
        // Upgrade 4 — Venue Singularity: pass the exact venue the route picked.
        // Old approach embedded venue in city string AND passed venueSeed, but
        // getCityVenue(seed) and route index picked different venues → 2 venues.
        venueOverride: { name: venue.name, setting: venue.setting ?? 'street' },
      });
      prompts[`tier${tier}`] = result.text;

      // Capture categoryMap from first tier (shared — same weather intelligence)
      if (!sharedCategoryMap && result.categoryMap) {
        sharedCategoryMap = result.categoryMap;
      }
    }

    // Phase D: Use categoryMap.meta for real venue name (fixes venue desync).
    // The generator's venue intelligence picks the actual venue — may differ
    // from the route's simple index rotation. Trust the generator.
    const realVenue = sharedCategoryMap?.meta?.venue ?? venue.name;

    // ── 7. Build provider shortcuts ─────────────────────────────────────
    const allShortcuts = getProviderShortcutsAllTiers();

    // ── 8. Calculate next rotation ──────────────────────────────────────
    const currentSlot = Math.floor(now / ROTATION_MS);
    const nextRotationAt = new Date((currentSlot + 1) * ROTATION_MS).toISOString();

    // ── 9. Build response ──────────────────────────────────────────────
    const response: PromptOfTheMoment = {
      city: cityName,
      countryCode,
      localTime,
      conditions: weather.conditions,
      mood: '',
      venue: realVenue,
      prompts: {
        tier1: prompts['tier1']!,
        tier2: prompts['tier2']!,
        tier3: prompts['tier3']!,
        tier4: prompts['tier4']!,
      },
      tierProviders: {
        tier1: allShortcuts['tier1'] ?? [],
        tier2: allShortcuts['tier2'] ?? [],
        tier3: allShortcuts['tier3'] ?? [],
        tier4: allShortcuts['tier4'] ?? [],
      },
      // Phase D: Full WeatherCategoryMap per tier — builder populates ALL 12
      // categories from this. Legacy promptText + empty selections kept for
      // backward compat with any cached responses still in flight.
      tierSelections: {
        tier1: { promptText: prompts['tier1']!, selections: {}, categoryMap: sharedCategoryMap },
        tier2: { promptText: prompts['tier2']!, selections: {}, categoryMap: sharedCategoryMap },
        tier3: { promptText: prompts['tier3']!, selections: {}, categoryMap: sharedCategoryMap },
        tier4: { promptText: prompts['tier4']!, selections: {}, categoryMap: sharedCategoryMap },
      },
      // Phase D: "Inspired by" badge from categoryMap.meta (real venue)
      inspiredBy: {
        city: cityName,
        venue: realVenue,
        conditions: sharedCategoryMap?.meta?.conditions ?? weather.conditions,
        emoji: sharedCategoryMap?.meta?.emoji ?? weather.emoji ?? '🌤️',
        tempC: sharedCategoryMap?.meta?.tempC ?? weather.temperatureC ?? null,
        localTime: sharedCategoryMap?.meta?.localTime ?? localTime,
        mood: '',
        // Upgrade 5: Prompt Fingerprint Verification hash
        categoryMapHash: sharedCategoryMap ? hashCategoryMap(sharedCategoryMap) : undefined,
      },
      generatedAt: new Date(now).toISOString(),
      nextRotationAt,
      rotationIndex,
      weather: {
        description: weather.description ?? weather.conditions,
        emoji: weather.emoji ?? '🌤️',
        tempC: weather.temperatureC ?? null,
        tempF: weather.temperatureF ?? null,
        windKmh: weather.windSpeedKmh ?? null,
        windDegrees: weather.windDegrees ?? null,
        windGustKmh: weather.windGustKmh ?? null,
        humidity: weather.humidity ?? null,
        visibility: weather.visibility ?? null,
        sunriseUtc: weather.sunriseUtc ?? null,
        sunsetUtc: weather.sunsetUtc ?? null,
        isDayTime: weather.isDayTime ?? null,
        timezoneOffset: weather.timezoneOffset ?? null,
        latitude,
        longitude,
        timezone: tz,
      },
    };

    _lastSuccessful = response;

    // ── 10. Auto-log to Community Pulse feed (Phase 5, fire-and-forget) ──
    void logShowcaseEntry(response, sharedCategoryMap);

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[prompt-of-the-moment] Error:', error);

    // Serve last successful response (never show error state per §4.3)
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
