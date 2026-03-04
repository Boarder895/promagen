// src/lib/weather/tier-generators.ts
// ============================================================================
// TIER GENERATOR HELPERS — Shared Seed + Sky/Time Enrichment
// ============================================================================
//
// v11.0.0 (Mar 2026) — Phase E: Tier Generator Retirement
// - Deleted generateTier1(), generateTier1Flux(), generateTier2(),
//   generateTier3(), generateTier4(), stripClipWeight()
// - These functions are superseded by the unified brain pipeline:
//   buildWeatherCategoryMap() → selectionsFromMap() → assemblePrompt()
// - Retained helpers: computeSeed(), enhanceSkySource(), enhanceTimeWithPhase()
//   (consumed by weather-category-mapper.ts and weather-prompt-generator.ts)
//
// v9.5.0: Cloud type + solar phase enrichment helpers
// v9.0.0: Extracted from weather-prompt-generator.ts (4,311-line monolith)
// Existing features preserved: Yes
// ============================================================================

import { hashString } from './prng';
import type { VisualTruth } from './prompt-types';
import type { buildContext } from './vocabulary-loaders';
import { getSolarPhaseLabel, type SolarPhase } from './time-utils';
import { getCloudTypePhrase } from './cloud-types';
import type { CloudType } from './cloud-types';

// ============================================================================
// SHARED SEED COMPUTATION
// ============================================================================

export function computeSeed(
  ctx: ReturnType<typeof buildContext>,
  hour: number,
  observedAtUtc: Date,
  city: string,
): number {
  const twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000);
  return (
    ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow + hashString(city)
  );
}

// ============================================================================
// v9.5.0: CLOUD TYPE + SOLAR PHASE ENRICHMENT
// ============================================================================

/**
 * Cloud-only OWM descriptions that can be replaced with richer cloud-type phrases.
 * Precipitation descriptions (rain, snow, etc.) are left as-is — they carry
 * critical scene information that cloud-type phrases don't cover.
 */
const REPLACEABLE_SKY = new Set([
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

/**
 * When sky source is a generic OWM cloud description, replace with the
 * richer cloud-type-specific phrase from cloud-types.ts.
 * Precipitation descriptions pass through untouched.
 * null stays null (lighting already encodes cloud state).
 */
export function enhanceSkySource(
  skySource: string | null,
  visualTruth: VisualTruth | null,
  seed: number,
): string | null {
  if (!skySource) return null;
  if (!visualTruth?.cloudType) return skySource;

  const lower = skySource.toLowerCase().trim();
  if (REPLACEABLE_SKY.has(lower)) {
    return getCloudTypePhrase(visualTruth.cloudType as CloudType, seed);
  }
  return skySource;
}

/**
 * Enhance time descriptor with solar phase label when at dawn/dusk.
 * "Late afternoon" → "Sunset golden hour, late afternoon"
 */
export function enhanceTimeWithPhase(time: string, visualTruth: VisualTruth | null): string {
  if (!visualTruth?.solarPhase) return time;
  const label = getSolarPhaseLabel(visualTruth.solarPhase as SolarPhase);
  if (!label) return time;
  return `${label}, ${time.charAt(0).toLowerCase() + time.slice(1)}`;
}
