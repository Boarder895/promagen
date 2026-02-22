// src/lib/weather/vocabulary-loaders.ts
// ============================================================================
// VOCABULARY LOADERS — JSON Data & Range Lookups
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Extracted from weather-prompt-generator.ts (4,311-line monolith)
// - Contains: JSON imports, range-based lookups, city/venue data,
//   condition/time phrase selectors, emoji mapping, legacy exports
//
// Existing features preserved: Yes
// ============================================================================

import { pickRandom } from './prng';
import type { ExchangeWeatherFull } from './weather-types';
import type {
  WeatherContext,
  VenueSetting,
  VenueResult,
  CityVenueData,
  PromptProfile,
} from './prompt-types';
import { STYLE_ENDING_PREFIX } from './prompt-types';
import { isNightTime } from './time-utils';
import { getMoonPhase } from './moon-phase';

// ── JSON vocabulary imports ─────────────────────────────────────────────────
import cityVibesData from '@/data/vocabulary/weather/city-vibes.json';
import temperatureData from '@/data/vocabulary/weather/temperature.json';
import humidityData from '@/data/vocabulary/weather/humidity.json';
import timeOfDayData from '@/data/vocabulary/weather/time-of-day.json';
import conditionsData from '@/data/vocabulary/weather/conditions.json';

// Legacy import kept for backward-compatible exports only
import windData from '@/data/vocabulary/weather/wind.json';

// ── Range-based lookup helper ───────────────────────────────────────────────
export interface RangeEntry {
  min: number;
  max: number;
  phrases: string[];
}

export function buildRangeLookup(ranges: Record<string, RangeEntry>): RangeEntry[] {
  return Object.values(ranges).sort((a, b) => a.min - b.min);
}

export function findRange(lookup: RangeEntry[], value: number): string[] {
  for (const range of lookup) {
    if (value >= range.min && value < range.max) return range.phrases;
  }
  // Clamp: if below min, use first; if above max, use last
  if (value < lookup[0]!.min) return lookup[0]!.phrases;
  return lookup[lookup.length - 1]!.phrases;
}

// ── Time of day (24 hours × N simple descriptors) ──────────────────────────
export const TIME_HOURS = timeOfDayData.hours as Record<string, string[]>;

// ── Conditions (emoji-keyed phrase pools) ───────────────────────────────────
export interface ConditionEntry {
  emoji: string;
  label?: string;
  phrases: string[];
}
export const CONDITION_TYPES = conditionsData.conditions as Record<string, ConditionEntry>;

// Build emoji → phrases lookup for fast access
export const CONDITION_BY_EMOJI: Record<string, string[]> = {};
for (const entry of Object.values(CONDITION_TYPES)) {
  if (entry.emoji && entry.phrases) {
    CONDITION_BY_EMOJI[entry.emoji] = entry.phrases;
  }
}

export const TEMP_LOOKUP = buildRangeLookup(temperatureData.ranges as Record<string, RangeEntry>);
export const HUMIDITY_LOOKUP = buildRangeLookup(humidityData.ranges as Record<string, RangeEntry>);

// ── City vibes (venue-only model, v6.0 + v7.2 venue settings) ───────────────

interface CityDataRaw {
  country?: string;
  venues?: CityVenueData[];
  attractions?: CityVenueData[];
}
interface CityData {
  country?: string;
  venues: CityVenueData[];
}

// Normalise at load: some batches used "attractions" instead of "venues"
const CITY_DATA_RAW = cityVibesData.cities as Record<string, CityDataRaw>;
const CITY_DATA: Record<string, CityData> = {};
for (const [key, raw] of Object.entries(CITY_DATA_RAW)) {
  CITY_DATA[key] = {
    country: raw.country,
    venues: raw.venues ?? raw.attractions ?? [],
  };
}

// ── v8.0.0: Setting Override Map ──────────────────────────────────────────
const SETTING_OVERRIDES: Record<string, VenueSetting> = {
  // No overrides currently needed
};

export const DESCRIPTION_EMOJI_MAP: Record<string, string> = {
  'clear sky': '☀️',
  'few clouds': '🌤️',
  'scattered clouds': '⛅',
  'broken clouds': '☁️',
  'overcast clouds': '☁️',
  'light intensity drizzle': '🌦️',
  drizzle: '🌦️',
  'heavy intensity drizzle': '🌦️',
  'light intensity drizzle rain': '🌦️',
  'drizzle rain': '🌦️',
  'heavy intensity drizzle rain': '🌧️',
  'shower rain and drizzle': '🌧️',
  'heavy shower rain and drizzle': '🌧️',
  'shower drizzle': '🌦️',
  'light rain': '🌧️',
  'moderate rain': '🌧️',
  'heavy intensity rain': '🌧️',
  'very heavy rain': '🌧️',
  'extreme rain': '🌧️',
  'freezing rain': '🌧️',
  'light intensity shower rain': '🌧️',
  'shower rain': '🌧️',
  'heavy intensity shower rain': '🌧️',
  'ragged shower rain': '🌧️',
  'thunderstorm with light rain': '⛈️',
  'thunderstorm with rain': '⛈️',
  'thunderstorm with heavy rain': '⛈️',
  'light thunderstorm': '⛈️',
  thunderstorm: '⛈️',
  'heavy thunderstorm': '⛈️',
  'ragged thunderstorm': '⛈️',
  'thunderstorm with light drizzle': '⛈️',
  'thunderstorm with drizzle': '⛈️',
  'thunderstorm with heavy drizzle': '⛈️',
  'light snow': '🌨️',
  snow: '🌨️',
  'heavy snow': '❄️',
  sleet: '🌨️',
  'light shower sleet': '🌨️',
  'shower sleet': '🌨️',
  'light rain and snow': '🌨️',
  'rain and snow': '🌨️',
  'light shower snow': '🌨️',
  'shower snow': '❄️',
  'heavy shower snow': '❄️',
  mist: '🌫️',
  smoke: '🌫️',
  haze: '🌫️',
  'sand/dust whirls': '💨',
  fog: '🌫️',
  sand: '💨',
  dust: '🌫️',
  'volcanic ash': '🌫️',
  squalls: '💨',
  tornado: '🌪️',
};

export function descriptionToEmoji(description: string, fallbackEmoji: string): string {
  if (!description) return fallbackEmoji;
  return DESCRIPTION_EMOJI_MAP[description.toLowerCase()] ?? fallbackEmoji;
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

export function buildContext(
  weather: ExchangeWeatherFull,
  localHour: number,
  observedAtUtc: Date,
): WeatherContext {
  const desc = (weather.description || '').toLowerCase();
  const cond = (weather.conditions || '').toLowerCase();
  const resolvedEmoji = weather.description
    ? descriptionToEmoji(weather.description, weather.emoji)
    : weather.emoji;
  const night = isNightTime(weather, localHour, observedAtUtc);
  const moon = getMoonPhase(observedAtUtc);

  return {
    tempC: weather.temperatureC,
    humidity: weather.humidity,
    windKmh: weather.windSpeedKmh,
    hour: localHour,
    condition: weather.conditions,
    description: weather.description,
    emoji: resolvedEmoji,
    isStormy:
      desc.includes('storm') ||
      desc.includes('thunder') ||
      cond.includes('thunder') ||
      cond.includes('storm'),
    isRainy:
      desc.includes('rain') ||
      desc.includes('drizzle') ||
      cond.includes('rain') ||
      cond.includes('drizzle'),
    isSnowy:
      desc.includes('snow') ||
      desc.includes('sleet') ||
      desc.includes('hail') ||
      cond.includes('snow') ||
      cond.includes('sleet') ||
      cond.includes('hail'),
    isFoggy: desc.includes('fog') || cond.includes('fog'),
    isMisty:
      desc.includes('mist') ||
      desc.includes('haze') ||
      cond.includes('mist') ||
      cond.includes('haze'),
    isCold: weather.temperatureC < 10,
    isHot: weather.temperatureC > 28,
    isDry: weather.humidity < 40,
    isHumid: weather.humidity > 70,
    isWindy: weather.windSpeedKmh > 25,
    isNight: night,
    isDawn: localHour >= 5 && localHour < 7,
    isDusk: localHour >= 17 && localHour < 20,
    moonEmoji: moon.emoji,
    moonPhrase: moon.name.toLowerCase(),
    moonName: moon.name,
    cloudCover: weather.cloudCover,
    visibility: weather.visibility,
    pressure: weather.pressure,
    windDegrees: weather.windDegrees ?? null,
    windGustKmh: weather.windGustKmh ?? null,
  };
}

// ============================================================================
// PHRASE SELECTORS
// ============================================================================

export function getTempPhrase(ctx: WeatherContext, seed: number): string {
  const pool = findRange(TEMP_LOOKUP, ctx.tempC);
  if (pool.length === 0) return 'mild';
  return pickRandom(pool, seed);
}

export function getHumidityPhrase(ctx: WeatherContext, seed: number): string {
  const pool = findRange(HUMIDITY_LOOKUP, ctx.humidity);
  if (pool.length === 0) return 'moderate humidity';
  return pickRandom(pool, seed * 1.1);
}
export function getTimeDescriptor(ctx: WeatherContext, seed: number): string {
  const hourKey = String(ctx.hour);
  const pool = TIME_HOURS[hourKey] ?? TIME_HOURS['12'] ?? [];
  if (pool.length === 0) return 'daytime';
  return pickRandom(pool, seed * 1.3);
}

// ── Sky source (with v6.0 lighting duplication awareness) ─────────────────
const WIND_ONLY_DESCRIPTIONS = new Set([
  'windy',
  'breezy',
  'gusty',
  'blustery',
  'squall',
  'squalls',
]);

// v7.8: Cloud-only descriptions — these duplicate the lighting engine's cloud
// encoding and SHOULD be suppressed when encodesCloudState is true.
// Everything NOT in this set is a precipitation or visibility phenomenon
// (snow, rain, mist, fog, thunderstorm, etc.) that must ALWAYS appear
// regardless of encodesCloudState — it fundamentally changes the scene.
const CLOUD_ONLY_DESCRIPTIONS = new Set([
  'clear sky',
  'clear',
  'sunny',
  'few clouds',
  'scattered clouds',
  'broken clouds',
  'overcast clouds',
  'overcast',
  'partly cloudy',
  'mostly cloudy',
  'cloudy',
]);

export function getSkySource(ctx: WeatherContext, seed: number): string | null {
  if (ctx.description) {
    const lower = ctx.description.toLowerCase().trim();
    if (WIND_ONLY_DESCRIPTIONS.has(lower)) return null;
    return ctx.description;
  }
  return getConditionPhrase(ctx, seed);
}

/**
 * v7.8: Precipitation-aware sky source.
 * Returns the sky/condition phrase, respecting the encodesCloudState gate
 * ONLY for pure cloud descriptions. Precipitation and visibility phenomena
 * (snow, rain, mist, fog, thunderstorm, sleet, hail, etc.) always pass through.
 *
 * Why: at night, encodesCloudState is always true (lighting encodes clouds),
 * but "snow" or "light rain" are visually critical and must appear in the prompt.
 * Before v7.8, Toronto at night with snow would produce no weather condition.
 */
export function getSkySourceAware(
  ctx: WeatherContext,
  seed: number,
  encodesCloudState: boolean,
): string | null {
  // If lighting doesn't encode cloud state, always include sky source
  if (!encodesCloudState) return getSkySource(ctx, seed);

  // Lighting encodes cloud state — only allow through if it's NOT a cloud-only desc.
  // Precipitation, fog, mist, etc. always pass through.
  if (ctx.description) {
    const lower = ctx.description.toLowerCase().trim();
    if (WIND_ONLY_DESCRIPTIONS.has(lower)) return null;
    if (CLOUD_ONLY_DESCRIPTIONS.has(lower)) return null; // Suppressed — lighting covers it
    return ctx.description; // Precipitation or phenomenon — always include
  }

  // No description — check if conditions imply precipitation
  // If we only have an emoji/condition, fall back to condition phrase
  // but only if it's likely precipitation (not just cloud state)
  const condLower = (ctx.condition || '').toLowerCase();
  const isPrecip =
    condLower.includes('rain') ||
    condLower.includes('snow') ||
    condLower.includes('drizzle') ||
    condLower.includes('sleet') ||
    condLower.includes('hail') ||
    condLower.includes('thunder') ||
    condLower.includes('storm') ||
    condLower.includes('mist') ||
    condLower.includes('fog') ||
    condLower.includes('freezing');
  if (isPrecip) return getConditionPhrase(ctx, seed);

  return null; // Cloud-only condition — suppressed
}

export function getConditionPhrase(ctx: WeatherContext, seed: number): string {
  const pool = CONDITION_BY_EMOJI[ctx.emoji];
  if (pool && pool.length > 0) return pickRandom(pool, seed * 1.4);
  // Fallback: try to find any matching condition type
  for (const entry of Object.values(CONDITION_TYPES)) {
    if (entry.phrases.length > 0) return pickRandom(entry.phrases, seed * 1.4);
  }
  return 'clear skies';
}

// ============================================================================
// CITY VENUE SELECTOR (v6.0 — venue only, no activities)
// ============================================================================
// Picks a random venue from the city. Activities are removed entirely.
// Returns null when the city has no venue data.
// ============================================================================
export function getCityVenue(city: string, seed: number): VenueResult | null {
  const cityLower = city.toLowerCase();

  // Exact match first
  let data = CITY_DATA[cityLower];

  // Partial match fallback (e.g. "New York" matches "new york")
  if (!data) {
    for (const [key, value] of Object.entries(CITY_DATA)) {
      if (cityLower.includes(key) || key.includes(cityLower)) {
        data = value;
        break;
      }
    }
  }

  if (!data || !data.venues || data.venues.length === 0) return null;

  // Pick a random venue — return name + setting (default to 'street')
  // v7.7: pass through venue-specific lightCharacter when present in JSON.
  // v8.0.0: Apply setting override if registered (runtime safety net).
  const venue = pickRandom(data.venues, seed * 2.1);
  const overrideKey = `${cityLower}::${venue.name.toLowerCase()}`;
  const effectiveSetting: VenueSetting =
    SETTING_OVERRIDES[overrideKey] ?? (venue.setting as VenueSetting) ?? 'street';
  const result: VenueResult = {
    name: venue.name,
    setting: effectiveSetting,
  };
  if (venue.lightCharacter && venue.lightCharacter.length > 0) {
    result.lightCharacter = venue.lightCharacter;
  }
  return result;
}

// ============================================================================
// TIER-SPECIFIC GENERATORS (v6.0 — rebuilt with lighting engine)
// ============================================================================
//
// v6.0 Element Ordering:
//
// Tier 1 (CLIP):  (City:1.3) → (Venue:1.2) → (Lighting:1.3, tokens) →
//                 (Moon:1.2) → (Sky:1.1, conditional) → Temp → Wind →
//                 Humidity → Time → quality tags → --no
//
// Tier 2 (MJ):    Lighting+Time — City+Venue → Sky(cond) → Moon →
//                 Wind → Humidity → Temp → params
//
// Tier 3 (NatLang): S1: Time+City+Venue. S2: Lighting(causal) + Sky(cond).
//                   S3: Moon. S4: Wind+Humidity+Temp. S5: Quality+Directive.
//
// Tier 4 (Plain):  City → Venue → Lighting → Time → Sky(cond) → Moon →
//                  Wind → Humidity → Temp → Directive
// ============================================================================
export function getSettingEnding(
  venue: VenueResult | null,
  style: PromptProfile['style'] = 'photoreal',
): string {
  const prefix = STYLE_ENDING_PREFIX[style];
  if (!venue) return `${prefix}, high-detail city scene.`;
  switch (venue.setting) {
    case 'street':
    case 'narrow':
    case 'market':
    case 'plaza':
      return `${prefix}, high-detail city scene.`;
    case 'waterfront':
    case 'beach':
      return `${prefix}, high-detail coastal scene.`;
    case 'monument':
      return `${prefix}, high-detail landmark scene.`;
    case 'park':
      return `${prefix}, high-detail landscape scene.`;
    case 'elevated':
      return `${prefix}, high-detail skyline view.`;
    default:
      return `${prefix}, high-detail city scene.`;
  }
}

/**
 * Period noun for Tier 4 — weak parsers handle "dawn", "dusk", "night"
 * better than "seven in the evening" or "the stroke of midnight".
 * Returns a simple period-of-day noun instead of clock-time phrasing.
 */
export function getTimePeriod(hour: number): string {
  if (hour >= 0 && hour < 5) return 'deep night';
  if (hour === 5) return 'pre-dawn';
  if (hour === 6) return 'dawn';
  if (hour >= 7 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 12) return 'late morning';
  if (hour === 12) return 'midday';
  if (hour >= 13 && hour < 15) return 'early afternoon';
  if (hour >= 15 && hour < 17) return 'late afternoon';
  if (hour >= 17 && hour < 19) return 'early evening';
  if (hour === 19) return 'dusk';
  if (hour === 20) return 'twilight';
  if (hour >= 21 && hour < 23) return 'night';
  return 'late night'; // hour 23
}

// ── v8.0.0 Chat 5→7: Quality tags now in STYLE_QUALITY_TAGS (profile-keyed).
// Old PHOTOREAL_QUALITY_TAGS constant removed — use STYLE_QUALITY_TAGS[profile.style].

/**
 * Tier 1: CLIP-Based — Weighted keywords with emphasis markers
 *
 * v8.0.0 Chat 5:
 * - Returns WeatherPromptResult (structured positive/negative).
 * - Quality tags: "masterpiece, best quality, 8k" → photoreal-biased.
 * - Token budget guard: caps at 15 parts (~60 CLIP tokens).
 *
 * Lighting rendered as independent weighted tokens:
 * - Primary light source gets :1.3 weight
 * - Shadow/atmosphere modifiers rendered unweighted as comma tokens
 * - Stability modifier omitted (too abstract for CLIP)
 */

// ============================================================================
// LEGACY EXPORTS (backward compatibility — used by commodity-prompt-generator)
// ============================================================================

// Legacy wind lookup for backward-compatible getWindEnergy() only
const LEGACY_WIND_LOOKUP = buildRangeLookup(windData.ranges as Record<string, RangeEntry>);

/** @deprecated Use generateWeatherPrompt with full context */
export function getTempFeel(tempC: number): { feel: string; atmosphere: string } {
  const pool = findRange(TEMP_LOOKUP, tempC);
  const phrase = pool.length > 0 ? pickRandom(pool, tempC) : 'mild';
  return { feel: phrase.split(' ').slice(0, 2).join(' '), atmosphere: phrase };
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getHumidityTexture(humidity: number): string {
  const pool = findRange(HUMIDITY_LOOKUP, humidity);
  return pool.length > 0 ? pickRandom(pool, humidity) : 'moderate humidity';
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getWindEnergy(windKmh: number): string {
  const pool = findRange(LEGACY_WIND_LOOKUP, windKmh);
  return pool.length > 0 ? pickRandom(pool, windKmh) : 'gentle breeze';
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getTimeMood(hour: number): { mood: string; lighting: string } {
  const hourKey = String(hour);
  const pool = TIME_HOURS[hourKey] ?? TIME_HOURS['12'] ?? [];
  const descriptor = pool.length > 0 ? pickRandom(pool, hour) : 'daytime';
  return { mood: descriptor, lighting: '' };
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getConditionVisual(condition: string, description: string): string {
  for (const entry of Object.values(CONDITION_TYPES)) {
    if (entry.label?.toLowerCase().includes(condition.toLowerCase())) {
      if (entry.phrases.length > 0) return pickRandom(entry.phrases, 12);
    }
  }
  return description || 'clear skies';
}
