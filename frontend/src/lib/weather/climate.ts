// src/lib/weather/climate.ts
// ============================================================================
// CLIMATE ZONE SYSTEM — Latitude-Based Humidity Normalisation (v9.4.0 Chat 5)
// ============================================================================
//
// PROBLEM:  deriveVisualTruth uses fixed humidity thresholds everywhere.
//           85% humidity triggers 'noticeable' moisture in Singapore (normal)
//           AND London (genuinely fog-forming). Singapore ≠ London.
//
// SOLUTION: Compute "effective humidity" and "effective dew spread" that
//           normalise raw values against climate expectations. Thresholds
//           were calibrated for temperate Europe — adjustments shift tropical
//           and arid readings toward equivalent visual impact.
//
// INPUTS:   latitude (already in orchestrator), temperature, raw humidity.
// OUTPUTS:  ClimateContext with adjusted humidity/dew-spread for threshold
//           checks, plus zone label for trace/debugging.
//
// PHYSICS:
//   Warm air holds exponentially more water (Clausius–Clapeyron). At 30°C,
//   saturation is ~30 g/m³. At 5°C, it's ~7 g/m³. So 85% RH at 30°C means
//   ~25 g/m³ actual moisture — spread across a large capacity. At 5°C, 85% RH
//   means ~6 g/m³ — nearly all capacity used, condensation imminent.
//
//   This is WHY dew spread alone isn't sufficient: a 3°C spread at 30°C leaves
//   plenty of capacity headroom, but 3°C spread at 5°C means saturation is very
//   close. The climate adjustment accounts for this by widening tropical dew
//   spread thresholds and narrowing cold-climate ones.
//
// Existing features preserved: Yes (new file — no existing code changed)
// ============================================================================

/**
 * Climate zone classification.
 *
 * Determined by absolute latitude with temperature as secondary signal
 * (distinguishes arid from humid at same latitude — Cairo ≠ Shanghai).
 */
export type ClimateZone =
  | 'tropical'       // |lat| < 15° — Singapore, Bangkok, Jakarta, Lagos, Nairobi
  | 'subtropical'    // 15–25° warm — Mumbai, Hong Kong, Taipei, Manila, Dhaka
  | 'arid'           // 15–35° hot+dry — Abu Dhabi, Cairo, Doha, Kuwait City
  | 'warm-temperate' // 25–40° moderate — Tokyo, Shanghai, Sydney, São Paulo
  | 'cool-temperate' // 40–55° — London, Paris, Frankfurt, Toronto, New York
  | 'continental'    // 50–65° or very cold — Moscow, Helsinki, Almaty
  | 'subarctic';     // |lat| > 60° or extreme cold — Reykjavik, Ulaanbaatar

/**
 * Climate context — computed once per prompt, consumed by deriveVisualTruth.
 */
export interface ClimateContext {
  /** Classified climate zone */
  zone: ClimateZone;
  /**
   * Humidity with climate expectations removed.
   * Thresholds calibrated for cool-temperate (London/Paris baseline).
   * Tropical 85% → ~70% effective. Arid 50% → ~58% effective.
   */
  effectiveHumidity: number;
  /**
   * Dew spread with climate capacity adjustment.
   * Tropical 2°C spread → ~4°C effective (warm air has headroom).
   * Cold-climate 3°C spread → ~2.5°C effective (cold air near capacity).
   */
  effectiveDewSpread: number;
  /** Raw offset applied to humidity (for trace). Positive = raised thresholds. */
  humidityOffset: number;
  /** Raw multiplier applied to dew spread (for trace). >1 = widened spread. */
  dewSpreadScale: number;
}

// ============================================================================
// CLIMATE ZONE CLASSIFICATION
// ============================================================================

/**
 * Classify climate zone from latitude and current conditions.
 *
 * Uses absolute latitude as primary signal, temperature + humidity as
 * secondary to distinguish arid from humid at same latitude.
 *
 * @param latitude  Degrees (-90 to 90). null → defaults to cool-temperate.
 * @param tempC     Current temperature in Celsius.
 * @param humidity  Current relative humidity percentage (0–100).
 */
export function classifyClimate(
  latitude: number | null,
  tempC: number,
  humidity: number,
): ClimateZone {
  // No latitude available → assume cool-temperate (existing threshold behaviour)
  if (latitude === null) return 'cool-temperate';

  const absLat = Math.abs(latitude);

  // ── Subarctic / extreme cold ──
  if (absLat > 60 || (absLat > 50 && tempC < -15)) {
    return 'subarctic';
  }

  // ── Tropical ── (equatorial band, always warm+humid)
  if (absLat < 15) {
    return 'tropical';
  }

  // ── 15–25° band: subtropical vs arid ──
  if (absLat < 25) {
    // Hot + dry → arid (Abu Dhabi, Doha, Kuwait City, Muscat)
    if (tempC > 25 && humidity < 45) return 'arid';
    return 'subtropical';
  }

  // ── 25–40° band: arid vs warm-temperate ──
  if (absLat < 40) {
    // Hot + very dry → arid (Cairo, Windhoek)
    if (tempC > 28 && humidity < 35) return 'arid';
    return 'warm-temperate';
  }

  // ── 40–55° band: cool-temperate vs continental ──
  if (absLat < 55) {
    // Very cold → continental regardless of latitude
    if (tempC < -5) return 'continental';
    return 'cool-temperate';
  }

  // ── 55–60° band ──
  return 'continental';
}

// ============================================================================
// HUMIDITY & DEW SPREAD NORMALISATION
// ============================================================================
//
// Offsets per zone. Positive humidity offset = thresholds effectively raised
// (higher raw humidity needed to trigger effects). Dew spread scale >1 =
// wider effective spread (further from condensation point).
//
// Calibrated empirically against real OWM data:
//   Singapore (tropical): 85% RH, 2°C dew spread = normal clear day
//     → effectiveHumidity ≈ 70%, effectiveDewSpread ≈ 3.2°C → 'clear'/'subtle'
//   London (cool-temperate): 85% RH, 2°C dew spread = fog forming
//     → effectiveHumidity = 85%, effectiveDewSpread = 2°C → 'hazy'/'noticeable'
//   Abu Dhabi (arid): 50% RH, 8°C dew spread = unusually humid day
//     → effectiveHumidity ≈ 58%, effectiveDewSpread ≈ 6.4°C → 'softened'
//   Moscow (continental, winter): 90% RH, 1°C spread = guaranteed fog
//     → effectiveHumidity ≈ 93%, effectiveDewSpread ≈ 0.8°C → 'foggy'

interface ZoneParams {
  humidityOffset: number;
  dewSpreadScale: number;
}

const ZONE_PARAMS: Record<ClimateZone, ZoneParams> = {
  tropical:         { humidityOffset: 15,  dewSpreadScale: 1.6 },
  subtropical:      { humidityOffset: 10,  dewSpreadScale: 1.4 },
  arid:             { humidityOffset: -8,  dewSpreadScale: 0.8 },
  'warm-temperate': { humidityOffset: 5,   dewSpreadScale: 1.15 },
  'cool-temperate': { humidityOffset: 0,   dewSpreadScale: 1.0  }, // Baseline
  continental:      { humidityOffset: -3,  dewSpreadScale: 0.85 },
  subarctic:        { humidityOffset: -5,  dewSpreadScale: 0.75 },
};

/**
 * Compute climate-adjusted humidity and dew spread.
 *
 * effectiveHumidity = raw - offset  (clamped 0–100)
 * effectiveDewSpread = raw × scale  (clamped ≥ 0)
 *
 * @param latitude   Degrees (-90 to 90). null → no adjustment.
 * @param tempC      Current temperature in Celsius.
 * @param humidity   Raw relative humidity (0–100).
 * @param dewSpread  Raw dew point spread (tempC - dewPoint).
 */
export function computeClimateContext(
  latitude: number | null,
  tempC: number,
  humidity: number,
  dewSpread: number,
): ClimateContext {
  const zone = classifyClimate(latitude, tempC, humidity);
  const params = ZONE_PARAMS[zone];

  // Apply offset/scale with clamping to valid ranges
  const effectiveHumidity = Math.max(0, Math.min(100, humidity - params.humidityOffset));
  const effectiveDewSpread = Math.max(0, dewSpread * params.dewSpreadScale);

  return {
    zone,
    effectiveHumidity,
    effectiveDewSpread,
    humidityOffset: params.humidityOffset,
    dewSpreadScale: params.dewSpreadScale,
  };
}
