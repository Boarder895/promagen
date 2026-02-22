// src/lib/weather/weather-prompt-generator.ts
// ============================================================================
// WEATHER PROMPT GENERATOR — ORCHESTRATOR (v10.0.0)
// ============================================================================
//
// Goals vs v9.x
// - Reduce prompt jitter when observedAtUtcSeconds is not provided (time quantisation)
// - Stronger deterministic seed based on *all* relevant weather fields
// - Post-process outputs to:
//     * remove redundant sky/atmosphere duplication (fog/haze/mist/smoke/dust)
//     * fix a few known grammar patterns (Flux "with in ...")
//     * neutralise culturally-specific leak phrases that misfire in many cities
//     * (lightly) inject composition phrasing by venue setting (short, safe)
//
// Public API and exports remain compatible with v9.x.
//
// IMPORTANT (end-to-end): For truly stable "physics-grade" prompts, pass
// observedAtUtcSeconds from OpenWeather dt (time of data calculation).
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
  LightingState,
} from './prompt-types';
import { TIER_INFO, resolveProfile } from './prompt-types';
import { classifyPrecip, deriveVisualTruth, computeDewPoint } from './visual-truth';
import { computeClimateContext } from './climate';
import { computeLighting, validateLightingCoherence } from './lighting-engine';
import { classifyWind } from './wind-system';
import { getCityVenue } from './vocabulary-loaders';
import {
  generateTier1,
  generateTier1Flux,
  generateTier2,
  generateTier3,
  generateTier4,
} from './tier-generators';
import { isNightTime, shouldExcludePeople, computeSolarPhase } from './time-utils';
import { getMoonPhase } from './moon-phase';
import { getCameraLens } from './camera-lens';
import { classifyCloudType } from './cloud-types';

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
// POST-PROCESSING: COHERENCE + LEXICAL SAFETY
// ============================================================================

/**
 * Returns true when the lens descriptor indicates a portrait or telephoto focal
 * length that contradicts "wide" framing language.
 * Standard primes (35-50mm) are borderline but acceptable with "wide" in MJ.
 */
function isTeleLens(lensDescriptor?: string): boolean {
  if (!lensDescriptor) return false;
  const d = lensDescriptor.toLowerCase();
  return (
    d.includes('portrait') ||
    d.includes('telephoto') ||
    d.includes('macro') ||
    d.includes('tele')
  );
}

function getComposition(
  setting: VenueSetting | null,
  isNight: boolean,
  lensDescriptor?: string,
): string | null {
  // Keep these short and non-contradictory (we already specify lens + camera separately).
  // v9.8.0: Lens-aware. When a portrait/tele lens is selected, "wide" framing
  // becomes contradictory. Switch to compressed/detail framing instead.
  const tele = isTeleLens(lensDescriptor);

  switch (setting) {
    case 'elevated':
      return tele ? 'compressed telephoto skyline view' : 'wide panoramic establishing shot';
    case 'beach':
      return tele
        ? (isNight ? 'telephoto seascape night shot' : 'telephoto seascape shot')
        : (isNight ? 'wide seascape night shot' : 'wide seascape shot');
    case 'waterfront':
      return tele ? 'compressed harbourfront detail' : 'wide harbourfront shot';
    case 'monument':
      return isNight ? 'low-angle architectural night shot' : 'low-angle architectural shot';
    case 'narrow':
      return 'eye-level alleyway shot';
    case 'market':
      return 'street-level documentary shot';
    case 'park':
      return tele ? 'compressed parkland detail shot' : 'wide parkland scene';
    case 'plaza':
      return tele ? 'compressed plaza detail shot' : 'wide open-square scene';
    case 'street':
    default:
      return isNight ? 'street-level night photography' : 'street-level photography';
  }
}

function removeRedundantPhenomenon(text: string, lighting: LightingState): string {
  const atm = (lighting.atmosphereModifier || '').toLowerCase();

  // Only remove the ultra-simple “X overhead.” sentence when it duplicates atmosphere.
  // This avoids deleting richer sky clauses.
  const pairs: Array<{ k: string; re: RegExp }> = [
    { k: 'haze', re: /\s+Haze overhead\.\s*/i },
    { k: 'mist', re: /\s+Mist overhead\.\s*/i },
    { k: 'fog', re: /\s+Fog overhead\.\s*/i },
    { k: 'smoke', re: /\s+Smoke overhead\.\s*/i },
    { k: 'dust', re: /\s+Dust overhead\.\s*/i },
  ];

  let out = text;
  for (const p of pairs) {
    if (atm.includes(p.k)) {
      out = out.replace(p.re, ' ');
    }
  }
  return out;
}

function neutraliseLeakPhrases(text: string): string {
  // These replacements deliberately target culturally-specific or overly-assumptive nouns
  // that can misfire across many cities/venues.
  const replacements: Array<[RegExp, string]> = [
    [/prayer flags/gi, 'entrance flags'],
    [/temple steps/gi, 'stone steps'],
    [/faint moisture on temple steps/gi, 'faint moisture on stone steps'],
    [/offering items/gi, 'loose items'],
  ];

  let out = text;
  for (const [re, rep] of replacements) {
    out = out.replace(re, rep);
  }
  return out;
}

function fixCommonGrammar(text: string): string {
  let out = text;

  // Flux variant can produce "with in atmospheric haze" when an atmosphere modifier begins with "in ...".
  out = out.replace(/\bwith in\b/gi, 'in');

  // Clean double commas / spacing.
  out = out.replace(/\s+,/g, ',');
  out = out.replace(/,\s*,/g, ', ');
  out = out.replace(/\s{2,}/g, ' ');
  return out.trim();
}

function injectCompositionIntoText(
  tier: PromptTier,
  text: string,
  composition: string | null,
): string {
  if (!composition) return text;

  // Tier 1 text has a fixed "Positive prompt:" / "Negative prompt:" structure.
  if (tier === 1) {
    // Do nothing here; Tier 1 injection is handled via positive string reconstruction.
    return text;
  }

  // Tier 2 includes params starting at "--ar". Insert composition before params.
  if (tier === 2) {
    const idx = text.indexOf(' --ar ');
    if (idx === -1) return `${text}. ${composition}`;
    const promptPart = text.slice(0, idx).trim();
    const paramsPart = text.slice(idx).trim();
    return `${promptPart}. ${composition} ${paramsPart}`.replace(/\s{2,}/g, ' ').trim();
  }

  // Tier 3 is sentence-based; add a short sentence after the opening clause.
  if (tier === 3) {
    // Insert after first sentence (up to first period).
    const firstStop = text.indexOf('.');
    if (firstStop === -1) return `${text}. ${composition}.`;
    const a = text.slice(0, firstStop + 1);
    const b = text.slice(firstStop + 1).trim();
    return `${a} ${composition}. ${b}`.replace(/\s{2,}/g, ' ').trim();
  }

  // Tier 4 is comma-separated; inject after city/venue if possible.
  if (tier === 4) {
    const firstComma = text.indexOf(',');
    if (firstComma === -1) return `${text}, ${composition}`;
    const secondComma = text.indexOf(',', firstComma + 1);
    if (secondComma === -1) return `${text}, ${composition}`;
    const head = text.slice(0, secondComma);
    const tail = text.slice(secondComma + 1).trim();
    return `${head}, ${composition}, ${tail}`.replace(/\s{2,}/g, ' ').trim();
  }

  return text;
}

function postProcessTier1Positive(positive: string, lighting: LightingState): string {
  // Remove simple duplicated sky tokens if lighting already encodes the same phenomenon.
  const atm = (lighting.atmosphereModifier || '').toLowerCase();
  const fenómenos = ['haze', 'mist', 'fog', 'smoke', 'dust'];

  let out = positive;
  for (const k of fenómenos) {
    if (atm.includes(k)) {
      // Remove both "(haze:1.1)" and plain "haze" tokens that sit as comma fragments.
      const weighted = new RegExp(`\\(\\s*${k}\\s*:\\s*1\\.1\\s*\\)\\s*,?\\s*`, 'ig');
      const plainMid = new RegExp(`,\\s*${k}\\s*,`, 'ig');
      const plainEnd = new RegExp(`,\\s*${k}\\s*$`, 'ig');
      out = out.replace(weighted, '');
      out = out.replace(plainMid, ', ');
      out = out.replace(plainEnd, '');
    }
  }

  out = out.replace(/,\s*,/g, ', ');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/,\s*$/g, '');
  return out.trim();
}

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
  const venueSeed = (sceneSeed ^ 0x9e3779b9) >>> 0;

  const venue = getCityVenue(city, venueSeed);

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

  // Dispatch to tier generator.
  let result: WeatherPromptResult;
  switch (tier) {
    case 1: {
      const t1 = generateTier1(
        city,
        weather,
        localHour,
        lighting,
        observedAtUtc,
        visualTruth,
        venue,
        profile,
      );
      t1.fluxPrompt = generateTier1Flux(
        city,
        weather,
        localHour,
        lighting,
        observedAtUtc,
        visualTruth,
        venue,
        profile,
      );
      result = t1;
      break;
    }
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

  // ── Post-process: coherence and polish ─────────────────────────────────

  // v9.8.0: Compute camera lens for composition coherence. Uses venueSeed
  // so the lens class matches what tier generators select for the same venue.
  const compositionCamera = getCameraLens(profile.style, venue?.setting ?? null, venueSeed);
  const composition = getComposition(venue?.setting ?? null, isNight, compositionCamera.lensDescriptor);

  if (result.tier === 1 && result.positive && result.negative) {
    // Post-process positive and rebuild the display text.
    let pos = result.positive;
    pos = neutraliseLeakPhrases(pos);
    pos = postProcessTier1Positive(pos, lighting);
    pos = fixCommonGrammar(pos);

    // Optional: composition token (keep subtle weight, skip for short verbosity)
    if (composition && profile.verbosity !== 'short') {
      pos = `${pos}, (${composition}:1.05)`;
    }

    let neg = result.negative;
    neg = fixCommonGrammar(neutraliseLeakPhrases(neg));

    // Flux prompt: grammar + neutralisation + optional composition (as plain phrase)
    let flux = result.fluxPrompt ?? '';
    if (flux) {
      flux = neutraliseLeakPhrases(flux);
      flux = fixCommonGrammar(flux);
      if (composition) {
        flux = `${flux}, ${composition}`.replace(/\s{2,}/g, ' ').trim();
      }
    }

    result.positive = pos;
    result.negative = neg;
    result.fluxPrompt = flux || undefined;
    result.text = `Positive prompt: ${pos}\nNegative prompt: ${neg}`;
  } else {
    let txt = result.text;
    txt = neutraliseLeakPhrases(txt);
    txt = removeRedundantPhenomenon(txt, lighting);
    txt = injectCompositionIntoText(result.tier, txt, composition);
    txt = fixCommonGrammar(txt);

    // A small extra redundancy trim for MJ prompts: remove ", haze," etc when atmosphere already encodes haze.
    if (result.tier === 2) {
      const atm = (lighting.atmosphereModifier || '').toLowerCase();
      if (atm.includes('haze')) txt = txt.replace(/,\s*haze\s*,/i, ', ');
      if (atm.includes('mist')) txt = txt.replace(/,\s*mist\s*,/i, ', ');
      if (atm.includes('fog')) txt = txt.replace(/,\s*fog\s*,/i, ', ');
      if (atm.includes('smoke')) txt = txt.replace(/,\s*smoke\s*,/i, ', ');
      if (atm.includes('dust')) txt = txt.replace(/,\s*dust\s*,/i, ', ');
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
        // Use the same venueSeed used for venue picking to keep trace deterministic.
        const cam = getCameraLens(profile.style, venue?.setting ?? null, venueSeed);
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
