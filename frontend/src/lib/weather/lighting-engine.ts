// src/lib/weather/lighting-engine.ts
// ============================================================================
// LIGHTING ENGINE v4 — Venue-Aware Night Competition + Daylight Colour Temp
// ============================================================================
//
// v9.1.0 (20 Feb 2026) — Chat 2: Daytime Lighting + Colour Temperature
// - 7 daylight bands × 4 cloud strata = 28 pool slots, 80+ phrase combos
// - Kelvin (CCT) computed from solar elevation + cloud blend
// - 3 twilight bands enriched with cloud interaction
// - computeColourTempK() exported for consumer use
// - getDaylightBase() replaces static if/else chain
//
// v9.0.0: Extracted from monolith. Night competition model preserved.
// Existing features preserved: Yes
// ============================================================================

import type { LunarPosition } from './sun-calculator';
import { pickRandom } from './prng';
import type {
  AirClarity,
  CloudState,
  LightingState,
  VisualTruth,
  VenueSetting,
} from './prompt-types';
import { AIR_CLARITY_PHRASES, getContrastShadowPhrase } from './visual-truth';
import urbanLightData from '@/data/vocabulary/weather/urban-light.json';

interface UrbanLightEntry {
  urbanLight: number;
  lightCharacter: string[];
}

// Re-export types consumers need
export type { LightingState };

// ── Urban Light Lookup ────────────────────────────────────────────────────
// Per-city static emission factor and light character from urban-light.json.
// urbanLight: 0.0–1.0 drives the competition model.
// lightCharacter: 3 phrases describing each city's unique artificial light quality.
// Falls back to meta.defaultFallback / meta.defaultLightCharacter when city not found.


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

export function getUrbanLightFactor(city: string): number {
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

export function getUrbanLightCharacter(city: string): string[] {
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
    'warm floodlighting on pale stone surfaces',
    'upward-angled spotlights on historic facades',
    'amber heritage floodlights on arches and columns',
    'golden uplighting on weathered walls',
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
export function validateLightingCoherence(
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

export function cityLightSeed(city: string, moonDayInCycle: number): number {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = hash + city.charCodeAt(i);
  }
  return ((hash * 2654435761) ^ (moonDayInCycle * 40503)) >>> 0;
}

export function getCloudStateFromCover(cloudCover: number): CloudState {
  // Deterministic bins (0–100). Keep stable — these drive dedupe logic.
  if (cloudCover <= 10) return 'none';
  if (cloudCover <= 25) return 'few';
  if (cloudCover <= 50) return 'partial';
  if (cloudCover <= 75) return 'mostly';
  return 'overcast';
}

// ── Moon brightness as numeric value (for competition maths) ──────────────
// Full/Gibbous = 1.0, Quarter = 0.5, Crescent = 0.2, New = 0.05

export function getMoonBrightnessValue(dayInCycle: number): number {
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

export function getLunarAltitudeAttenuation(lunarAltitude: number | null): number {
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

export function getLunarLightQuality(lunarAltitude: number | null): string {
  if (lunarAltitude === null) return 'silver'; // Fallback
  if (lunarAltitude < 10) return 'warm amber';
  if (lunarAltitude < 20) return 'pale amber';
  if (lunarAltitude < 35) return 'silver';
  if (lunarAltitude < 60) return 'cool white';
  return 'bright white';
}

export function getLunarShadowQuality(lunarAltitude: number | null): string {
  if (lunarAltitude === null) return 'moderate'; // Fallback
  if (lunarAltitude < 15) return 'long lateral';
  if (lunarAltitude < 35) return 'medium';
  if (lunarAltitude < 60) return 'short downward';
  return 'near-vertical';
}

// ============================================================================
// DAYLIGHT PHRASE POOLS (v9.1.0 — Chat 2)
// ============================================================================
// Each solar-elevation band has 4 cloud strata: clear (≤25%), scattered (26-50%),
// broken (51-75%), overcast (76-100%). The seed picks from the pool for variety.
// Phrases describe the LIGHT SOURCE CHARACTER only — shadow, atmosphere, and
// stability are still handled by Segments 2-4 (unchanged).
//
// Photography CCT reference (for Kelvin computation below):
//   2200-2800K  Golden hour — deep amber-gold
//   3000-4000K  Low angle — warm yellow
//   4500-5500K  Mid elevation — neutral daylight
//   5500-6000K  High angle — slightly cool white
//   5800-6500K  Near vertical — blue-white
//   6500-7500K  Overcast — cool diffused (any elevation)
//   7500-10000K Blue hour — cool blue
//   10000K+     Deep twilight — indigo-violet
// ============================================================================

interface DaylightPool {
  clear: string[];     // ≤25% cloud
  scattered: string[]; // 26-50%
  broken: string[];    // 51-75%
  overcast: string[];  // 76-100%
}

// ── Twilight Bands ──────────────────────────────────────────────────────────

const TWILIGHT_ASTRO: DaylightPool = {
  clear: [
    'astronomical twilight with faint indigo sky glow',
    'deep pre-dawn glow at the edge of night',
    'faint violet-blue horizon light under dark sky',
  ],
  scattered: [
    'astronomical twilight with thin high cloud catching faint colour',
    'deep twilight glow filtered through sparse cloud',
  ],
  broken: [
    'faint astronomical twilight muted by broken cloud',
    'deep sky glow barely visible through cloud gaps',
  ],
  overcast: [
    'near-darkness with faint overcast glow on the horizon',
    'heavy cloud absorbing the last traces of twilight',
  ],
};

const TWILIGHT_NAUTICAL: DaylightPool = {
  clear: [
    'nautical twilight with deep blue sky gradient',
    'deep blue pre-dawn light along the horizon band',
    'rich navy-to-cobalt sky glow at nautical twilight',
  ],
  scattered: [
    'nautical twilight with cloud edges catching blue-violet light',
    'deep blue twilight filtered through scattered high cloud',
  ],
  broken: [
    'muted nautical twilight diffused through broken cloud',
    'patchy deep blue light between cloud breaks at dawn',
  ],
  overcast: [
    'flat deep grey-blue light under overcast twilight sky',
    'uniform dull twilight glow through heavy cloud',
  ],
};

const TWILIGHT_CIVIL: DaylightPool = {
  clear: [
    'civil twilight with cool blue-hour light',
    'blue-hour light with warm horizon gradient',
    'soft directional blue light at civil twilight',
    'delicate blue-to-peach gradient at the horizon',
  ],
  scattered: [
    'blue-hour light with cloud edges lit warm from below',
    'cool twilight with scattered cloud catching peach tones',
    'soft blue light with warm patches on high cloud',
  ],
  broken: [
    'diffused blue-hour glow through broken cloud cover',
    'muted civil twilight with intermittent warm breaks',
  ],
  overcast: [
    'flat cool pre-dawn light through heavy overcast',
    'even grey-blue twilight glow under thick cloud',
    'uniform dull light at civil twilight under overcast',
  ],
};

// ── Golden Hour (0-6° — the critical band for photography) ──────────────────

const DAYLIGHT_GOLDEN: DaylightPool = {
  clear: [
    'golden-hour sunlight with deep amber horizontal rays',
    'rich golden light raking across surfaces at low angle',
    'warm amber-gold sunlight with long stretched shadows',
    'intense low-angle golden light with warm colour cast',
  ],
  scattered: [
    'warm golden light filtering between scattered clouds',
    'intermittent golden-hour rays with cloud-shadow patterns',
    'golden sunlight alternating with brief cool cloud shade',
  ],
  broken: [
    'muted golden glow through broken cloud cover',
    'diffused amber light with occasional direct golden shafts',
    'soft warm light at golden hour under broken sky',
  ],
  overcast: [
    'low-angle overcast daylight with no warm colour shift',
    'flat grey-white light at low sun angle through heavy cloud',
    'even cool diffused light blocking golden-hour warmth',
  ],
};

// ── Low Angle (6-15°) ───────────────────────────────────────────────────────

const DAYLIGHT_LOW: DaylightPool = {
  clear: [
    'low-angle sunlight with warm yellow cast',
    'direct warm-toned light cutting at steep lateral angle',
    'bright low sun with moderate colour warmth',
  ],
  scattered: [
    'warm low sunlight with drifting cloud shadows',
    'low-angle sun alternating with scattered cloud shade',
    'bright lateral light with moving shadow patterns',
  ],
  broken: [
    'intermittent low-angle light through broken cloud',
    'diffused warm daylight with occasional direct sun breaks',
  ],
  overcast: [
    'flat even daylight at low sun angle through overcast',
    'uniform cool-white light with sun position barely visible',
    'dull overcast daylight from low in the sky',
  ],
};

// ── Mid Elevation (15-35°) ──────────────────────────────────────────────────

const DAYLIGHT_MID: DaylightPool = {
  clear: [
    'bright mid-elevation daylight with neutral colour balance',
    'clear direct sunlight at moderate angle',
    'neutral-toned daylight with well-defined light direction',
  ],
  scattered: [
    'bright daylight with passing cumulus cloud shadows',
    'mid-angle sun with scattered cloud creating dappled shade',
    'dynamic light and shade as clouds drift past the sun',
  ],
  broken: [
    'variable daylight shifting between bright and diffused',
    'mid-elevation sun filtered through broken cloud cover',
    'alternating direct and soft light under broken sky',
  ],
  overcast: [
    'even overcast daylight with soft diffused quality',
    'flat white-grey light through complete cloud cover',
    'bright but directionless diffused overcast daylight',
  ],
};

// ── High Angle (35-60°) ─────────────────────────────────────────────────────

const DAYLIGHT_HIGH: DaylightPool = {
  clear: [
    'high-angle sunlight with well-defined downward light direction',
    'bright overhead sun with slightly cool white quality',
    'clear direct daylight from high in the sky',
  ],
  scattered: [
    'strong high-angle sun with occasional cloud dimming',
    'bright overhead daylight with sparse cumulus drifting past',
    'direct sun at high angle with scattered cloud filtering',
  ],
  broken: [
    'high sun diffused through broken cloud layer',
    'strong but intermittent overhead light through cloud gaps',
  ],
  overcast: [
    'bright diffused overhead light through overcast sky',
    'strong even white light from overhead cloud layer',
    'luminous overcast with bright uniform daylight',
  ],
};

// ── Near Vertical / Zenith (60°+) ──────────────────────────────────────────

const DAYLIGHT_ZENITH: DaylightPool = {
  clear: [
    'near-vertical overhead sunlight at steep downward angle',
    'direct downlight from near-zenith sun',
    'strong overhead tropical-angle sunlight',
  ],
  scattered: [
    'strong overhead sun with thin cloud barely filtering',
    'near-vertical sun with scattered cloud drifting across',
  ],
  broken: [
    'strong diffused zenith light through broken cloud',
    'overhead sun intermittently filtered by passing cloud',
  ],
  overcast: [
    'bright even glow from directly overhead cloud layer',
    'flat luminous overcast at peak sun elevation',
    'strong diffused white light from zenith through cloud',
  ],
};

// ── Pool Selector ───────────────────────────────────────────────────────────
// Maps solar elevation + cloud cover → phrase pool → deterministic pick.

function pickFromDaylightPool(pool: DaylightPool, cloud: number, seed: number): string {
  if (cloud <= 25) return pickRandom(pool.clear, seed);
  if (cloud <= 50) return pickRandom(pool.scattered, seed);
  if (cloud <= 75) return pickRandom(pool.broken, seed);
  return pickRandom(pool.overcast, seed);
}

/**
 * Select daylight base phrase from elevation band + cloud strata.
 * Replaces the v9.0.0 static if/else chain.
 *
 * v9.8.0: Visibility-aware. Mist/fog scatters sunlight regardless of cloud
 * cover — even under clear sky, the air itself acts as a diffuser. Without
 * this floor, low cloud + low visibility produces contradictions like
 * "intense direct daylight" + "flat even illumination" + "thin drifting mist".
 *
 * Visibility → effective cloud floor (standard meteorology thresholds):
 *   < 1000m  (fog)  → overcast pool (76+)
 *   < 3000m  (mist) → broken pool (51+)
 *   < 5000m  (haze) → scattered pool (26+)
 */
function getDaylightBase(
  solarElevation: number,
  cloud: number,
  seed: number,
  visibility?: number,
  airClarity?: AirClarity | null,
): string {
  let effectiveCloud = cloud;
  if (visibility !== undefined) {
    if (visibility < 1000) {
      effectiveCloud = Math.max(effectiveCloud, 76); // fog → overcast
    } else if (visibility < 3000) {
      effectiveCloud = Math.max(effectiveCloud, 51); // mist → broken
    } else if (visibility < 5000) {
      effectiveCloud = Math.max(effectiveCloud, 26); // haze → scattered
    }
  }

  // v10.2.0: Air clarity floor (Bug 2 fix). Humidity-derived haze/softening
  // can scatter direct sunlight even when OWM visibility is above 5000m.
  // Without this, getDaylightBase picks "intense direct" phrases from the
  // clear pool, which then contradicts the shadow modifier's "soft" phrase
  // and the atmosphere modifier's "softly diffused air".
  // The floor pushes pool selection to scattered/broken, which has phrases
  // like "warm sunlight with occasional haze dimming" — coherent with the
  // shadow and atmosphere modifiers downstream.
  //
  // Also covers OWM visibility-cap distrust: visual-truth can classify
  // airClarity as 'foggy'/'misty' when OWM reports 10000m visibility but
  // near-dew-point conditions indicate actual fog/mist formation. The
  // visibility floor above wouldn't fire (10000 > 5000), but the lighting
  // base must still reflect the reduced clarity.
  if (airClarity === 'foggy') {
    effectiveCloud = Math.max(effectiveCloud, 76); // foggy → overcast pool
  } else if (airClarity === 'misty') {
    effectiveCloud = Math.max(effectiveCloud, 51); // misty → broken pool
  } else if (airClarity === 'hazy') {
    effectiveCloud = Math.max(effectiveCloud, 51); // hazy → broken pool
  } else if (airClarity === 'softened') {
    effectiveCloud = Math.max(effectiveCloud, 26); // softened → scattered pool
  }

  if (solarElevation < -12) return pickFromDaylightPool(TWILIGHT_ASTRO, effectiveCloud, seed);
  if (solarElevation < -6)  return pickFromDaylightPool(TWILIGHT_NAUTICAL, effectiveCloud, seed);
  if (solarElevation < 0)   return pickFromDaylightPool(TWILIGHT_CIVIL, effectiveCloud, seed);
  if (solarElevation < 6)   return pickFromDaylightPool(DAYLIGHT_GOLDEN, effectiveCloud, seed);
  if (solarElevation < 15)  return pickFromDaylightPool(DAYLIGHT_LOW, effectiveCloud, seed);
  if (solarElevation < 35)  return pickFromDaylightPool(DAYLIGHT_MID, effectiveCloud, seed);
  if (solarElevation < 60)  return pickFromDaylightPool(DAYLIGHT_HIGH, effectiveCloud, seed);
  return pickFromDaylightPool(DAYLIGHT_ZENITH, effectiveCloud, seed);
}

// ── Correlated Colour Temperature (CCT) ────────────────────────────────────
// Computes Kelvin from solar elevation + cloud cover.
// Clear-sky CCT comes from atmospheric scattering physics:
//   - Low sun passes through more atmosphere → warmer (lower K).
//   - High sun → shorter path → cooler/neutral (higher K).
// Overcast sky flattens everything toward ~6500K (cloud acts as diffuser).
// Night returns null (urban light is mixed-source, no single CCT).
//
// These values match standard photography CCT charts. AI image generators
// trained on EXIF data understand these numbers natively.

// Clear-sky CCT reference (inlined in computeColourTempK for type safety):
//   astroTwilight:    12000K     goldenHour:  2500K
//   nauticalTwilight: 10000K     lowAngle:    3500K
//   civilTwilight:     8500K     midElevation: 5200K
//                                highAngle:   5600K    zenith: 5800K

const OVERCAST_KELVIN = 6500; // Standard overcast CCT (any sun position)

/**
 * Compute correlated colour temperature in Kelvin.
 * Returns null for night (urban light is mixed warm/cool, no single CCT).
 *
 * Cloud blend: thin cloud barely shifts CCT, heavy overcast flattens to 6500K.
 * Uses a quadratic blend curve — the first 50% cloud has much less effect
 * than the last 50%, matching real-world optical behaviour.
 */
export function computeColourTempK(
  solarElevation: number | null,
  cloud: number,
  isNight: boolean,
): number | null {
  if (isNight) return null;
  if (solarElevation === null) return 5500; // Demo data fallback

  // Determine clear-sky Kelvin for this elevation band (inline literals — no
  // Record<string,number> indirection which TS narrows to number|undefined).
  let clearK: number;
  if (solarElevation < -12) clearK = 12000;       // astroTwilight
  else if (solarElevation < -6) clearK = 10000;    // nauticalTwilight
  else if (solarElevation < 0) clearK = 8500;      // civilTwilight
  else if (solarElevation < 6) clearK = 2500;      // goldenHour
  else if (solarElevation < 15) clearK = 3500;     // lowAngle
  else if (solarElevation < 35) clearK = 5200;     // midElevation
  else if (solarElevation < 60) clearK = 5600;     // highAngle
  else clearK = 5800;                               // zenith

  // Quadratic blend toward overcast K. (cloud/100)^1.5 means:
  //   25% cloud → ~12% blend (barely shifts)
  //   50% cloud → ~35% blend (noticeable)
  //   75% cloud → ~65% blend (dominant)
  //  100% cloud → 100% blend (full overcast)
  const cloudFraction = Math.min(cloud, 100) / 100;
  const blendFactor = Math.pow(cloudFraction, 1.5);

  return Math.round(clearK + (OVERCAST_KELVIN - clearK) * blendFactor);
}

/**
 * Compute the full lighting state from measured data.
 * Runs ONCE per prompt. Each tier then renders this state differently.
 *
 * v6.1: Night branch uses urban vs moon competition model.
 * v7.5: Venue setting attenuates urbanFactor and selects setting-appropriate
 *        light phrases. Beach/park/elevated/monument get dedicated pools.
 * v7.7: Venue-specific lightCharacter takes highest priority when present.
 * v9.1.0: Daytime branch uses phrase pools × cloud strata + Kelvin CCT.
 * Inputs: solar elevation, cloud cover, visibility, humidity, pressure,
 *         moon phase, night flag, lunar position, city name, venue setting,
 *         venue-specific light character.
 */
export function computeLighting(
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
  } else {
    // ════════════════════════════════════════════════════════════════
    // DAYTIME + TWILIGHT — Pool-Based Phrase Selection (v9.1.0)
    // ════════════════════════════════════════════════════════════════
    // Solar elevation selects the band, cloud cover selects the stratum,
    // seed picks deterministically from the phrase pool.
    // Replaces the v9.0.0 static 9-phrase chain with 80+ combinations.
    const daylightSeed = cityLightSeed(city, moonDayInCycle);
    const airClarity = visualTruth?.airClarity ?? null;
    base = getDaylightBase(solarElevation, cloud, daylightSeed, vis, airClarity);
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
      // v10.2.0: Context-aware shadow phrase — differentiates haze-caused
      // from cloud-caused moderate contrast. Prevents "strong intensity" base
      // paired with "soft intermittent shadows" when haze is the real cause.
      shadowModifier = getContrastShadowPhrase(visualTruth.contrast, visualTruth.airClarity);
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

  // v9.1.0: Correlated colour temperature from solar elevation + cloud blend
  const colourTempK = computeColourTempK(solarElevation, cloud, isNight);

  return {
    fullPhrase,
    base,
    shadowModifier,
    atmosphereModifier,
    stabilityModifier,
    cloudState,
    encodesCloudState,
    colourTempK,
    moonPositionPhrase,
    nightDominant,
    moonVisible,
  };
}
