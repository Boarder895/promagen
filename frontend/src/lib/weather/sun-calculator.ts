// src/lib/weather/sun-calculator.ts
// ============================================================================
// ASTRONOMICAL SUNRISE/SUNSET CALCULATOR - Pure Maths
// ============================================================================
// Calculates sunrise and sunset times from latitude, longitude, and date.
// Uses the standard NOAA Solar Calculations spreadsheet algorithm.
//
// Accuracy: ±5 minutes vs observed times. Good enough for tooltip display.
// No API dependency — works offline, works with demo data, works always.
//
// Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
//
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

/**
 * Sunrise and sunset times for a given location and date.
 */
export interface SunTimes {
  /** Sunrise as Date object in UTC */
  sunriseUTC: Date;
  /** Sunset as Date object in UTC */
  sunsetUTC: Date;
  /** Sunrise formatted in local 24h time (e.g., "06:42") */
  sunriseLocal: string;
  /** Sunset formatted in local 24h time (e.g., "20:28") */
  sunsetLocal: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Convert degrees to radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Format a Date as local time string in 24-hour format (e.g., "06:41") using IANA timezone.
 */
function formatLocalTime(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    // Fallback: UTC display
    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m} UTC`;
  }
}

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

/**
 * Calculate sunrise and sunset for a given location and date.
 *
 * Uses the NOAA simplified solar position algorithm:
 * 1. Julian day → fractional century
 * 2. Solar mean anomaly → equation of center → true longitude
 * 3. Obliquity → declination
 * 4. Equation of time
 * 5. Hour angle from latitude + declination
 * 6. Sunrise/sunset = solar noon ± hour angle
 *
 * @param latitude  - Degrees north (negative for south), e.g. -41.2866 for Wellington
 * @param longitude - Degrees east (negative for west), e.g. 174.7756 for Wellington
 * @param tz        - IANA timezone string for local time formatting
 * @param date      - Date to calculate for (defaults to today)
 * @returns SunTimes with UTC Date objects + formatted local strings,
 *          or null for polar regions where sun doesn't rise/set
 */
export function calculateSunTimes(
  latitude: number,
  longitude: number,
  tz: string,
  date: Date = new Date(),
): SunTimes | null {
  // ── Julian Day Number ────────────────────────────────────────────
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  // Julian day (Meeus, Astronomical Algorithms)
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // The JDN from Meeus already represents noon on the given date.
  // The NOAA simplified algorithm expects noon Julian Date as input.
  // DO NOT subtract 0.5 — that shifts to midnight and offsets all results by 12 hours.
  const jd = jdn;
  const n = jd - 2451545.0; // Days since J2000.0 epoch (noon)

  // ── Solar Mean Anomaly ───────────────────────────────────────────
  const M = (357.5291 + 0.98560028 * n) % 360;
  const Mrad = toRad(M);

  // ── Equation of Center ───────────────────────────────────────────
  const C =
    1.9148 * Math.sin(Mrad) +
    0.02 * Math.sin(2 * Mrad) +
    0.0003 * Math.sin(3 * Mrad);

  // ── Ecliptic Longitude ───────────────────────────────────────────
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaRad = toRad(lambda);

  // ── Solar Transit (solar noon) ───────────────────────────────────
  const solarNoonJD =
    2451545.0 +
    n -
    longitude / 360 +
    0.0053 * Math.sin(Mrad) -
    0.0069 * Math.sin(2 * lambdaRad);

  // ── Declination ──────────────────────────────────────────────────
  const sinDec = Math.sin(lambdaRad) * Math.sin(toRad(23.4393));
  const declination = Math.asin(sinDec);

  // ── Hour Angle ───────────────────────────────────────────────────
  // Standard solar zenith for sunrise/sunset = 90.833° (includes refraction)
  const zenith = toRad(90.833);
  const latRad = toRad(latitude);

  const cosHA =
    (Math.cos(zenith) - Math.sin(latRad) * sinDec) /
    (Math.cos(latRad) * Math.cos(declination));

  // Polar regions: sun doesn't rise or set on this date
  if (cosHA > 1 || cosHA < -1) {
    return null;
  }

  const hourAngle = toDeg(Math.acos(cosHA));

  // ── Sunrise & Sunset Julian Dates ────────────────────────────────
  const sunriseJD = solarNoonJD - hourAngle / 360;
  const sunsetJD = solarNoonJD + hourAngle / 360;

  // ── Convert Julian Date → JS Date ────────────────────────────────
  function jdToDate(julianDate: number): Date {
    const unixSeconds = (julianDate - 2440587.5) * 86400;
    return new Date(unixSeconds * 1000);
  }

  const sunriseUTC = jdToDate(sunriseJD);
  const sunsetUTC = jdToDate(sunsetJD);

  return {
    sunriseUTC,
    sunsetUTC,
    sunriseLocal: formatLocalTime(sunriseUTC, tz),
    sunsetLocal: formatLocalTime(sunsetUTC, tz),
  };
}

/**
 * Get the next sunrise or sunset time string for tooltip display.
 *
 * Priority cascade:
 * 1. API timestamps (sunriseUtc/sunsetUtc from OWM via gateway) — most accurate
 * 2. Astronomical calculation (lat/lon + NOAA maths) — ±5 min fallback
 *
 * @param isNight    - Whether it's currently night at this location
 * @param tz         - IANA timezone string for formatting
 * @param sunriseUtc - Unix timestamp from API (seconds, optional)
 * @param sunsetUtc  - Unix timestamp from API (seconds, optional)
 * @param latitude   - Degrees north (optional, for calculation fallback)
 * @param longitude  - Degrees east (optional, for calculation fallback)
 * @returns { label, time } or null if unavailable (should never happen)
 */
export function getNextSunEvent(
  isNight: boolean,
  tz: string,
  sunriseUtc?: number | null,
  sunsetUtc?: number | null,
  latitude?: number | null,
  longitude?: number | null,
): { label: 'Sunrise' | 'Sunset'; time: string } | null {
  // ── Tier 1: API timestamps (exact from OWM) ───────────────────
  if (isNight && typeof sunriseUtc === 'number' && sunriseUtc > 0) {
    return { label: 'Sunrise', time: formatLocalTime(new Date(sunriseUtc * 1000), tz) };
  }
  if (!isNight && typeof sunsetUtc === 'number' && sunsetUtc > 0) {
    return { label: 'Sunset', time: formatLocalTime(new Date(sunsetUtc * 1000), tz) };
  }

  // ── Tier 2: Astronomical calculation (±5 min) ─────────────────
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    const sunTimes = calculateSunTimes(latitude, longitude, tz);
    if (sunTimes) {
      return isNight
        ? { label: 'Sunrise', time: sunTimes.sunriseLocal }
        : { label: 'Sunset', time: sunTimes.sunsetLocal };
    }
  }

  return null;
}
