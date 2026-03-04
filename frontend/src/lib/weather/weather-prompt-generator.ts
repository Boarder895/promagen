// src/lib/weather/weather-prompt-generator.ts
// ============================================================================
// WEATHER PROMPT GENERATOR — ORCHESTRATOR (v11.0.0)
// ============================================================================
//
// v11.0.0 (Mar 2026) — Phase E: Tier Generator Retirement
// - Unified brain is now the ONLY prompt path (no feature flag)
// - Deleted legacy tier generator dispatch + A/B comparison logger
// - Removed getComposition() + injectCompositionIntoText() (assembler handles it)
// - weather-brain-comparison.ts deleted (transitional A/B tool)
// - ~200 lines of dual-path plumbing removed
//
// v10.3.0 — Phase C: Unified Brain with feature flag
// v10.1.0 — Composition coherence + camera lens determinism
// v10.0.0 — Reduce prompt jitter, stronger deterministic seed, post-processing
//
// Public API and exports remain compatible with v9.x.
// ============================================================================

// ── Re-export public types for all consumers ────────────────────────────────
export type {
  PromptTier,
  TierInfo,
  WeatherPromptInput,
  WeatherPromptResult,
  PromptTrace,
  PromptProfile,
} from './prompt-types';

export { TIER_INFO, DEFAULT_PROMPT_PROFILE } from './prompt-types';

export type { MoonPhaseInfo } from './moon-phase';
export { getMoonPhase } from './moon-phase';

// ── Re-export legacy helpers for commodity-prompt-generator ─────────────────
export {
  getTempFeel,
  getHumidityTexture,
  getWindEnergy,
  getTimeMood,
  getConditionVisual,
} from './vocabulary-loaders';

// ── Internal imports for orchestration ──────────────────────────────────────
import type { LunarPosition } from './sun-calculator';
import { getSolarElevation, getLunarPosition } from './sun-calculator';
import { hashString } from './prng';
import type {
  PromptTier,
  WeatherPromptInput,
  WeatherPromptResult,
  VenueSetting,
  VenueResult,
} from './prompt-types';
import { TIER_INFO, resolveProfile } from './prompt-types';
import { classifyPrecip, deriveVisualTruth, computeDewPoint } from './visual-truth';
import { computeClimateContext } from './climate';
import { computeLighting, validateLightingCoherence } from './lighting-engine';
import { classifyWind } from './wind-system';
import { getCityVenue, buildContext } from './vocabulary-loaders';
import { computeSeed as computeTierSeed } from './tier-generators';
import { isNightTime, shouldExcludePeople, computeSolarPhase } from './time-utils';
import { getMoonPhase } from './moon-phase';
import { getCameraLens } from './camera-lens';
import { classifyCloudType } from './cloud-types';
import { buildWeatherCategoryMap } from './weather-category-mapper';
import type { WeatherCategoryMap } from './prompt-types';
import { assemblePrompt, selectionsFromMap, tierToRefPlatform } from '@/lib/prompt-builder';
import { hashCategoryMap } from '@/lib/prompt-dna';
import { rewriteWithSynergy } from './synergy-rewriter';
import {
  neutraliseLeakPhrases,
  fixCommonGrammar,
  postProcessTier1Positive,
  removeRedundantPhenomenon,
  trimMjPhenomenonDuplicates,
} from '@/lib/prompt-post-process';

// ============================================================================
// TIME + SEED HELPERS
// ============================================================================

const DEFAULT_TIME_QUANT_MS = 10 * 60 * 1000; // 10 minutes (matches common weather update cadence)

/** Quantise a Date down to a fixed bucket to reduce "jitter" when using now(). */
function quantiseTime(d: Date, bucketMs: number): Date {
  const t = d.getTime();
  return new Date(Math.floor(t / bucketMs) * bucketMs);
}

/**
 * Resolve the reference UTC timestamp used for all physics and seeding.
 * - If observedAtUtcSeconds provided: use it exactly (best case).
 * - Else: use quantised "now" to prevent rapid prompt drift.
 */
function resolveObservedAtUtc(observedAtUtcSeconds?: number | null): Date {
  if (typeof observedAtUtcSeconds === 'number' && Number.isFinite(observedAtUtcSeconds)) {
    return new Date(observedAtUtcSeconds * 1000);
  }
  return quantiseTime(new Date(), DEFAULT_TIME_QUANT_MS);
}

/** FNV-1a 32-bit hash for stable, well-dispersed deterministic seeds. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Normalise numeric fields into stable string tokens for hashing. */
function nToken(n: number | null | undefined, digits = 0, fallback = 'na'): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  const factor = Math.pow(10, Math.max(0, Math.min(4, digits)));
  return String(Math.round(n * factor) / factor);
}

/**
 * Scene seed includes *all* weather fields that affect visuals.
 * This improves "sensitivity": small but meaningful changes can rotate phrase picks.
 */
function computeSceneSeed(input: WeatherPromptInput, observedAtUtc: Date): number {
  const w = input.weather;

  // Bucket time for variety without thrash.
  // If observedAtUtcSeconds is passed, this bucket is anchored to the observation time.
  const twoHourBucket = Math.floor(observedAtUtc.getTime() / 7_200_000);

  const key = [
    'v10',
    input.city.toLowerCase().trim(),
    `tier=${input.tier}`,
    `h=${input.localHour}`,
    `t2h=${twoHourBucket}`,
    `lat=${nToken(input.latitude, 2)}`,
    `lon=${nToken(input.longitude, 2)}`,

    // Core weather
    `tempC=${nToken(w.temperatureC, 1)}`,
    `hum=${nToken(w.humidity, 0)}`,
    `wind=${nToken(w.windSpeedKmh, 0)}`,
    `gust=${nToken(w.windGustKmh, 0)}`,
    `wdeg=${nToken(w.windDegrees, 0)}`,

    // Atmosphere/sky
    `cloud=${nToken(w.cloudCover, 0)}`,
    `vis=${nToken(w.visibility, 0)}`,
    `pres=${nToken(w.pressure, 0)}`,

    // Precip volumes (when present)
    `rain1h=${nToken(w.rainMm1h, 2)}`,
    `snow1h=${nToken(w.snowMm1h, 2)}`,

    // IDs/strings
    `wid=${nToken(w.weatherId, 0)}`,
    `cond=${(w.conditions || '').toLowerCase().trim()}`,
    `desc=${(w.description || '').toLowerCase().trim()}`,

    // Day/night inputs
    `sunrise=${nToken(w.sunriseUtc, 0)}`,
    `sunset=${nToken(w.sunsetUtc, 0)}`,
    `tzoff=${nToken(w.timezoneOffset, 0)}`,
    `isDay=${String(w.isDayTime)}`,
  ].join('|');

  // Mix in the old city hash too (keeps continuity with prior dispersion behaviour).
  return (fnv1a32(key) ^ hashString(input.city)) >>> 0;
}

// ============================================================================
// POST-PROCESSING: Imported from @/lib/prompt-post-process.ts
// Functions: neutraliseLeakPhrases, fixCommonGrammar, postProcessTier1Positive,
//            removeRedundantPhenomenon, trimMjPhenomenonDuplicates
// ============================================================================

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export function generateWeatherPrompt(input: WeatherPromptInput): WeatherPromptResult {
  const { city, weather, localHour, tier, latitude, longitude } = input;

  // Resolve profile (fills defaults for omitted fields).
  const profile = resolveProfile(input.profile);

  // Resolve single reference time for all physics.
  const observedAtUtc = resolveObservedAtUtc(input.observedAtUtcSeconds);

  // Compute solar elevation and lunar position if lat/lon available.
  let solarElevation: number | null = null;
  let lunarPosition: LunarPosition | null = null;

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    solarElevation = getSolarElevation(latitude, longitude, observedAtUtc);
    lunarPosition = getLunarPosition(latitude, longitude, observedAtUtc);
  }

  // Precip + night detection.
  const isNight = isNightTime(weather, localHour, observedAtUtc);
  const precip = classifyPrecip(weather);

  // Unified atmospheric assessment.
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
    latitude,
  );

  // Cloud type + solar phase enrichment.
  const cloudType = classifyCloudType(
    weather.description,
    weather.conditions,
    weather.cloudCover,
    weather.weatherId,
    weather.temperatureC,
    precip.active,
  );
  visualTruth.cloudType = cloudType;

  const solarPhase = computeSolarPhase(solarElevation, weather, localHour, observedAtUtc);
  visualTruth.solarPhase = solarPhase;

  // Stronger deterministic seed for venue and post-processing.
  const sceneSeed = computeSceneSeed(input, observedAtUtc);

  // v10.3.0 Phase C (Extra 2): Venue seed forwarding.
  // When the route passes venueSeed, use it directly so the route and generator
  // agree on which venue to display. Eliminates the desync bug where the
  // homepage label says "Museum District" but the prompt describes "Discovery Green".
  const venueSeed =
    typeof input.venueSeed === 'number'
      ? input.venueSeed >>> 0 // unsigned 32-bit
      : (sceneSeed ^ 0x9e3779b9) >>> 0;

  // v11.1.0 Upgrade 4 — Venue Singularity: when the route provides a direct
  // venue override, use it exactly. No getCityVenue() call, no seed mismatch.
  // The route knows which venue it wants — trust it.
  let venue: VenueResult | null;
  if (input.venueOverride) {
    venue = {
      name: input.venueOverride.name,
      setting: input.venueOverride.setting as VenueSetting,
    };
  } else {
    venue = getCityVenue(city, venueSeed);
  }

  // Moon + lighting.
  // v9.8.0: Precipitation-aware cloud floor.
  // OWM occasionally reports low cloudiness during active rain/drizzle (data
  // inconsistency). This produces physics-contradictory prompts like
  // "bright overhead sun" during "moderate rain". Force a minimum cloud cover
  // when wet precipitation is active so the lighting engine selects appropriate
  // overcast/broken pools instead of clear-sky pools.
  let effectiveCloud = weather.cloudCover ?? 0;
  if (precip.active) {
    if (precip.type === 'rain' || precip.type === 'drizzle' || precip.type === 'sleet') {
      // Rain/drizzle requires at minimum broken cloud (60%)
      // Heavy rain forces full overcast (90%)
      const precipFloor =
        precip.intensity === 'heavy' ? 90 : precip.intensity === 'moderate' ? 75 : 60;
      effectiveCloud = Math.max(effectiveCloud, precipFloor);
    } else if (precip.type === 'snow') {
      // Snow requires at minimum scattered cloud (40%)
      effectiveCloud = Math.max(effectiveCloud, 40);
    }
    // Mist/fog: leave cloud as-is — fog can occur with any cloud cover
  }

  const moonInfo = getMoonPhase(observedAtUtc);
  const lighting = computeLighting(
    solarElevation,
    effectiveCloud,
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

  // Coherence validator — safety net.
  validateLightingCoherence(
    lighting,
    venue?.setting ?? null,
    city,
    moonInfo.dayInCycle,
    venue?.lightCharacter ?? null,
  );

  // ── Phase C (Unified Brain): Build category map ────────────────────────
  // Always computed — consumers (route, showcase, builder) use it.
  const categoryMap: WeatherCategoryMap = buildWeatherCategoryMap({
    city,
    weather,
    hour: localHour,
    lighting,
    observedAtUtc,
    visualTruth,
    solarElevation,
    venue,
    profile,
  });

  // ── Unified brain: assemblePrompt() produces text from category map ──────
  const refPlatform = tierToRefPlatform(tier as 1 | 2 | 3 | 4);
  const rawSelections = selectionsFromMap(categoryMap);

  // Extra 6: Synergy-aware rewriting — resolve conflicts, boost reinforcements
  const rewritten = rewriteWithSynergy(rawSelections, categoryMap.customValues);
  const selections = rewritten.selections;

  const assembled = assemblePrompt(refPlatform, selections, categoryMap.weightOverrides);

  const result: WeatherPromptResult = {
    text: assembled.positive,
    tier,
  };

  // Tier 1: separate positive/negative + Flux variant
  if (tier === 1) {
    result.positive = assembled.positive;
    result.negative = assembled.negative ?? categoryMap.negative.join(', ');

    // Flux: assemble with Tier 3 reference (T5 = natural language, no weights)
    const fluxAssembled = assemblePrompt('flux', selections);
    result.fluxPrompt = fluxAssembled.positive || undefined;

    result.text = `Positive prompt: ${result.positive}\nNegative prompt: ${result.negative}`;
  }

  // Always attach the category map to the result.
  result.categoryMap = categoryMap;

  // Upgrade 5 — Prompt Fingerprint Verification:
  // Hash the categoryMap content so the builder can verify symmetry.
  result.categoryMapHash = hashCategoryMap(categoryMap);

  // ── Post-process: coherence and polish ─────────────────────────────────
  // v11.0.0: Composition injection removed — assembler already includes it.
  // Camera lens is still computed for the trace diagnostic below.
  const tierCtx = buildContext(weather, localHour, observedAtUtc);
  const tierSeed = computeTierSeed(tierCtx, localHour, observedAtUtc, city);

  if (result.tier === 1 && result.positive && result.negative) {
    // Post-process positive and rebuild the display text.
    let pos = result.positive;
    pos = neutraliseLeakPhrases(pos);
    pos = postProcessTier1Positive(pos, lighting.atmosphereModifier ?? '');
    pos = fixCommonGrammar(pos);

    let neg = result.negative;
    neg = fixCommonGrammar(neutraliseLeakPhrases(neg));

    // Flux prompt: grammar + neutralisation
    let flux = result.fluxPrompt ?? '';
    if (flux) {
      flux = neutraliseLeakPhrases(flux);
      flux = fixCommonGrammar(flux);
    }

    result.positive = pos;
    result.negative = neg;
    result.fluxPrompt = flux || undefined;
    result.text = `Positive prompt: ${pos}\nNegative prompt: ${neg}`;
  } else {
    let txt = result.text;
    txt = neutraliseLeakPhrases(txt);
    txt = removeRedundantPhenomenon(txt, lighting.atmosphereModifier ?? '');
    txt = fixCommonGrammar(txt);

    // A small extra redundancy trim for MJ prompts: remove ", haze," etc when atmosphere already encodes haze.
    if (result.tier === 2) {
      txt = trimMjPhenomenonDuplicates(txt, lighting.atmosphereModifier ?? '');
      txt = fixCommonGrammar(txt);
    }

    result.text = txt;
  }

  // ── Prompt Trace — attach diagnostic object in debug mode ────────────────
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
        secondaryType: precip.secondaryType,
        visibilityMetres: precip.visibilityMetres,
        compound: precip.compound,
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
        colourTempK: lighting.colourTempK,
        moonVisible: lighting.moonVisible,
        moonPositionPhrase: lighting.moonPositionPhrase,
        nightDominant: lighting.nightDominant,
        encodesCloudState: lighting.encodesCloudState,
      },
      solarElevation,
      camera: (() => {
        // v10.2.0: Use tierSeed (same as the seed used for composition and prompt camera)
        // to keep trace deterministic AND matching the actual camera in the output.
        const cam = getCameraLens(profile.style, venue?.setting ?? null, tierSeed);
        return { body: cam.body, lensSpec: cam.lensSpec, lensDescriptor: cam.lensDescriptor };
      })(),
      climate: (() => {
        const dp = computeDewPoint(weather.temperatureC, weather.humidity);
        const ds = weather.temperatureC - dp;
        const ctx = computeClimateContext(
          latitude ?? null,
          weather.temperatureC,
          weather.humidity,
          ds,
        );
        return {
          zone: ctx.zone,
          effectiveHumidity: Math.round(ctx.effectiveHumidity * 10) / 10,
          effectiveDewSpread: Math.round(ctx.effectiveDewSpread * 10) / 10,
          humidityOffset: ctx.humidityOffset,
          dewSpreadScale: ctx.dewSpreadScale,
        };
      })(),
      cloudType,
      solarPhase,
      moon: { name: moonInfo.name, dayInCycle: moonInfo.dayInCycle, emoji: moonInfo.emoji },
      isNight,
      seed: sceneSeed,
      excludedPeople,
      localHour,
      temperatureC: weather.temperatureC,
      humidity: weather.humidity,
    };
  }

  return result;
}

// ============================================================================
// PUBLIC HELPERS (unchanged API)
// ============================================================================

export function getDefaultTier(): PromptTier {
  return 3;
}

export function getTierInfo(tier: PromptTier): (typeof TIER_INFO)[PromptTier] {
  return TIER_INFO[tier];
}

export function getAllTierOptions(): (typeof TIER_INFO)[PromptTier][] {
  return [TIER_INFO[1], TIER_INFO[2], TIER_INFO[3], TIER_INFO[4]];
}
