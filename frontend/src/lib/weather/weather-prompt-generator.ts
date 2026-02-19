// src/lib/weather/weather-prompt-generator.ts
// ============================================================================
// WEATHER PROMPT GENERATOR v8.0 — PRECIPITATION TRUTH
// ============================================================================
// Generates dynamic image prompts from live weather data.
//
// v8.0 ARCHITECTURE — PRECIPITATION TRUTH:
//   The biggest correctness bug in v7.x: snow, sleet, hail, fog, mist, smoke,
//   and dust were NOT treated as precipitation-active by the Visual Truth engine.
//   Only rain/drizzle/thunderstorm triggered the precipitationActive flag.
//   This meant Toronto at -5°C with heavy snow → air clarity "clear",
//   surfaces "invisible moisture" — obviously wrong.
//
//   New classifyPrecip() function replaces the old isRainy/isStormy booleans
//   with a proper multi-type PrecipState:
//     { type, intensity, active, reducesVisibility }
//
//   Prefers numeric rain.1h/snow.1h from OWM (measured volumes, most trustworthy)
//   then falls back to keyword inference from conditions/description.
//
//   Gateway pipeline: OWM rain/snow objects + wind.deg/wind.gust now extracted
//   (4 new WeatherData fields: rainMm1h, snowMm1h, windDegrees, windGustKmh).
//
//   deriveVisualTruth() now receives PrecipState and handles:
//   - Snow-specific air clarity (diffuse scattering, heavy → foggy)
//   - Snow surface moisture (accumulation at ≤0°C, melting at >0°C)
//   - Hail surface effects (visible regardless of temperature)
//   - Fog/mist/haze/smoke/dust atmospheric classification
//
//   WeatherContext gains isSnowy, isFoggy, isMisty flags.
//   All 4 tier generators unchanged — they consume VisualTruth which now
//   carries correct physics for ALL precipitation types.
//
// v7.8 ARCHITECTURE — PRECIPITATION-AWARE SKY SOURCE:
//   Night scenes previously suppressed ALL weather descriptions because
//   encodesCloudState was always true at night. This dropped precipitation
//   (snow, rain, mist, fog, thunderstorm) — visually critical conditions
//   that fundamentally change the scene.
//
//   New function getSkySourceAware() separates cloud-only descriptions
//   (which lighting already covers) from precipitation/phenomena (which
//   must always appear). CLOUD_ONLY_DESCRIPTIONS are suppressed when
//   lighting encodes cloud state. Everything else passes through.
//
//   Fix: Toronto at night with snow now includes "snow" in the prompt.
//   Fix: unused `pres` in deriveVisualTruth prefixed with `_`.
//   Fix: urbanLightData TypeScript cast uses `as unknown as` for safe access.
//
// v7.7 ARCHITECTURE — ICONIC VENUE ENRICHMENT:
//   Venues in city-vibes.json can now carry an optional `lightCharacter`
//   array. When present, these phrases take HIGHEST priority in the
//   nighttime lighting engine — above both the setting pool (v7.5) and
//   the city lightCharacter (v7.0).
//
//   3-tier night light priority:
//     1. venue.lightCharacter (iconic venues — from city-vibes.json)
//     2. SETTING_NIGHT_LIGHT[setting] (generic per setting type)
//     3. city lightCharacter (urban-light.json — commercial strip)
//
//   Only used for venues with truly distinctive lighting (e.g. Coney Island
//   fairground, Victoria Peak skyline view, Giza pyramids).
//   Most venues inherit from the setting pool — no data change required.
//
// v7.6 ARCHITECTURE — COHERENCE VALIDATOR:
//   Post-computeLighting safety net. Scans the lighting base phrase for
//   commercial terms that are physically impossible at non-urban venues.
//   If "neon", "shopfront", "storefront", "signage", etc. appear in
//   the lighting for a beach/park/elevated/monument venue, the base is
//   swapped to the setting-specific pool and fullPhrase rebuilt.
//
//   Catches edge cases that v7.5 routing can't prevent:
//   - "balanced" competition concatenating city character with moonlight
//   - Future data changes introducing unexpected lightCharacter phrases
//   - Fallback/unknown venue settings
//
// v7.5 ARCHITECTURE — VENUE-AWARE LIGHTING:
//   The nighttime lighting engine now receives the venue's setting type
//   BEFORE computing the competition model. Two new systems:
//
//   1. SETTING_NIGHT_LIGHT — dedicated light pools for non-commercial venues
//      (beach, park, elevated, monument). A beach gets "boardwalk lamp pools"
//      not "LED billboard glow". Urban settings (street, narrow, market, plaza,
//      waterfront) still use the city's unique lightCharacter.
//
//   2. SETTING_URBAN_ATTENUATION — per-setting multiplier on the city's
//      urbanLight factor. A park (×0.4) or beach (×0.3) in a high-urban city
//      shifts the competition toward moonlight, which is physically accurate.
//      Victoria Peak at night is moonlit, not neon-lit.
//
//   Venue is now selected ONCE in generateWeatherPrompt (before computeLighting)
//   and passed to all tier generators. Same deterministic seed. No duplication.
//
// v7.0 ARCHITECTURE — VISUAL TRUTH LAYER:
//   Before any phrase is selected, ALL weather data is cross-referenced to
//   derive what the atmosphere ACTUALLY LOOKS LIKE (VisualTruth).
//   Every layer reads from this shared truth. No layer can contradict another.
//
//   VisualTruth derives 4 properties:
//     airClarity         — what AIR between viewer and scene looks like
//     contrast           — what SHADOWS actually look like given the full picture
//     moistureVisibility — what SURFACES look like (damp, frost, dry)
//     thermalOptics      — what TEMPERATURE does to light/physics (shimmer, frost)
//
//   Key input: dew point spread (tempC − dewPoint):
//     > 10°C → invisible moisture, clear atmosphere
//     5–10°C → slight softening
//     2–5°C  → visible haze
//     1–2°C  → mist forming, wet surfaces
//     < 1°C  → fog likely (wind-dependent)
//
// 10 LAYERS (v6.0 structure preserved):
//   Layer 1  — WHERE: City name (e.g. "Tokyo")
//   Layer 2  — SPECIFIC WHERE: Venue (e.g. "Tsukiji Outer Market") [NO activities]
//   Layer 3  — LIGHTING: Deterministic procedural assembly from 6 data inputs
//              v7.0: shadow + atmosphere modifiers now use VisualTruth
//   Layer 4  — TIME: Simple descriptor (e.g. "eleven at night")
//   Layer 5  — SKY: OWM description or conditions.json (CONDITIONAL)
//   Layer 6  — MOON: Phase phrase (night only)
//   Layer 7  — WIND: Template descriptor + exact API speed
//   Layer 8  — MOISTURE: v7.0 replaces humidity — optical surface effects
//   Layer 9  — THERMAL: v7.0 replaces temperature — optical light effects
//   Layer 10 — DIRECTIVE: "no people or text visible" (quiet hours only)
//
// v8.0 KEY CHANGES FROM v7.8:
// - PRECIPITATION TRUTH: classifyPrecip() replaces isRainy/isStormy booleans.
//   Returns PrecipState { type, intensity, active, reducesVisibility }.
//   Snow, sleet, hail, fog, mist, haze, smoke, dust now classified correctly.
// - NUMERIC PRECIPITATION: Prefers OWM rain.1h/snow.1h (measured mm/h) over
//   keyword inference. Light (<0.5mm), moderate (0.5–2mm), heavy (>2mm) for snow;
//   light (<2mm), moderate (2–6mm), heavy (>6mm) for rain.
// - GATEWAY PIPELINE: 4 new WeatherData fields extracted from OWM:
//   rainMm1h, snowMm1h, windDegrees, windGustKmh. Full pipeline:
//   gateway types → adapter → frontend fetch → component types → exchange card → weather types.
// - VISUAL TRUTH FIX: deriveVisualTruth() receives PrecipState instead of 2 booleans.
//   Snow-specific air clarity (diffuse scattering). Snow surface moisture
//   (accumulation at ≤0°C, melting at >0°C). Hail surface effects. Fog/mist/smoke/dust
//   atmospheric classification with OWM type trust.
// - WEATHER CONTEXT: gains isSnowy, isFoggy, isMisty, windDegrees, windGustKmh
//   in buildContext().
// - BEAUFORT WIND: WindTier (4 tiers) → WindForce (7 Beaufort-aligned tiers).
//   Key correction: 50 km/h = nearGale (strong effects, NOT destructive).
//   Destructive phrases start at gale (62+). All human-body phrases purged.
//   classifyWind() replaces getWindTier(). VENUE_WIND expanded to 7 tiers × 9 venues.
// - WIND DIRECTION: getCardinalDirection() converts OWM wind.deg to cardinal word.
//   Prefix added when available: "south-westerly 35 km/h wind".
// - GUST FACTOR: When windGustKmh > sustained × 1.5 → "gusting to {gust}" suffix.
// - SNOW+WIND: When PrecipState is active snow + wind ≥20 km/h → blowing/drifting
//   snow phrases override venue interaction (horizontal at 50+, reducing vis at 30+).
// - VENUE TAXONOMY: 7 misclassified venues fixed in city-vibes.json
//   (e.g. Chinatown Canal Street waterfront→street, Canal City waterfront→market).
//   14 legitimate exceptions documented with overrideJustification field.
//   SETTING_OVERRIDES runtime safety net in getCityVenue() for future corrections.
//   Standalone linter: `npx tsx scripts/lint-venues.ts` (CI-ready, exit code 1 on errors).
// - TIER 3 SETTING ENDING (Chat 4): Hardcoded "urban landscape" replaced with
//   getSettingEnding() — returns venue-appropriate directives:
//   street/narrow/market/plaza→"city scene", waterfront/beach→"coastal scene",
//   monument→"landmark scene", park→"landscape scene", elevated→"skyline view".
// - TIER 4 FRAGMENT LIMIT (Chat 4): Hard cap of 10 comma items. Priority-based
//   dropping: grounding→sky→moon→thermal→moisture (least visual impact first).
// - TIER 4 PERIOD NOUNS (Chat 4): getTimePeriod() returns "dawn"/"dusk"/"night"
//   instead of "seven in the evening" — weak parsers handle simple nouns better.
// - TIER 1 STRUCTURED RETURN (Chat 5): generateWeatherPrompt() returns
//   WeatherPromptResult { text, positive?, negative?, tier } instead of string.
//   Consumers use `.text` (backward compat). Tier 1 populates positive/negative
//   separately for future "copy positive only" UI.
// - TIER 1 PHOTOREAL TAGS (Chat 5): "masterpiece, best quality, 8k" replaced
//   with "professional photography, sharp focus, high resolution" (photoreal bias).
//   Swappable via PHOTOREAL_QUALITY_TAGS constant (future PromptProfile).
// - TIER 1 TOKEN GUARD (Chat 5): Caps at 15 parts (~60 CLIP tokens). Drops
//   time/grounding/moisture before quality tags when over budget.
// - TIER 2 MULTI-PROMPT (Chat 6): Midjourney :: weight syntax replaces dash-break
//   folklore. Segments: lighting+time::2, venue+sky+weather::1, surface::0.5.
//   Word budget ~40 words before params. Surface segment dropped when over budget.
// - PROMPT PROFILE (Chat 7): PromptProfile interface configures generator without
//   unpredictability. Fields: verbosity (short/standard/rich), style (photoreal/
//   cinematic/documentary), excludePeople (always/quiet-hours/never), mjAspect,
//   mjStylize, strictPhysics. DEFAULT_PROMPT_PROFILE matches pre-Chat-7 output
//   exactly (zero regression). Profile threaded through all 4 tier generators.
//   Style-keyed quality tags (STYLE_QUALITY_TAGS) and ending prefixes
//   (STYLE_ENDING_PREFIX) replace hardcoded constants. Verbosity-keyed fragment
//   limits (VERBOSITY_T1_LIMIT, VERBOSITY_T4_LIMIT) replace hardcoded caps.
// - PROMPT TRACE (Chat 8): PromptTrace interface exposes every generator decision.
//   Activated by `debug: true` in WeatherPromptInput or NODE_ENV=development.
//   Attached to WeatherPromptResult.trace. Fields: profile, precip, windForce,
//   venue, visualTruth summary, lighting summary, solarElevation, moon,
//   isNight, seed, excludedPeople, localHour, temperatureC, humidity.
//   Zero cost in production — trace block never entered when debug is false.
// - LINT FIX: Removed unused PHOTOREAL_QUALITY_TAGS alias (replaced by
//   STYLE_QUALITY_TAGS[profile.style] in Chat 7).
//
// v7.8 KEY CHANGES FROM v7.7:
// - PRECIPITATION-AWARE SKY: getSkySourceAware() replaces the old
//   `!encodesCloudState ? getSkySource() : null` gate in all 4 tiers.
//   Precipitation (snow, rain, drizzle, sleet, hail, mist, fog, thunderstorm)
//   always passes through. Cloud-only descriptions suppressed when redundant.
// - CLOUD_ONLY_DESCRIPTIONS: set of 12 OWM descriptions that duplicate
//   the lighting engine's cloud encoding. Only these are suppressed.
// - LINT FIX: unused `pres` in deriveVisualTruth → `_pres`.
// - TYPE FIX: urbanLightData cast uses `as unknown as` with optional fields
//   to handle JSON meta schemas that lack defaultFallback/defaultLightCharacter.
//
// v7.7 KEY CHANGES FROM v7.6:
// - VENUE ENRICHMENT: city-vibes.json venues can carry optional lightCharacter[].
//   When present, these override setting pool AND city lightCharacter at night.
// - 3-TIER PRIORITY: venue lightCharacter → SETTING_NIGHT_LIGHT → city character.
// - CityVenueData + VenueResult interfaces extended with optional lightCharacter.
// - getCityVenue passes through lightCharacter from JSON data.
// - computeLighting accepts new venueLightCharacter param.
// - validateLightingCoherence prefers venue lightCharacter for replacements.
// - DATA: 25 iconic venues enriched with 3 phrases each (75 new phrases).
//
// v7.6 KEY CHANGES FROM v7.5:
// - COHERENCE VALIDATOR: validateLightingCoherence() runs after computeLighting.
//   Scans lighting.base for per-setting banned terms. Swaps + rebuilds if found.
// - SETTING_BANNED_TERMS: ~12 commercial terms per non-urban setting (beach, park,
//   elevated, monument). Urban settings have no bans — city character is correct.
// - SAFETY NET: catches edge cases where v7.5 routing doesn't prevent city
//   lightCharacter leaking into non-urban venues (balanced competition, fallbacks).
//
// v7.5 KEY CHANGES FROM v7.4:
// - VENUE-AWARE LIGHTING: computeLighting receives venue setting. Night base
//   phrase now uses setting-specific pools for beach/park/elevated/monument.
// - URBAN ATTENUATION: per-setting multiplier on urbanFactor. Parks get ×0.4,
//   beaches ×0.3, elevated ×0.2 — shifting competition toward moonlight.
// - HOISTED VENUE: venue selected once in generateWeatherPrompt, shared by
//   computeLighting and all tier generators. Same seed, no duplication.
// - SETTING LIGHT POOLS: 5 phrases each for beach, park, elevated, monument.
//   Physical emitters only (boardwalk lamps, path lighting, floodlights).
//
// v7.0 KEY CHANGES FROM v6.1:
// - VISUAL TRUTH: Unified atmospheric assessment cross-referencing temp, humidity,
//   wind, cloud, visibility, pressure, dew point. Computed ONCE, used everywhere.
// - DEW POINT PHYSICS: Magnus formula computes dew point spread. Drives air clarity,
//   moisture visibility, fog/mist decisions. Overrides OWM visibility cap (10000m).
// - HUMIDITY PHRASES → MOISTURE PHRASES: Weather-report descriptions ("humidity very
//   close to saturation") replaced with surface optical effects ("damp surfaces
//   glistening under the light"). Omitted when moisture is invisible (~50% of cases).
// - TEMPERATURE PHRASES → THERMAL PHRASES: Thermometer readings ("comfortable mild
//   temperatures") replaced with light/physics effects ("heat shimmer distorting
//   distant surfaces"). Omitted when temperature is visually neutral (10–30°C).
// - SHADOW MODIFIER: Now cross-references cloud + humidity + dew point, not just
//   cloud alone. Saturated air at 0°C → "faint diffused shadows" not "sharp shadows".
// - ATMOSPHERE MODIFIER: Now driven by air clarity (dew point + vis + humidity + wind),
//   not visibility alone. "in pristine clear air" eliminated for ~85% of prompts.
// - PHYSICS CONFLICT ELIMINATION: Impossible combinations like "sharp shadows" +
//   "fully saturated air" + "pristine clear air" can no longer occur.
// - TIER 3 SENTENCE 4: "The air carries X and Y, with Z" → dynamic composition
//   from visual truth phrases. No triple-"air" constructions.
// - BACKWARD COMPAT: Legacy exports (getTempFeel, getHumidityTexture) unchanged.
//   Demo exchanges without cloud/visibility data fall back to v6.1 logic.
//
// VOCABULARY SCALE (v7.0):
// - City venues: 83 cities × ~10 venues = 842 (no activities)
// - Moisture (NEW): 5 states × 3 phrases = 15 (+ 2 states omitted = 0)
// - Thermal (NEW): 6 states × 3 phrases = 18 (+ 1 state omitted = 0)
// - Wind: 30 bins × 1 descriptor (+ exact API speed) = 30
// - Time of day: 24 hours, 67 phrases total
// - Conditions: 14 types × 20 phrases = 280
// - Moon phase: 8 phases × 5 phrases = 40
// - Lighting: 28 procedural phrases (no rotation)
// - Air clarity: 6 states × 1 phrase = 6
// - Contrast: 4 states × 1 phrase = 4
// TOTAL: ~1,333 items (down from ~1,401 — fewer but higher quality)
//
// Authority: docs/authority/exchange-card-weather.md §11 + §11A
// Existing features preserved: Yes (all exports maintained, legacy deprecated)
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';
import { getSolarElevation, getLunarPosition } from './sun-calculator';
import type { LunarPosition } from './sun-calculator';

// ── JSON vocabulary imports ─────────────────────────────────────────────────
import cityVibesData from '@/data/vocabulary/weather/city-vibes.json';
import temperatureData from '@/data/vocabulary/weather/temperature.json';
// wind-template-descriptors.json no longer imported — v7.3 uses inline noun scale
import humidityData from '@/data/vocabulary/weather/humidity.json';
import timeOfDayData from '@/data/vocabulary/weather/time-of-day.json';
import conditionsData from '@/data/vocabulary/weather/conditions.json';
import urbanLightData from '@/data/vocabulary/weather/urban-light.json';

// Legacy import kept for backward-compatible exports only
import windData from '@/data/vocabulary/weather/wind.json';

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
  /**
   * Weather observation timestamp as Unix seconds (UTC).
   * Pass through OWM `dt` (or equivalent) to make lighting + moon physics consistent.
   * When omitted, generator falls back to `new Date()` and is not physics-grade.
   */
  observedAtUtcSeconds?: number | null;
  tier: PromptTier;
  /** Latitude for solar elevation calculation (lighting engine). Optional. */
  latitude?: number | null;
  /** Longitude for solar elevation calculation (lighting engine). Optional. */
  longitude?: number | null;
  /** v8.0.0 Chat 7: Optional prompt profile. Omit for default behaviour. */
  profile?: Partial<PromptProfile> | null;
  /**
   * v8.0.0 Chat 8: When true, attaches PromptTrace to the result.
   * Also activates when `process.env.NODE_ENV === 'development'`.
   * Zero cost when false — trace object is never constructed.
   */
  debug?: boolean;
}

/**
 * v8.0.0 Chat 5: Structured prompt result.
 *
 * `text` is the full display string (backward compatible with old string return).
 * `positive`/`negative` are only populated for Tier 1 (CLIP-based platforms).
 * All existing consumers use `.text` identically to the old string.
 */
export interface WeatherPromptResult {
  /** Full display string — equivalent to the old string return. */
  text: string;
  /** Positive prompt only (Tier 1 only). For "copy positive only" UI. */
  positive?: string;
  /** Negative prompt only (Tier 1 only). For "copy negative only" UI. */
  negative?: string;
  /** Which tier generated this result. */
  tier: PromptTier;
  /**
   * v8.0.0 Chat 8: Diagnostic trace — every decision the generator made.
   * Only populated when `debug: true` in input or NODE_ENV === 'development'.
   * Inspect with `console.log(result.trace)` or React DevTools.
   */
  trace?: PromptTrace;
}

/**
 * v8.0.0 Chat 8: Prompt Trace — makes "why did this output happen?" trivial.
 *
 * All fields use primitive or serialisable types so they survive
 * `JSON.stringify()` / React DevTools inspection without circular refs.
 * Only constructed when debug mode is active — zero cost in production.
 */
export interface PromptTrace {
  /** Resolved profile (after defaults merged). */
  profile: PromptProfile;
  /** Precipitation classification from classifyPrecip(). */
  precip: {
    type: string;
    intensity: string;
    active: boolean;
    reducesVisibility: boolean;
  };
  /** Wind classification from classifyWind(). */
  windForce: string;
  /** Wind speed in km/h (raw input). */
  windSpeedKmh: number;
  /** Venue picked for this city+seed, or null if city has no venues. */
  venue: { name: string; setting: string } | null;
  /** Visual truth summary — what the atmosphere actually looks like. */
  visualTruth: {
    airClarity: string;
    contrast: string;
    moistureVisibility: string;
    thermalOptics: string;
    precipActive: boolean;
  } | null;
  /** Lighting engine output summary. */
  lighting: {
    base: string;
    fullPhrase: string;
    shadowModifier: string;
    atmosphereModifier: string;
    moonVisible: boolean;
    moonPositionPhrase: string | null;
    nightDominant: string | null;
    encodesCloudState: boolean;
  };
  /** Solar elevation in degrees, null if lat/lon not provided. */
  solarElevation: number | null;
  /** Moon phase info. */
  moon: { name: string; dayInCycle: number; emoji: string };
  /** Night/day classification. */
  isNight: boolean;
  /** Deterministic seed used for phrase rotation. */
  seed: number;
  /** Whether people were excluded from this prompt. */
  excludedPeople: boolean;
  /** Input hour (local time at the exchange). */
  localHour: number;
  /** Temperature in °C. */
  temperatureC: number;
  /** Humidity percentage. */
  humidity: number;
}

// ============================================================================
// v8.0.0 Chat 7: PROMPT PROFILE — configurable without unpredictable
// ============================================================================

/**
 * Controls generator behaviour without changing the generator's logic.
 * All fields are optional — omitted fields use DEFAULT_PROMPT_PROFILE values.
 * The default profile produces identical output to pre-Chat-7 behaviour.
 *
 * Future Pro tier: users pick a profile, we store it, pass it in.
 */
export interface PromptProfile {
  /** Controls fragment count. 'standard' matches pre-Chat-7 output. */
  verbosity: 'short' | 'standard' | 'rich';
  /** Controls quality tags (Tier 1) and ending sentence (Tier 3). */
  style: 'photoreal' | 'cinematic' | 'documentary';
  /** People exclusion: 'quiet-hours' matches pre-Chat-7 behaviour. */
  excludePeople: 'always' | 'quiet-hours' | 'never';
  /** Midjourney aspect ratio (Tier 2 only). */
  mjAspect: '1:1' | '16:9' | '2:3';
  /** Midjourney stylize value (Tier 2 only). */
  mjStylize: number;
  /** When true, more aggressively prune contradictory fragments. (Reserved.) */
  strictPhysics: boolean;
}

/** Zero-regression default — produces identical output to Chats 1–6. */
export const DEFAULT_PROMPT_PROFILE: PromptProfile = {
  verbosity: 'standard',
  style: 'photoreal',
  excludePeople: 'quiet-hours',
  mjAspect: '16:9',
  mjStylize: 100,
  strictPhysics: false,
};

/**
 * Merge a partial profile with defaults. Every field guaranteed filled.
 * Consumers can pass `{ style: 'cinematic' }` and get everything else default.
 */
function resolveProfile(partial?: Partial<PromptProfile> | null): PromptProfile {
  if (!partial) return { ...DEFAULT_PROMPT_PROFILE };
  return { ...DEFAULT_PROMPT_PROFILE, ...partial };
}

// ── Style-keyed quality tags (Tier 1) ──────────────────────────────────
const STYLE_QUALITY_TAGS: Record<PromptProfile['style'], readonly string[]> = {
  photoreal: ['professional photography', 'sharp focus', 'high resolution'],
  cinematic: ['cinematic color grading', 'anamorphic lens', 'high resolution'],
  documentary: ['documentary photography', 'natural light', 'high resolution'],
};

// ── Style-keyed ending prefixes (Tier 3) ───────────────────────────────
const STYLE_ENDING_PREFIX: Record<PromptProfile['style'], string> = {
  photoreal: 'Photorealistic',
  cinematic: 'Cinematic',
  documentary: 'Documentary',
};

// ── Verbosity-keyed fragment limits ────────────────────────────────────
const VERBOSITY_T1_LIMIT: Record<PromptProfile['verbosity'], number> = {
  short: 12,
  standard: 15,
  rich: 18,
};
const VERBOSITY_T4_LIMIT: Record<PromptProfile['verbosity'], number> = {
  short: 8,
  standard: 10,
  rich: 12,
};

/**
 * Resolve people-exclusion based on profile + current quiet-hours state.
 * Replaces raw `isQuietHours()` in each tier.
 */
function shouldExcludePeople(
  profile: PromptProfile,
  weather: ExchangeWeatherFull,
  localHour: number,
  observedAtUtc: Date,
): boolean {
  switch (profile.excludePeople) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'quiet-hours':
    default:
      return isQuietHours(weather, localHour, observedAtUtc);
  }
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
  /** v8.0.0: Snow/sleet/hail detection (was missing before — biggest correctness bug) */
  isSnowy: boolean;
  /** v8.0.0: Fog detection for atmospheric rendering */
  isFoggy: boolean;
  /** v8.0.0: Mist/haze detection for atmospheric rendering */
  isMisty: boolean;
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
  /** Cloud cover percentage (0–100). null = demo/unavailable. */
  cloudCover: number | null;
  /** Visibility in metres (0–10000). null = demo/unavailable. */
  visibility: number | null;
  /** Atmospheric pressure in hPa. null = demo/unavailable. */
  pressure: number | null;
  /** v8.0.0: Wind direction in degrees (0–360). null = demo/unavailable. */
  windDegrees: number | null;
  /** v8.0.0: Wind gust speed in km/h. null = demo/unavailable. */
  windGustKmh: number | null;
}

// ============================================================================
// LIGHTING ENGINE TYPES

type CloudState = 'none' | 'few' | 'partial' | 'mostly' | 'overcast';

// ============================================================================

/**
 * Lighting state — computed once per prompt, rendered differently per tier.
 * This is the "one engine" in "one engine, multiple skins".
 */
interface LightingState {
  /** Full assembled phrase: "[BASE] [SHADOW] [ATMOSPHERE] [STABILITY]" */
  fullPhrase: string;
  /** Base light descriptor (always present) */
  base: string;
  /** Shadow modifier (daytime only, may be empty) */
  shadowModifier: string;
  /** Atmosphere modifier (may be empty) */
  atmosphereModifier: string;
  /** Stability modifier (may be empty) */
  stabilityModifier: string;
  /** Structured cloud state derived from cloud cover bins */
  cloudState: CloudState;
  /** Whether the lighting already encodes cloud state (so Sky can be omitted) */
  encodesCloudState: boolean;
  /**
   * Moon position phrase for prompt rendering. null when:
   * - Daytime (moon layer suppressed)
   * - Moon below horizon (altitude ≤ 0°)
   * - Cloud > 75% (position not visible)
   * - Visibility < 3000m (position not discernible)
   * - No lat/lon available
   * e.g. "low in the eastern sky", "high in the north-western sky"
   */
  moonPositionPhrase: string | null;
  /**
   * Which light source dominates at night. null during daytime.
   * 'urban' = city glow overpowers moonlight
   * 'moon' = moonlight is primary light source
   * 'balanced' = both contribute roughly equally
   */
  nightDominant: 'urban' | 'moon' | 'balanced' | null;
  /**
   * Whether the moon is above the horizon and renderable in the prompt.
   * When false, the entire moon layer (phase + position) is suppressed.
   * No point telling an AI to render a moon you can't see.
   */
  moonVisible: boolean;
}

// ============================================================================
// VISUAL TRUTH — UNIFIED ATMOSPHERIC ASSESSMENT (v7.0)
// ============================================================================
// Cross-references ALL weather data to derive what the atmosphere LOOKS like.
// Computed ONCE per prompt. Every layer reads from this shared truth.
// Eliminates physics conflicts (e.g. "sharp shadows" + "saturated air").
//
// 4 derived properties:
//   airClarity       — what AIR between viewer and scene looks like
//   contrast         — what SHADOWS actually look like given the full picture
//   moistureVisibility — what SURFACES look like (damp, frost, dry)
//   thermalOptics    — what TEMPERATURE does to light/physics (shimmer, frost)
//
// Key input: dew point spread = tempC - dewPoint.
//   Spread > 10°C  → moisture invisible, clear atmosphere
//   Spread 5–10°C  → slight softening
//   Spread 2–5°C   → visible haze
//   Spread 1–2°C   → mist forming, wet surfaces
//   Spread < 1°C   → fog likely (wind-dependent)
// ============================================================================

type AirClarity = 'crystal' | 'clear' | 'softened' | 'hazy' | 'misty' | 'foggy';
type ContrastLevel = 'high' | 'moderate' | 'low' | 'flat';
type MoistureVisibility =
  | 'bone-dry'
  | 'invisible'
  | 'subtle'
  | 'noticeable'
  | 'visible'
  | 'dominant';
type ThermalOptics =
  | 'shimmer'
  | 'warm-shimmer'
  | 'heavy-tropical'
  | 'neutral'
  | 'cold-sharp'
  | 'frost'
  | 'deep-cold';

// ── Precipitation Classification (v8.0.0) ──────────────────────────────────
// Replaces the old isRainy/isStormy booleans with a proper classifier.
// Prefers numeric rain.1h/snow.1h when available (most trustworthy),
// falls back to keyword inference from OWM description/conditions.
//
// Key fix: snow, sleet, hail are now treated as precipitation-active,
// which feeds correct air clarity, surface moisture, and light scattering.

type PrecipType =
  | 'none'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'sleet'
  | 'hail'
  | 'thunderstorm'
  | 'mist'
  | 'fog'
  | 'haze'
  | 'smoke'
  | 'dust';

type PrecipIntensity = 'none' | 'light' | 'moderate' | 'heavy';

interface PrecipState {
  /** Specific precipitation type */
  type: PrecipType;
  /** Intensity level — derived from numeric mm/h when available, else keyword */
  intensity: PrecipIntensity;
  /** True when something is physically falling (rain, snow, sleet, hail, drizzle, thunderstorm) */
  active: boolean;
  /** True for anything that impairs visibility (all active precip + fog/mist/haze/smoke/dust) */
  reducesVisibility: boolean;
}

interface VisualTruth {
  /** Dew point temperature in °C (Magnus formula) */
  dewPoint: number;
  /** Temperature minus dew point — how close to condensation */
  dewSpread: number;
  /** What the air between viewer and scene looks like */
  airClarity: AirClarity;
  /** What shadows look like given cloud + humidity + visibility */
  contrast: ContrastLevel;
  /** What surfaces look like (dry, damp, frost) */
  moistureVisibility: MoistureVisibility;
  /** What temperature does to light and physics */
  thermalOptics: ThermalOptics;
  /**
   * v8.0.0: Full precipitation classification.
   * Replaces the old boolean `precipitationActive` with rich type/intensity data.
   * - type: exact precip type (snow, rain, sleet, hail, fog, mist, etc.)
   * - intensity: none | light | moderate | heavy (from rain.1h/snow.1h when available)
   * - active: true when something is physically falling (rain, snow, sleet, hail)
   * - reducesVisibility: true for all precip + fog/mist/haze/smoke/dust
   */
  precip: PrecipState;
}

// ── Dew Point Calculation (Magnus formula) ──────────────────────────────────
// Standard Magnus coefficients: a = 17.27, b = 237.7°C
// Accuracy: ±0.4°C for -40°C to 50°C range.

function computeDewPoint(tempC: number, humidity: number): number {
  const clampedHumidity = Math.max(1, Math.min(100, humidity)); // Avoid log(0)
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(clampedHumidity / 100);
  return (b * alpha) / (a - alpha);
}

// ── Precipitation Classifier (v8.0.0) ──────────────────────────────────────
// Replaces the old isRainy/isStormy booleans with a proper multi-type classifier.
//
// Priority:
//   1. Numeric rain.1h / snow.1h (most trustworthy — OWM measures these)
//   2. Keyword inference from conditions/description (always available)
//
// KEY FIX: Snow, sleet, hail are now correctly classified as active precipitation.
// Before v8.0.0, "light snow" in Toronto → precipitationActive = false → air clarity
// stayed "clear" → prompt showed pristine conditions during snowfall. Now fixed.

function classifyPrecip(weather: ExchangeWeatherFull): PrecipState {
  const desc = (weather.description || '').toLowerCase();
  const cond = (weather.conditions || '').toLowerCase();
  const rain = weather.rainMm1h ?? null;
  const snow = weather.snowMm1h ?? null;

  // ── Priority 1: Numeric measurement (when OWM provides rain.1h / snow.1h) ──
  // These are actual measured volumes — most trustworthy signal.
  if (snow !== null && snow > 0) {
    const intensity: PrecipIntensity = snow >= 2 ? 'heavy' : snow >= 0.5 ? 'moderate' : 'light';
    return { type: 'snow', intensity, active: true, reducesVisibility: true };
  }
  if (rain !== null && rain > 0) {
    const intensity: PrecipIntensity = rain >= 6 ? 'heavy' : rain >= 2 ? 'moderate' : 'light';
    return { type: 'rain', intensity, active: true, reducesVisibility: true };
  }

  // ── Priority 2: Keyword inference from OWM description/conditions ───────────
  // Less precise than numeric, but always available.
  const has = (k: string) => desc.includes(k) || cond.includes(k);

  // Active falling precipitation (order: most specific → least)
  if (has('thunder'))
    return { type: 'thunderstorm', intensity: 'moderate', active: true, reducesVisibility: true };
  if (has('hail'))
    return { type: 'hail', intensity: 'moderate', active: true, reducesVisibility: true };
  if (has('sleet'))
    return { type: 'sleet', intensity: 'light', active: true, reducesVisibility: true };
  if (has('snow'))
    return { type: 'snow', intensity: 'light', active: true, reducesVisibility: true };
  if (has('drizzle'))
    return { type: 'drizzle', intensity: 'light', active: true, reducesVisibility: true };
  if (has('rain'))
    return { type: 'rain', intensity: 'light', active: true, reducesVisibility: true };

  // Visibility phenomena (not falling, but critical to rendering)
  if (has('fog'))
    return { type: 'fog', intensity: 'moderate', active: false, reducesVisibility: true };
  if (has('mist'))
    return { type: 'mist', intensity: 'light', active: false, reducesVisibility: true };
  if (has('haze'))
    return { type: 'haze', intensity: 'light', active: false, reducesVisibility: true };
  if (has('smoke'))
    return { type: 'smoke', intensity: 'moderate', active: false, reducesVisibility: true };
  if (has('dust') || has('sand'))
    return { type: 'dust', intensity: 'moderate', active: false, reducesVisibility: true };

  // No precipitation or visibility phenomena detected
  return { type: 'none', intensity: 'none', active: false, reducesVisibility: false };
}

// ── Derive Visual Truth ─────────────────────────────────────────────────────
// Reads ALL weather data together. Returns the unified atmospheric state.
// When data is missing (null), falls back to conservative assumptions.

function deriveVisualTruth(
  tempC: number,
  humidity: number,
  windKmh: number,
  cloudCover: number | null,
  visibility: number | null,
  pressure: number | null,
  solarElevation: number | null,
  isNight: boolean,
  precip: PrecipState,
): VisualTruth {
  const cloud = cloudCover ?? 0;
  const vis = visibility ?? 10000;
  const _pres = pressure ?? 1015; // Reserved for future barometric haze model

  // ── Dew point spread ──────────────────────────────────────────
  const dewPoint = computeDewPoint(tempC, humidity);
  const dewSpread = tempC - dewPoint;

  // ── Precipitation state (v8.0.0) ──────────────────────────────────
  // Now derived from classifyPrecip() — includes snow, sleet, hail.
  // Before v8.0.0, snow was NOT treated as precipitation, causing
  // "clear pristine air" prompts during snowfall.
  const precipitationActive = precip.active;

  // ── Air Clarity ───────────────────────────────────────────────
  // Cross-references: visibility, humidity, dew point spread, wind, temperature.
  // OWM caps visibility at 10000m — we DISTRUST this when dew spread is narrow.
  let airClarity: AirClarity;

  if (precipitationActive) {
    // Active falling precipitation always reduces atmospheric clarity.
    // v8.0.0: Snow-specific logic — heavy snow can approach whiteout.
    if (precip.type === 'snow' || precip.type === 'sleet') {
      // Snow scatters light diffusely — intensity drives how much
      airClarity =
        precip.intensity === 'heavy'
          ? 'foggy'
          : precip.intensity === 'moderate' || vis < 3000
            ? 'misty'
            : 'hazy';
    } else {
      // Rain, drizzle, thunderstorm, hail
      airClarity = vis < 3000 ? 'foggy' : 'hazy';
    }
  } else if (precip.reducesVisibility) {
    // Non-falling visibility phenomena (fog, mist, haze, smoke, dust).
    // These are ALSO handled by the vis-based checks below, but we
    // trust the explicit OWM classification when available.
    if (precip.type === 'fog') {
      airClarity = 'foggy';
    } else if (precip.type === 'mist') {
      airClarity = vis < 1000 ? 'foggy' : 'misty';
    } else if (precip.type === 'smoke' || precip.type === 'dust') {
      airClarity = vis < 3000 ? 'misty' : 'hazy';
    } else {
      // haze — defer to visibility-based checks below
      airClarity = vis < 5000 ? 'hazy' : 'softened';
    }
  } else if (vis < 1000) {
    airClarity = 'foggy'; // OWM reporting actual fog
  } else if (vis < 3000) {
    airClarity = 'misty'; // OWM reporting reduced visibility
  } else if (vis < 5000) {
    airClarity = 'hazy';
  } else if (dewSpread < 1 && windKmh < 10) {
    // Dew point nearly met + calm wind = fog forming, regardless of OWM vis cap
    airClarity = 'foggy';
  } else if (dewSpread < 1 && windKmh < 15) {
    // Near dew point, light wind = mist (wind prevents full fog)
    airClarity = 'misty';
  } else if (dewSpread < 1 && windKmh >= 15) {
    // Near dew point but strong wind disperses fog → hazy
    airClarity = 'hazy';
  } else if (dewSpread < 3) {
    // Close to dew point → noticeable haze
    airClarity = 'hazy';
  } else if (dewSpread < 5 || (humidity > 75 && vis < 8000)) {
    airClarity = 'softened';
  } else if (tempC > 35 && humidity < 50 && windKmh < 15) {
    // Extreme heat shimmer reduces air clarity even in dry conditions
    airClarity = 'softened';
  } else if (humidity < 40 && vis >= 10000) {
    // Genuinely dry + high vis = crystal (rare — ~15% of conditions)
    airClarity = 'crystal';
  } else if (vis >= 8000 && humidity < 65) {
    // Normal clear conditions — say nothing (clear is the default)
    airClarity = 'clear';
  } else if (humidity >= 65 && dewSpread >= 5) {
    // Moderate-high humidity but dew point well away — slight softening
    airClarity = 'softened';
  } else {
    airClarity = 'clear';
  }

  // ── Contrast Level ────────────────────────────────────────────
  // Cross-references: cloud, air clarity, solar elevation, humidity, dew spread.
  // At night, contrast is handled by the lighting competition model.
  let contrast: ContrastLevel;

  if (isNight) {
    // Night contrast is driven by the urban/moon competition model
    // Visual truth sets 'flat' as placeholder — not used by shadow modifier at night
    contrast = 'flat';
  } else if (airClarity === 'foggy' || airClarity === 'misty') {
    // Fog/mist scatters light omnidirectionally → no shadows possible
    contrast = 'flat';
  } else if (cloud > 75) {
    // Heavy overcast → flat regardless of other conditions
    contrast = 'flat';
  } else if (cloud > 50) {
    // Mostly cloudy → low contrast
    contrast = 'low';
  } else if (dewSpread < 3 && humidity > 80) {
    // Near-saturated air scatters even direct sunlight → reduced contrast
    // THIS is the Paris fix: 100% humidity at 0°C → low contrast, not sharp
    contrast = cloud > 30 ? 'flat' : 'low';
  } else if (cloud > 25) {
    // Partial cloud → moderate
    contrast = 'moderate';
  } else if (airClarity === 'hazy' || airClarity === 'softened') {
    // Haze softens shadows even with clear sky
    contrast = 'moderate';
  } else {
    // Clear sky, clear/crystal air, low cloud → sharp shadows
    contrast = solarElevation !== null && solarElevation > 6 ? 'high' : 'moderate';
  }

  // ── Moisture Visibility ───────────────────────────────────────
  // Describes SURFACE effects (damp, frost, dry). Not atmospheric effects
  // (those are covered by airClarity).
  //
  // v8.0.0: Snow is now correctly treated as surface-affecting precipitation.
  // Before v8.0.0, sub-zero snow had precipitationActive=false, so surfaces
  // showed "invisible" moisture during snowfall — obviously wrong.
  //
  // Snow logic: at ≤0°C, snow accumulates (noticeable→dominant by intensity).
  //             at >0°C, snow melts on contact → wet surfaces (same as rain).
  let moistureVisibility: MoistureVisibility;

  if (precipitationActive && (precip.type === 'snow' || precip.type === 'sleet')) {
    // Snow/sleet on surfaces — affected regardless of temperature.
    // At ≤0°C: accumulation. At >0°C: melting to wet.
    if (tempC <= 0) {
      // Sub-zero snow: surfaces show snow cover (thermal optics handles frost character)
      moistureVisibility =
        precip.intensity === 'heavy'
          ? 'dominant'
          : precip.intensity === 'moderate'
            ? 'visible'
            : 'noticeable';
    } else {
      // Above-zero snow/sleet: melts on contact → wet surfaces
      moistureVisibility = 'dominant';
    }
  } else if (precipitationActive && precip.type === 'hail') {
    // Hail: ice impacts on surfaces — visible regardless of temperature
    moistureVisibility = 'visible';
  } else if (tempC <= 0) {
    // Sub-zero, no active precip: any surface moisture is frost/ice.
    // Thermal optics handles frost visual character. Suppress liquid descriptions.
    moistureVisibility = humidity < 20 ? 'bone-dry' : 'invisible';
  } else if (precipitationActive) {
    // Active rain/drizzle/thunderstorm at >0°C = surfaces are wet
    moistureVisibility = 'dominant';
  } else if (humidity < 20) {
    moistureVisibility = 'bone-dry';
  } else if (humidity < 55 || dewSpread > 10) {
    moistureVisibility = 'invisible';
  } else if (humidity < 70 || dewSpread > 5) {
    moistureVisibility = 'subtle';
  } else if (humidity < 85 || dewSpread > 3) {
    moistureVisibility = 'noticeable';
  } else if (dewSpread < 1 && windKmh < 10) {
    moistureVisibility = 'dominant';
  } else {
    moistureVisibility = 'visible';
  }

  // ── Thermal Optics ────────────────────────────────────────────
  // Describes temperature effects on LIGHT and PHYSICS.
  // Heat shimmer, frost formation, ice crystals — not thermometer readings.
  let thermalOptics: ThermalOptics;

  if (tempC < -5) {
    thermalOptics = 'deep-cold';
  } else if (tempC <= 0 && humidity > 80) {
    // Freezing + humid → frost forms on surfaces
    thermalOptics = 'frost';
  } else if (tempC <= 0) {
    // Freezing but drier → sharp cold clarity, less frost
    thermalOptics = 'cold-sharp';
  } else if (tempC <= 5) {
    thermalOptics = 'cold-sharp';
  } else if (tempC > 35 && humidity > 60) {
    // Very hot + very humid → heavy tropical (no shimmer — moisture suppresses convection)
    thermalOptics = 'heavy-tropical';
  } else if (tempC > 35 && humidity < 50 && windKmh < 15) {
    // Very hot + dry + calm → full heat shimmer
    thermalOptics = 'shimmer';
  } else if (tempC > 30 && humidity < 40) {
    // Hot + dry → mild shimmer
    thermalOptics = 'warm-shimmer';
  } else {
    // 6°C to 30°C, or hot+windy, or hot+moderate-humidity → no visible thermal effect
    thermalOptics = 'neutral';
  }

  // ── State Exclusivity (v7.2) ────────────────────────────────────
  // Cross-check: enforce mutual exclusion between independently derived states.
  //
  // Rule 1: Diffused/hazy/misty/foggy air kills cold-sharp thermal.
  //   Sharp edges invisible through obscured air. Frost/deep-cold survive
  //   (surface ice, not optical sharpness).
  if (
    (airClarity === 'softened' ||
      airClarity === 'hazy' ||
      airClarity === 'misty' ||
      airClarity === 'foggy') &&
    thermalOptics === 'cold-sharp'
  ) {
    thermalOptics = 'neutral';
  }

  // Rule 2: Crystal air excludes visible/dominant moisture.
  //   Crystal = genuinely dry. Wet surfaces don't form in dry air.
  if (
    airClarity === 'crystal' &&
    (moistureVisibility === 'visible' || moistureVisibility === 'dominant')
  ) {
    moistureVisibility = 'noticeable';
  }

  return {
    dewPoint,
    dewSpread,
    airClarity,
    contrast,
    moistureVisibility,
    thermalOptics,
    precip,
  };
}

// ── Visual Truth Phrase Pools ────────────────────────────────────────────────
// Keyed by derived states, not raw data ranges.
// Each state has 3 phrases (seeded selection, deterministic).
// These describe OPTICAL EFFECTS — not weather station readings, not scene props.

// Atmosphere phrases (air clarity) — used by computeLighting atmosphere modifier
// These replace the old visibility-only bins.
const AIR_CLARITY_PHRASES: Record<AirClarity, string> = {
  crystal: 'in crystalline air',
  clear: '', // Clear is the default assumption — say nothing, save token budget
  softened: 'in softly diffused air',
  hazy: 'in atmospheric haze',
  misty: 'in thin drifting mist',
  foggy: 'in dense fog',
};

// Shadow phrases (contrast) — used by computeLighting shadow modifier
// These replace the old cloud-only bins.
const CONTRAST_SHADOW_PHRASES: Record<ContrastLevel, string> = {
  high: 'with sharp defined shadows',
  moderate: 'with soft intermittent shadows',
  low: 'with faint diffused shadows',
  flat: 'with flat even illumination',
};

// Moisture phrases — SURFACE effects
// v7.3: Setting-aware material-specific phrases.
// Each venue setting has a known ground material. Moisture phrases name it.
// Generic fallback ('street') used when no setting available.
// ≤6 words. Concrete. Camera-visible.

const MOISTURE_BY_SETTING: Record<VenueSetting, Record<MoistureVisibility, string[]>> = {
  waterfront: {
    'bone-dry': [
      'sun-bleached quayside stone',
      'dry cracked harbour planks',
      'dusty pale dock stone',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'damp sheen on quayside stone',
      'wet dock planks glistening faintly',
      'mist-damp harbour railings',
    ],
    visible: [
      'rain-slick quayside flagstones',
      'wet harbour stone reflecting light',
      'glistening dock planks and bollards',
    ],
    dominant: [
      'pooling water on quayside stone',
      'harbour pavement streaming wet',
      'drenched dock planks and railings',
    ],
  },
  beach: {
    'bone-dry': [
      'bone-dry sand above tideline',
      'sun-baked pale dry sand',
      'wind-scoured dry dune sand',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'damp packed sand at waterline',
      'moist sand darkened near shore',
      'faint wet sheen on sand',
    ],
    visible: [
      'wet sand reflecting sky light',
      'glistening tidal sand flats',
      'rain-darkened beach sand',
    ],
    dominant: [
      'sand saturated and mirror-flat',
      'standing water pooling on sand',
      'beach sand completely waterlogged',
    ],
  },
  street: {
    'bone-dry': [
      'sun-bleached dry pavement',
      'dusty dry asphalt surface',
      'parched concrete sidewalks',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'faint moisture sheen on pavement',
      'damp-edged asphalt surface',
      'thin condensation on sidewalks',
    ],
    visible: [
      'rain-slick asphalt reflecting light',
      'wet pavement glistening under lamps',
      'damp concrete catching reflections',
    ],
    dominant: [
      'pavement streaming with runoff',
      'deep puddles across asphalt',
      'saturated sidewalks pooling water',
    ],
  },
  narrow: {
    'bone-dry': [
      'dry worn cobblestones',
      'dusty pale alley flagstones',
      'sun-bleached lane paving',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'damp sheen on cobblestones',
      'faint moisture on alley stone',
      'condensation on narrow lane walls',
    ],
    visible: [
      'wet cobblestones reflecting neon',
      'rain-slick alley flagstones glistening',
      'glistening narrow lane paving',
    ],
    dominant: [
      'cobblestones streaming with runoff',
      'alley floor pooling water',
      'saturated flagstones ankle-deep',
    ],
  },
  market: {
    'bone-dry': [
      'dusty dry market concrete',
      'sun-baked stall floor tiles',
      'dry packed-earth market ground',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'damp market floor tiles',
      'faint moisture on stall concrete',
      'condensation on market surfaces',
    ],
    visible: [
      'wet market tiles reflecting light',
      'rain-slick concrete between stalls',
      'glistening market floor puddles',
    ],
    dominant: [
      'market floor streaming wet',
      'deep puddles between stall rows',
      'saturated market ground everywhere',
    ],
  },
  plaza: {
    'bone-dry': [
      'sun-bleached dry flagstones',
      'dusty pale plaza stone',
      'parched open stone paving',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'faint sheen on plaza flagstones',
      'damp stone paving underfoot',
      'condensation on plaza benches',
    ],
    visible: [
      'rain-slick plaza flagstones reflecting',
      'wet stone paving glistening',
      'damp plaza stone catching light',
    ],
    dominant: [
      'flagstones streaming with water',
      'plaza stone pooling reflections',
      'saturated open stone paving',
    ],
  },
  park: {
    'bone-dry': [
      'dry brittle grass underfoot',
      'sun-baked cracked earth paths',
      'dusty gravel park walkways',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'dew-damp grass and gravel paths',
      'faint moisture on park benches',
      'damp earth and wet leaves',
    ],
    visible: [
      'rain-soaked grass and muddy paths',
      'wet gravel paths glistening',
      'glistening park lawns and benches',
    ],
    dominant: [
      'waterlogged grass and flooded paths',
      'standing water across park lawns',
      'saturated mud and pooling gravel',
    ],
  },
  elevated: {
    'bone-dry': [
      'dry exposed rock surface',
      'sun-baked viewpoint stone',
      'dusty dry lookout platform',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'damp rock glistening at viewpoint',
      'faint moisture on lookout stone',
      'condensation on metal railings',
    ],
    visible: [
      'wet exposed rock reflecting sky',
      'rain-slick viewpoint stone',
      'glistening lookout platform surface',
    ],
    dominant: [
      'rock surface streaming water',
      'viewpoint stone pooling deeply',
      'saturated exposed summit rock',
    ],
  },
  monument: {
    'bone-dry': [
      'sun-bleached temple flagstones',
      'dry pale courtyard stone',
      'dusty monument approach steps',
    ],
    invisible: [],
    subtle: [],
    noticeable: [
      'damp sheen on courtyard stone',
      'faint moisture on temple steps',
      'condensation on monument walls',
    ],
    visible: [
      'rain-slick courtyard flagstones',
      'wet temple steps reflecting light',
      'glistening monument approach stone',
    ],
    dominant: [
      'courtyard flagstones streaming wet',
      'temple steps cascading water',
      'saturated monument stone pooling',
    ],
  },
};

// Fallback: generic phrases for when no setting is available
const MOISTURE_GENERIC: Record<MoistureVisibility, string[]> = {
  'bone-dry': [
    'sun-bleached dry surfaces',
    'arid dust-dry ground',
    'parched cracked-earth textures',
  ],
  invisible: [],
  subtle: [],
  noticeable: [
    'faint moisture sheen on ground',
    'damp-edged cool surfaces',
    'thin surface condensation',
  ],
  visible: [
    'wet ground glistening under light',
    'damp reflective pavement',
    'rain-slick ground surface',
  ],
  dominant: [
    'heavy dripping condensation',
    'pooling water on ground',
    'saturated reflective pavement',
  ],
};

// Thermal phrases — TEMPERATURE effects on light/physics
// v7.3: Fixed "hard light" (solar-only term) → "sharp contrast" (works day/night).
const THERMAL_PHRASES: Record<ThermalOptics, string[]> = {
  shimmer: [
    'intense heat shimmer distortion',
    'radiative heat-haze rippling',
    'thermal convection warping distance',
  ],
  'warm-shimmer': [
    'faint heat shimmer',
    'mild thermal distortion',
    'slight ground-level heat-haze',
  ],
  'heavy-tropical': ['dense tropical heat', 'heavy saturating warmth', 'oppressive humid heat'],
  neutral: [],
  'cold-sharp': [
    'cold-sharpened crisp edges',
    'winter clarity sharp contrast',
    'freezing-air precise detail',
  ],
  frost: ['frost-coated surfaces', 'ice-rimmed edges everywhere', 'crystalline frost coating'],
  'deep-cold': [
    'suspended ice crystals',
    'diamond-dust light refraction',
    'deep-freeze ice particles',
  ],
};

// ── Visual Truth Phrase Selectors ────────────────────────────────────────────

// ── Level 2 Connector Templates (v7.4) ──────────────────────────────────────
//
// PURPOSE: Make phrases REFERENCE each other instead of existing as islands.
// Before: "neon shopfronts stacked tight. Cold-sharpened crisp edges, wet cobblestones, 35 km/h wind."
// After:  "neon shopfronts stacked tight, sharpened by cold winter air. 35 km/h wind. Wet cobblestones reflecting the neon glow."
//
// Three connector systems:
// 1. THERMAL_LIGHT_CONN — thermal modifies the lighting sentence directly.
// 2. getLightReflectionNoun() — what light wet surfaces actually reflect.
// 3. composeSurfaceSentence() — merges surface phrase + light reflection.
//
// Used by Tier 3 (natural language, default) and Tier 2 (Midjourney).
// NOT used by Tier 1 (CLIP tags — commas are correct for attention heads)
// or Tier 4 (plain — minimal parsers, keep simple).

/**
 * Thermal → Light connectors.
 *
 * Instead of thermal as a standalone fragment ("cold-sharpened crisp edges"),
 * it modifies HOW the light appears:
 *   "neon shopfronts stacked tight, sharpened by cold winter air"
 *
 * Rules:
 * - Each connector attaches to the end of the lighting base phrase.
 * - ≤6 words per connector.
 * - Physically accurate: describes how temperature changes light perception.
 * - No standalone noun phrases — always relational.
 */
const THERMAL_LIGHT_CONN: Record<ThermalOptics, string[]> = {
  shimmer: [
    'rippling in ground-level heat haze',
    'distorted by rising heat shimmer',
    'warping through thermal convection',
  ],
  'warm-shimmer': ['with faint heat shimmer rising', 'with slight thermal ripple above ground'],
  'heavy-tropical': [
    'thick in dense tropical air',
    'heavy in humid tropical warmth',
    'saturated by tropical heat',
  ],
  neutral: [], // No visible thermal effect — say nothing
  'cold-sharp': [
    'sharpened by cold winter air',
    'with crisp cold-air clarity',
    'razor-sharp in freezing air',
  ],
  frost: [
    'glinting off frost-coated surfaces',
    'catching crystalline frost on edges',
    'sharp on frost-rimmed surfaces',
  ],
  'deep-cold': [
    'filtered through suspended ice crystals',
    'refracting through diamond dust',
    'scattered by airborne ice particles',
  ],
};

/**
 * Light reflection noun — what light do wet surfaces actually reflect?
 *
 * At night in Tokyo street: "reflecting the neon glow"
 * At night in Paris monument: "reflecting the floodlight glow"
 * At night on Bondi Beach: "reflecting the promenade lighting"
 * At golden hour anywhere: "reflecting golden sunlight"
 *
 * v7.4: Setting-aware. Beaches don't have neon. Parks don't have shopfronts.
 * Monuments have floodlighting. Elevated viewpoints see city light below.
 */
function getLightReflectionNoun(
  isNight: boolean,
  urbanFactor: number,
  solarElevation: number | null,
  seed: number,
  setting?: VenueSetting,
): string {
  if (isNight) {
    // Setting-specific overrides — not everywhere has neon
    if (setting === 'beach') {
      return pickRandom(
        ['promenade lighting', 'overhead lamp glow', 'distant street light'],
        seed * 3.1,
      );
    }
    if (setting === 'elevated') {
      return pickRandom(['city light below', 'skyline glow', 'distant urban light'], seed * 3.1);
    }
    if (setting === 'park') {
      return pickRandom(['lamppost glow', 'path lighting', 'park lamp light'], seed * 3.1);
    }
    if (setting === 'monument') {
      return pickRandom(['floodlight glow', 'monument lighting', 'warm floodlight'], seed * 3.1);
    }
    // Street, narrow, market, plaza, waterfront — city-level urbanFactor drives noun
    if (urbanFactor > 0.75) {
      return pickRandom(['neon glow', 'shopfront light', 'city light'], seed * 3.1);
    }
    if (urbanFactor > 0.5) {
      return pickRandom(['streetlamp glow', 'lamppost light', 'warm street light'], seed * 3.1);
    }
    if (urbanFactor > 0.3) {
      return pickRandom(['lamppost glow', 'scattered street light'], seed * 3.1);
    }
    return pickRandom(['sparse lamplight', 'dim overhead light'], seed * 3.1);
  }
  // Daytime
  if (solarElevation !== null && solarElevation < 6) {
    return pickRandom(['golden sunlight', 'warm low-angle light'], seed * 3.1);
  }
  if (solarElevation !== null && solarElevation < 15) {
    return pickRandom(['low sunlight', 'morning light'], seed * 3.1);
  }
  if (solarElevation !== null && solarElevation > 60) {
    return pickRandom(['overhead sunlight', 'direct sun'], seed * 3.1);
  }
  if (solarElevation !== null && solarElevation > 35) {
    return pickRandom(['bright sunlight', 'high-angle light'], seed * 3.1);
  }
  return pickRandom(['daylight', 'diffused sunlight'], seed * 3.1);
}

/**
 * Compose connected lighting sentence for Tier 3/2.
 *
 * Merges: base lighting + shadow + thermal connector + atmosphere
 * into ONE flowing phrase instead of concatenated fragments.
 *
 * Output: "Warm amber floodlighting on stone facades with soft intermittent
 *          shadows, sharpened by cold winter air in softly diffused air"
 *
 * Old:    "warm amber floodlighting on stone facades with soft intermittent
 *          shadows in softly diffused air" + standalone "cold-sharpened crisp edges"
 */
function composeLightingSentence(
  lighting: LightingState,
  visualTruth: VisualTruth | null,
  seed: number,
): string {
  let sentence = lighting.base;

  // Shadow modifier (daytime only — "with sharp defined shadows")
  if (lighting.shadowModifier) {
    sentence += ` ${lighting.shadowModifier}`;
  }

  // Thermal connector — comma-joined: "...stacked tight, sharpened by cold winter air"
  if (visualTruth) {
    const thermalPool = THERMAL_LIGHT_CONN[visualTruth.thermalOptics];
    if (thermalPool && thermalPool.length > 0) {
      sentence += `, ${pickRandom(thermalPool, seed * 1.9)}`;
    }
  }

  // Atmosphere modifier ("in softly diffused air", "in atmospheric haze")
  if (lighting.atmosphereModifier) {
    sentence += ` ${lighting.atmosphereModifier}`;
  }

  return sentence;
}

/**
 * Compose connected surface sentence for Tier 3/2.
 *
 * Merges moisture/grounding phrase with what light it's reflecting.
 * Only wet/damp surfaces get a light reference. Dry surfaces don't reflect.
 *
 * Rules:
 * - visible/dominant moisture (wet) → "reflecting {lightRef}"
 * - noticeable moisture (damp) → "catching {lightRef}"
 * - bone-dry → no light reference (dust doesn't reflect)
 * - grounding (all layers silent) → no light reference (already precise)
 * - If phrase already contains "reflecting" → replace generic with specific noun
 */
function composeSurfaceSentence(
  moisture: string | null,
  grounding: string | null,
  moistureLevel: MoistureVisibility,
  lightReflection: string,
): string | null {
  const surface = moisture || grounding;
  if (!surface) return null;

  // Grounding phrases fire when ALL atmospheric layers silent — already precise.
  if (grounding && !moisture) return capitalize(surface);

  // Bone-dry: dust, bleached surfaces — don't reflect light
  if (moistureLevel === 'bone-dry') return capitalize(surface);

  // noticeable/subtle: damp but not pooling
  if (moistureLevel === 'noticeable' || moistureLevel === 'subtle') {
    if (/reflecting light|reflecting neon|reflecting sky|catching light/i.test(surface)) {
      return capitalize(
        surface
          .replace(/reflecting light/gi, `reflecting ${lightReflection}`)
          .replace(/reflecting neon/gi, `reflecting ${lightReflection}`)
          .replace(/reflecting sky light/gi, `reflecting ${lightReflection}`)
          .replace(/reflecting sky/gi, `reflecting ${lightReflection}`)
          .replace(/catching light/gi, `catching ${lightReflection}`),
      );
    }
    return `${capitalize(surface)} catching ${lightReflection}`;
  }

  // visible/dominant: wet, pooling — strong reflections
  if (moistureLevel === 'visible' || moistureLevel === 'dominant') {
    if (/reflecting light|reflecting neon|reflecting sky|catching light/i.test(surface)) {
      return capitalize(
        surface
          .replace(/reflecting light/gi, `reflecting ${lightReflection}`)
          .replace(/reflecting neon/gi, `reflecting ${lightReflection}`)
          .replace(/reflecting sky light/gi, `reflecting ${lightReflection}`)
          .replace(/reflecting sky/gi, `reflecting ${lightReflection}`)
          .replace(/catching light/gi, `reflecting ${lightReflection}`),
      );
    }
    return `${capitalize(surface)} reflecting ${lightReflection}`;
  }

  // invisible/other
  return capitalize(surface);
}

function getMoisturePhrase(vt: VisualTruth, seed: number, setting?: VenueSetting): string | null {
  const settingPhrases = setting ? MOISTURE_BY_SETTING[setting] : null;
  const pool = settingPhrases?.[vt.moistureVisibility] ?? MOISTURE_GENERIC[vt.moistureVisibility];
  if (!pool || pool.length === 0) return null;
  return pickRandom(pool, seed * 1.7);
}

function getThermalPhrase(vt: VisualTruth, seed: number): string | null {
  const pool = THERMAL_PHRASES[vt.thermalOptics];
  if (!pool || pool.length === 0) return null;
  return pickRandom(pool, seed * 1.9);
}

// ── Surface Grounding (v7.1 — minimum-one-grounding rule) ──────────────────
//
// When moisture, thermal, AND air clarity ALL produce no phrase, the prompt
// has zero atmospheric grounding — it reads like a film-set catalogue, not a
// real place. This function injects ONE minimal surface-condition phrase that
// describes what surfaces LOOK like under the actual conditions.
//
// NOT fake atmosphere. NOT invented humidity. Just what the ground and
// surfaces look like given the weather state.
//
// Only fires when all three atmospheric layers are silent.

// v7.3: Setting-aware surface grounding. Names actual ground material per venue.
const SURFACE_GROUNDING_BY_SETTING: Record<VenueSetting, Record<string, string[]>> = {
  waterfront: {
    'dry-mild': [
      'clean dry quayside stone',
      'sharp light on dock planks',
      'dry harbour pavement reflections',
    ],
    'dry-cool': [
      'cold dry quayside flagstones',
      'crisp light on harbour stone',
      'frost-free dry dock planks',
    ],
    'dry-warm': [
      'sun-warmed quayside stone',
      'heat-soaked dock planks',
      'warm dry harbour pavement',
    ],
  },
  beach: {
    'dry-mild': [
      'pale dry sand above tideline',
      'clean sunlit sand surface',
      'firm dry sand underfoot',
    ],
    'dry-cool': ['cold dry firm sand', 'crisp light on pale sand', 'hard-packed cool dry sand'],
    'dry-warm': [
      'hot dry sand radiating heat',
      'sun-baked burning sand surface',
      'scorching pale dry sand',
    ],
  },
  street: {
    'dry-mild': [
      'clean dry pavement reflections',
      'crisp light on dry asphalt',
      'sharp light-pools on sidewalk',
    ],
    'dry-cool': [
      'cold dry pavement underfoot',
      'crisp dry asphalt surface',
      'tight light-pools on concrete',
    ],
    'dry-warm': [
      'warm dry pavement radiating heat',
      'heat-soaked bright asphalt',
      'sun-warmed concrete glowing',
    ],
  },
  narrow: {
    'dry-mild': [
      'clean dry cobblestone surface',
      'sharp light on worn flagstones',
      'dry pale alley paving',
    ],
    'dry-cool': [
      'cold dry cobblestones underfoot',
      'crisp light on alley flagstones',
      'tight shadows on dry stone',
    ],
    'dry-warm': [
      'warm dry cobblestones radiating',
      'heat-soaked alley flagstones',
      'sun-warmed narrow lane stone',
    ],
  },
  market: {
    'dry-mild': [
      'clean dry market floor tiles',
      'sharp light on stall concrete',
      'dry packed-earth market ground',
    ],
    'dry-cool': [
      'cold dry market concrete',
      'crisp light on stall tiles',
      'tight shadows on dry floor',
    ],
    'dry-warm': [
      'warm dry market concrete',
      'heat-soaked stall floor tiles',
      'sun-warmed packed market earth',
    ],
  },
  plaza: {
    'dry-mild': [
      'clean dry plaza flagstones',
      'sharp light on stone paving',
      'dry pale open square stone',
    ],
    'dry-cool': [
      'cold dry plaza stone underfoot',
      'crisp light on dry flagstones',
      'tight shadows on plaza stone',
    ],
    'dry-warm': [
      'warm dry flagstones radiating heat',
      'heat-soaked plaza stone surface',
      'sun-warmed open stone paving',
    ],
  },
  park: {
    'dry-mild': [
      'clean dry grass and gravel',
      'sharp light on park paths',
      'dry firm earth walkways',
    ],
    'dry-cool': [
      'cold dry brittle grass',
      'crisp light on gravel paths',
      'hard-packed cool dry earth',
    ],
    'dry-warm': [
      'warm dry grass radiating heat',
      'heat-soaked park earth paths',
      'sun-baked dry gravel walkways',
    ],
  },
  elevated: {
    'dry-mild': [
      'clean dry exposed rock surface',
      'sharp light on viewpoint stone',
      'dry pale lookout platform',
    ],
    'dry-cool': [
      'cold dry exposed rock',
      'crisp light on viewpoint stone',
      'tight shadows on summit rock',
    ],
    'dry-warm': [
      'warm dry rock radiating heat',
      'heat-soaked viewpoint stone',
      'sun-baked lookout platform',
    ],
  },
  monument: {
    'dry-mild': [
      'clean dry courtyard flagstones',
      'sharp light on temple stone',
      'dry pale monument approach steps',
    ],
    'dry-cool': [
      'cold dry temple steps',
      'crisp light on courtyard stone',
      'tight shadows on monument walls',
    ],
    'dry-warm': [
      'warm dry temple stone radiating',
      'heat-soaked courtyard flagstones',
      'sun-warmed monument approach stone',
    ],
  },
};

// Fallback grounding for when no venue setting available
const SURFACE_GROUNDING_GENERIC: Record<string, string[]> = {
  'dry-mild': [
    'clean dry sharp reflections',
    'crisp light on dry ground',
    'sharp light-pools dry pavement',
  ],
  'dry-cool': [
    'cold dry precise edges',
    'crisp dry ground reflections',
    'tight light-pools dry pavement',
  ],
  'dry-warm': [
    'warm dry radiating surfaces',
    'heat-soaked bright pavement',
    'sun-warmed hard ground glow',
  ],
};

/**
 * Surface grounding — minimum-one-grounding rule (v7.1).
 * v7.3: Setting-aware. Names actual ground material per venue.
 *
 * Returns a phrase ONLY when moisture, thermal, and airClarity all produce
 * nothing visible. If any of those layers already has output, this returns
 * null — the scene is already grounded by existing atmospheric phrases.
 */
function getSurfaceGrounding(
  vt: VisualTruth,
  tempC: number,
  moisture: string | null,
  thermal: string | null,
  seed: number,
  setting?: VenueSetting,
): string | null {
  // If ANY atmospheric layer already produced output, scene is grounded
  if (moisture) return null;
  if (thermal) return null;
  // airClarity 'clear' outputs '' (empty), everything else outputs a phrase
  if (vt.airClarity !== 'clear') return null;

  // All three silent — inject surface grounding based on temperature
  let key: string;
  if (tempC >= 25) {
    key = 'dry-warm';
  } else if (tempC <= 15) {
    key = 'dry-cool';
  } else {
    key = 'dry-mild';
  }

  const settingPhrases = setting ? SURFACE_GROUNDING_BY_SETTING[setting] : null;
  const pool = settingPhrases?.[key] ?? SURFACE_GROUNDING_GENERIC[key];
  if (!pool || pool.length === 0) return null;
  return pickRandom(pool, seed * 2.1);
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

function isNightTime(
  weather: ExchangeWeatherFull,
  localHour: number,
  observedAtUtc: Date,
): boolean {
  if (weather.sunriseUtc != null && weather.sunsetUtc != null && weather.timezoneOffset != null) {
    const SECONDS_PER_DAY = 86400;
    const nowUtc = Math.floor(observedAtUtc.getTime() / 1000);
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
// QUIET HOURS — 23:59 TO SUNRISE + 1 HOUR (v6.0 revised)
// ============================================================================
// Between 23:59 local and sunrise+1hr, the "no people" directive is active.
// Activities are gone entirely (v6.0), so quiet only controls the directive.
// v6.0 change: Window expanded from midnight→sunrise to 23:59→sunrise+1hr.
// Rationale: Cities aren't empty at 23:30, and aren't bustling at 06:01.
// ============================================================================

function isQuietHours(
  weather: ExchangeWeatherFull,
  localHour: number,
  observedAtUtc: Date,
): boolean {
  if (weather.sunriseUtc != null && weather.timezoneOffset != null) {
    const SECONDS_PER_DAY = 86400;
    const nowUtc = Math.floor(observedAtUtc.getTime() / 1000);
    const nowLocal =
      (((nowUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const sunriseLocal =
      (((weather.sunriseUtc + weather.timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    // 23:59 = 86340 seconds into the day
    const QUIET_START = 86340;
    // sunrise + 1 hour (3600 seconds)
    const quietEnd = sunriseLocal + 3600;
    // Quiet if: after 23:59 (end of day wrap) OR before sunrise+1hr
    return nowLocal >= QUIET_START || nowLocal < quietEnd;
  }
  // Fallback: 0:00 to 7:00 (extended from 6 to account for sunrise+1hr)
  return localHour >= 0 && localHour < 7;
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

function buildContext(
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
    // v8.0.0: Snow, fog, mist detection (was missing before)
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
// LIGHTING ENGINE v3 — VENUE-AWARE NIGHT COMPETITION MODEL
// ============================================================================
// Deterministic procedural assembly from measured inputs.
// No randomness. No phrase pools for daytime. Same inputs = same output. Always.
//
// DAYTIME: 4-segment concatenation [BASE] + [SHADOW] + [ATMOSPHERE] + [STABILITY]
//   Unchanged from v6.0. Solar elevation drives base phrase.
//
// NIGHTTIME: Urban vs Moon competition model (v7.5 — venue-aware)
//   v7.5: venue setting attenuates effectiveUrban AND selects setting-appropriate
//   light phrases. Non-urban settings (beach, park, elevated, monument) use
//   SETTING_NIGHT_LIGHT pools. Urban settings use city lightCharacter.
//
//   Two competing light sources:
//   Source A — Urban glow: Artificial city light. Static per city (urban-light.json),
//     ATTENUATED by venue setting (×1.0 for street, ×0.3 for beach, etc.),
//     amplified by cloud reflection. Always present. Omnidirectional.
//   Source B — Moonlight: Astronomical. Phase brightness × altitude attenuation ×
//     cloud blocking. Directional positioned source. May be below horizon.
//
//   Competition: effectiveUrban vs effectiveMoon → 3 outcomes:
//     Urban dominates → scene light phrases (city character OR setting pool)
//     Moon dominates  → moonlight phrases with altitude-derived quality
//     Balanced        → both sources mentioned
//
//   Moon position descriptor: altitude bin + azimuth bin → prompt phrase
//     Gated on: altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m
//     Rendered per-tier syntax in tier generators.
//
// Authority: exchange-card-weather.md §11A
// ============================================================================

// ── Urban Light Lookup ────────────────────────────────────────────────────
// Per-city static emission factor and light character from urban-light.json.
// urbanLight: 0.0–1.0 drives the competition model.
// lightCharacter: 3 phrases describing each city's unique artificial light quality.
// Falls back to meta.defaultFallback / meta.defaultLightCharacter when city not found.

interface UrbanLightEntry {
  urbanLight: number;
  lightCharacter: string[];
}

const URBAN_LIGHT_CITIES = (
  urbanLightData as unknown as {
    cities: Record<string, UrbanLightEntry>;
    meta: { defaultFallback?: number; defaultLightCharacter?: string[] };
  }
).cities;
const URBAN_LIGHT_DEFAULT =
  (urbanLightData as unknown as { meta: { defaultFallback?: number } }).meta.defaultFallback ?? 0.5;
const URBAN_LIGHT_DEFAULT_CHARACTER = (
  urbanLightData as unknown as { meta: { defaultLightCharacter?: string[] } }
).meta.defaultLightCharacter ?? [
  'moderate mixed warm-cool artificial light',
  'even warm-toned illumination at mid-intensity',
  'standard urban glow with warm bias',
];

function getUrbanLightFactor(city: string): number {
  const cityLower = city.toLowerCase();

  // Exact match first
  const exact = URBAN_LIGHT_CITIES[cityLower];
  if (exact) return exact.urbanLight;

  // Partial match (e.g. "New York" matches "new york")
  for (const [key, value] of Object.entries(URBAN_LIGHT_CITIES)) {
    if (cityLower.includes(key) || key.includes(cityLower)) {
      return value.urbanLight;
    }
  }

  return URBAN_LIGHT_DEFAULT;
}

// ── Urban Light Character Lookup ──────────────────────────────────────────
// Returns the 3-phrase lightCharacter array for a city.
// Used by the night lighting engine to select a city-specific phrase.
// Selection is deterministic: seeded from city hash + moonDayInCycle.

function getUrbanLightCharacter(city: string): string[] {
  const cityLower = city.toLowerCase();

  const exact = URBAN_LIGHT_CITIES[cityLower];
  if (exact?.lightCharacter?.length) return exact.lightCharacter;

  for (const [key, value] of Object.entries(URBAN_LIGHT_CITIES)) {
    if (cityLower.includes(key) || key.includes(cityLower)) {
      if (value.lightCharacter?.length) return value.lightCharacter;
    }
  }

  return URBAN_LIGHT_DEFAULT_CHARACTER;
}

// ── Setting-Specific Night Light Pools (v7.5) ──────────────────────────────
// When a venue setting is non-urban (beach, park, elevated), the city's
// commercial lightCharacter is inappropriate (no LED billboards on a beach).
// These pools describe what LIGHT ACTUALLY EXISTS at each setting type at night.
//
// Rules:
//   - Phrases are location-generic (work for any city's beach, any city's park).
//   - Intensity is modulated by the attenuated urbanFactor, not hardcoded.
//   - Phrases name PHYSICAL EMITTERS (boardwalk lamps, path lighting), not moods.
//   - ≤8 words per phrase. Concrete. Camera-visible.
//   - Settings NOT listed here (street, narrow, market, plaza, waterfront)
//     fall through to the city's lightCharacter — which IS appropriate for them.

const SETTING_NIGHT_LIGHT: Partial<Record<VenueSetting, string[]>> = {
  beach: [
    'scattered boardwalk lamp pools on sand',
    'distant pier lights and promenade lamps',
    'warm string lights along a quiet boardwalk',
    'faint lifeguard station light and pier glow',
    'low timber-post lamps along the shoreline',
  ],
  park: [
    'lamppost pools on gravel paths and grass',
    'warm path lighting filtering through branches',
    'scattered park lamps casting circles on ground',
    'low bollard lights along winding walkways',
    'heritage lamppost glow between dark tree canopy',
  ],
  elevated: [
    'city glow illuminating from far below',
    'distant skyline light and faint railing lamps',
    'urban light washing upward from the city below',
    'faint safety lighting at a dark viewpoint',
    'observation platform lamp and city light below',
  ],
  monument: [
    'warm floodlighting on carved stone surfaces',
    'upward-angled spotlights on historic facades',
    'amber heritage floodlights on arches and columns',
    'golden uplighting on weathered stone walls',
    'focused accent lighting on monument detail',
  ],
};

// ── Setting Urban Attenuation (v7.5) ────────────────────────────────────────
// Multiplier applied to the city's raw urbanLight factor per venue setting.
// Reduces effective urban brightness at non-commercial locations.
// This shifts the urban vs moon competition outcome — a park in Tokyo will
// trend toward balanced/moon-dominant instead of always urban-dominant.
//
// Values tuned to physical reality:
//   street/narrow:  You ARE in the commercial light. Full factor.
//   market:         Open-air but lit. Slight reduction.
//   plaza/waterfront: Set back from dense commercial. Moderate reduction.
//   monument:       Floodlit but isolated from commercial strip.
//   park:           Dramatically less urban — lamppost pools, not neon.
//   beach:          Boardwalk-level light only. Distant city glow.
//   elevated:       ABOVE the light. Looking down at it. Minimal direct.

const SETTING_URBAN_ATTENUATION: Record<VenueSetting, number> = {
  street: 1.0,
  narrow: 1.0,
  market: 0.95,
  plaza: 0.85,
  waterfront: 0.85,
  monument: 0.7,
  park: 0.4,
  beach: 0.3,
  elevated: 0.2,
};

// ── Coherence Validator — Banned Terms per Setting (v7.6) ───────────────────
// Safety net: catches commercial-light vocabulary that should NEVER appear in
// the lighting base phrase for non-urban venues. Runs AFTER computeLighting.
//
// Why needed despite v7.5 routing:
//   - The "balanced" competition outcome concatenates scene light + moonlight.
//     If the setting pool lookup somehow fails, city character leaks through.
//   - Future data changes might introduce new city lightCharacter phrases
//     containing terms not anticipated by the routing logic.
//   - Edge cases where venueSetting fallback resolves to an unexpected value.
//
// Terms are matched as case-insensitive substrings against lighting.base.
// When a violation is detected, lighting.base is swapped to the setting pool
// and fullPhrase is rebuilt. Only non-urban settings have bans.
//
// Urban settings (street, narrow, market, plaza, waterfront) are NOT listed —
// they correctly use city lightCharacter and have no banned terms.

const SETTING_BANNED_TERMS: Partial<Record<VenueSetting, string[]>> = {
  beach: [
    'neon',
    'shopfront',
    'storefront',
    'signage',
    'fluorescent',
    'billboard',
    'bodega',
    'vending',
    'stall',
    'bazaar',
    'tower facade',
    'boulevard',
    'metro entrance',
  ],
  park: [
    'neon',
    'shopfront',
    'storefront',
    'signage',
    'fluorescent',
    'billboard',
    'bodega',
    'vending',
    'stall',
    'bazaar',
    'tower facade',
    'boulevard',
    'metro entrance',
    'harbour',
    'dock',
  ],
  elevated: [
    'neon',
    'shopfront',
    'storefront',
    'signage',
    'fluorescent',
    'billboard',
    'bodega',
    'vending',
    'stall',
    'bazaar',
    'cobblestone',
    'harbour',
    'dock',
  ],
  monument: [
    'neon',
    'shopfront',
    'storefront',
    'signage',
    'fluorescent',
    'billboard',
    'bodega',
    'vending',
    'stall',
    'bazaar',
    'tower facade',
  ],
};

/**
 * Coherence Validator (v7.6) — post-computeLighting safety net.
 *
 * Scans the lighting base phrase for terms that are physically impossible
 * at the given venue setting. If a violation is found:
 *   1. Swaps lighting.base to a phrase from the setting-specific pool.
 *   2. Rebuilds lighting.fullPhrase from the patched components.
 *
 * Mutates the LightingState object in place. Only fires at night —
 * daytime lighting is solar-driven and always physically correct.
 *
 * @returns true if a violation was found and corrected, false otherwise.
 */
function validateLightingCoherence(
  lighting: LightingState,
  venueSetting: VenueSetting | null,
  city: string,
  moonDayInCycle: number,
  venueLightCharacter?: string[] | null,
): boolean {
  // Daytime: solar-driven, always correct. Nothing to validate.
  if (lighting.nightDominant === null) return false;
  // No venue setting: no bans to enforce.
  if (!venueSetting) return false;

  const bannedTerms = SETTING_BANNED_TERMS[venueSetting];
  if (!bannedTerms || bannedTerms.length === 0) return false;

  // Scan base phrase for any banned term (case-insensitive substring match)
  const baseLower = lighting.base.toLowerCase();
  const hasBanned = bannedTerms.some((term) => baseLower.includes(term));
  if (!hasBanned) return false;

  // ── Violation detected — swap base phrase ──────────────────────────
  // Priority: venue lightCharacter → setting pool → leave unchanged.
  const replacementPool =
    venueLightCharacter && venueLightCharacter.length > 0
      ? venueLightCharacter
      : SETTING_NIGHT_LIGHT[venueSetting];

  if (!replacementPool || replacementPool.length === 0) {
    return false;
  }

  const seed = cityLightSeed(city, moonDayInCycle);
  lighting.base = pickRandom(replacementPool, seed);

  // Rebuild fullPhrase from patched components
  const segments = [
    lighting.base,
    lighting.shadowModifier,
    lighting.atmosphereModifier,
    lighting.stabilityModifier,
  ].filter(Boolean);
  lighting.fullPhrase = segments.join(' ');

  return true;
}

// ── City Light Seed (for deterministic phrase selection in lighting engine) ──
// Knuth multiplicative hash × XOR mixing. Produces excellent dispersion
// across small pools (3 phrases) even with sequential moonDayInCycle values.
// Same city + same moon day = same phrase. Different day = likely different phrase.

function cityLightSeed(city: string, moonDayInCycle: number): number {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = hash + city.charCodeAt(i);
  }
  return ((hash * 2654435761) ^ (moonDayInCycle * 40503)) >>> 0;
}

function getCloudStateFromCover(cloudCover: number): CloudState {
  // Deterministic bins (0–100). Keep stable — these drive dedupe logic.
  if (cloudCover <= 10) return 'none';
  if (cloudCover <= 25) return 'few';
  if (cloudCover <= 50) return 'partial';
  if (cloudCover <= 75) return 'mostly';
  return 'overcast';
}

// ── Moon brightness as numeric value (for competition maths) ──────────────
// Full/Gibbous = 1.0, Quarter = 0.5, Crescent = 0.2, New = 0.05

function getMoonBrightnessValue(dayInCycle: number): number {
  // Full Moon + Gibbous (days ~11–22): high brightness
  if (dayInCycle >= 14.0 && dayInCycle < 16.61) return 1.0; // Full Moon peak
  if (dayInCycle >= 11.07 && dayInCycle < 22.14) return 0.75; // Gibbous
  // Quarters (days ~7–11 and ~22–26)
  if ((dayInCycle >= 7.38 && dayInCycle < 11.07) || (dayInCycle >= 22.14 && dayInCycle < 25.83))
    return 0.4;
  // Crescents (days ~2–7 and ~26–29)
  if (dayInCycle >= 1.85 && dayInCycle < 7.38) return 0.15;
  if (dayInCycle >= 25.83) return 0.15;
  // New Moon (days 0–1.85)
  return 0.02;
}

// ── Lunar altitude attenuation ────────────────────────────────────────────
// Low moon = more atmosphere = dimmer + warmer. High = full brightness.
// Below horizon = zero contribution.

function getLunarAltitudeAttenuation(lunarAltitude: number | null): number {
  if (lunarAltitude === null) return 0.7; // No position data → assume mid-sky
  if (lunarAltitude <= 0) return 0; // Below horizon → no moonlight
  if (lunarAltitude < 10) return 0.4; // Very low — heavy atmospheric extinction
  if (lunarAltitude < 20) return 0.6; // Low — significant dimming
  if (lunarAltitude < 35) return 0.8; // Mid — moderate
  if (lunarAltitude < 60) return 0.95; // High — near full
  return 1.0; // Overhead — full brightness
}

// ── Lunar light quality descriptor ────────────────────────────────────────
// Altitude-dependent colour temperature and shadow character.
// Only used when moon dominates — describes directional light quality.

function getLunarLightQuality(lunarAltitude: number | null): string {
  if (lunarAltitude === null) return 'silver'; // Fallback
  if (lunarAltitude < 10) return 'warm amber';
  if (lunarAltitude < 20) return 'pale amber';
  if (lunarAltitude < 35) return 'silver';
  if (lunarAltitude < 60) return 'cool white';
  return 'bright white';
}

function getLunarShadowQuality(lunarAltitude: number | null): string {
  if (lunarAltitude === null) return 'moderate'; // Fallback
  if (lunarAltitude < 15) return 'long lateral';
  if (lunarAltitude < 35) return 'medium';
  if (lunarAltitude < 60) return 'short downward';
  return 'near-vertical';
}

/**
 * Compute the full lighting state from measured data.
 * Runs ONCE per prompt. Each tier then renders this state differently.
 *
 * v6.1: Night branch uses urban vs moon competition model.
 * v7.5: Venue setting attenuates urbanFactor and selects setting-appropriate
 *        light phrases. Beach/park/elevated/monument get dedicated pools.
 * v7.7: Venue-specific lightCharacter takes highest priority when present.
 * Inputs: solar elevation, cloud cover, visibility, humidity, pressure,
 *         moon phase, night flag, lunar position, city name, venue setting,
 *         venue-specific light character.
 */
function computeLighting(
  solarElevation: number | null,
  cloudCover: number | null,
  visibility: number | null,
  pressure: number | null,
  moonDayInCycle: number,
  isNight: boolean,
  lunarPosition: LunarPosition | null,
  city: string,
  visualTruth: VisualTruth | null,
  venueSetting?: VenueSetting | null,
  venueLightCharacter?: string[] | null,
): LightingState {
  const cloud = cloudCover ?? 0;
  const vis = visibility ?? 10000;
  const pres = pressure ?? 1015;

  // ── Night competition variables ─────────────────────────────────
  let moonPositionPhrase: string | null = null;
  let nightDominant: 'urban' | 'moon' | 'balanced' | null = null;

  // ── Segment 1: BASE ─────────────────────────────────────────────
  let base: string;

  if (isNight || (solarElevation !== null && solarElevation < -18)) {
    // ════════════════════════════════════════════════════════════════
    // NIGHT — Urban vs Moon Competition Model (v7.5 — venue-aware)
    // ════════════════════════════════════════════════════════════════
    // v7.5: venue setting attenuates the effective urban factor AND
    // selects setting-appropriate light phrases. A beach in New York
    // gets "boardwalk lamp pools" not "LED billboard glow".
    //
    // Settings with override pools: beach, park, elevated, monument.
    // Settings without overrides: street, narrow, market, plaza, waterfront
    //   → use city's lightCharacter (these ARE the commercial strip).

    // Source A: Urban glow — static factor × venue attenuation × cloud amplification
    const rawUrbanFactor = getUrbanLightFactor(city);
    const settingAttenuation = venueSetting
      ? (SETTING_URBAN_ATTENUATION[venueSetting] ?? 1.0)
      : 1.0;
    const urbanFactor = rawUrbanFactor * settingAttenuation;
    const cloudAmplification = 1 + (cloud / 100) * 0.5; // Overcast adds up to 50%
    const effectiveUrban = urbanFactor * cloudAmplification;

    // Source B: Moonlight — phase × altitude × cloud blocking
    const phaseBrightness = getMoonBrightnessValue(moonDayInCycle);
    const lunarAlt = lunarPosition?.altitude ?? null;
    const altAttenuation = getLunarAltitudeAttenuation(lunarAlt);
    const cloudBlocking = 1 - (cloud / 100) * 0.7; // Heavy cloud blocks up to 70%
    const effectiveMoon = phaseBrightness * altAttenuation * cloudBlocking;

    // ── Competition decision ──────────────────────────────────────
    const DOMINANCE_THRESHOLD = 1.5;
    if (effectiveUrban > effectiveMoon * DOMINANCE_THRESHOLD) {
      nightDominant = 'urban';
    } else if (effectiveMoon > effectiveUrban * DOMINANCE_THRESHOLD) {
      nightDominant = 'moon';
    } else {
      nightDominant = 'balanced';
    }

    // ── Moon position descriptor ──────────────────────────────────
    // Gate: must be above horizon, cloud ≤ 75%, visibility ≥ 3000m
    if (lunarPosition && lunarPosition.altitude > 0 && cloud <= 75 && vis >= 3000) {
      moonPositionPhrase = lunarPosition.positionPhrase;
    }

    // ── Base phrase by competition winner ──────────────────────────
    const moonAbove = lunarAlt !== null && lunarAlt > 0;
    const lightQuality = getLunarLightQuality(lunarAlt);
    const shadowQuality = getLunarShadowQuality(lunarAlt);

    // v7.7: 3-tier light phrase priority:
    //   1. Venue-specific lightCharacter (iconic venues only — from city-vibes.json)
    //   2. Setting pool (SETTING_NIGHT_LIGHT — generic per setting type)
    //   3. City lightCharacter (urban-light.json — commercial strip light)
    //
    // Tier 1 wins when present (Coney Island gets its own fairground phrases).
    // Tier 2 wins for non-urban settings without venue enrichment.
    // Tier 3 is the fallback for urban settings (street, narrow, market, etc.).
    const hasVenueLight = venueLightCharacter && venueLightCharacter.length > 0;
    const settingLightPool = venueSetting ? SETTING_NIGHT_LIGHT[venueSetting] : null;
    const hasSettingLight = settingLightPool && settingLightPool.length > 0;

    const urbanSeed = cityLightSeed(city, moonDayInCycle);
    let sceneLightPhrase: string;
    if (hasVenueLight) {
      sceneLightPhrase = pickRandom(venueLightCharacter, urbanSeed);
    } else if (hasSettingLight) {
      sceneLightPhrase = pickRandom(settingLightPool, urbanSeed);
    } else {
      sceneLightPhrase = pickRandom(getUrbanLightCharacter(city), urbanSeed);
    }
    // Track whether we used a non-city source (for moon-below-horizon fallback)
    const useSettingLight = hasVenueLight || hasSettingLight;

    if (nightDominant === 'urban') {
      // Urban glow overpowers — moon is decoration at best.
      // Cloud > 60%: overcast amplifies and diffuses all light.
      // Otherwise: scene's light character stands alone.
      if (cloud > 60) {
        base = `${sceneLightPhrase} diffused under heavy overcast`;
      } else {
        base = sceneLightPhrase;
      }
    } else if (nightDominant === 'moon') {
      // Moonlight dominates — altitude drives light quality.
      // Scene light is background — too weak to describe.
      if (!moonAbove) {
        // Moon below horizon but still won (very low urban setting, dim everything)
        if (useSettingLight) {
          base = `faint ${sceneLightPhrase} under a dark sky`;
        } else {
          base = 'faint starlight with sparse artificial light';
        }
      } else if (cloud > 50) {
        base = `diffused ${lightQuality} moonlight through cloud`;
      } else if (lunarAlt !== null && lunarAlt >= 35) {
        base = `${lightQuality} moonlight with ${shadowQuality} shadows`;
      } else if (lunarAlt !== null && lunarAlt >= 10) {
        base = `${lightQuality} moonlight casting ${shadowQuality} shadows`;
      } else {
        // Very low moon — dramatic lateral light
        base = `${lightQuality} moonlight on the horizon casting ${shadowQuality} shadows`;
      }
    } else {
      // Balanced — both sources contribute. Scene character meets moonlight.
      if (moonAbove && cloud <= 50) {
        base = `${lightQuality} moonlight competing with ${sceneLightPhrase}`;
      } else if (moonAbove && cloud > 50) {
        base = `diffused moonlight and ${sceneLightPhrase} through cloud`;
      } else {
        // Moon below horizon but urban not dominant (low-urban setting, dark night).
        // Scene's light phrase already expresses appropriate intensity.
        base = `${sceneLightPhrase} under a moonless sky`;
      }
    }
  } else if (solarElevation === null) {
    // No solar elevation available (demo data) — simple time-based fallback
    base = 'natural daylight';
  } else if (solarElevation < -12) {
    base = 'astronomical twilight faint sky glow';
  } else if (solarElevation < -6) {
    base = 'nautical twilight deep blue sky light';
  } else if (solarElevation < 0) {
    base = 'civil twilight blue-hour light';
  } else if (solarElevation < 6) {
    // Golden hour — but >75% cloud blocks the spectral warm shift
    base = cloud > 75 ? 'low-angle overcast daylight' : 'golden-hour sunlight';
  } else if (solarElevation < 15) {
    base = 'low-angle sunlight';
  } else if (solarElevation < 35) {
    base = 'mid-elevation daylight';
  } else if (solarElevation < 60) {
    base = 'high-angle sunlight';
  } else {
    base = 'near-vertical overhead sunlight';
  }

  // ── Segment 2: SHADOW MODIFIER ──────────────────────────────────
  // Daytime only. At night or golden hour (0-6°), omitted.
  // Night shadows are handled in the base phrase (moon-dominant: altitude-based).
  // v7.0: Uses visual truth contrast (cross-references cloud + humidity + dew point)
  // instead of cloud-only bins. Eliminates physics conflicts like
  // "sharp shadows" + "saturated air" (Paris problem).
  let shadowModifier = '';
  if (
    !isNight &&
    solarElevation !== null &&
    solarElevation > 6 // Skip golden hour — shadows inherently soft
  ) {
    if (visualTruth) {
      shadowModifier = CONTRAST_SHADOW_PHRASES[visualTruth.contrast];
    } else {
      shadowModifier = '';
    }
  }

  // ── Segment 3: ATMOSPHERE MODIFIER ──────────────────────────────
  // v7.0: Uses visual truth air clarity (cross-references visibility, humidity,
  // dew point spread, wind, temperature) instead of visibility-only bins.
  // Eliminates "in pristine clear air" monotony (was ~85% of prompts).
  // 'clear' produces empty string — clear air is the default assumption.
  let atmosphereModifier = '';
  if (visualTruth) {
    atmosphereModifier = AIR_CLARITY_PHRASES[visualTruth.airClarity];
  } else {
    // Safety fallback — should never fire now that visual truth is always computed.
    atmosphereModifier = '';
  }

  // ── Segment 4: STABILITY MODIFIER ───────────────────────────────
  // Only extreme values. Mid-range (1015-1030) omitted.
  let stabilityModifier = '';
  if (pres > 1030) {
    stabilityModifier = 'under stable high-pressure air';
  } else if (pres < 1000) {
    stabilityModifier = 'under low-pressure unsettled conditions';
  } else if (pres < 1015 && cloud > 40) {
    stabilityModifier = 'under unsettled air';
  }

  // ── Assemble ────────────────────────────────────────────────────
  const segments = [base, shadowModifier, atmosphereModifier, stabilityModifier].filter(Boolean);
  const fullPhrase = segments.join(' ');

  // Check if // Structured cloud state derived from OWM cloudCover bins (0–100)
  const cloudState: CloudState = getCloudStateFromCover(cloud);
  // Sky/lighting duplication rule: if lighting already encodes cloud behaviour/state,
  // omit the separate Sky element.
  const encodesCloudState =
    isNight || shadowModifier.length > 0 || cloudState === 'mostly' || cloudState === 'overcast';

  // Moon visibility: suppress entire moon layer when moon is below horizon.
  // If we have lunar position data → only visible when altitude > 0.
  // If no position data (no lat/lon) → assume visible for backward compat.
  const moonVisible = isNight && (lunarPosition === null || lunarPosition.altitude > 0);

  return {
    fullPhrase,
    base,
    shadowModifier,
    atmosphereModifier,
    stabilityModifier,
    cloudState,
    encodesCloudState,
    moonPositionPhrase,
    nightDominant,
    moonVisible,
  };
}

// ============================================================================
// JSON VOCABULARY LOADERS
// ============================================================================

// ── Range-based lookup helper ───────────────────────────────────────────────
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
const HUMIDITY_LOOKUP = buildRangeLookup(humidityData.ranges as Record<string, RangeEntry>);

// ── Wind template descriptors (v6.0 — replaces phrase pools) ────────────────
// v7.3: Wind descriptors replaced by inline noun scale in getWindPhrase
// (breeze < 25 km/h, wind 25–50 km/h, gale 50+ km/h)

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

// ── City vibes (venue-only model, v6.0 + v7.2 venue settings) ───────────────
type VenueSetting =
  | 'waterfront'
  | 'beach'
  | 'street'
  | 'narrow'
  | 'market'
  | 'plaza'
  | 'park'
  | 'elevated'
  | 'monument';

interface CityVenueData {
  name: string;
  setting?: VenueSetting;
  /** v7.7: Optional venue-specific night light phrases. When present,
   *  these override both the setting pool and city lightCharacter.
   *  Only for iconic venues with truly distinctive lighting. */
  lightCharacter?: string[];
}
interface VenueResult {
  name: string;
  setting: VenueSetting;
  /** v7.7: Venue-specific night light phrases (when present in JSON). */
  lightCharacter?: string[];
}
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
// Runtime safety net for known taxonomy errors that haven't been fixed in
// city-vibes.json yet. Key = "city::venue name" (lowercase), value = correct
// VenueSetting. Applied in getCityVenue() after venue selection.
//
// This map should be EMPTY in a fully-corrected dataset. If you add entries
// here, also file a fix for city-vibes.json so the override can be removed.
// Run `npx tsx scripts/lint-venues.ts` to detect mismatches.
const SETTING_OVERRIDES: Record<string, VenueSetting> = {
  // No overrides currently needed — all known errors fixed in city-vibes.json v8.0.0.
  // Example format:
  // 'new york::chinatown canal street': 'street',
};

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

// ── Beaufort-Calibrated Wind System (v8.0.0) ─────────────────────────────────
// Replaces the old 4-tier system (light/moderate/strong/extreme) with
// 7 Beaufort-aligned tiers. Key correction: 50 km/h is "near gale"
// (strong visible effects on vegetation/objects, NOT destructive).
// Destructive phrases ("airborne", "ripping", "buckling") now correctly
// start at gale force (62+ km/h, Beaufort 8+).
//
// All human-body references purged ("hair pulled", "difficult to stand",
// "impossible to stand") — prompts describe what the CAMERA sees, not
// what a person feels.
//
// Beaufort mapping:
//   calm       <6       (B0–1)  — invisible in photograph, early return
//   breeze     6–19     (B2–3)  — gentle movement: flags shift, leaves rustle
//   fresh      20–29    (B4)    — moderate: dust raised, small branches move
//   strong     30–49    (B5–6)  — clear effects: large branches, flags snap
//   nearGale   50–61    (B7)    — whole trees sway, resistance felt walking
//   gale       62–74    (B8)    — twigs break, structural damage begins
//   strongGale 75–88    (B9)    — significant damage, chimneys removed
//   storm      89+      (B10+)  — trees uprooted, considerable structural damage
//
// New features in v8.0.0:
// - Wind direction from OWM (windDegrees) → cardinal suffix when available
// - Gust factor: when windGustKmh > sustained * 1.5 → "gusting to {gust}" suffix
// - Snow+wind interaction: blowing/drifting snow phrases when precip.type === 'snow'

type WindForce =
  | 'calm'
  | 'breeze'
  | 'fresh'
  | 'strong'
  | 'nearGale'
  | 'gale'
  | 'strongGale'
  | 'storm';

/** Tiers that have venue interaction phrase pools (calm excluded — early return). */
type ActiveWindForce = Exclude<WindForce, 'calm'>;

const VENUE_WIND: Record<VenueSetting, Record<ActiveWindForce, string[]>> = {
  waterfront: {
    breeze: [
      'ripples crossing harbour water',
      'moored boats shifting gently at berths',
      'harbour flags lifting from poles',
    ],
    fresh: [
      'small waves forming across the harbour',
      'spray misting lightly over bows',
      'flags extending taut from poles',
    ],
    strong: [
      'whitecaps forming across the harbour',
      'spray lifting off wave crests',
      'moored boats straining at lines',
    ],
    nearGale: [
      'harbour whitecaps and blown spray',
      'waves slapping hard against quayside',
      'rigging cables humming taut',
    ],
    gale: [
      'waves crashing against quayside walls',
      'spray filling the air horizontally',
      'boats slamming against moorings',
    ],
    strongGale: [
      'heavy seas breaking over harbour walls',
      'harbour awash with horizontal spray',
      'smaller vessels heeling dangerously',
    ],
    storm: [
      'waves overtopping harbour walls entirely',
      'massive spray sheets across the quay',
      'harbour infrastructure visibly straining',
    ],
  },
  beach: {
    breeze: [
      'fine sand drifting at ankle height',
      'shallow surf ruffled onshore',
      'beach grass swaying gently',
    ],
    fresh: [
      'sand streaming in low ribbons',
      'surf choppy and breaking unevenly',
      'dune grass bending sideways',
    ],
    strong: [
      'sand flying at knee height',
      'rough surf pounding the shore',
      'vegetation flattened sideways',
    ],
    nearGale: [
      'sand streaming at waist height',
      'heavy surf breaking far up the beach',
      'everything bent hard shoreward',
    ],
    gale: [
      'sand airborne in thick clouds',
      'violent surf crashing far inland',
      'beach scoured down to wet sand',
    ],
    strongGale: [
      'sand blasting horizontal across the shore',
      'enormous surf breaking over dunes',
      'coastal debris tumbling inland',
    ],
    storm: [
      'total sand whiteout conditions',
      'surf reaching well beyond the dunes',
      'beach landscape completely reshaped',
    ],
  },
  street: {
    breeze: [
      'awnings swaying gently overhead',
      'litter drifting along gutters',
      'shop banners shifting slowly',
    ],
    fresh: [
      'awnings flapping hard overhead',
      'signage rattling on brackets',
      'loose paper channelling fast between buildings',
    ],
    strong: [
      'awnings straining at fixings',
      'signs swinging wildly on posts',
      'debris skittering down the pavement',
    ],
    nearGale: [
      'awnings pulled taut and vibrating',
      'larger signs bending on mountings',
      'bins rolling down the street',
    ],
    gale: [
      'awnings ripping from brackets',
      'signs bent sideways on posts',
      'loose objects tumbling down the road',
    ],
    strongGale: [
      'canopy structures tearing free',
      'signage damaged and hanging loose',
      'lightweight street furniture shifting',
    ],
    storm: [
      'structural debris airborne in the street',
      'signage destroyed and scattered',
      'nothing unsecured remaining upright',
    ],
  },
  narrow: {
    breeze: [
      'noren curtains swaying in doorways',
      'hanging lanterns rotating slowly',
      'alley air funnelling gently',
    ],
    fresh: [
      'noren curtains flapping horizontal',
      'hanging signs clattering on walls',
      'funnelled air pushing through the passage',
    ],
    strong: [
      'noren curtains pinned horizontal',
      'lanterns swinging wildly overhead',
      'funnelled blast howling through the alley',
    ],
    nearGale: [
      'fabric pinned flat against walls',
      'hanging objects swinging hard',
      'wind howling through the narrow passage',
    ],
    gale: [
      'lightweight objects torn from hooks',
      'alley acting as a violent wind tunnel',
      'debris channelling fast through the gap',
    ],
    strongGale: [
      'everything loose stripped from walls',
      'alley funnelling violent sustained gusts',
      'shutters rattling and straining on hinges',
    ],
    storm: [
      'alley completely scoured by wind',
      'debris blasting through the passage',
      'nothing hanging or mounted remaining',
    ],
  },
  market: {
    breeze: [
      'stall canopies rippling gently',
      'hanging fabric swaying overhead',
      'produce displays shifting slightly',
    ],
    fresh: [
      'stall canopies flapping hard',
      'hanging banners snapping taut',
      'lightweight goods sliding off tables',
    ],
    strong: [
      'canopy frames straining and bending',
      'fabric covers lifting at edges',
      'stall goods scattering across aisles',
    ],
    nearGale: [
      'canopies pulled taut and vibrating',
      'heavier goods sliding on tables',
      'vendors securing remaining stock',
    ],
    gale: [
      'canopy frames bending dangerously',
      'fabric covers tearing loose',
      'goods tumbling from overturned tables',
    ],
    strongGale: [
      'stall canopies ripping free entirely',
      'market goods airborne across the aisles',
      'entire stall frames buckling',
    ],
    storm: [
      'entire market stalls collapsing',
      'everything airborne and scattered',
      'market infrastructure destroyed',
    ],
  },
  plaza: {
    breeze: [
      'dust skittering across flagstones',
      'flags on poles shifting gently',
      'fountain spray drifting sideways',
    ],
    fresh: [
      'flags snapping taut on poles',
      'loose leaves spiralling across stone',
      'fountain spray blown sideways',
    ],
    strong: [
      'flags rigid horizontal on poles',
      'grit blasting across open stone',
      'fountain spray completely dispersed',
    ],
    nearGale: [
      'flag fabric straining at fastenings',
      'loose objects rolling across the plaza',
      'fountain blown apart into mist',
    ],
    gale: [
      'flag fabric shredding on poles',
      'open plaza scoured by flying grit',
      'temporary structures leaning dangerously',
    ],
    strongGale: [
      'flagpoles bending under sustained force',
      'nothing unsecured remaining in the open',
      'plaza completely scoured clean',
    ],
    storm: [
      'structural elements straining visibly',
      'plaza cleared of all loose material',
      'flagpoles damaged and bent horizontal',
    ],
  },
  park: {
    breeze: [
      'leaves drifting from branches',
      'long grass bending uniformly',
      'branches swaying gently overhead',
    ],
    fresh: [
      'trees swaying noticeably',
      'leaves scattering across paths',
      'shrubs flattened sideways',
    ],
    strong: [
      'trees bending hard windward',
      'branches cracking overhead',
      'leaves stripped from lower canopy',
    ],
    nearGale: [
      'whole trees swaying heavily',
      'large branches thrashing',
      'leaf litter spiralling in vortices',
    ],
    gale: ['large branches snapping off', 'trees bent hard windward', 'canopy being stripped bare'],
    strongGale: [
      'major limbs breaking with cracks',
      'trees leaning dangerously windward',
      'everything stripped bare overhead',
    ],
    storm: [
      'trees uprooted and toppling',
      'canopy completely destroyed',
      'park landscape totally transformed',
    ],
  },
  elevated: {
    breeze: [
      'exposed shrubs leaning gently',
      'treetops swaying below viewpoint',
      'summit flags shifting on poles',
    ],
    fresh: [
      'treetops thrashing below viewpoint',
      'exposed vegetation bending sideways',
      'summit flags snapping taut',
    ],
    strong: [
      'treetops violently thrashing below',
      'all vegetation pinned flat',
      'exposed surfaces completely windswept',
    ],
    nearGale: [
      'everything flattened on exposed summit',
      'vegetation pinned flat to the ground',
      'sustained roar across the ridgeline',
    ],
    gale: [
      'summit completely scoured by wind',
      'vegetation stripped from exposed rock',
      'exposed structures visibly straining',
    ],
    strongGale: [
      'nothing upright on the exposed ridge',
      'structural elements vibrating audibly',
      'sustained howl across bare summit',
    ],
    storm: [
      'extreme exposure conditions at summit',
      'everything flattened or stripped away',
      'ridgeline completely impassable',
    ],
  },
  monument: {
    breeze: [
      'entrance flags shifting gently',
      'courtyard dust drifting in eddies',
      'prayer flags swaying on lines',
    ],
    fresh: [
      'entrance flags flapping hard',
      'courtyard grit spiralling upward',
      'loose offering items sliding across stone',
    ],
    strong: [
      'flags rigid and snapping loudly',
      'courtyard scoured by blowing grit',
      'temporary structures straining at anchors',
    ],
    nearGale: [
      'flags straining hard at poles',
      'courtyard blasted clean of debris',
      'lightweight barriers shifting position',
    ],
    gale: [
      'flags shredding at their poles',
      'everything loose airborne across grounds',
      'temporary structures leaning dangerously',
    ],
    strongGale: [
      'flagpoles bending under the force',
      'monument grounds completely scoured',
      'barriers toppling across courtyards',
    ],
    storm: [
      'structural elements of grounds straining',
      'grounds completely cleared by wind',
      'monument stonework sandblasted by debris',
    ],
  },
};

function classifyWind(speed: number): WindForce {
  if (speed < 6) return 'calm';
  if (speed < 20) return 'breeze';
  if (speed < 30) return 'fresh';
  if (speed < 50) return 'strong';
  if (speed < 62) return 'nearGale';
  if (speed < 75) return 'gale';
  if (speed < 89) return 'strongGale';
  return 'storm';
}

/** Convert wind degrees (0–360) to cardinal direction word. */
function getCardinalDirection(degrees: number): string {
  const dirs = [
    'northerly',
    'north-easterly',
    'easterly',
    'south-easterly',
    'southerly',
    'south-westerly',
    'westerly',
    'north-westerly',
  ];
  return dirs[Math.round(degrees / 45) % 8]!;
}

/** Wind noun by Beaufort force — what the whole clause labels itself. */
function getWindNoun(force: WindForce): string {
  switch (force) {
    case 'calm':
      return 'air';
    case 'breeze':
      return 'breeze';
    case 'fresh':
      return 'breeze';
    case 'strong':
      return 'wind';
    case 'nearGale':
      return 'high wind';
    case 'gale':
      return 'gale';
    case 'strongGale':
      return 'severe gale';
    case 'storm':
      return 'storm';
  }
}

/**
 * v8.0.0: Beaufort-calibrated wind phrase.
 *
 * Output format (single clause, no stacking):
 *   Below 6:   "still air"
 *   6–19:      "{direction} {speed} km/h breeze, {interaction}"
 *   20–29:     "{direction} {speed} km/h breeze, {interaction}"
 *   30–49:     "{direction} {speed} km/h wind, {interaction}"
 *   50–61:     "{direction} {speed} km/h high wind, {interaction}"
 *   62–74:     "{direction} {speed} km/h gale, {interaction}"
 *   75–88:     "{direction} {speed} km/h severe gale, {interaction}"
 *   89+:       "{direction} {speed} km/h storm, {interaction}"
 *
 * New in v8.0.0:
 * - Direction prefix when windDegrees available (e.g. "south-westerly 35 km/h wind")
 * - Gust suffix when gust > sustained * 1.5 (e.g. "gusting to 52 km/h")
 * - Snow+wind interaction: blowing/drifting snow replaces venue interaction
 *   when PrecipState indicates active snow and wind is fresh+
 *
 * The speed number does the intensity work. The noun (breeze/wind/gale/storm)
 * sets the register. The interaction shows what the camera sees.
 */
function getWindPhrase(
  ctx: WeatherContext,
  seed: number,
  venueSetting?: VenueSetting,
  precip?: PrecipState,
): string {
  const speed = Math.round(ctx.windKmh);

  // Below 6 km/h — Beaufort 0–1, invisible in a still photo
  if (speed < 6) return 'still air';

  const force = classifyWind(speed);
  const noun = getWindNoun(force);
  const setting = venueSetting ?? 'street';

  // Direction prefix — only when OWM provides wind.deg
  const dirPrefix =
    typeof ctx.windDegrees === 'number' ? `${getCardinalDirection(ctx.windDegrees)} ` : '';

  // Gust suffix — only when gust exceeds sustained speed by 50%+
  let gustSuffix = '';
  if (typeof ctx.windGustKmh === 'number' && ctx.windGustKmh > speed * 1.5) {
    gustSuffix = ` gusting to ${Math.round(ctx.windGustKmh)} km/h`;
  }

  // Snow+wind interaction: blowing/drifting snow overrides venue interaction
  // when active snow/sleet and wind is fresh (20+) or above
  if (
    precip &&
    precip.active &&
    (precip.type === 'snow' || precip.type === 'sleet') &&
    speed >= 20
  ) {
    const snowInteraction =
      speed >= 50
        ? 'snow streaming horizontal across the scene'
        : speed >= 30
          ? 'blowing snow reducing visibility'
          : 'snow drifting across surfaces';
    return `${dirPrefix}${speed} km/h ${noun}${gustSuffix}, ${snowInteraction}`;
  }

  // Standard venue interaction
  const pool = force !== 'calm' ? VENUE_WIND[setting]?.[force as ActiveWindForce] : undefined;
  const interaction = pool?.length ? pickRandom(pool, seed * 2.3) : '';

  const core = `${dirPrefix}${speed} km/h ${noun}${gustSuffix}`;
  return interaction ? `${core}, ${interaction}` : core;
}

/**
 * Simple time descriptor — just a plain phrase like "early morning" or "midnight".
 * No mood, no lighting. Uses JSON phrase pool per hour.
 */
function getTimeDescriptor(ctx: WeatherContext, seed: number): string {
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

function getSkySource(ctx: WeatherContext, seed: number): string | null {
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
function getSkySourceAware(
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
// CITY VENUE SELECTOR (v6.0 — venue only, no activities)
// ============================================================================
// Picks a random venue from the city. Activities are removed entirely.
// Returns null when the city has no venue data.
// ============================================================================

function getCityVenue(city: string, seed: number): VenueResult | null {
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

// ── v8.0.0 Chat 4: Setting-Aware Ending + Period Noun Time ────────────────

/**
 * Returns a setting-appropriate quality directive for Tier 3 endings.
 * Replaces the hardcoded "Photorealistic, highly detailed urban landscape."
 * which was wrong for beaches, parks, elevated viewpoints, etc.
 * v8.0.0 Chat 7: prefix driven by profile.style (Photorealistic/Cinematic/Documentary).
 */
function getSettingEnding(
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
function getTimePeriod(hour: number): string {
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
function generateTier1(
  city: string,
  weather: ExchangeWeatherFull,
  hour: number,
  lighting: LightingState,
  observedAtUtc: Date,
  visualTruth: VisualTruth | null,
  venue: VenueResult | null,
  profile: PromptProfile,
): WeatherPromptResult {
  const ctx = buildContext(weather, hour, observedAtUtc);
  const twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  // v8.0.0 Chat 7: People exclusion driven by profile instead of raw isQuietHours.
  const quiet = shouldExcludePeople(profile, weather, hour, observedAtUtc);
  const wind = getWindPhrase(ctx, seed, venue?.setting, visualTruth?.precip);
  const time = getTimeDescriptor(ctx, seed);
  // Sky omitted when lighting already encodes cloud state
  const skySource = getSkySourceAware(ctx, seed, lighting.encodesCloudState);

  // v7.0: Use visual truth phrases (optical effects) instead of weather-report phrases
  const moisture = visualTruth
    ? getMoisturePhrase(visualTruth, seed, venue?.setting)
    : getHumidityPhrase(ctx, seed);
  const thermal = visualTruth ? getThermalPhrase(visualTruth, seed) : getTempPhrase(ctx, seed);
  // v7.1: Surface grounding — fires only when all atmospheric layers are silent
  const grounding = visualTruth
    ? getSurfaceGrounding(visualTruth, ctx.tempC, moisture, thermal, seed, venue?.setting)
    : null;

  // Lighting: primary source gets 1.3, modifiers unweighted comma tokens
  const lightingParts: string[] = [];
  lightingParts.push(`(${lighting.base}:1.3)`);
  if (lighting.shadowModifier) lightingParts.push(lighting.shadowModifier);
  if (lighting.atmosphereModifier) lightingParts.push(lighting.atmosphereModifier);
  // Stability modifier omitted from T1 — too abstract for CLIP

  // v8.0.0 Chat 7: Quality tags driven by profile.style.
  const qualityTags = STYLE_QUALITY_TAGS[profile.style];
  const parts: (string | null)[] = [
    `(${city}:1.3)`,
    venue ? `(${venue.name}:1.2)` : null,
    ...lightingParts,
    lighting.moonVisible
      ? `(${ctx.moonPhrase}${lighting.moonPositionPhrase ? ' ' + lighting.moonPositionPhrase : ''}:1.2)`
      : null,
    skySource ? `(${skySource}:1.1)` : null,
    thermal,
    wind,
    moisture,
    grounding,
    time,
    ...qualityTags,
  ];

  // v8.0.0 Chat 7: Fragment limit driven by profile.verbosity.
  const maxParts = VERBOSITY_T1_LIMIT[profile.verbosity];
  const filtered = parts.filter(Boolean) as string[];
  while (filtered.length > maxParts) {
    const dropIdx = filtered.length - qualityTags.length - 1;
    if (dropIdx < 3) break; // Never drop city/venue/primary lighting
    filtered.splice(dropIdx, 1);
  }

  const positivePrompt = filtered.join(', ');
  const negativePrompt = quiet
    ? 'people, person, crowd, text, watermark, logo, signature, blurry'
    : 'text, watermark, logo, signature, blurry';

  return {
    text: `Positive prompt: ${positivePrompt}\nNegative prompt: ${negativePrompt}`,
    positive: positivePrompt,
    negative: negativePrompt,
    tier: 1,
  };
}

/**
 * Tier 2: Midjourney — Multi-prompt weight syntax (v8.0.0 Chat 6)
 *
 * Replaced dash-break folklore with Midjourney `::` weight syntax.
 * Segments control relative importance directly:
 *   lighting+time::2  venue+sky+weather::1  surface::0.5
 *
 * Word budget: ~40 words before parameters (MJ docs warn long prompts confuse).
 * Quiet hours: formalised `--no people text` parameter.
 *
 * Segment strategy:
 * - Seg 1 (::2): Lighting + time — defines colour palette and mood.
 *   MJ gives ~60% attention to first segment; ::2 reinforces.
 * - Seg 2 (::1): Venue + sky + weather — the scene content.
 * - Seg 3 (::0.5): Surface detail — lowest priority, adds realism.
 *   Omitted entirely when empty or over word budget (keeps prompt tight).
 */
function generateTier2(
  city: string,
  weather: ExchangeWeatherFull,
  hour: number,
  lighting: LightingState,
  observedAtUtc: Date,
  visualTruth: VisualTruth | null,
  solarElevation: number | null,
  venue: VenueResult | null,
  profile: PromptProfile,
): string {
  const ctx = buildContext(weather, hour, observedAtUtc);
  const twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  // v8.0.0 Chat 7: People exclusion driven by profile.
  const quiet = shouldExcludePeople(profile, weather, hour, observedAtUtc);
  const wind = getWindPhrase(ctx, seed, venue?.setting, visualTruth?.precip);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySourceAware(ctx, seed, lighting.encodesCloudState);

  // v7.0: Visual truth phrases
  const moisture = visualTruth
    ? getMoisturePhrase(visualTruth, seed, venue?.setting)
    : getHumidityPhrase(ctx, seed);
  const thermal = visualTruth ? getThermalPhrase(visualTruth, seed) : getTempPhrase(ctx, seed);
  // v7.1: Surface grounding
  const grounding = visualTruth
    ? getSurfaceGrounding(visualTruth, ctx.tempC, moisture, thermal, seed, venue?.setting)
    : null;

  // v7.4: Connected lighting (thermal absorbed as connector)
  const lightScene = composeLightingSentence(lighting, visualTruth, seed);

  // Moon
  const moonPart = lighting.moonVisible
    ? lighting.moonPositionPhrase
      ? `${ctx.moonPhrase} ${lighting.moonPositionPhrase}`
      : ctx.moonPhrase
    : null;

  // v7.4: Surface with light reflection reference
  const isNight = lighting.nightDominant !== null;
  const urbanFactor = getUrbanLightFactor(city);
  const lightRef = getLightReflectionNoun(
    isNight,
    urbanFactor,
    solarElevation,
    seed,
    venue?.setting,
  );
  const moistureLevel = visualTruth?.moistureVisibility ?? 'invisible';
  const surfacePhrase = composeSurfaceSentence(moisture, grounding, moistureLevel, lightRef);

  // ── Segment 1 (::2): Lighting + time ─────────────────────────────────
  const seg1 = `${capitalize(time)}, ${lightScene}`;

  // ── Segment 2 (::1): Venue + sky + weather ───────────────────────────
  const venuePart = venue ? ` at ${venue.name}` : '';
  const sceneParts = [`${city}${venuePart}`, skySource, moonPart, wind].filter(Boolean);
  const seg2 = sceneParts.join(', ');

  // ── Segment 3 (::0.5): Surface detail ────────────────────────────────
  // Omitted entirely if no surface phrase (keeps prompt short).
  const surfaceLower = surfacePhrase
    ? surfacePhrase.charAt(0).toLowerCase() + surfacePhrase.slice(1)
    : null;

  // Word budget: target ~40 words before params. Count across all segments.
  const countWords = (s: string) => s.split(/\s+/).length;
  const baseWords = countWords(seg1) + countWords(seg2);
  const surfaceWords = surfaceLower ? countWords(surfaceLower) : 0;

  // Assemble with :: weight syntax
  let prompt: string;
  if (surfaceLower && baseWords + surfaceWords <= 45) {
    prompt = `${seg1}::2 ${seg2}::1 ${surfaceLower}::0.5`;
  } else {
    // Over budget or no surface — 2-segment prompt
    prompt = `${seg1}::2 ${seg2}::1`;
  }

  // Parameters always trail after the last segment
  const params = quiet
    ? `--ar ${profile.mjAspect} --stylize ${profile.mjStylize} --no people text`
    : `--ar ${profile.mjAspect} --stylize ${profile.mjStylize}`;

  return `${prompt} ${params}`;
}

/**
 * Tier 3: Natural Language — Connected scene description (DEFAULT TIER)
 *
 * v7.4: Level 2 connector templates. Phrases REFERENCE each other.
 *
 * STRUCTURE:
 *   S1: Location + time anchor (direct nouns, no filler)
 *   S2: Connected lighting scene (base + thermal connector + atmosphere)
 *       + sky (conditional) + moon (night only)
 *   S3: Wind as action (standalone sentence, not comma-listed)
 *   S4: Surface reflecting specific light (wet surfaces name WHAT they reflect)
 *   S5: Quality directive + quiet hours
 *
 * KEY CHANGES from v7.3:
 * - Thermal MODIFIES the lighting (connector) instead of being a standalone fragment
 * - Moisture phrases get a light-reflection reference specific to the scene
 * - Wind is isolated as its own action sentence
 * - Opening is direct nouns ("Tokyo, venue, time") not "A scene in..."
 */
function generateTier3(
  city: string,
  weather: ExchangeWeatherFull,
  hour: number,
  lighting: LightingState,
  observedAtUtc: Date,
  visualTruth: VisualTruth | null,
  solarElevation: number | null,
  venue: VenueResult | null,
  profile: PromptProfile,
): string {
  const ctx = buildContext(weather, hour, observedAtUtc);
  const twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  // v8.0.0 Chat 7: People exclusion driven by profile.
  const quiet = shouldExcludePeople(profile, weather, hour, observedAtUtc);
  const wind = getWindPhrase(ctx, seed, venue?.setting, visualTruth?.precip);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySourceAware(ctx, seed, lighting.encodesCloudState);

  // v7.0: Visual truth phrases — still generated for Tier 1/4 compat and for
  // composeSurfaceSentence which needs the raw moisture phrase.
  const moisture = visualTruth
    ? getMoisturePhrase(visualTruth, seed, venue?.setting)
    : getHumidityPhrase(ctx, seed);
  // Thermal NOT used directly in T3 — absorbed into lighting via connector.
  // Still computed because getSurfaceGrounding checks if thermal is non-null.
  const thermal = visualTruth ? getThermalPhrase(visualTruth, seed) : getTempPhrase(ctx, seed);
  // v7.1: Surface grounding (fires only when all atmospheric layers are silent)
  const grounding = visualTruth
    ? getSurfaceGrounding(visualTruth, ctx.tempC, moisture, thermal, seed, venue?.setting)
    : null;

  // ── S1: Location + time anchor ──────────────────────────────────────
  // Direct nouns, no filler words. AI models parse nouns faster than
  // "A [time] scene in [city] at [venue]".
  const venuePart = venue ? `, ${venue.name}` : '';
  const opening = `${city}${venuePart}, ${time}.`;

  // ── S2: Connected lighting scene ────────────────────────────────────
  // v7.4: composeLightingSentence merges base + thermal connector + atmosphere
  // into one flowing phrase. Thermal MODIFIES the light instead of standalone.
  const lightScene = composeLightingSentence(lighting, visualTruth, seed);

  // Sky: only when lighting doesn't already encode cloud state
  const skyClause = skySource ? ` ${capitalize(skySource)} overhead.` : '';

  // Moon: night only, with position when available
  let moonClause = '';
  if (lighting.moonVisible) {
    moonClause = lighting.moonPositionPhrase
      ? ` A ${ctx.moonPhrase} ${lighting.moonPositionPhrase}.`
      : ` Under a ${ctx.moonPhrase}.`;
  }

  const lightSentence = `${capitalize(lightScene)}.${skyClause}${moonClause}`;

  // ── S3: Wind as action ──────────────────────────────────────────────
  // v8.0.0: Threshold updated to match Beaufort calm boundary (B0–1 = <6 km/h).
  // Below 6 km/h: omitted entirely (invisible in a still photograph).
  let windSentence = '';
  const speed = Math.round(ctx.windKmh);
  if (speed >= 6) {
    windSentence = `${capitalize(wind)}.`;
  }

  // ── S4: Surface reflecting light ────────────────────────────────────
  // v7.4: Wet surfaces name WHAT light they're reflecting, derived from
  // time-of-day + urban light intensity + venue setting of the city.
  const isNight = lighting.nightDominant !== null;
  const urbanFactor = getUrbanLightFactor(city);
  const lightRef = getLightReflectionNoun(
    isNight,
    urbanFactor,
    solarElevation,
    seed,
    venue?.setting,
  );
  const moistureLevel = visualTruth?.moistureVisibility ?? 'invisible';
  const surfacePhrase = composeSurfaceSentence(moisture, grounding, moistureLevel, lightRef);
  const surfaceSentence = surfacePhrase ? `${surfacePhrase}.` : '';

  // ── Assemble ────────────────────────────────────────────────────────
  // v8.0.0 Chat 4: Setting-aware ending replaces hardcoded "urban landscape"
  // which was wrong for beaches, parks, elevated viewpoints, etc.
  const sentences = [
    opening,
    lightSentence,
    windSentence,
    surfaceSentence,
    getSettingEnding(venue, profile.style),
  ].filter(Boolean);
  if (quiet) sentences.push('No people or readable text.');

  return sentences.join(' ');
}

/**
 * Tier 4: Plain Language — Simple comma-separated prompt
 *
 * v8.0.0 Chat 4:
 * - Period noun time (getTimePeriod) replaces clock-time phrasing.
 *   Weak parsers handle "dawn"/"night" better than "seven in the evening".
 * - Hard fragment limit: 10 comma items maximum.
 *   Drop priority (lowest visual impact first):
 *   grounding → skySource → moon → thermal → moisture
 *
 * Lighting before Time (concrete visual > abstract clock for weak parsers).
 */
function generateTier4(
  city: string,
  weather: ExchangeWeatherFull,
  hour: number,
  lighting: LightingState,
  observedAtUtc: Date,
  visualTruth: VisualTruth | null,
  venue: VenueResult | null,
  profile: PromptProfile,
): string {
  const ctx = buildContext(weather, hour, observedAtUtc);
  const twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;

  // v8.0.0 Chat 7: People exclusion driven by profile.
  const quiet = shouldExcludePeople(profile, weather, hour, observedAtUtc);
  const wind = getWindPhrase(ctx, seed, venue?.setting, visualTruth?.precip);
  // v8.0.0 Chat 4: Period noun instead of clock-time phrasing
  const time = getTimePeriod(ctx.hour);
  const skySource = getSkySourceAware(ctx, seed, lighting.encodesCloudState);

  // v7.0: Visual truth phrases
  const moisture = visualTruth
    ? getMoisturePhrase(visualTruth, seed, venue?.setting)
    : getHumidityPhrase(ctx, seed);
  const thermal = visualTruth ? getThermalPhrase(visualTruth, seed) : getTempPhrase(ctx, seed);
  // v7.1: Surface grounding
  const grounding = visualTruth
    ? getSurfaceGrounding(visualTruth, ctx.tempC, moisture, thermal, seed, venue?.setting)
    : null;

  const moonPart = lighting.moonVisible
    ? lighting.moonPositionPhrase
      ? `${ctx.moonPhrase} ${lighting.moonPositionPhrase}`
      : ctx.moonPhrase
    : null;

  // v8.0.0 Chat 4: Priority-tagged parts for the 10-fragment limit.
  // Higher priority = kept. Lower priority = dropped first when over budget.
  // Priority 10 (city) → never dropped.  Priority 1 (grounding) → first to drop.
  const tagged: { value: string | null | undefined; priority: number }[] = [
    { value: city, priority: 10 },
    { value: venue?.name, priority: 9 },
    { value: lighting.fullPhrase, priority: 8 },
    { value: time, priority: 7 },
    { value: wind, priority: 6 },
    { value: moisture, priority: 5 },
    { value: thermal, priority: 4 },
    { value: moonPart, priority: 3 },
    { value: skySource, priority: 2 },
    { value: grounding, priority: 1 },
  ];

  // Filter to only non-empty values
  const live = tagged.filter((t): t is { value: string; priority: number } => !!t.value);

  // v8.0.0 Chat 7: Fragment limit driven by profile.verbosity.
  const MAX_T4_PARTS = VERBOSITY_T4_LIMIT[profile.verbosity];
  while (live.length > MAX_T4_PARTS) {
    let minIdx = 0;
    let minPri = live[0]?.priority ?? Infinity;
    for (let i = 1; i < live.length; i++) {
      const pri = live[i]?.priority ?? Infinity;
      if (pri < minPri) {
        minPri = pri;
        minIdx = i;
      }
    }
    live.splice(minIdx, 1);
  }

  const prompt = live.map((t) => t.value).join(', ');
  return quiet ? `${prompt}, no people or text visible` : prompt;
}

// ============================================================================
// HELPERS
// ============================================================================

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateWeatherPrompt(input: WeatherPromptInput): WeatherPromptResult {
  const { city, weather, localHour, tier, latitude, longitude, observedAtUtcSeconds } = input;

  // v8.0.0 Chat 7: Resolve prompt profile (fills defaults for omitted fields).
  const profile = resolveProfile(input.profile);

  // v6.2: single reference time for ALL physics (sun elevation, lunar position, moon phase,
  // and quiet-hours gating). Derived from API dt (UTC seconds) + timezoneOffset.
  const observedAtUtc =
    typeof observedAtUtcSeconds === 'number' ? new Date(observedAtUtcSeconds * 1000) : new Date();

  // Compute solar elevation if lat/lon available (lighting engine input)
  let solarElevation: number | null = null;
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    solarElevation = getSolarElevation(latitude, longitude, observedAtUtc);
  }

  // Compute lunar position if lat/lon available (night lighting v2)
  let lunarPosition: LunarPosition | null = null;
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    lunarPosition = getLunarPosition(latitude, longitude, observedAtUtc);
  }

  // v7.0: Derive visual truth BEFORE lighting — unified atmospheric assessment.
  // v8.0.0: classifyPrecip() replaces isRainy/isStormy booleans.
  // This is the fix for the biggest correctness bug: snow was not treated
  // as precipitation-active, causing "clear pristine air" during snowfall.
  const isNight = isNightTime(weather, localHour, observedAtUtc);
  const precip = classifyPrecip(weather);

  // Visual truth: cross-references ALL weather data to derive what the atmosphere LOOKS like.
  // v7.1: ALWAYS computed. Dew point needs only temp + humidity (always available).
  // cloudCover/visibility/pressure default safely to 0/10000/1015 when null inside deriveVisualTruth.
  // v7.0 BUG: guard (cloudCover != null || visibility != null) blocked visual truth for demo
  // exchanges and any live data gap, causing fallback to "in pristine clear air" + old
  // humidity/temp phrases — exactly the contradictions visual truth was built to eliminate.
  // v8.0.0: Now receives PrecipState instead of isRainy/isStormy booleans.
  const visualTruth = deriveVisualTruth(
    weather.temperatureC,
    weather.humidity,
    weather.windSpeedKmh,
    weather.cloudCover,
    weather.visibility,
    weather.pressure,
    solarElevation,
    isNight,
    precip,
  );

  // Compute lighting state ONCE — one engine, multiple skins
  // v7.0: receives visual truth for physics-correct shadow and atmosphere modifiers.
  // v7.5: venue selected BEFORE lighting so computeLighting can use venue-aware
  // light pools and urban attenuation. Same seed formula as tier generators.
  const twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000);
  const venueSeed =
    weather.temperatureC * 100 +
    weather.humidity * 10 +
    weather.windSpeedKmh +
    localHour +
    twoHourWindow;
  const venue = getCityVenue(city, venueSeed);

  const moonInfo = getMoonPhase(observedAtUtc);
  const lighting = computeLighting(
    solarElevation,
    weather.cloudCover,
    weather.visibility,
    weather.pressure,
    moonInfo.dayInCycle,
    isNight,
    lunarPosition,
    city,
    visualTruth,
    venue?.setting ?? null,
    venue?.lightCharacter ?? null,
  );

  // v7.6: Coherence validator — safety net.
  // Catches any commercial-light vocabulary that shouldn't appear at
  // non-urban venues (beach, park, elevated, monument). Swaps to
  // venue lightCharacter or setting pool and rebuilds fullPhrase if found.
  validateLightingCoherence(
    lighting,
    venue?.setting ?? null,
    city,
    moonInfo.dayInCycle,
    venue?.lightCharacter ?? null,
  );

  // v8.0.0 Chat 5→7: All tiers return WeatherPromptResult.
  // Tier 1 returns it directly (with positive/negative fields).
  // Tiers 2/3/4 return string internally; wrapped here for backward compat.
  // v8.0.0 Chat 7: Resolved profile passed to every tier.
  // v8.0.0 Chat 8: Result captured so trace can be attached.
  let result: WeatherPromptResult;

  switch (tier) {
    case 1:
      result = generateTier1(
        city,
        weather,
        localHour,
        lighting,
        observedAtUtc,
        visualTruth,
        venue,
        profile,
      );
      break;
    case 2:
      result = {
        text: generateTier2(
          city,
          weather,
          localHour,
          lighting,
          observedAtUtc,
          visualTruth,
          solarElevation,
          venue,
          profile,
        ),
        tier: 2,
      };
      break;
    case 4:
      result = {
        text: generateTier4(
          city,
          weather,
          localHour,
          lighting,
          observedAtUtc,
          visualTruth,
          venue,
          profile,
        ),
        tier: 4,
      };
      break;
    case 3:
    default:
      result = {
        text: generateTier3(
          city,
          weather,
          localHour,
          lighting,
          observedAtUtc,
          visualTruth,
          solarElevation,
          venue,
          profile,
        ),
        tier: 3,
      };
      break;
  }

  // v8.0.0 Chat 8: Prompt Trace — attach diagnostic object in debug mode.
  // Zero cost in production: the trace block is never entered.
  const debugMode = input.debug === true || process.env.NODE_ENV === 'development';
  if (debugMode) {
    const windForce = classifyWind(weather.windSpeedKmh);
    const excludedPeople = shouldExcludePeople(profile, weather, localHour, observedAtUtc);

    result.trace = {
      profile,
      precip: {
        type: precip.type,
        intensity: precip.intensity,
        active: precip.active,
        reducesVisibility: precip.reducesVisibility,
      },
      windForce,
      windSpeedKmh: weather.windSpeedKmh,
      venue: venue ? { name: venue.name, setting: venue.setting } : null,
      visualTruth: visualTruth
        ? {
            airClarity: visualTruth.airClarity,
            contrast: visualTruth.contrast,
            moistureVisibility: visualTruth.moistureVisibility,
            thermalOptics: visualTruth.thermalOptics,
            precipActive: visualTruth.precip.active,
          }
        : null,
      lighting: {
        base: lighting.base,
        fullPhrase: lighting.fullPhrase,
        shadowModifier: lighting.shadowModifier,
        atmosphereModifier: lighting.atmosphereModifier,
        moonVisible: lighting.moonVisible,
        moonPositionPhrase: lighting.moonPositionPhrase,
        nightDominant: lighting.nightDominant,
        encodesCloudState: lighting.encodesCloudState,
      },
      solarElevation,
      moon: { name: moonInfo.name, dayInCycle: moonInfo.dayInCycle, emoji: moonInfo.emoji },
      isNight,
      seed: venueSeed,
      excludedPeople,
      localHour,
      temperatureC: weather.temperatureC,
      humidity: weather.humidity,
    };
  }

  return result;
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
