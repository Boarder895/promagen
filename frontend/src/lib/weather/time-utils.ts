// src/lib/weather/time-utils.ts
// ============================================================================
// TIME UTILITIES — Night/Day Detection, Quiet Hours
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Extracted from weather-prompt-generator.ts (4,311-line monolith)
// - Contains: isNightTime, isQuietHours, shouldExcludePeople
//
// Existing features preserved: Yes
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';
import type { PromptProfile } from './prompt-types';

export function isNightTime(
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
// Between 23:59 local and sunrise+1hr, the "no people" directive is active.
// Activities are gone entirely (v6.0), so quiet only controls the directive.
// v6.0 change: Window expanded from midnight→sunrise to 23:59→sunrise+1hr.
// Rationale: Cities aren't empty at 23:30, and aren't bustling at 06:01.
// ============================================================================

export function isQuietHours(
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

/**
 * Resolve people-exclusion based on profile + current quiet-hours state.
 * Replaces raw `isQuietHours()` in each tier.
 */
export function shouldExcludePeople(
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

// ============================================================================
// SOLAR PHASE — Dawn vs Dusk Direction (v9.5.0 Chat 6)
// ============================================================================
//
// The lighting engine already uses solar elevation for bands (golden hour,
// civil twilight, etc.) but cannot distinguish dawn from dusk — they have
// DIFFERENT colour palettes:
//   Dawn:  cooler (blue-pink), cleaner air, dew forming
//   Dusk:  warmer (amber-red), hazier air, scattered dust/pollution
//
// This function combines solar elevation with sunrise/sunset times to add
// directional labels. When sunrise/sunset unavailable, localHour is used.
// ============================================================================

/**
 * Solar phase — combines elevation band with direction.
 *
 * Lighting engine uses the elevation part; tier generators use the
 * dawn/dusk prefix for colour vocabulary selection.
 */
export type SolarPhase =
  | 'night'
  | 'dawn-astro'       // -18° to -12°, sun rising
  | 'dawn-nautical'    // -12° to -6°, sun rising
  | 'dawn-civil'       // -6° to 0°, sun rising — "blue hour"
  | 'dawn-golden'      // 0° to 6°, sun rising — "golden hour"
  | 'morning'          // 6°+, before solar noon
  | 'midday'           // sun near peak (solarElev > 35°)
  | 'afternoon'        // 6°+, after solar noon
  | 'dusk-golden'      // 0° to 6°, sun setting — "golden hour"
  | 'dusk-civil'       // -6° to 0°, sun setting — "blue hour"
  | 'dusk-nautical'    // -12° to -6°, sun setting
  | 'dusk-astro';      // -18° to -12°, sun setting

/**
 * Compute solar phase from elevation + direction.
 *
 * Direction is determined by comparing current time to solar noon
 * (midpoint of sunrise/sunset). Falls back to localHour when OWM
 * sun times unavailable.
 *
 * @param solarElevation  Degrees above horizon. null → use localHour only.
 * @param weather         For sunrise/sunset times.
 * @param localHour       Fallback for direction when no sun times.
 * @param observedAtUtc   Current observation time.
 */
export function computeSolarPhase(
  solarElevation: number | null,
  weather: ExchangeWeatherFull,
  localHour: number,
  observedAtUtc: Date,
): SolarPhase {
  // Determine direction: is the sun rising or setting?
  let sunRising: boolean;

  if (weather.sunriseUtc != null && weather.sunsetUtc != null && weather.timezoneOffset != null) {
    // Precise: compare to solar noon (midpoint of sunrise/sunset)
    const nowUtc = Math.floor(observedAtUtc.getTime() / 1000);
    const solarNoonUtc = (weather.sunriseUtc + weather.sunsetUtc) / 2;
    sunRising = nowUtc < solarNoonUtc;
  } else {
    // Fallback: before noon = rising
    sunRising = localHour < 12;
  }

  // If no solar elevation, use hour-based approximation
  if (solarElevation === null) {
    if (localHour >= 22 || localHour < 5) return 'night';
    if (localHour < 7) return sunRising ? 'dawn-golden' : 'dusk-golden';
    if (localHour < 10) return 'morning';
    if (localHour < 14) return 'midday';
    if (localHour < 17) return 'afternoon';
    if (localHour < 19) return sunRising ? 'dawn-golden' : 'dusk-golden';
    return 'night';
  }

  // Full dark
  if (solarElevation < -18) return 'night';

  // Astronomical twilight
  if (solarElevation < -12) return sunRising ? 'dawn-astro' : 'dusk-astro';

  // Nautical twilight
  if (solarElevation < -6) return sunRising ? 'dawn-nautical' : 'dusk-nautical';

  // Civil twilight (blue hour)
  if (solarElevation < 0) return sunRising ? 'dawn-civil' : 'dusk-civil';

  // Golden hour
  if (solarElevation < 6) return sunRising ? 'dawn-golden' : 'dusk-golden';

  // Daytime — distinguish morning/midday/afternoon
  if (solarElevation > 35) return 'midday';
  return sunRising ? 'morning' : 'afternoon';
}

/**
 * Human-readable label for the solar phase, for prompt enrichment.
 * Returns null for midday/morning/afternoon/night (no special label needed).
 */
export function getSolarPhaseLabel(phase: SolarPhase): string | null {
  switch (phase) {
    case 'dawn-astro':    return 'pre-dawn';
    case 'dawn-nautical': return 'early dawn';
    case 'dawn-civil':    return 'dawn blue hour';
    case 'dawn-golden':   return 'sunrise golden hour';
    case 'dusk-golden':   return 'sunset golden hour';
    case 'dusk-civil':    return 'dusk blue hour';
    case 'dusk-nautical': return 'late dusk';
    case 'dusk-astro':    return 'deep dusk';
    default:              return null;
  }
}
