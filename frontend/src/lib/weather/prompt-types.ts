// src/lib/weather/prompt-types.ts
// ============================================================================
// WEATHER PROMPT GENERATOR — SHARED TYPES & CONSTANTS
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Extracted from weather-prompt-generator.ts (4,311-line monolith)
// - All types used across multiple modules live here
// - No implementation (only interfaces, types, and simple constants)
// - Zero circular dependency risk — this module imports nothing from siblings
//
// Existing features preserved: Yes
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';

// ============================================================================
// PROMPT TIER TYPES
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
  /**
   * v9.6.0: Flux-native variant (Tier 1 only).
   * Flux uses a T5 text encoder, NOT CLIP. T5 doesn't understand
   * (token:1.3) weight syntax — it's literal garbage. This field
   * contains a clean T5-friendly prompt with no weights, no negative
   * prompt, and descriptive flowing phrases.
   * null/undefined when tier !== 1.
   */
  fluxPrompt?: string;
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
    /** v9.3.0: Secondary atmospheric layer (fog during rain, mist during snow, etc.) */
    secondaryType: string | null;
    /** v9.3.0: Raw OWM visibility in metres */
    visibilityMetres: number;
    /** v9.3.0: Two atmospheric layers co-exist */
    compound: boolean;
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
    /** v9.1.0: Correlated colour temperature in Kelvin. null at night. */
    colourTempK: number | null;
    moonVisible: boolean;
    moonPositionPhrase: string | null;
    nightDominant: string | null;
    encodesCloudState: boolean;
  };
  /** Solar elevation in degrees, null if lat/lon not provided. */
  solarElevation: number | null;
  /** v9.2.0: Camera + lens selection for this scene. */
  camera: {
    body: string;
    lensSpec: string;
    lensDescriptor: string;
  } | null;
  /** v9.4.0: Climate zone and humidity normalisation trace. */
  climate: {
    zone: string;
    effectiveHumidity: number;
    effectiveDewSpread: number;
    humidityOffset: number;
    dewSpreadScale: number;
  } | null;
  /** v9.5.0: Cloud type classification (e.g., "cumulus", "stratocumulus"). */
  cloudType: string | null;
  /** v9.5.0: Directional solar phase (e.g., "dawn-golden", "dusk-civil"). */
  solarPhase: string | null;
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
// PROMPT PROFILE
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
  /**
   * v9.6.0: Midjourney model version (Tier 2 only).
   * '5.2' = legacy multi-prompt (::) syntax.
   * '6.1' | '7' = natural language (no :: weights).
   */
  mjVersion: '5.2' | '6.1' | '7';
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
  mjVersion: '7',
  strictPhysics: false,
};

/**
 * Merge a partial profile with defaults. Every field guaranteed filled.
 * Consumers can pass `{ style: 'cinematic' }` and get everything else default.
 */
export function resolveProfile(partial?: Partial<PromptProfile> | null): PromptProfile {
  if (!partial) return { ...DEFAULT_PROMPT_PROFILE };
  return { ...DEFAULT_PROMPT_PROFILE, ...partial };
}

// ── Style-keyed quality tags (Tier 1) ──────────────────────────────────
export const STYLE_QUALITY_TAGS: Record<PromptProfile['style'], readonly string[]> = {
  photoreal: ['professional photography', 'sharp focus', 'high resolution'],
  cinematic: ['cinematic color grading', 'anamorphic lens', 'high resolution'],
  documentary: ['documentary photography', 'natural light', 'high resolution'],
};

// ── Style-keyed ending prefixes (Tier 3) ───────────────────────────────
export const STYLE_ENDING_PREFIX: Record<PromptProfile['style'], string> = {
  photoreal: 'Photorealistic',
  cinematic: 'Cinematic',
  documentary: 'Documentary',
};

// ── Verbosity-keyed fragment limits ────────────────────────────────────
export const VERBOSITY_T1_LIMIT: Record<PromptProfile['verbosity'], number> = {
  short: 12,
  standard: 15,
  rich: 18,
};
export const VERBOSITY_T4_LIMIT: Record<PromptProfile['verbosity'], number> = {
  short: 8,
  standard: 10,
  rich: 12,
};

// ============================================================================
// LIGHTING ENGINE TYPES
// ============================================================================

export type CloudState = 'none' | 'few' | 'partial' | 'mostly' | 'overcast';

/**
 * Lighting state — computed once per prompt, rendered differently per tier.
 * This is the "one engine" in "one engine, multiple skins".
 */
export interface LightingState {
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
   * Correlated colour temperature in Kelvin (CCT).
   * Standard photography scale: 2500K = golden hour, 5500K = daylight,
   * 6500K = overcast, 10000K = blue hour. null when night (urban light is mixed).
   * v9.1.0: Computed from solar elevation + cloud cover blend.
   */
  colourTempK: number | null;
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
// VISUAL TRUTH TYPES
// ============================================================================

export type AirClarity = 'crystal' | 'clear' | 'softened' | 'hazy' | 'misty' | 'foggy';
export type ContrastLevel = 'high' | 'moderate' | 'low' | 'flat';
export type MoistureVisibility =
  | 'bone-dry'
  | 'invisible'
  | 'subtle'
  | 'noticeable'
  | 'visible'
  | 'dominant';
export type ThermalOptics =
  | 'shimmer'
  | 'warm-shimmer'
  | 'heavy-tropical'
  | 'neutral'
  | 'cold-sharp'
  | 'frost'
  | 'deep-cold';

// ── Precipitation Classification (v8.0.0) ──────────────────────────────────

export type PrecipType =
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

export type PrecipIntensity = 'none' | 'light' | 'moderate' | 'heavy';

export interface PrecipState {
  /** Specific precipitation type */
  type: PrecipType;
  /** Intensity level — derived from numeric mm/h when available, else keyword */
  intensity: PrecipIntensity;
  /** True when something is physically falling (rain, snow, sleet, hail, drizzle, thunderstorm) */
  active: boolean;
  /** True for anything that impairs visibility (all active precip + fog/mist/haze/smoke/dust) */
  reducesVisibility: boolean;
  /**
   * v9.3.0: Secondary atmospheric layer present alongside primary type.
   * e.g. rain + fog, snow + mist, thunderstorm + dust.
   * null when only one atmospheric layer detected.
   *
   * Sources (priority order):
   *   1. Explicit OWM keywords ("rain and fog", "snow with mist")
   *   2. OWM visibility during falling precip (vis < 1000 → implied fog)
   *   3. Dew-point proximity during precip (spread < 1°C → fog forming)
   */
  secondaryType: PrecipType | null;
  /**
   * v9.3.0: Raw OWM visibility in metres (0–10000).
   * Passed through from weather.visibility for downstream consumers.
   * 10000 when OWM caps or when demo data.
   */
  visibilityMetres: number;
  /**
   * v9.3.0: True when two atmospheric layers co-exist.
   * Shorthand for `secondaryType !== null`.
   */
  compound: boolean;
}

export interface VisualTruth {
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
   */
  precip: PrecipState;
  /**
   * v9.4.0: Climate zone determined from latitude + conditions.
   * Used to normalise humidity thresholds (Singapore ≠ London).
   * null when latitude unavailable (falls back to cool-temperate baseline).
   */
  climateZone: string | null;
  /**
   * v9.5.0: Visual cloud type inferred from OWM description + weatherId.
   * Used by tier generators for cloud-type-specific sky phrases.
   * null when no cloud data available.
   */
  cloudType: string | null;
  /**
   * v9.5.0: Directional solar phase (dawn vs dusk distinction).
   * Combines solar elevation bands with sunrise/sunset direction.
   * null when solar elevation unavailable.
   */
  solarPhase: string | null;
}

// ============================================================================
// VENUE TYPES
// ============================================================================

export type VenueSetting =
  | 'waterfront'
  | 'beach'
  | 'street'
  | 'narrow'
  | 'market'
  | 'plaza'
  | 'park'
  | 'elevated'
  | 'monument';

export interface CityVenueData {
  name: string;
  setting: VenueSetting;
  lightCharacter?: string[];
  overrideJustification?: string;
}

export interface VenueResult {
  name: string;
  setting: VenueSetting;
  lightCharacter?: string[];
}

// ============================================================================
// WIND TYPES
// ============================================================================

export type WindForce =
  | 'calm'
  | 'breeze'
  | 'fresh'
  | 'strong'
  | 'nearGale'
  | 'gale'
  | 'strongGale'
  | 'storm';

export type ActiveWindForce = Exclude<WindForce, 'calm'>;

// ============================================================================
// WEATHER CONTEXT
// ============================================================================

export interface WeatherContext {
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
// TIER INFO CONSTANT
// ============================================================================

export const TIER_INFO: Record<PromptTier, TierInfo> = {
  1: {
    tier: 1,
    name: 'CLIP-Based',
    description: 'Weighted keywords with emphasis markers (+ Flux variant)',
    platforms: ['Stable Diffusion', 'Leonardo', 'ComfyUI', 'Flux'],
    gradient: 'from-violet-500 to-purple-600',
  },
  2: {
    tier: 2,
    name: 'Midjourney',
    description: 'Natural flow with V6/V7 parameter flags',
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
// MOON PHASE CONSTANTS (used by moon-phase.ts)
// ============================================================================

export const SYNODIC_MONTH = 29.53058770576;
export const REFERENCE_NEW_MOON_DAYS = 10957.76;
