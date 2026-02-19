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

// ============================================================================
// SOLAR ELEVATION (v6.0 — for lighting engine)
// ============================================================================

/**
 * Calculate solar elevation angle in degrees for a given location and time.
 *
 * Uses the NOAA simplified algorithm. Computes the sun's angle above (+)
 * or below (−) the horizon at the current moment.
 *
 * elevation = arcsin(sin(lat) × sin(dec) + cos(lat) × cos(dec) × cos(HA))
 *
 * @param latitude  - Degrees north (negative for south)
 * @param longitude - Degrees east (negative for west)
 * @param date      - Date/time to calculate for (defaults to now)
 * @returns Solar elevation in degrees. Positive = above horizon, negative = below.
 */
export function getSolarElevation(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
): number {
  // ── Julian Day Number ────────────────────────────────────────────
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

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

  // Fractional day from midnight UTC
  const fractionOfDay =
    (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;

  // Julian date including time of day (JDN is noon, -0.5 → midnight, +fraction)
  const jd = jdn - 0.5 + fractionOfDay;
  const n = jd - 2451545.0; // Days since J2000.0

  // ── Solar Mean Anomaly ───────────────────────────────────────────
  const M = ((357.5291 + 0.98560028 * n) % 360 + 360) % 360;
  const Mrad = toRad(M);

  // ── Equation of Center ───────────────────────────────────────────
  const C =
    1.9148 * Math.sin(Mrad) +
    0.02 * Math.sin(2 * Mrad) +
    0.0003 * Math.sin(3 * Mrad);

  // ── Ecliptic Longitude ───────────────────────────────────────────
  const lambda = ((M + C + 180 + 102.9372) % 360 + 360) % 360;
  const lambdaRad = toRad(lambda);

  // ── Declination ──────────────────────────────────────────────────
  const sinDec = Math.sin(lambdaRad) * Math.sin(toRad(23.4393));
  const cosDec = Math.cos(Math.asin(sinDec));

  // ── Equation of Time (minutes) ───────────────────────────────────
  const eqOfTime =
    -7.655 * Math.sin(Mrad) +
    9.873 * Math.sin(2 * lambdaRad + 3.5932);

  // ── Solar Hour Angle ─────────────────────────────────────────────
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarTime = utcMinutes + eqOfTime + 4 * longitude; // minutes
  const hourAngle = (solarTime / 4 - 180); // degrees from noon
  const haRad = toRad(hourAngle);

  // ── Solar Elevation ──────────────────────────────────────────────
  const latRad = toRad(latitude);
  const sinElevation =
    Math.sin(latRad) * sinDec + Math.cos(latRad) * cosDec * Math.cos(haRad);

  return toDeg(Math.asin(sinElevation));
}

// ============================================================================
// LUNAR POSITION (v6.1 — for night lighting engine)
// ============================================================================
// Computes the Moon's altitude (elevation) and azimuth from observer coordinates.
//
// Uses the simplified lunar ephemeris from Jean Meeus, "Astronomical Algorithms."
// Main perturbation terms give ~1° accuracy — more than sufficient for binning
// into 5 altitude bands × 8 compass sectors.
//
// The Moon is a positioned directional light source. Its altitude determines:
// - Whether it's above the horizon at all (altitude > 0°)
// - Atmospheric dimming (low altitude = more air mass = warmer/dimmer)
// - Shadow length (high = short shadows, low = long lateral shadows)
//
// Its azimuth determines:
// - Shadow direction
// - Rim lighting angle on buildings
// - Which side of the sky has bright cloud patches
//
// Reference: Meeus, Jean. "Astronomical Algorithms" 2nd ed., ch. 47
// ============================================================================

/**
 * Lunar position in horizontal (observer-relative) coordinates.
 */
export interface LunarPosition {
  /** Altitude in degrees. Positive = above horizon, negative = below. */
  altitude: number;
  /** Azimuth in degrees (0–360). 0=North, 90=East, 180=South, 270=West. */
  azimuth: number;
  /** Binned altitude descriptor for prompt use. null if below horizon. */
  altitudeBin: string | null;
  /** Binned azimuth descriptor (compass direction). */
  azimuthBin: string;
  /**
   * Combined position phrase for prompt use. null if below horizon.
   * e.g. "low in the eastern sky", "high in the north-western sky", "near overhead"
   */
  positionPhrase: string | null;
}

/**
 * Normalise angle to [0, 360) range.
 */
function normaliseDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Bin lunar altitude into a human descriptor.
 *
 * | Degrees       | Descriptor           |
 * |---------------|----------------------|
 * | ≤ 0°          | below the horizon    |
 * | 0–15°         | low on the horizon   |
 * | 15–35°        | mid-sky              |
 * | 35–60°        | high in the sky      |
 * | 60°+          | near overhead        |
 */
function binAltitude(altitude: number): string | null {
  if (altitude <= 0) return null; // Below horizon — not visible
  if (altitude < 15) return 'low on the horizon';
  if (altitude < 35) return 'mid-sky';
  if (altitude < 60) return 'high in the sky';
  return 'near overhead';
}

/**
 * Bin azimuth into 8 compass sectors.
 *
 * | Degrees   | Direction   |
 * |-----------|-------------|
 * | 337–22°   | northern    |
 * | 22–67°    | north-eastern |
 * | 67–112°   | eastern     |
 * | 112–157°  | south-eastern |
 * | 157–202°  | southern    |
 * | 202–247°  | south-western |
 * | 247–292°  | western     |
 * | 292–337°  | north-western |
 */
function binAzimuth(azimuth: number): string {
  const a = normaliseDeg(azimuth);
  if (a >= 337 || a < 22) return 'northern';
  if (a < 67) return 'north-eastern';
  if (a < 112) return 'eastern';
  if (a < 157) return 'south-eastern';
  if (a < 202) return 'southern';
  if (a < 247) return 'south-western';
  if (a < 292) return 'western';
  return 'north-western';
}

/**
 * Build the combined position phrase from altitude and azimuth bins.
 * Returns null if the Moon is below the horizon.
 *
 * Examples:
 *   "low in the eastern sky"
 *   "high in the north-western sky"
 *   "near overhead" (no direction needed — it's above you)
 */
function buildPositionPhrase(altBin: string | null, azBin: string): string | null {
  if (altBin === null) return null; // Below horizon
  if (altBin === 'near overhead') return 'near overhead'; // Direction irrelevant
  return `${altBin} in the ${azBin} sky`;
}

/**
 * Calculate the Moon's position (altitude + azimuth) for a given location and time.
 *
 * Uses simplified Meeus lunar ephemeris with the six largest perturbation terms
 * for ecliptic longitude and five for ecliptic latitude. Converts through
 * ecliptic → equatorial → horizontal coordinate systems.
 *
 * Accuracy: ~1° for altitude, ~2° for azimuth. Sufficient for 5-band altitude
 * binning and 8-sector compass direction.
 *
 * @param latitude  - Observer latitude in degrees (north positive)
 * @param longitude - Observer longitude in degrees (east positive)
 * @param date      - Date/time to calculate for (defaults to now)
 * @returns LunarPosition with altitude, azimuth, and binned descriptors
 */
export function getLunarPosition(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
): LunarPosition {
  // ── Days since J2000.0 ───────────────────────────────────────────
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

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

  const fractionOfDay =
    (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
  const jd = jdn - 0.5 + fractionOfDay;
  const d = jd - 2451545.0; // Days since J2000.0

  // ── Moon's mean orbital elements (degrees) ───────────────────────
  // L' — Mean longitude of the Moon
  const Lp = normaliseDeg(218.3165 + 13.176396 * d);
  // M' — Mean anomaly of the Moon
  const Mp = normaliseDeg(134.9634 + 13.064993 * d);
  // D — Mean elongation of the Moon from the Sun
  const D = normaliseDeg(297.8502 + 12.190749 * d);
  // F — Argument of latitude (mean distance from ascending node)
  const F = normaliseDeg(93.2720 + 13.229350 * d);
  // Ms — Sun's mean anomaly (for solar perturbation of lunar orbit)
  const Ms = normaliseDeg(357.5291 + 0.985600 * d);

  // Convert to radians for trig
  const MpR = toRad(Mp);
  const DR = toRad(D);
  const FR = toRad(F);
  const MsR = toRad(Ms);

  // ── Ecliptic longitude corrections (6 largest terms) ─────────────
  // These account for: equation of centre, evection, variation,
  // annual equation, reduction to ecliptic, and parallactic inequality
  const lonCorrection =
    +6.289 * Math.sin(MpR) +               // Equation of centre
    1.274 * Math.sin(2 * DR - MpR) +        // Evection
    0.658 * Math.sin(2 * DR) +              // Variation
    0.214 * Math.sin(2 * MpR) +             // Second equation of centre
    -0.186 * Math.sin(MsR) +               // Annual equation (solar)
    -0.114 * Math.sin(2 * FR);              // Reduction to ecliptic

  // ── Ecliptic latitude corrections (5 largest terms) ──────────────
  const latCorrection =
    +5.128 * Math.sin(FR) +                 // Main latitude term
    0.281 * Math.sin(MpR + FR) +            // Evection in latitude
    0.278 * Math.sin(MpR - FR) +            // Evection in latitude
    0.173 * Math.sin(2 * DR - FR) +         // Variation in latitude
    0.055 * Math.sin(2 * DR - MpR + FR);    // Mixed term

  // ── Ecliptic coordinates ─────────────────────────────────────────
  const eclipticLon = normaliseDeg(Lp + lonCorrection); // degrees
  const eclipticLat = latCorrection;                     // degrees (small, near 0)

  const eclLonR = toRad(eclipticLon);
  const eclLatR = toRad(eclipticLat);

  // ── Ecliptic → Equatorial ────────────────────────────────────────
  // Using obliquity of ecliptic ε = 23.4393° (J2000 value, adequate for ~1° accuracy)
  const obliquity = toRad(23.4393);

  // Right ascension (α) — via atan2 for correct quadrant
  const sinRA =
    Math.sin(eclLonR) * Math.cos(obliquity) -
    Math.tan(eclLatR) * Math.sin(obliquity);
  const cosRA = Math.cos(eclLonR);
  const rightAscension = normaliseDeg(toDeg(Math.atan2(sinRA, cosRA))); // degrees

  // Declination (δ)
  const sinDec =
    Math.sin(eclLatR) * Math.cos(obliquity) +
    Math.cos(eclLatR) * Math.sin(obliquity) * Math.sin(eclLonR);
  const declination = toDeg(Math.asin(sinDec)); // degrees

  // ── Local Sidereal Time ──────────────────────────────────────────
  // Greenwich Mean Sidereal Time (GMST) at the given moment
  const gmst = normaliseDeg(280.46061837 + 360.98564736629 * d);
  // Local Sidereal Time = GMST + observer longitude
  const lst = normaliseDeg(gmst + longitude);

  // ── Hour Angle ───────────────────────────────────────────────────
  const hourAngle = normaliseDeg(lst - rightAscension); // degrees
  const haR = toRad(hourAngle);
  const decR = toRad(declination);
  const latR = toRad(latitude);

  // ── Equatorial → Horizontal ──────────────────────────────────────
  // Altitude (elevation above horizon)
  const sinAlt =
    Math.sin(latR) * Math.sin(decR) +
    Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
  const altitude = toDeg(Math.asin(sinAlt));

  // Azimuth (compass bearing from north, clockwise)
  const cosAz =
    (Math.sin(decR) - Math.sin(latR) * Math.sin(toRad(altitude))) /
    (Math.cos(latR) * Math.cos(toRad(altitude)));
  // Clamp cosAz to [-1, 1] to prevent NaN from floating point rounding
  const clampedCosAz = Math.max(-1, Math.min(1, cosAz));
  let azimuth = toDeg(Math.acos(clampedCosAz));

  // atan2-based correction: if hour angle > 180°, azimuth is in western hemisphere
  if (Math.sin(haR) > 0) {
    azimuth = 360 - azimuth;
  }

  // ── Bin into descriptors ─────────────────────────────────────────
  const altBin = binAltitude(altitude);
  const azBin = binAzimuth(azimuth);
  const positionPhrase = buildPositionPhrase(altBin, azBin);

  return {
    altitude,
    azimuth,
    altitudeBin: altBin,
    azimuthBin: azBin,
    positionPhrase,
  };
}
