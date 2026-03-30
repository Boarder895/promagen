// src/lib/homepage/generate-potm-data.ts
// ============================================================================
// PROMPT OF THE MOMENT — Shared Generator (v1.0.0)
// ============================================================================
// Pure generation function extracted from the POTM API route. Contains:
//   - Deterministic city rotation (3-minute cadence, 102 cities)
//   - Weather → prompt generation (all 4 tiers)
//   - Provider shortcut resolution
//   - Response assembly
//
// NO side effects: no HTTP fetches, no DB writes, no caching.
// Callers provide weather data; this function is synchronous.
//
// Used by:
//   1. page.tsx (SSR) — generates POTM data during server render so the
//      Prompt of the Moment appears in the INITIAL HTML (zero client fetch).
//   2. API route — client-side 3-minute rotation refreshes still hit the
//      route, which calls this function + adds Community Pulse DB logging.
//
// Authority: docs/authority/homepage.md §4
// Existing features preserved: Yes
// ============================================================================

import { generateWeatherPrompt } from '@/lib/weather/weather-prompt-generator';
import type { PromptTier } from '@/lib/weather/prompt-types';
import type { ExchangeWeatherFull } from '@/lib/weather/weather-types';
import { PLATFORM_TIERS } from '@/data/platform-tiers';
import { getProviders } from '@/lib/providers/api';
import type { PromptOfTheMoment, ProviderShortcut } from '@/types/homepage';
import type { WeatherCategoryMap } from '@/types/prompt-builder';
import { hashCategoryMap } from '@/lib/prompt-dna';

import cityVibesData from '@/data/vocabulary/weather/city-vibes.json';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Rotation cadence in milliseconds (3 minutes). Must match API route. */
export const ROTATION_MS = 3 * 60 * 1000;

// ============================================================================
// DATA STRUCTURES (computed once at module load)
// ============================================================================

interface CityVibe {
  country: string;
  venues: Array<{ name: string; setting: string }>;
}

const CITIES: Record<string, CityVibe> = (cityVibesData as { cities: Record<string, CityVibe> })
  .cities;
const CITY_KEYS = Object.keys(CITIES).sort();
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

const CITY_TO_EXCHANGE = new Map<string, ExchangeEntry>();
for (const ex of EXCHANGES) {
  const city = (ex.city ?? '').toLowerCase();
  if (city && !CITY_TO_EXCHANGE.has(city)) {
    CITY_TO_EXCHANGE.set(city, ex);
  }
}

// Country name → ISO alpha-2 (covers all 102 city-vibes countries)
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  Argentina: 'AR', Australia: 'AU', Austria: 'AT', Bahrain: 'BH',
  Bangladesh: 'BD', Belgium: 'BE', 'Bosnia and Herzegovina': 'BA',
  Botswana: 'BW', Brazil: 'BR', Canada: 'CA', Chile: 'CL', China: 'CN',
  Colombia: 'CO', Croatia: 'HR', Cyprus: 'CY', 'Czech Republic': 'CZ',
  Denmark: 'DK', Ecuador: 'EC', Egypt: 'EG', Finland: 'FI', France: 'FR',
  Germany: 'DE', Ghana: 'GH', Greece: 'GR', 'Hong Kong': 'HK',
  Hungary: 'HU', India: 'IN', Indonesia: 'ID', Ireland: 'IE', Israel: 'IL',
  Italy: 'IT', Japan: 'JP', Jordan: 'JO', Kazakhstan: 'KZ', Kenya: 'KE',
  Kuwait: 'KW', Laos: 'LA', Latvia: 'LV', Lebanon: 'LB', Malaysia: 'MY',
  Mauritius: 'MU', Mexico: 'MX', Mongolia: 'MN', Montenegro: 'ME',
  Morocco: 'MA', Namibia: 'NA', Netherlands: 'NL', 'New Zealand': 'NZ',
  Nigeria: 'NG', 'North Macedonia': 'MK', Norway: 'NO', Oman: 'OM',
  Pakistan: 'PK', Peru: 'PE', Philippines: 'PH', Poland: 'PL',
  Portugal: 'PT', Qatar: 'QA', Romania: 'RO', Russia: 'RU',
  'Saudi Arabia': 'SA', Serbia: 'RS', Singapore: 'SG', Slovakia: 'SK',
  Slovenia: 'SI', 'South Africa': 'ZA', 'South Korea': 'KR', Spain: 'ES',
  'Sri Lanka': 'LK', Sweden: 'SE', Switzerland: 'CH', Taiwan: 'TW',
  Tanzania: 'TZ', Thailand: 'TH', Turkey: 'TR',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
  'United States': 'US', Venezuela: 'VE', Vietnam: 'VN',
};

// ============================================================================
// HELPERS (pure, no side effects)
// ============================================================================

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

function getLocalTime(tz: string): { hour: number; formatted: string } {
  try {
    const now = new Date();
    const hourNum = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now),
      10,
    );
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now);
    return { hour: isNaN(hourNum) ? 12 : hourNum, formatted };
  } catch {
    return { hour: 12, formatted: '12:00' };
  }
}

/** Demo weather fallback — used when no live data available. */
export function getDemoWeather(): ExchangeWeatherFull {
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
    windDegrees: 180,
    windGustKmh: 18,
    weatherId: null,
  };
}

// ============================================================================
// PROVIDER SHORTCUTS (cached once per server lifetime)
// ============================================================================

let _providerShortcutCache: Record<string, ProviderShortcut[]> | null = null;

function getProviderShortcutsAllTiers(): Record<string, ProviderShortcut[]> {
  if (_providerShortcutCache) return _providerShortcutCache;

  const allProviders = getProviders();
  const cache: Record<string, ProviderShortcut[]> = {};

  for (const tierNum of [1, 2, 3, 4] as const) {
    const tierDef = PLATFORM_TIERS[tierNum];
    if (!tierDef) { cache[`tier${tierNum}`] = []; continue; }
    const tierProviderIds = new Set(tierDef.platforms);
    const shortcuts: ProviderShortcut[] = [];
    for (const provider of allProviders) {
      if (tierProviderIds.has(provider.id) && provider.localIcon) {
        shortcuts.push({ id: provider.id, name: provider.name, iconPath: provider.localIcon });
      }
    }
    cache[`tier${tierNum}`] = shortcuts;
  }

  _providerShortcutCache = cache;
  return cache;
}

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface GeneratePotmOptions {
  /**
   * Sync weather lookup by exchange ID. Returns ExchangeWeatherFull or null.
   * SSR passes a function that reads from the weatherIndex already fetched.
   * API route passes a function that reads from its in-memory gateway cache.
   * If omitted or returns null, demo weather is used.
   */
  weatherLookup?: (exchangeId: string) => ExchangeWeatherFull | null;
}

export interface GeneratePotmResult {
  /** The PromptOfTheMoment response (identical shape to API response) */
  data: PromptOfTheMoment;
  /** The shared categoryMap from weather intelligence (for Community Pulse logging) */
  categoryMap?: WeatherCategoryMap;
}

// ============================================================================
// MAIN GENERATOR (synchronous, no side effects)
// ============================================================================

/**
 * Generate the current Prompt of the Moment data.
 *
 * Deterministic: same rotation index → same city → same prompts
 * (weather data may vary if live data is available vs demo fallback).
 *
 * @param options.weatherLookup — sync function to look up weather by exchange ID
 * @returns PromptOfTheMoment + categoryMap for optional DB logging
 */
export function generatePotmData(options?: GeneratePotmOptions): GeneratePotmResult {
  const now = Date.now();
  const weatherLookup = options?.weatherLookup;

  // ── 1. Determine rotation city ──────────────────────────────────────────
  const rotationIndex = Math.floor(now / ROTATION_MS) % TOTAL_CITIES;
  const cityKey = CITY_KEYS[rotationIndex]!;
  const cityData = CITIES[cityKey]!;
  const cityName = toTitleCase(cityKey);

  // Pick venue (second-level rotation within the city)
  const venueRotation = Math.floor(now / ROTATION_MS / TOTAL_CITIES);
  const venueIndex = venueRotation % cityData.venues.length;
  const venue = cityData.venues[venueIndex] ?? cityData.venues[0]!;

  // ── 2. Resolve country code ─────────────────────────────────────────────
  const exchange = CITY_TO_EXCHANGE.get(cityKey);
  const countryCode =
    COUNTRY_NAME_TO_CODE[cityData.country] ?? exchange?.iso2 ?? exchange?.countryCode ?? 'XX';

  // ── 3. Get weather data ─────────────────────────────────────────────────
  let weather: ExchangeWeatherFull;
  if (exchange && weatherLookup) {
    weather = weatherLookup(exchange.id) ?? getDemoWeather();
  } else {
    weather = getDemoWeather();
  }

  // ── 4. Resolve coordinates + timezone ───────────────────────────────────
  const latitude = exchange?.latitude ?? null;
  const longitude = exchange?.longitude ?? null;
  const tz = exchange?.tz ?? 'UTC';
  const { hour: localHour, formatted: localTime } = getLocalTime(tz);

  // ── 5. Generate all 4 tier prompts ──────────────────────────────────────
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
      venueOverride: { name: venue.name, setting: venue.setting ?? 'street' },
    });
    prompts[`tier${tier}`] = result.text;

    if (!sharedCategoryMap && result.categoryMap) {
      sharedCategoryMap = result.categoryMap;
    }
  }

  const realVenue = sharedCategoryMap?.meta?.venue ?? venue.name;

  // ── 6. Build provider shortcuts ─────────────────────────────────────────
  const allShortcuts = getProviderShortcutsAllTiers();

  // ── 7. Calculate next rotation ──────────────────────────────────────────
  const currentSlot = Math.floor(now / ROTATION_MS);
  const nextRotationAt = new Date((currentSlot + 1) * ROTATION_MS).toISOString();

  const nextRotationIndex = (rotationIndex + 1) % TOTAL_CITIES;
  const nextCityKey = CITY_KEYS[nextRotationIndex]!;
  const nextCityData = CITIES[nextCityKey]!;
  const nextCityName = toTitleCase(nextCityKey);
  const nextExchange = CITY_TO_EXCHANGE.get(nextCityKey);
  const nextCountryCode =
    COUNTRY_NAME_TO_CODE[nextCityData.country] ?? nextExchange?.iso2 ?? nextExchange?.countryCode ?? 'XX';

  // ── 8. Build response ──────────────────────────────────────────────────
  const data: PromptOfTheMoment = {
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
    tierSelections: {
      tier1: { promptText: prompts['tier1']!, selections: {}, categoryMap: sharedCategoryMap },
      tier2: { promptText: prompts['tier2']!, selections: {}, categoryMap: sharedCategoryMap },
      tier3: { promptText: prompts['tier3']!, selections: {}, categoryMap: sharedCategoryMap },
      tier4: { promptText: prompts['tier4']!, selections: {}, categoryMap: sharedCategoryMap },
    },
    inspiredBy: {
      city: cityName,
      venue: realVenue,
      conditions: sharedCategoryMap?.meta?.conditions ?? weather.conditions,
      emoji: sharedCategoryMap?.meta?.emoji ?? weather.emoji ?? '🌤️',
      tempC: sharedCategoryMap?.meta?.tempC ?? weather.temperatureC ?? null,
      localTime: sharedCategoryMap?.meta?.localTime ?? localTime,
      mood: '',
      categoryMapHash: sharedCategoryMap ? hashCategoryMap(sharedCategoryMap) : undefined,
    },
    generatedAt: new Date(now).toISOString(),
    nextRotationAt,
    rotationIndex,
    nextCity: nextCityName,
    nextCountryCode,
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

  return { data, categoryMap: sharedCategoryMap };
}
