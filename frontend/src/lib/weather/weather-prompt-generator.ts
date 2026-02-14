// src/lib/weather/weather-prompt-generator.ts
// ============================================================================
// WEATHER PROMPT GENERATOR v5.2 — VENUE + ACTIVITY SCENE MODEL
// ============================================================================
// Generates dynamic image prompts from live weather data.
//
// v4.0 ARCHITECTURE — 4 LAYERS:
//   Layer 1 — WHERE: City name (e.g. "Tokyo")
//   Layer 2 — SPECIFIC WHERE: Venue (e.g. "Tsukiji Outer Market")
//   Layer 3 — WHAT'S HAPPENING: Activity (e.g. "tuna being carried on wooden carts")
//   Layer 4 — CONDITIONS: Weather + temp + wind + time + humidity + sky + moon
//             Modifies how layers 1–3 look. Does NOT add new subjects.
//
// Layers 2+3 are connected: a random venue is picked, then a random activity
// from THAT venue. The same venue+activity looks completely different depending
// on what live API data feeds into Layer 4.
//
// v5.2 CHANGES FROM v5.1:
// - Tier 4: Added "no people or text visible" during quiet hours. Previously
//   Tier 4 never had this directive. Now all 4 tiers are consistent — activity
//   suppressed AND people exclusion present during quiet hours (midnight→sunrise),
//   both removed during active hours (sunrise→midnight).
//
// v5.1 CHANGES FROM v5.0:
// - "No people" directive now ONLY appears during quiet hours (midnight → sunrise).
//   Previously hardcoded unconditionally in Tiers 1, 2, and 3.
//   Tier 1: --no people text ... → quiet hours only; --no watermarks logos blurry always.
//   Tier 2: --no people text → quiet hours only; --ar/--stylize always.
//   Tier 3: "No people or text visible." sentence → quiet hours only.
//   Tier 4: unchanged (never had this directive).
//
// v5.0 CHANGES FROM v4.4:
// - DEFAULT TIER: Changed from Tier 4 (Plain Language) to Tier 3 (Natural
//   Language). Free users now get Tier 3 prompts by default. Artistly test
//   proved Tier 4's flat comma-list lost time-of-day context entirely, while
//   Tier 3's sentence structure ("A nine in the evening scene in Dubai at
//   Kite Beach...") produced accurate nighttime imagery.
//
// - TIER ELEMENT ORDERING: Rebuilt all 4 tier templates with platform-optimal
//   element ordering based on how each platform class reads prompts:
//
//   Tier 1 (CLIP): City→Venue→Activity→Moon→Sky→Temp→Wind→Humidity→Time→quality
//     Weights (:1.3/:1.2/:1.1) control importance. Time late (no weight needed).
//
//   Tier 2 (MJ): TIME→City+Venue→Activity→Moon→Sky→Temp→Wind→Humidity→params
//     Left-to-right diminishing attention. Time first = lighting context.
//
//   Tier 3 (NatLang): TIME→City→Venue→Activity→Sky→Moon→Temp→Wind→Humidity
//     Story structure. "A [time] scene in [city] at [venue]..." Time frames all.
//
//   Tier 4 (Plain): City→Venue→Activity→TIME→Sky→Temp→Wind→Humidity→Moon
//     Weakest parser. Subject leads. Time at pos 4 (after subject). Moon last.
//
// - MAIN SWITCH: default case now routes to generateTier3 instead of Tier4.
//
// - Tier 3 sentence polish: "Under a [moon]" (added article), wind sentence
//   improved to "carries through the air" for better natural language flow.
//
// v4.4 CHANGES FROM v4.3:
// - FIXED: isQuietHours now compares in SECONDS not truncated hours.
//   Previously Math.floor(sunriseLocal / 3600) lost minute precision.
//   Wellington at 06:40 with sunrise 06:42 → both truncated to hour 6
//   → 6 < 6 = false → activity wrongly shown 2 minutes before sunrise.
//   Now uses Date.now() in seconds vs sunriseLocal in seconds (same
//   pattern as isNightTime directly above). No truncation, no gap.
//
// v4.3 CHANGES FROM v4.2:
// - FIXED: getTimeDescriptor no longer clamps night hours to max 4.
//   Previously Math.min(ctx.hour, 4) forced ALL nighttime hours to show
//   "four in the morning" regardless of actual time. Now uses ctx.hour
//   directly — time-of-day.json has phrases for all 24 hours.
//   Example: Dubai at 21:00 now shows "nine in the evening" not "04:00"
//
// v4.2 CHANGES FROM v4.1:
// - Quiet hours fix: replaced object mutation (scene.activity = '') with
//   inline boolean gate (!quiet) in all 4 tier templates. No mutation needed.
//   Previous approach mutated the CityScene object which failed at runtime.
//
// v4.1 CHANGES FROM v4.0:
// - Moon phrase simplified: uses phase name ("new moon", "full moon") not rich phrases
// - Seed includes 2-hour rotation: Math.floor(Date.now() / 7_200_000)
//   → If any weather value changes, layers 2+3 re-roll immediately
//   → If weather is unchanged for 2 hours, layers 2+3 re-roll automatically
// - Quiet hours: midnight → sunrise, activities suppressed (venue only)
//   Uses OWM sunriseUtc per city, falls back to hour < 6 when API missing
// - Humidity phrase in all 4 tiers (carried from v4.0)
//
// v4.0 CHANGES FROM v3.0:
// - City vibes → venue + activity pairs (from city-vibes.json)
// - Time phrases → simple time descriptors (from time-of-day.json), no mood/lighting
// - Temperature, wind, humidity, conditions → loaded from JSON files
// - All hardcoded vocabulary REMOVED — JSON is the single source of truth
// - Lighting slot DROPPED from all tiers
// - Humidity phrase RE-ADDED to all tiers (was removed in v3.0, now back)
//
// VOCABULARY SCALE (from JSON files):
// - City venues: 83 cities × 10 venues × 5-8 activities = ~4,150 phrases
// - Temperature: 18 ranges × 10 phrases = 180
// - Wind: 30 ranges × 8 phrases = 240
// - Humidity: 20 ranges × 8 phrases = 160
// - Time of day: 24 hours × 5 phrases = 120
// - Conditions: 14 types × 20 phrases = 280
// - Moon phase: 8 phases × 5 phrases = 40
// TOTAL: ~5,170 unique phrases
//
// Authority: docs/authority/ai_providers.md §4-Tier Prompt System
// Existing features preserved: Yes (all exports maintained, legacy deprecated)
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';

// ── JSON vocabulary imports ─────────────────────────────────────────────────
import cityVibesData from '@/data/vocabulary/weather/city-vibes.json';
import temperatureData from '@/data/vocabulary/weather/temperature.json';
import windData from '@/data/vocabulary/weather/wind.json';
import humidityData from '@/data/vocabulary/weather/humidity.json';
import timeOfDayData from '@/data/vocabulary/weather/time-of-day.json';
import conditionsData from '@/data/vocabulary/weather/conditions.json';

// ============================================================================
// TYPES
// ============================================================================

export type PromptTier = 1 | 2 | 3 | 4;

export interface TierInfo {
  tier: PromptTier;
  name: string;
  description: string;
  platforms: string[];
  gradient: string;
}

export interface WeatherPromptInput {
  city: string;
  weather: ExchangeWeatherFull;
  localHour: number;
  tier: PromptTier;
}

interface WeatherContext {
  tempC: number;
  humidity: number;
  windKmh: number;
  hour: number;
  condition: string;
  description: string;
  emoji: string;
  isStormy: boolean;
  isRainy: boolean;
  isCold: boolean;
  isHot: boolean;
  isDry: boolean;
  isHumid: boolean;
  isWindy: boolean;
  isNight: boolean;
  isDawn: boolean;
  isDusk: boolean;
  moonEmoji: string;
  moonPhrase: string;
  moonName: string;
}

/** Venue + activity pair — always selected together */
interface CityScene {
  venue: string;
  activity: string;
}

// ============================================================================
// TIER METADATA
// ============================================================================

export const TIER_INFO: Record<PromptTier, TierInfo> = {
  1: {
    tier: 1,
    name: 'CLIP-Based',
    description: 'Weighted keywords with emphasis markers',
    platforms: ['Stable Diffusion', 'Leonardo', 'Flux', 'ComfyUI'],
    gradient: 'from-violet-500 to-purple-600',
  },
  2: {
    tier: 2,
    name: 'Midjourney',
    description: 'Natural flow with parameter flags',
    platforms: ['Midjourney', 'BlueWillow', 'Niji'],
    gradient: 'from-blue-500 to-indigo-600',
  },
  3: {
    tier: 3,
    name: 'Natural Language',
    description: 'Full descriptive sentences',
    platforms: ['DALL·E', 'Imagen', 'Adobe Firefly', 'Bing Image Creator'],
    gradient: 'from-emerald-500 to-teal-600',
  },
  4: {
    tier: 4,
    name: 'Plain Language',
    description: 'Simple, minimal prompts',
    platforms: ['Canva', 'Craiyon', 'Artistly', 'Microsoft Designer'],
    gradient: 'from-amber-500 to-orange-600',
  },
};

// ============================================================================
// SEEDED RANDOM
// ============================================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function pickRandom<T>(pool: T[], seed: number): T {
  if (pool.length === 0) throw new Error('pickRandom: empty pool');
  const idx = Math.floor(seededRandom(seed) * pool.length);
  return pool[idx]!;
}

// ============================================================================
// DESCRIPTION → EMOJI MAPPING (sky deduplication — unchanged from v3)
// ============================================================================

const DESCRIPTION_EMOJI_MAP: Record<string, string> = {
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

function descriptionToEmoji(description: string, fallbackEmoji: string): string {
  if (!description) return fallbackEmoji;
  return DESCRIPTION_EMOJI_MAP[description.toLowerCase()] ?? fallbackEmoji;
}

// ============================================================================
// NIGHT DETECTION (unchanged from v3)
// ============================================================================

function isNightTime(weather: ExchangeWeatherFull, localHour: number): boolean {
  if (weather.sunriseUtc != null && weather.sunsetUtc != null && weather.timezoneOffset != null) {
    const SECONDS_PER_DAY = 86400;
    const nowUtc = Math.floor(Date.now() / 1000);
    const nowLocal =
      (((nowUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const sunriseLocal =
      (((weather.sunriseUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    const sunsetLocal =
      (((weather.sunsetUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    return nowLocal < sunriseLocal || nowLocal > sunsetLocal;
  }
  if (weather.isDayTime === true) return false;
  if (weather.isDayTime === false) return true;
  return localHour < 6 || localHour >= 19;
}

// ============================================================================
// QUIET HOURS — MIDNIGHT TO SUNRISE (activity suppression)
// ============================================================================
// Between 00:00 and sunrise, venues are shown without activities.
// This prevents unrealistic scenes (e.g. market traders at 3am).
// Uses OWM sunriseUtc for per-city, per-season accuracy.
// Fallback: hour < 6 when API data is missing.
// Evening activities (before midnight) are NOT suppressed.
// ============================================================================

function isQuietHours(weather: ExchangeWeatherFull, localHour: number): boolean {
  if (weather.sunriseUtc != null && weather.timezoneOffset != null) {
    const SECONDS_PER_DAY = 86400;
    const nowUtc = Math.floor(Date.now() / 1000);
    const nowLocal =
      (((nowUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const sunriseLocal =
      (((weather.sunriseUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    // Midnight (second 0) to sunrise (seconds precision, not truncated hours)
    return nowLocal < sunriseLocal;
  }
  // Fallback: midnight to 6am
  return localHour >= 0 && localHour < 6;
}

// ============================================================================
// MOON PHASE (unchanged from v3 — pure maths, no API)
// ============================================================================

const SYNODIC_MONTH = 29.53058770576;
const REFERENCE_NEW_MOON_DAYS = 10957.76;

export interface MoonPhaseInfo {
  readonly name: string;
  readonly emoji: string;
  readonly promptPhrase: string;
  readonly dayInCycle: number;
}

const MOON_PHASES: {
  maxDay: number;
  name: string;
  emoji: string;
  phrases: string[];
}[] = [
  {
    maxDay: 1.85,
    name: 'New Moon',
    emoji: '🌑',
    phrases: [
      'new moon darkness with starlit sky',
      'moonless night deep velvet darkness',
      'new moon shadow absolute night stillness',
      'pitch dark new moon starfield clarity',
      'inky black moonless canopy',
    ],
  },
  {
    maxDay: 7.38,
    name: 'Waxing Crescent',
    emoji: '🌒',
    phrases: [
      'waxing crescent thin silver sliver',
      'delicate crescent moon low arc',
      'young moon faint crescent glow',
      'slender waxing crescent silver edge',
      'emerging crescent moonlight whisper',
    ],
  },
  {
    maxDay: 11.07,
    name: 'First Quarter',
    emoji: '🌓',
    phrases: [
      'half moon sharp light divide',
      'first quarter moon crisp shadow line',
      'half-lit moon geometric precision',
      'quarter moon balanced light and dark',
      'first quarter moon clean bisected glow',
    ],
  },
  {
    maxDay: 14.76,
    name: 'Waxing Gibbous',
    emoji: '🌔',
    phrases: [
      'near-full moon bright luminous glow',
      'waxing gibbous generous moonlight',
      'almost full moon radiant silver wash',
      'swelling gibbous moon brilliant presence',
      'bright waxing gibbous moon flooding light',
    ],
  },
  {
    maxDay: 16.61,
    name: 'Full Moon',
    emoji: '🌕',
    phrases: [
      'full moon silver flood illumination',
      'brilliant full moon casting sharp shadows',
      'magnificent full moon total lunar glow',
      'resplendent full moon night turned silver',
      'blazing full moon dramatic moonlit scene',
    ],
  },
  {
    maxDay: 22.14,
    name: 'Waning Gibbous',
    emoji: '🌖',
    phrases: [
      'waning gibbous soft fading moonlight',
      'post-full moon gentle silver retreat',
      'waning gibbous mellow lunar glow',
      'dimming gibbous moon amber-tinged light',
      'retreating gibbous moon warm silver wash',
    ],
  },
  {
    maxDay: 25.83,
    name: 'Last Quarter',
    emoji: '🌗',
    phrases: [
      'half moon fading light receding',
      'last quarter moon stark shadow divide',
      'waning half moon muted silver glow',
      'third quarter moon geometric dimness',
      'last quarter balanced darkness and light',
    ],
  },
  {
    maxDay: SYNODIC_MONTH,
    name: 'Waning Crescent',
    emoji: '🌘',
    phrases: [
      'thin waning crescent moon vanishing arc',
      'dying crescent moon final silver breath',
      'fading crescent sliver barely visible',
      'old moon waning crescent ghostly trace',
      'disappearing crescent moon pre-dawn whisper',
    ],
  },
];

export function getMoonPhase(date?: Date): MoonPhaseInfo {
  const now = date ?? new Date();
  const nowDays = now.getTime() / 86_400_000;
  const daysSinceRef = nowDays - REFERENCE_NEW_MOON_DAYS;
  const dayInCycle = ((daysSinceRef % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;

  for (const phase of MOON_PHASES) {
    if (dayInCycle < phase.maxDay) {
      const dayOfYear = Math.floor(daysSinceRef);
      const idx = Math.abs(dayOfYear) % phase.phrases.length;
      return {
        name: phase.name,
        emoji: phase.emoji,
        promptPhrase: phase.phrases[idx]!,
        dayInCycle,
      };
    }
  }

  const last = MOON_PHASES[MOON_PHASES.length - 1]!;
  return { name: last.name, emoji: last.emoji, promptPhrase: last.phrases[0]!, dayInCycle };
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

function buildContext(weather: ExchangeWeatherFull, localHour: number): WeatherContext {
  const desc = (weather.description || '').toLowerCase();
  const cond = (weather.conditions || '').toLowerCase();
  const resolvedEmoji = weather.description
    ? descriptionToEmoji(weather.description, weather.emoji)
    : weather.emoji;
  const night = isNightTime(weather, localHour);
  const moon = getMoonPhase();

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
  };
}

// ============================================================================
// JSON VOCABULARY LOADERS
// ============================================================================

// ── Range-based lookup helper ───────────────────────────────────────────────
// temperature.json, wind.json, humidity.json all use { ranges: { "range_X_to_Y": { min, max, phrases } } }
// This finds the matching range for a numeric value and returns its phrase pool.

interface RangeEntry {
  min: number;
  max: number;
  phrases: string[];
}

function buildRangeLookup(ranges: Record<string, RangeEntry>): RangeEntry[] {
  return Object.values(ranges).sort((a, b) => a.min - b.min);
}

function findRange(lookup: RangeEntry[], value: number): string[] {
  for (const range of lookup) {
    if (value >= range.min && value < range.max) return range.phrases;
  }
  // Clamp: if below min, use first; if above max, use last
  if (value < lookup[0]!.min) return lookup[0]!.phrases;
  return lookup[lookup.length - 1]!.phrases;
}

const TEMP_LOOKUP = buildRangeLookup(temperatureData.ranges as Record<string, RangeEntry>);
const WIND_LOOKUP = buildRangeLookup(windData.ranges as Record<string, RangeEntry>);
const HUMIDITY_LOOKUP = buildRangeLookup(humidityData.ranges as Record<string, RangeEntry>);

// ── Time of day (24 hours × N simple descriptors) ──────────────────────────
const TIME_HOURS = timeOfDayData.hours as Record<string, string[]>;

// ── Conditions (emoji-keyed phrase pools) ───────────────────────────────────
interface ConditionEntry {
  emoji: string;
  label?: string;
  phrases: string[];
}
const CONDITION_TYPES = conditionsData.conditions as Record<string, ConditionEntry>;

// Build emoji → phrases lookup for fast access
const CONDITION_BY_EMOJI: Record<string, string[]> = {};
for (const entry of Object.values(CONDITION_TYPES)) {
  if (entry.emoji && entry.phrases) {
    CONDITION_BY_EMOJI[entry.emoji] = entry.phrases;
  }
}

// ── City vibes (venue + activity model) ─────────────────────────────────────
interface CityVenueData {
  name: string;
  activities: string[];
}
interface CityDataRaw {
  country?: string;
  venues?: CityVenueData[];
  attractions?: CityVenueData[]; // Legacy key — normalised below
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

// ============================================================================
// PHRASE SELECTORS
// ============================================================================

function getTempPhrase(ctx: WeatherContext, seed: number): string {
  const pool = findRange(TEMP_LOOKUP, ctx.tempC);
  if (pool.length === 0) return 'mild';
  return pickRandom(pool, seed);
}

function getHumidityPhrase(ctx: WeatherContext, seed: number): string {
  const pool = findRange(HUMIDITY_LOOKUP, ctx.humidity);
  if (pool.length === 0) return 'moderate humidity';
  return pickRandom(pool, seed * 1.1);
}

function getWindPhrase(ctx: WeatherContext, seed: number): string {
  const pool = findRange(WIND_LOOKUP, ctx.windKmh);
  if (pool.length === 0) return 'gentle breeze';
  return pickRandom(pool, seed * 1.2);
}

/**
 * Simple time descriptor — just a plain phrase like "early morning" or "midnight".
 * No mood, no lighting. When isNight is true, force hour 0 pool for consistency.
 */
function getTimeDescriptor(ctx: WeatherContext, seed: number): string {
  const hourKey = String(ctx.hour);
  const pool = TIME_HOURS[hourKey] ?? TIME_HOURS['12'] ?? [];
  if (pool.length === 0) return 'daytime';
  return pickRandom(pool, seed * 1.3);
}

// ── Sky source (unchanged dedup logic) ──────────────────────────────────────
const WIND_ONLY_DESCRIPTIONS = new Set([
  'windy',
  'breezy',
  'gusty',
  'blustery',
  'squall',
  'squalls',
]);

function getSkySource(ctx: WeatherContext, seed: number): string | null {
  if (ctx.description) {
    const lower = ctx.description.toLowerCase().trim();
    if (WIND_ONLY_DESCRIPTIONS.has(lower)) return null;
    return ctx.description;
  }
  return getConditionPhrase(ctx, seed);
}

function getConditionPhrase(ctx: WeatherContext, seed: number): string {
  const pool = CONDITION_BY_EMOJI[ctx.emoji];
  if (pool && pool.length > 0) return pickRandom(pool, seed * 1.4);
  // Fallback: try to find any matching condition type
  for (const entry of Object.values(CONDITION_TYPES)) {
    if (entry.phrases.length > 0) return pickRandom(entry.phrases, seed * 1.4);
  }
  return 'clear skies';
}

// ============================================================================
// CITY SCENE SELECTOR (Layers 2 + 3)
// ============================================================================
// Picks a random venue from the city, then a random activity from THAT venue.
// Venue and activity are always paired — they describe the same place.
// Returns null when the city has no venue data.
// ============================================================================

function getCityScene(city: string, seed: number): CityScene | null {
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

  // Pick a random venue
  const venue = pickRandom(data.venues, seed * 2.1);
  if (!venue.activities || venue.activities.length === 0) {
    return { venue: venue.name, activity: '' };
  }

  // Pick a random activity from that venue
  const activity = pickRandom(venue.activities, seed * 2.7);
  return { venue: venue.name, activity };
}

// ============================================================================
// TIER-SPECIFIC GENERATORS
// ============================================================================
//
// Element ordering is optimised per tier based on how each platform class
// reads and weights prompt fragments:
//
// Tier 1 (CLIP):  City→Venue→Activity→Moon→Sky→Temp→Wind→Humidity→Time→quality
//   Weights (:1.3, :1.2, :1.1) control importance; position is secondary.
//   Time can sit late because it carries no weight marker.
//
// Tier 2 (MJ):    Time→City→Venue→Activity→Moon→Sky→Temp→Wind→Humidity→params
//   Left-to-right diminishing attention. Time first = lighting context for
//   everything after it. Parameters (--ar, --stylize, --no) always trail.
//
// Tier 3 (NatLang): Time→City→Venue→Activity→Sky→Moon→Temp→Wind→Humidity
//   Parsed like a story. "A nine in the evening scene in Dubai at Kite Beach"
//   — time frames the whole image. Sky+Moon dress it. Conditions close.
//
// Tier 4 (Plain):  City→Venue→Activity→Time→Sky→Temp→Wind→Humidity→Moon
//   Weakest parser. Subject (city+venue+activity) must lead. Time at pos 4
//   gives it the best chance of being noticed. Moon last — rarely rendered.
// ============================================================================

/**
 * Tier 1: CLIP-Based — Weighted keywords with emphasis markers
 *
 * Order: City::1.3 → (Venue:1.2) → (Activity:1.1) → (Moon:1.2) →
 *        (Sky:1.2) → Temp → Wind → Humidity → Time → quality tags
 *
 * Weights override position, so city/venue/moon get highest emphasis.
 * Time sits late (no weight needed). Quality tags and --no always trail.
 */
function generateTier1(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const twoHourWindow = Math.floor(Date.now() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  const scene = getCityScene(city, seed);
  const quiet = isQuietHours(weather, hour);
  const temp = getTempPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const humidity = getHumidityPhrase(ctx, seed);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySource(ctx, seed);

  // Order: City → Venue → Activity → Moon → Sky → Temp → Wind → Humidity → Time → quality
  const parts = [
    `${city}::1.3`,
    scene ? `(${scene.venue}:1.2)` : null,
    scene && scene.activity && !quiet ? `(${scene.activity}:1.1)` : null,
    ctx.isNight ? `(${ctx.moonPhrase}:1.2)` : null,
    skySource ? `(${skySource}:1.2)` : null,
    temp,
    wind,
    humidity,
    time,
    'masterpiece',
    'best quality',
    '8k',
  ].filter(Boolean);

  const negatives = quiet
    ? '--no people text watermarks logos blurry'
    : '--no watermarks logos blurry';

  return `${parts.join(', ')} ${negatives}`;
}

/**
 * Tier 2: Midjourney — Natural flow with parameter flags
 *
 * Order: Time → City+Venue → Activity → Moon → Sky → Temp → Wind → Humidity → params
 *
 * Left-to-right diminishing attention — ~60% weight on first clause.
 * Time leads so lighting context colours everything after it.
 * Parameters (--ar, --stylize, --no) always go last.
 */
function generateTier2(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const twoHourWindow = Math.floor(Date.now() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  const scene = getCityScene(city, seed);
  const quiet = isQuietHours(weather, hour);
  const temp = getTempPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const humidity = getHumidityPhrase(ctx, seed);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySource(ctx, seed);

  const venuePart = scene ? ` at ${scene.venue}` : '';
  const activityPart = scene && scene.activity && !quiet ? scene.activity : null;

  // Order: Time+City+Venue → Activity → Moon → Sky → Temp → Wind → Humidity
  const description = [
    `${time} in ${city}${venuePart}`,
    activityPart,
    ctx.isNight ? ctx.moonPhrase : null,
    skySource,
    temp,
    wind,
    humidity,
  ]
    .filter(Boolean)
    .join(', ');

  const negatives = quiet ? '--ar 16:9 --stylize 100 --no people text' : '--ar 16:9 --stylize 100';

  return `${description} ${negatives}`;
}

/**
 * Tier 3: Natural Language — Full descriptive sentences (DEFAULT TIER)
 *
 * Order: Time→City→Venue→Activity → Sky→Moon → Temp→Wind→Humidity
 *
 * Parsed like a story. Time frames the entire image from the first word.
 * "A nine in the evening scene in Dubai at Kite Beach, volleyball courts..."
 * Sky+Moon dress the scene. Temperature, wind, humidity close as atmosphere.
 * Quality directive and content exclusion as final sentences.
 */
function generateTier3(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const twoHourWindow = Math.floor(Date.now() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  const scene = getCityScene(city, seed);
  const quiet = isQuietHours(weather, hour);
  const temp = getTempPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const humidity = getHumidityPhrase(ctx, seed);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySource(ctx, seed);

  // Sentence 1: TIME → City → Venue → Activity
  const venuePart = scene ? ` at ${scene.venue}` : '';
  const activityClause = scene && scene.activity && !quiet ? `, ${scene.activity}` : '';
  const opening = `A ${time} scene in ${city}${venuePart}${activityClause}.`;

  // Sentence 2: Sky → Moon → Temp
  const moonClause = ctx.isNight ? ` Under a ${ctx.moonPhrase}.` : '';
  const skySentence = skySource
    ? `The sky shows ${skySource}, creating a ${temp} atmosphere.${moonClause}`
    : `A ${temp} atmosphere pervades the scene.${moonClause}`;

  // Sentence 3: Wind → Humidity (phrases are self-contained, no suffixes)
  const conditionSentence = `Ambient conditions include ${wind} and ${humidity}.`;

  const sentences = [
    opening,
    skySentence,
    conditionSentence,
    'Photorealistic, highly detailed urban landscape.',
  ];
  if (quiet) sentences.push('No people or text visible.');

  return sentences.join(' ');
}

/**
 * Tier 4: Plain Language — Simple comma-separated prompt
 *
 * Order: City → Venue → Activity → Time → Sky → Temp → Wind → Humidity → Moon
 *
 * Weakest parsers. Subject (city+venue+activity) must lead so the model
 * knows WHAT to draw. Time at position 4 — right after the visual subject,
 * best chance of being noticed. Moon last — plain generators rarely render
 * lunar phases visually. NO EMOJI in output.
 */
function generateTier4(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const twoHourWindow = Math.floor(Date.now() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  const scene = getCityScene(city, seed);
  const quiet = isQuietHours(weather, hour);
  const temp = getTempPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const humidity = getHumidityPhrase(ctx, seed);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySource(ctx, seed);

  // Order: City → Venue → Activity → Time → Sky → Temp → Wind → Humidity → Moon
  const parts = [
    city,
    scene ? scene.venue : null,
    scene && scene.activity && !quiet ? scene.activity : null,
    time,
    skySource,
    temp,
    wind,
    humidity,
    ctx.isNight ? ctx.moonPhrase : null,
  ].filter(Boolean);

  const prompt = parts.join(', ');
  return quiet ? `${prompt}, no people or text visible` : prompt;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateWeatherPrompt(input: WeatherPromptInput): string {
  const { city, weather, localHour, tier } = input;

  switch (tier) {
    case 1:
      return generateTier1(city, weather, localHour);
    case 2:
      return generateTier2(city, weather, localHour);
    case 3:
      return generateTier3(city, weather, localHour);
    case 4:
      return generateTier4(city, weather, localHour);
    default:
      return generateTier3(city, weather, localHour);
  }
}

export function getDefaultTier(): PromptTier {
  return 3;
}

export function getTierInfo(tier: PromptTier): TierInfo {
  return TIER_INFO[tier];
}

export function getAllTierOptions(): TierInfo[] {
  return [TIER_INFO[1], TIER_INFO[2], TIER_INFO[3], TIER_INFO[4]];
}

// ============================================================================
// LEGACY EXPORTS (backward compatibility — used by commodity-prompt-generator)
// ============================================================================

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
  const pool = findRange(WIND_LOOKUP, windKmh);
  return pool.length > 0 ? pickRandom(pool, windKmh) : 'gentle breeze';
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getTimeMood(hour: number): { mood: string; lighting: string } {
  const hourKey = String(hour);
  const pool = TIME_HOURS[hourKey] ?? TIME_HOURS['12'] ?? [];
  const descriptor = pool.length > 0 ? pickRandom(pool, hour) : 'daytime';
  // Legacy callers expect mood + lighting. Lighting is gone — return empty string.
  return { mood: descriptor, lighting: '' };
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getConditionVisual(condition: string, description: string): string {
  // Try to find a matching condition type by label
  for (const entry of Object.values(CONDITION_TYPES)) {
    if (entry.label?.toLowerCase().includes(condition.toLowerCase())) {
      if (entry.phrases.length > 0) return pickRandom(entry.phrases, 12);
    }
  }
  return description || 'clear skies';
}
