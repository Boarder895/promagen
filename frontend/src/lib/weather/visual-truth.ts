// src/lib/weather/visual-truth.ts
// ============================================================================
// VISUAL TRUTH ENGINE — Unified Atmospheric Assessment
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Extracted from weather-prompt-generator.ts (4,311-line monolith)
// - Contains: VisualTruth derivation, precipitation classifier, dew point,
//   all phrase pools, phrase selectors, surface grounding, connectors
//
// v7.0 origin: Cross-references ALL weather data to derive what the atmosphere
// LOOKS like. Computed ONCE per prompt. Every layer reads from this shared truth.
// Eliminates physics conflicts (e.g. "sharp shadows" + "saturated air").
//
// Existing features preserved: Yes
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';
import { pickRandom, capitalize } from './prng';
import { computeClimateContext } from './climate';
import type {
  AirClarity,
  ContrastLevel,
  MoistureVisibility,
  ThermalOptics,
  PrecipType,
  PrecipIntensity,
  PrecipState,
  VisualTruth,
  VenueSetting,
  LightingState,
} from './prompt-types';

// Re-export types that consumers need
export type {
  AirClarity,
  ContrastLevel,
  MoistureVisibility,
  ThermalOptics,
  PrecipType,
  PrecipIntensity,
  PrecipState,
  VisualTruth,
};

// ── Dew Point Calculation (Magnus formula) ──────────────────────────────────
// Standard Magnus coefficients: a = 17.27, b = 237.7°C
// Accuracy: ±0.4°C for -40°C to 50°C range.

export function computeDewPoint(tempC: number, humidity: number): number {
  const clampedHumidity = Math.max(1, Math.min(100, humidity)); // Avoid log(0)
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(clampedHumidity / 100);
  return (b * alpha) / (a - alpha);
}

// ── Precipitation Classifier (v9.3.0) ──────────────────────────────────────
// Replaces the old isRainy/isStormy booleans with a proper multi-type classifier.
//
// v9.3.0: COMPOUND DETECTION — real weather has layered atmospheric conditions.
// OWM often sends "light rain" with visibility=800m. That 800m MEANS fog is
// present, but the old single-type classifier only saw "rain" and the fog
// layer vanished from the prompt.
//
// Detection priority (primary type):
//   1. Numeric rain.1h / snow.1h (most trustworthy — OWM measures these)
//   2. Keyword inference from conditions/description (always available)
//
// Detection priority (secondary/compound layer):
//   1. Explicit keywords: "rain and fog", "snow with mist" in OWM description
//   2. OWM visibility during falling precip: vis < 1000 → implied fog, < 3000 → mist
//   3. Dew-point proximity during falling precip: spread < 1°C → fog forming
//
// KEY FIX: Snow, sleet, hail correctly classified as active precipitation.

export function classifyPrecip(weather: ExchangeWeatherFull): PrecipState {
  const desc = (weather.description || '').toLowerCase();
  const cond = (weather.conditions || '').toLowerCase();
  const rain = weather.rainMm1h ?? null;
  const snow = weather.snowMm1h ?? null;
  const vis = weather.visibility ?? 10000;

  // Helper: keyword presence in description OR conditions
  const has = (k: string) => desc.includes(k) || cond.includes(k);

  // ── Step 1: Identify primary type ─────────────────────────────────────

  // Priority 1: Numeric measurement (when OWM provides rain.1h / snow.1h)
  let primary: { type: PrecipType; intensity: PrecipIntensity; active: boolean } | null = null;

  if (snow !== null && snow > 0) {
    const intensity: PrecipIntensity = snow >= 2 ? 'heavy' : snow >= 0.5 ? 'moderate' : 'light';
    primary = { type: 'snow', intensity, active: true };
  } else if (rain !== null && rain > 0) {
    const intensity: PrecipIntensity = rain >= 6 ? 'heavy' : rain >= 2 ? 'moderate' : 'light';
    primary = { type: 'rain', intensity, active: true };
  }

  // Priority 2: Keyword inference (if numeric didn't match)
  if (!primary) {
    if (has('thunder')) primary = { type: 'thunderstorm', intensity: 'moderate', active: true };
    else if (has('hail')) primary = { type: 'hail', intensity: 'moderate', active: true };
    else if (has('sleet')) primary = { type: 'sleet', intensity: 'light', active: true };
    else if (has('snow')) primary = { type: 'snow', intensity: 'light', active: true };
    else if (has('drizzle')) primary = { type: 'drizzle', intensity: 'light', active: true };
    else if (has('rain')) primary = { type: 'rain', intensity: 'light', active: true };
    // Visibility phenomena (not falling)
    else if (has('fog')) primary = { type: 'fog', intensity: 'moderate', active: false };
    else if (has('mist')) primary = { type: 'mist', intensity: 'light', active: false };
    else if (has('haze')) primary = { type: 'haze', intensity: 'light', active: false };
    else if (has('smoke')) primary = { type: 'smoke', intensity: 'moderate', active: false };
    else if (has('dust') || has('sand'))
      primary = { type: 'dust', intensity: 'moderate', active: false };
  }

  // No weather detected at all
  if (!primary) {
    return {
      type: 'none',
      intensity: 'none',
      active: false,
      reducesVisibility: false,
      secondaryType: null,
      visibilityMetres: vis,
      compound: false,
    };
  }

  // ── Step 2: Detect secondary atmospheric layer ────────────────────────
  // Only meaningful when primary is FALLING precipitation. Fog or mist as
  // primary don't get a "secondary" — they ARE the atmospheric layer.
  let secondaryType: PrecipType | null = null;

  if (primary.active) {
    // Source 1: Explicit OWM keywords for visibility phenomena
    // OWM sometimes sends compound like "light rain and fog"
    if (has('fog') && primary.type !== 'fog') {
      secondaryType = 'fog';
    } else if (has('mist') && primary.type !== 'mist') {
      secondaryType = 'mist';
    } else if (has('haze') && primary.type !== 'haze') {
      secondaryType = 'haze';
    } else if (has('smoke') && primary.type !== 'smoke') {
      secondaryType = 'smoke';
    } else if ((has('dust') || has('sand')) && primary.type !== 'dust') {
      secondaryType = 'dust';
    }

    // Source 2: OWM visibility implies fog/mist even when not explicit
    // OWM caps vis at 10000m. Low vis during falling precip = atmospheric layer.
    if (!secondaryType) {
      if (vis < 1000) {
        // Below 1km during active precip → fog layer present
        secondaryType = 'fog';
      } else if (vis < 3000) {
        // 1–3km during active precip → mist layer present
        secondaryType = 'mist';
      } else if (vis < 5000) {
        // 3–5km during active precip → haze layer present
        secondaryType = 'haze';
      }
    }

    // Source 3: Dew-point proximity during precip → fog/mist forming
    // Even if OWM reports vis=10000, near-dew-point + calm wind = fog
    if (!secondaryType) {
      const dewPoint = computeDewPoint(weather.temperatureC, weather.humidity);
      const dewSpread = weather.temperatureC - dewPoint;
      if (dewSpread < 1 && weather.windSpeedKmh < 10) {
        secondaryType = 'fog';
      } else if (dewSpread < 1 && weather.windSpeedKmh < 15) {
        secondaryType = 'mist';
      }
    }
  }

  const compound = secondaryType !== null;

  return {
    type: primary.type,
    intensity: primary.intensity,
    active: primary.active,
    reducesVisibility: true, // Any detected weather reduces visibility
    secondaryType,
    visibilityMetres: vis,
    compound,
  };
}

// ── Derive Visual Truth ─────────────────────────────────────────────────────
// Reads ALL weather data together. Returns the unified atmospheric state.
// When data is missing (null), falls back to conservative assumptions.

export function deriveVisualTruth(
  tempC: number,
  humidity: number,
  windKmh: number,
  cloudCover: number | null,
  visibility: number | null,
  pressure: number | null,
  solarElevation: number | null,
  isNight: boolean,
  precip: PrecipState,
  latitude?: number | null,
): VisualTruth {
  const cloud = cloudCover ?? 0;
  const vis = visibility ?? 10000;
  const _pres = pressure ?? 1015; // Reserved for future barometric haze model

  // ── Dew point spread ──────────────────────────────────────────
  const dewPoint = computeDewPoint(tempC, humidity);
  const dewSpread = tempC - dewPoint;

  // ── v9.4.0: Climate-normalised thresholds ────────────────────
  // Singapore 85% RH → effectiveHumidity ~70% (normal tropical day).
  // London 85% RH → effectiveHumidity 85% (genuinely fog-forming).
  // Abu Dhabi 50% RH → effectiveHumidity ~58% (unusually humid for desert).
  //
  // Precipitation-driven paths use RAW values (rain is rain everywhere).
  // Thermal optics use RAW values (physics of frost/shimmer don't change).
  // Air clarity, contrast, and moisture use EFFECTIVE values.
  const climate = computeClimateContext(latitude ?? null, tempC, humidity, dewSpread);
  const eHum = climate.effectiveHumidity;
  const eDew = climate.effectiveDewSpread;

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
    // v9.3.0: Compound detection — secondary atmospheric layer overrides.
    // Rain+fog → foggy (not just hazy). Snow+mist → misty (not just intensity-based).
    if (precip.compound && precip.secondaryType === 'fog') {
      // Fog layer present during falling precip → always foggy
      airClarity = 'foggy';
    } else if (precip.compound && precip.secondaryType === 'mist') {
      // Mist layer present during falling precip → always misty
      airClarity = 'misty';
    } else if (
      precip.compound &&
      (precip.secondaryType === 'haze' ||
        precip.secondaryType === 'smoke' ||
        precip.secondaryType === 'dust')
    ) {
      // Haze/smoke/dust layer during precip → at least hazy
      airClarity = vis < 3000 ? 'misty' : 'hazy';
    } else if (precip.type === 'snow' || precip.type === 'sleet') {
      // v8.0.0: Snow-specific logic — heavy snow can approach whiteout
      airClarity =
        precip.intensity === 'heavy'
          ? 'foggy'
          : precip.intensity === 'moderate' || vis < 3000
            ? 'misty'
            : 'hazy';
    } else {
      // Rain, drizzle, thunderstorm, hail (no compound layer)
      // v9.3.0: Use actual visibility for finer gradation
      if (vis < 1000) airClarity = 'foggy';
      else if (vis < 3000) airClarity = 'misty';
      else if (vis < 5000) airClarity = 'hazy';
      else airClarity = 'softened';
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
  } else if (eDew < 1 && windKmh < 10) {
    // v9.4.0: Climate-adjusted dew spread. Tropical 2°C raw → ~3.2°C effective.
    // Dew point nearly met + calm wind = fog forming, regardless of OWM vis cap.
    airClarity = 'foggy';
  } else if (eDew < 1 && windKmh < 15) {
    // Near dew point, light wind = mist (wind prevents full fog)
    airClarity = 'misty';
  } else if (eDew < 1 && windKmh >= 15) {
    // Near dew point but strong wind disperses fog → hazy
    airClarity = 'hazy';
  } else if (eDew < 2 && windKmh < 10) {
    // v9.6.1: Extended distrust zone — 1–2°C spread with calm wind.
    // OWM caps vis at 10000m but atmosphere is actively condensing.
    // Wellington 93% RH, 1.1°C spread, 5 km/h → mist forming, not haze.
    // Coastal cities at night frequently hit this band.
    airClarity = 'misty';
  } else if (eDew < 2 && windKmh < 20) {
    // v9.6.1: 1–2°C spread with light-to-moderate wind.
    // Wind disperses some moisture but air is still visibly thick.
    airClarity = 'hazy';
  } else if (eDew < 2) {
    // v9.6.1: 1–2°C spread with strong wind (20+ km/h).
    // Wind actively disperses moisture — softened but not hazy.
    airClarity = 'softened';
  } else if (eDew < 3) {
    // 2–3°C spread — noticeable haze regardless of wind
    airClarity = 'hazy';
  } else if (eDew < 5 || (eHum > 75 && vis < 8000)) {
    // v9.4.0: Climate-adjusted humidity. Tropical 85% raw → ~70% eff (no softening).
    airClarity = 'softened';
  } else if (tempC > 35 && humidity < 50 && windKmh < 15) {
    // Extreme heat shimmer — uses RAW humidity (shimmer physics are absolute)
    airClarity = 'softened';
  } else if (eHum < 40 && vis >= 10000) {
    // Genuinely dry + high vis = crystal (rare — ~15% of conditions)
    airClarity = 'crystal';
  } else if (vis >= 8000 && eHum < 65) {
    // Normal clear conditions — say nothing (clear is the default)
    airClarity = 'clear';
  } else if (eHum >= 65 && eDew >= 5) {
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
    // Broken cloud (50-75%) — intermittent sun through gaps produces
    // moderate shadows that come and go. Matches lighting engine's broken
    // pool ("strong but intermittent overhead light through cloud gaps").
    // v9.8.0: Changed from 'low' to 'moderate' — "faint diffused shadows"
    // contradicted the intermittent direct sunlight the lighting engine describes.
    contrast = 'moderate';
  } else if (eDew < 3 && eHum > 80) {
    // v9.4.0: Climate-adjusted. Near-saturated air scatters direct sunlight.
    // Paris fix preserved: 100% humidity at 0°C (cool-temperate) → low contrast.
    // Singapore 85% RH: eHum ~70% → skips this branch (correct — clear tropical day).
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
    // Uses RAW humidity — frost physics are absolute, not climate-relative.
    moistureVisibility = humidity < 20 ? 'bone-dry' : 'invisible';
  } else if (precipitationActive) {
    // Active rain/drizzle/thunderstorm at >0°C = surfaces are wet
    moistureVisibility = 'dominant';
  } else if (eHum < 20) {
    // v9.4.0: Climate-adjusted. Arid 30% raw → ~38% eff (still dry-looking).
    moistureVisibility = 'bone-dry';
  } else if (eHum < 55 || eDew > 10) {
    moistureVisibility = 'invisible';
  } else if (eHum < 70 || eDew > 5) {
    moistureVisibility = 'subtle';
  } else if (eHum < 85 || eDew > 3) {
    moistureVisibility = 'noticeable';
  } else if (eDew < 1 && windKmh < 10) {
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
    climateZone: climate.zone,
    cloudType: null, // v9.5.0: Set by orchestrator after classification
    solarPhase: null, // v9.5.0: Set by orchestrator after phase computation
  };
}

// ── Visual Truth Phrase Pools ────────────────────────────────────────────────
// Keyed by derived states, not raw data ranges.
// Each state has 3 phrases (seeded selection, deterministic).
// These describe OPTICAL EFFECTS — not weather station readings, not scene props.

// Atmosphere phrases (air clarity) — used by computeLighting atmosphere modifier
// These replace the old visibility-only bins.
export const AIR_CLARITY_PHRASES: Record<AirClarity, string> = {
  crystal: 'in crystalline air',
  clear: '', // Clear is the default assumption — say nothing, save token budget
  softened: 'in softly diffused air',
  hazy: 'in atmospheric haze',
  misty: 'in thin drifting mist',
  foggy: 'in dense fog',
};

// Shadow phrases (contrast) — used by computeLighting shadow modifier
// These replace the old cloud-only bins.
export const CONTRAST_SHADOW_PHRASES: Record<ContrastLevel, string> = {
  high: 'with sharp defined shadows',
  moderate: 'with soft intermittent shadows',
  low: 'with faint diffused shadows',
  flat: 'with flat even illumination',
};

/**
 * v10.2.0: Context-aware shadow phrase — differentiates between causes of
 * moderate contrast so the shadow modifier doesn't contradict the lighting base.
 *
 * "Soft intermittent shadows" = cloud gaps (intermittent direct sunlight).
 * "Well-defined light direction with soft-edged shadows" = haze/humidity softening
 *   (still directional sun, but edges are diffused by particulate scatter).
 *
 * This eliminates contradictions like:
 *   "high-angle sunlight with strong downward intensity with soft intermittent shadows"
 * because when airClarity is hazy/softened, getDaylightBase now selects from the
 * scattered/broken pool (softer base phrases) AND this function selects a shadow
 * phrase that acknowledges directional light with haze-softened edges.
 */
export function getContrastShadowPhrase(
  contrast: ContrastLevel,
  airClarity: AirClarity,
): string {
  switch (contrast) {
    case 'high':
      return 'with sharp defined shadows';
    case 'flat':
      return 'with flat even illumination';
    case 'low':
      return 'with faint diffused shadows';
    case 'moderate':
      // Haze/softened air: light is still directional but edges are diffused.
      // "Intermittent" is wrong — that implies cloud gaps, not atmospheric scatter.
      if (airClarity === 'hazy' || airClarity === 'softened') {
        return 'with well-defined light direction with soft-edged shadows';
      }
      // Cloud-caused moderate: intermittent sun through cloud gaps.
      return 'with soft intermittent shadows';
  }
}

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
export function getLightReflectionNoun(
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
export function composeLightingSentence(
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
export function composeSurfaceSentence(
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

export function getMoisturePhrase(
  vt: VisualTruth,
  seed: number,
  setting?: VenueSetting,
): string | null {
  const settingPhrases = setting ? MOISTURE_BY_SETTING[setting] : null;
  const pool = settingPhrases?.[vt.moistureVisibility] ?? MOISTURE_GENERIC[vt.moistureVisibility];
  if (!pool || pool.length === 0) return null;
  return pickRandom(pool, seed * 1.7);
}

export function getThermalPhrase(vt: VisualTruth, seed: number): string | null {
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
export function getSurfaceGrounding(
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
