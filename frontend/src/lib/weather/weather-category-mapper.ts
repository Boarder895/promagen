// src/lib/weather/weather-category-mapper.ts
// ============================================================================
// WEATHER CATEGORY MAPPER — Phase B (Unified Brain)
// ============================================================================
//
// v1.0.0 (Mar 2026) — Converts computed weather intelligence into a
// WeatherCategoryMap that the unified assembler consumes.
//
// This is the BRIDGE between physics (lighting engine, visual truth, camera,
// venue, wind) and assembly (prompt-builder.ts assemblePrompt()). Each
// weather intelligence output is mapped to one of the 12 prompt builder
// categories with both a vocabulary match (selections) and a rich
// physics-computed phrase (customValues).
//
// The tier generators currently do TWO things: (1) compute phrases from
// intelligence state, and (2) assemble them into platform-specific text.
// This module handles (1). The assembler handles (2).
//
// Existing features preserved: Yes — tier generators remain untouched.
// This module is purely additive until Phase C wires it into the generator.
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';
import type {
  PromptProfile,
  LightingState,
  VisualTruth,
  VenueResult,
} from './prompt-types';
import type {
  WeatherCategoryMap,
  WeatherCategoryMeta,
  PromptCategory,
} from '@/types/prompt-builder';
import {
  getMoisturePhrase,
  getThermalPhrase,
  getSurfaceGrounding,
  composeLightingSentence,
  composeSurfaceSentence,
  getLightReflectionNoun,
} from './visual-truth';
import {
  getTempPhrase,
  getHumidityPhrase,
  getTimeDescriptor,
  getSkySourceAware,
  buildContext,
} from './vocabulary-loaders';
import { getWindPhrase } from './wind-system';
import { shouldExcludePeople } from './time-utils';
import { getUrbanLightFactor } from './lighting-engine';
import {
  getCameraLens,
  getQualityTagsT1,
  type CameraLensResult,
} from './camera-lens';
import { computeSeed, enhanceSkySource, enhanceTimeWithPhase } from './tier-generators';
import { capitalize } from './prng';
import { computeCompositionBlueprint } from './composition-blueprint';

// ============================================================================
// INPUT TYPE
// ============================================================================

/**
 * All pre-computed state from weather-prompt-generator.ts.
 * This is the same data that tier generators receive, bundled into a
 * single object for cleaner function signatures.
 */
export interface CategoryMapperInput {
  city: string;
  weather: ExchangeWeatherFull;
  hour: number;
  lighting: LightingState;
  observedAtUtc: Date;
  visualTruth: VisualTruth | null;
  solarElevation: number | null;
  venue: VenueResult | null;
  profile: PromptProfile;
}

// ============================================================================
// VOCABULARY MATCHING — Heuristic closest-term matchers
// ============================================================================

/**
 * Map profile.style to the closest vocabulary term in style.json.
 * Direct mapping — weather generator only uses 3 style values.
 */
function mapStyleVocab(profileStyle: PromptProfile['style']): string {
  switch (profileStyle) {
    case 'photoreal':
      return 'photorealistic';
    case 'cinematic':
      return 'cinematic';
    case 'documentary':
      return 'documentary';
    default:
      return 'photorealistic';
  }
}

/**
 * Map lighting colour temperature (CCT) to the closest colour vocabulary term.
 *
 * Photography CCT scale:
 *   2500K = golden hour (very warm)
 *   3200K = tungsten (warm)
 *   5500K = daylight (neutral)
 *   6500K = overcast (cool)
 *   10000K = blue hour (very cool)
 *
 * Returns null when CCT unavailable (night — mixed urban light).
 */
function mapColourFromCCT(colourTempK: number | null): string | null {
  if (colourTempK === null) return null;

  if (colourTempK <= 2800) return 'warm tones';
  if (colourTempK <= 3500) return 'warm tones';
  if (colourTempK <= 4500) return 'earth tones';
  if (colourTempK <= 5800) return 'vibrant colours';
  if (colourTempK <= 7000) return 'cool tones';
  if (colourTempK <= 9000) return 'cool tones';
  return 'muted tones'; // Extreme blue hour / twilight
}

/**
 * Map the lighting base descriptor to a vocabulary-friendly short term.
 * The lighting engine produces descriptive bases like "golden hour glow",
 * "overcast diffused light", "sodium-vapour street lighting". We extract
 * the most salient 1-3 word essence for the selections dropdown.
 */
function matchLightingVocab(base: string): string {
  const lower = base.toLowerCase();

  // Solar-based
  if (lower.includes('golden hour')) return 'golden hour';
  if (lower.includes('blue hour')) return 'blue hour';
  if (lower.includes('sunset')) return 'sunset glow';
  if (lower.includes('sunrise')) return 'sunrise light';
  if (lower.includes('dawn')) return 'dawn light';
  if (lower.includes('dusk')) return 'dusk light';

  // Moon-based
  if (lower.includes('moonlight') || lower.includes('lunar')) return 'moonlight';

  // Artificial
  if (lower.includes('neon')) return 'neon lighting';
  if (lower.includes('sodium')) return 'streetlight glow';
  if (lower.includes('fluorescent')) return 'fluorescent light';
  if (lower.includes('led')) return 'LED lighting';
  if (lower.includes('tungsten')) return 'tungsten warmth';

  // Weather-based
  if (lower.includes('overcast')) return 'overcast light';
  if (lower.includes('diffused')) return 'soft diffused light';
  if (lower.includes('storm')) return 'storm light';

  // Time-based
  if (lower.includes('midday') || lower.includes('noon')) return 'harsh midday sun';
  if (lower.includes('afternoon')) return 'afternoon light';

  // Fallback: return the base as-is (it's already a valid term)
  return base;
}

/**
 * Map weather conditions to an atmosphere vocabulary term.
 * Matches condition flags from WeatherContext to curated atmosphere phrases.
 */
function matchAtmosphereVocab(
  ctx: ReturnType<typeof buildContext>,
  visualTruth: VisualTruth | null,
): string {
  // Precipitation states
  if (ctx.isStormy) return 'thundercloud anvil drama';
  if (ctx.isRainy) return 'gentle drizzle curtain';
  if (ctx.isSnowy) return 'snow-muffled stillness';
  if (ctx.isFoggy) return 'fog rolling through urban canyon';
  if (ctx.isMisty) return 'morning mist rising from pavement';

  // Temperature extremes
  if (ctx.isHot && ctx.isHumid) return 'heavy humid tropical haze';
  if (ctx.isHot && ctx.isDry) return 'heat shimmer above asphalt';
  if (ctx.isCold && ctx.isDry) return 'crisp clear night air';
  if (ctx.isCold) return 'cold breath condensation';

  // Humidity
  if (ctx.isHumid) return 'humid summer night thickness';
  if (ctx.isDry) return 'dry desert clarity';

  // Wind
  if (ctx.isWindy) return 'wind-whipped cloud movement';

  // Dawn/dusk
  if (ctx.isDawn) return 'dew-heavy dawn freshness';
  if (ctx.isDusk) return 'calm before the storm tension';

  // Clear default
  if (visualTruth?.airClarity === 'crystal') return 'crisp clear night air';

  return 'mysterious';
}

/**
 * Derive a mood string from weather conditions for meta.mood.
 */
function deriveMood(ctx: ReturnType<typeof buildContext>): string {
  if (ctx.isStormy) return 'dramatic';
  if (ctx.isRainy) return 'melancholic';
  if (ctx.isSnowy) return 'serene';
  if (ctx.isFoggy || ctx.isMisty) return 'mysterious';
  if (ctx.isDawn) return 'hopeful';
  if (ctx.isDusk) return 'contemplative';
  if (ctx.isHot) return 'intense';
  if (ctx.isCold) return 'crisp';
  if (ctx.isWindy) return 'dynamic';
  if (ctx.isNight) return 'nocturnal';
  return 'serene';
}

/**
 * Map CameraLensResult to a vocabulary-matched camera.json option.
 *
 * Strategy: extract the primary focal length from lensSpec (e.g., "35mm f/1.4"
 * → 35) and match to the closest vocabulary term. Anamorphic lenses always
 * map to "anamorphic lens". Zoom lenses map to their vocab zoom entry.
 *
 * Returns the single best vocabulary option for the dropdown selection.
 */
function matchCameraVocab(camera: CameraLensResult): string {
  const spec = camera.lensSpec.toLowerCase();

  // Anamorphic always maps directly
  if (spec.includes('anamorphic')) return 'anamorphic lens';

  // Macro lenses
  if (spec.includes('macro')) {
    if (spec.startsWith('105')) return '105mm macro';
    if (spec.startsWith('100')) return '100mm macro';
    if (spec.startsWith('180')) return '180mm macro';
    return 'macro lens';
  }

  // Zoom lenses — match by range
  if (spec.includes('-')) {
    if (spec.startsWith('70-200')) return '70-200mm zoom';
    if (spec.startsWith('24-70')) return '24-70mm zoom';
    if (spec.startsWith('16-35') || spec.startsWith('12-24')) return '16-35mm zoom';
    if (spec.startsWith('100-400')) return '100-400mm zoom';
    if (spec.startsWith('150-600')) return '150-600mm zoom';
    return 'zoom lens versatility';
  }

  // Prime lenses — extract focal length number
  const focalMatch = spec.match(/^(\d+)mm/);
  if (focalMatch) {
    const focal = parseInt(focalMatch[1]!, 10);
    // Direct vocabulary matches (camera.json has these exact entries)
    if (focal <= 14) return '14mm ultra wide';
    if (focal <= 16) return '16mm wide angle';
    if (focal <= 20) return '20mm wide angle';
    if (focal <= 24) return '24mm lens';
    if (focal <= 28) return '28mm wide angle';
    if (focal <= 35) return '35mm lens';
    if (focal <= 40) return '40mm standard';
    if (focal <= 50) return '50mm lens';
    if (focal <= 58) return '58mm portrait';
    if (focal <= 85) return '85mm lens';
    if (focal <= 90) return '85mm lens'; // 90mm → closest vocab match
    if (focal <= 135) return '135mm lens';
    if (focal <= 200) return '200mm lens';
    if (focal <= 300) return '300mm lens';
    return '400mm lens';
  }

  // Fallback: use the descriptor from camera-lens.ts (already human-readable)
  return camera.lensDescriptor;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Convert computed weather intelligence into a WeatherCategoryMap.
 *
 * This function performs the same phrase computation as the tier generators
 * but outputs structured category data instead of platform-specific text.
 * The assembler then formats it for any platform tier.
 *
 * @param input - All pre-computed state from weather-prompt-generator
 * @returns WeatherCategoryMap with selections, customValues, and metadata
 */
export function buildWeatherCategoryMap(input: CategoryMapperInput): WeatherCategoryMap {
  const { city, weather, hour, lighting, observedAtUtc, visualTruth, venue, profile } = input;
  const solarElevation = input.solarElevation;

  // ── Shared computation (same as tier generators) ─────────────────────
  const ctx = buildContext(weather, hour, observedAtUtc);
  const seed = computeSeed(ctx, hour, observedAtUtc, city);

  const quiet = shouldExcludePeople(profile, weather, hour, observedAtUtc);
  const wind = getWindPhrase(ctx, seed, venue?.setting, visualTruth?.precip);
  const time = getTimeDescriptor(ctx, seed);
  const skySource = getSkySourceAware(ctx, seed, lighting.encodesCloudState);

  // Cloud type + solar phase enrichment (v9.5.0)
  const enrichedSky = enhanceSkySource(skySource, visualTruth, seed);
  const enrichedTime = enhanceTimeWithPhase(time, visualTruth);

  // Visual truth phrases (v7.0)
  const moisture = visualTruth
    ? getMoisturePhrase(visualTruth, seed, venue?.setting)
    : getHumidityPhrase(ctx, seed);
  const thermal = visualTruth ? getThermalPhrase(visualTruth, seed) : getTempPhrase(ctx, seed);
  const grounding = visualTruth
    ? getSurfaceGrounding(visualTruth, ctx.tempC, moisture, thermal, seed, venue?.setting)
    : null;

  // Lighting sentence (connected phrase from visual-truth.ts)
  const lightSentence = composeLightingSentence(lighting, visualTruth, seed);

  // Surface sentence (moisture + grounding + light reflection)
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
  const surfaceSentence = composeSurfaceSentence(moisture, grounding, moistureLevel, lightRef);

  // Camera + quality (v9.2.0)
  const camera = getCameraLens(profile.style, venue?.setting ?? null, seed);

  // ── Map to categories ────────────────────────────────────────────────

  const selections: Partial<Record<PromptCategory, string[]>> = {};
  const customValues: Partial<Record<PromptCategory, string>> = {};
  const weightOverrides: Partial<Record<PromptCategory, number>> = {};

  // ── Subject: city name ───────────────────────────────────────────────
  selections.subject = [city];
  weightOverrides.subject = 1.3;

  // ── Environment: venue ───────────────────────────────────────────────
  if (venue) {
    selections.environment = [venue.name];
    weightOverrides.environment = 1.2;
  }

  // ── Lighting: vocab match + rich sentence ────────────────────────────
  const lightVocab = matchLightingVocab(lighting.base);
  selections.lighting = [lightVocab];
  weightOverrides.lighting = 1.3;

  // Rich lighting sentence as customValue (physics-computed)
  if (lightSentence) {
    // Build the full lighting description: sentence + sky + moon
    const skyClause = enrichedSky ? ` ${capitalize(enrichedSky)} overhead.` : '';
    let moonClause = '';
    if (lighting.moonVisible) {
      moonClause = lighting.moonPositionPhrase
        ? ` A ${ctx.moonPhrase} ${lighting.moonPositionPhrase}.`
        : ` Under a ${ctx.moonPhrase}.`;
    }
    customValues.lighting = `${capitalize(lightSentence)}.${skyClause}${moonClause}`.trim();
  }

  // ── Atmosphere: vocab match + enriched conditions ────────────────────
  const atmosVocab = matchAtmosphereVocab(ctx, visualTruth);
  selections.atmosphere = [atmosVocab];

  // Rich atmosphere: combine enriched time + moisture + thermal
  const atmosParts = [enrichedTime, moisture, thermal].filter(Boolean);
  if (atmosParts.length > 0) {
    customValues.atmosphere = atmosParts.join(', ');
  }

  // ── Style: map from profile ──────────────────────────────────────────
  const styleVocab = mapStyleVocab(profile.style);
  selections.style = [styleVocab];

  // ── Colour: derive from CCT ──────────────────────────────────────────
  const colourVocab = mapColourFromCCT(lighting.colourTempK);
  if (colourVocab) {
    selections.colour = [colourVocab];
  }

  // ── Fidelity: quality tags from camera system ────────────────────────
  const qualityTags = getQualityTagsT1(camera, profile.style);
  if (qualityTags.length > 0) {
    selections.fidelity = qualityTags;
  }

  // ── Materials: surface sentence (physics-computed) ───────────────────
  if (surfaceSentence) {
    customValues.materials = surfaceSentence;
  }

  // ── Action: wind phrase (scene motion) ───────────────────────────────
  const windSpeed = Math.round(ctx.windKmh);
  if (wind && windSpeed >= 6) {
    customValues.action = capitalize(wind);
  }

  // ── Camera: vocab selection + rich lens descriptor ────────────────────
  selections.camera = [matchCameraVocab(camera)];
  const cameraDesc = buildCameraDescription(camera, profile);
  if (cameraDesc) {
    customValues.camera = cameraDesc;
  }

  // ── Composition: scene blueprint (Extra 5) ──────────────────────────
  // This is the ONLY category that was never weather-populated until now.
  // The blueprint analyses foreground/midground/background layers from
  // already-populated categories, infers DoF from the camera lens, and
  // produces both a vocabulary-matched selection and a rich phrase.
  // NOTE: isNight already declared above (Surface sentence block).
  const blueprint = computeCompositionBlueprint({
    categoryMap: { selections, customValues, negative: [], meta: {} as WeatherCategoryMeta },
    camera,
    venueSetting: venue?.setting ?? null,
    isNight,
  });

  selections.composition = [blueprint.compositionSelection];
  customValues.composition = blueprint.compositionText;
  weightOverrides.composition = 1.05; // subtle, same as existing getComposition()

  // ── Negative: quiet-hours logic ──────────────────────────────────────
  const negative = buildNegativeTerms(quiet);

  // ── Confidence scores (Extra 2) ────────────────────────────────────
  const confidence = computeConfidence({
    hasVisualTruth: visualTruth !== null,
    hasVenue: venue !== null,
    hasCCT: lighting.colourTempK !== null,
    hasSurface: !!surfaceSentence,
    hasWind: wind !== null && windSpeed >= 6,
    hasLightSentence: !!lightSentence,
    hasSky: !!enrichedSky,
    hasComposition: blueprint.confidence > 0.5,
  });

  // ── Metadata ─────────────────────────────────────────────────────────
  const mood = deriveMood(ctx);

  const meta: WeatherCategoryMeta = {
    city,
    venue: venue?.name ?? city,
    venueSetting: venue?.setting ?? 'street',
    mood,
    conditions: weather.description || weather.conditions || '',
    emoji: ctx.emoji,
    tempC: weather.temperatureC,
    localTime: `${String(hour).padStart(2, '0')}:00`,
    source: 'weather-intelligence',
  };

  return {
    selections,
    customValues,
    negative,
    weightOverrides,
    confidence,
    meta,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Input flags for confidence scoring — derived from available data quality.
 */
interface ConfidenceInput {
  hasVisualTruth: boolean;
  hasVenue: boolean;
  hasCCT: boolean;
  hasSurface: boolean;
  hasWind: boolean;
  hasLightSentence: boolean;
  hasSky: boolean;
  hasComposition: boolean;
}

/**
 * Compute per-category confidence scores (0–1).
 *
 * Confidence reflects how much real data backs each category:
 *   1.0 = direct from API data (city name, venue name)
 *   0.9 = physics-computed with visual truth engine
 *   0.7 = heuristic mapping (profile → style vocab)
 *   0.5 = generic fallback (conditions → atmosphere guess)
 *   0.0 = category not populated
 *
 * The UI uses this to control chip opacity (dim = low confidence → invite editing)
 * and the assembler can prefer customValue (high) vs selection-only (low).
 */
function computeConfidence(
  flags: ConfidenceInput,
): Partial<Record<PromptCategory, number>> {
  const conf: Partial<Record<PromptCategory, number>> = {};

  // Subject: city name always comes from the API — 1.0
  conf.subject = 1.0;

  // Environment: venue selected by deterministic algorithm — high if found
  conf.environment = flags.hasVenue ? 0.95 : 0;

  // Lighting: visual truth gives physics accuracy; without it, base phrase only
  conf.lighting = flags.hasVisualTruth
    ? flags.hasLightSentence ? 0.95 : 0.85
    : 0.6;

  // Atmosphere: visual truth drives precise atmospheric assessment;
  // without it, we fall back to condition flag heuristics
  conf.atmosphere = flags.hasVisualTruth ? 0.85 : 0.5;

  // Style: always a direct map from profile (not weather-driven)
  conf.style = 0.7;

  // Colour: CCT gives precise colour temperature data; null at night
  conf.colour = flags.hasCCT ? 0.85 : 0;

  // Fidelity: camera system is deterministic but style-dependent
  conf.fidelity = 0.8;

  // Materials: surface sentence requires grounding + moisture + light ref
  conf.materials = flags.hasSurface ? 0.9 : 0;

  // Action: wind phrase is physics-based when wind speed meets threshold
  conf.action = flags.hasWind ? 0.85 : 0;

  // Camera: deterministic camera selection — always reliable
  conf.camera = 0.9;

  // Composition: blueprint derived from camera lens + venue + existing layers
  conf.composition = flags.hasComposition ? 0.85 : 0.5;

  // Negative: rule-based, always complete
  conf.negative = 1.0;

  return conf;
}

/**
 * Build a human-readable camera description from the camera lens result.
 * Uses the full camera spec for rich description.
 */
function buildCameraDescription(camera: CameraLensResult, _profile: PromptProfile): string {
  if (!camera.full) return '';
  return `Shot on ${camera.full}`;
}

/**
 * Build negative terms array from quiet-hours state.
 * These are used by all platforms (formatted differently per tier by the assembler).
 */
function buildNegativeTerms(quiet: boolean): string[] {
  // Standard anti-tokens (always present)
  const terms = ['blurry', 'watermarks', 'text', 'oversaturated'];

  if (quiet) {
    // Quiet hours: exclude people
    terms.unshift('people', 'crowds', 'pedestrians');
  }

  return terms;
}

// ============================================================================
// EXPORTS — CategoryMapperInput already exported at definition (line 70)
// ============================================================================
