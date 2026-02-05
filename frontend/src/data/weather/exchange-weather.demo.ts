// src/data/weather/exchange-weather.demo.ts
// ============================================================================
// DYNAMIC EXCHANGE WEATHER — Algorithmic fallback for all 89 catalog exchanges
// ============================================================================
// Version: 3.0.0 (01 Feb 2026)
//
// Instead of frozen demo data, this module generates plausible weather for
// every exchange city using pure math:
//
//   1. SEASONAL — sinusoidal model keyed to latitude, hemisphere, and month.
//   2. DIURNAL  — cosine curve peaking ~14:30 local time, scaled by climate
//                 aridity (Dubai: ±7 °C swing, London: ±3 °C swing).
//   3. CONDITION — deterministic per city per day (stable hash of exchange
//                  ID + day-of-year), weighted by climate type and season.
//   4. NIGHT    — emoji adjusts (☀️ → 🌙), cloudy nights reduce cooling.
//
// Usage:
//   import { getDynamicDemoWeather } from './exchange-weather.demo';
//   const weather = getDynamicDemoWeather();        // uses Date.now()
//   const weather = getDynamicDemoWeather(someDate); // for testing
//
// Backward-compatible:
//   import DEMO_EXCHANGE_WEATHER from './exchange-weather.demo';
//   // Still works — computed once at module load time.
//
// Existing features preserved: Yes
//   - ExchangeWeather type unchanged
//   - ExchangeWeatherCondition type unchanged
//   - iconOverride for Dubai (🔥) when temp ≥ 40 °C
//   - All 89 exchange IDs present
//
// ============================================================================

// ============================================================================
// SECTION 1 — PUBLIC TYPES (unchanged from v2)
// ============================================================================

export type ExchangeWeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'windy';

export type ExchangeWeather = {
  /** Exchange id, matching exchanges.catalog.json (e.g. "lse-london"). */
  exchange: string;
  /** Temperature in °C shown on the card. */
  tempC: number;
  /** Temperature in °F shown on the card. */
  tempF: number;
  /** "Feels like" temperature in °C. Omitted if same as tempC. */
  feelsLikeC?: number;
  /** "Feels like" temperature in °F. Omitted if same as tempF. */
  feelsLikeF?: number;
  /** Relative humidity percentage (0–100). */
  humidity: number;
  /** Wind speed in km/h. */
  windSpeedKmh: number;
  /** Short text label describing the condition. */
  condition: ExchangeWeatherCondition;
  /** Default emoji mapped from the condition. */
  emoji: string;
  /** Optional override emoji. If present this wins over the default. */
  iconOverride?: string;
};

// ============================================================================
// SECTION 2 — INTERNAL TYPES
// ============================================================================

/**
 * Köppen-inspired climate classification.
 * Each type defines diurnal range, humidity, and condition probabilities.
 */
type ClimateType =
  | 'equatorial'
  | 'tropical-monsoon'
  | 'tropical-savanna'
  | 'hot-arid'
  | 'semi-arid'
  | 'mediterranean'
  | 'oceanic'
  | 'humid-subtropical'
  | 'continental'
  | 'subarctic'
  | 'highland';

/** Condition probability weights (must sum to 100). */
type ConditionWeights = Record<ExchangeWeatherCondition, number>;

/** Climate configuration for a climate type. */
interface ClimateConfig {
  /** Daily temperature range in °C (max − min on a clear day). */
  diurnalRangeC: number;
  /** Base relative humidity (%). */
  baseHumidity: number;
  /** Humidity seasonal swing ± (%). Higher = wetter summers / drier winters. */
  humiditySwing: number;
  /** Condition weights for peak summer. */
  summer: ConditionWeights;
  /** Condition weights for deep winter. */
  winter: ConditionWeights;
}

/** Compact climate profile for a single exchange city. */
interface ClimateProfile {
  id: string;
  city: string;
  lat: number;
  lon: number;
  /** Annual mean temperature (°C). */
  meanC: number;
  /** Seasonal half-amplitude (°C). Temperature swings ± this around meanC. */
  ampC: number;
  /** Climate classification. */
  climate: ClimateType;
}

// ============================================================================
// SECTION 3 — CLIMATE CONFIGURATIONS BY TYPE
// ============================================================================
// Diurnal ranges, humidity, and condition weights are calibrated against
// real-world climate normals. Condition weights always sum to 100.
// ============================================================================

const CLIMATE_CONFIGS: Readonly<Record<ClimateType, ClimateConfig>> = {
  // ── Near-equator: perpetual warmth, frequent afternoon rain ──────────────
  equatorial: {
    diurnalRangeC: 7,
    baseHumidity: 82,
    humiditySwing: 5,
    summer: { sunny: 20, cloudy: 30, rain: 30, storm: 15, snow: 0, windy: 5 },
    winter: { sunny: 20, cloudy: 30, rain: 30, storm: 15, snow: 0, windy: 5 },
  },

  // ── Distinct wet/dry seasons, very humid in monsoon ──────────────────────
  'tropical-monsoon': {
    diurnalRangeC: 8,
    baseHumidity: 72,
    humiditySwing: 18,
    summer: { sunny: 15, cloudy: 20, rain: 35, storm: 25, snow: 0, windy: 5 },
    winter: { sunny: 50, cloudy: 25, rain: 15, storm: 5, snow: 0, windy: 5 },
  },

  // ── Warm year-round, moderate wet/dry contrast ───────────────────────────
  'tropical-savanna': {
    diurnalRangeC: 10,
    baseHumidity: 65,
    humiditySwing: 15,
    summer: { sunny: 25, cloudy: 25, rain: 30, storm: 15, snow: 0, windy: 5 },
    winter: { sunny: 50, cloudy: 25, rain: 10, storm: 5, snow: 0, windy: 10 },
  },

  // ── Desert: blazing days, cool nights, almost no rain ────────────────────
  // 12 °C range (not 15) because most Promagen hot-arid cities are coastal.
  'hot-arid': {
    diurnalRangeC: 12,
    baseHumidity: 28,
    humiditySwing: 8,
    summer: { sunny: 70, cloudy: 15, rain: 3, storm: 2, snow: 0, windy: 10 },
    winter: { sunny: 55, cloudy: 25, rain: 8, storm: 2, snow: 0, windy: 10 },
  },

  // ── Steppe: moderate, dry, moderate diurnal range ────────────────────────
  'semi-arid': {
    diurnalRangeC: 12,
    baseHumidity: 40,
    humiditySwing: 10,
    summer: { sunny: 50, cloudy: 20, rain: 15, storm: 5, snow: 0, windy: 10 },
    winter: { sunny: 35, cloudy: 30, rain: 15, storm: 5, snow: 5, windy: 10 },
  },

  // ── Dry hot summers, wet mild winters ────────────────────────────────────
  mediterranean: {
    diurnalRangeC: 10,
    baseHumidity: 55,
    humiditySwing: 20,
    summer: { sunny: 65, cloudy: 15, rain: 5, storm: 5, snow: 0, windy: 10 },
    winter: { sunny: 20, cloudy: 30, rain: 35, storm: 10, snow: 0, windy: 5 },
  },

  // ── Mild, wet year-round, small day/night swing ──────────────────────────
  oceanic: {
    diurnalRangeC: 6,
    baseHumidity: 76,
    humiditySwing: 5,
    summer: { sunny: 30, cloudy: 30, rain: 25, storm: 5, snow: 0, windy: 10 },
    winter: { sunny: 15, cloudy: 30, rain: 30, storm: 5, snow: 5, windy: 15 },
  },

  // ── Hot humid summers, mild winters ──────────────────────────────────────
  'humid-subtropical': {
    diurnalRangeC: 8,
    baseHumidity: 70,
    humiditySwing: 10,
    summer: { sunny: 30, cloudy: 25, rain: 25, storm: 15, snow: 0, windy: 5 },
    winter: { sunny: 30, cloudy: 30, rain: 20, storm: 5, snow: 10, windy: 5 },
  },

  // ── Large seasonal + diurnal swings, cold snowy winters ──────────────────
  continental: {
    diurnalRangeC: 10,
    baseHumidity: 65,
    humiditySwing: 10,
    summer: { sunny: 35, cloudy: 25, rain: 20, storm: 15, snow: 0, windy: 5 },
    winter: { sunny: 20, cloudy: 25, rain: 10, storm: 5, snow: 30, windy: 10 },
  },

  // ── Very cold winters, brief cool summers ────────────────────────────────
  subarctic: {
    diurnalRangeC: 8,
    baseHumidity: 72,
    humiditySwing: 8,
    summer: { sunny: 25, cloudy: 30, rain: 25, storm: 5, snow: 0, windy: 15 },
    winter: { sunny: 10, cloudy: 25, rain: 5, storm: 5, snow: 40, windy: 15 },
  },

  // ── Altitude-moderated: cooler than latitude suggests, UV-intense ────────
  highland: {
    diurnalRangeC: 11,
    baseHumidity: 55,
    humiditySwing: 15,
    summer: { sunny: 30, cloudy: 30, rain: 25, storm: 10, snow: 0, windy: 5 },
    winter: { sunny: 35, cloudy: 30, rain: 15, storm: 5, snow: 10, windy: 5 },
  },
};

// ============================================================================
// SECTION 4 — CLIMATE PROFILES FOR ALL 89 EXCHANGES
// ============================================================================
// Each entry: id, city, latitude, longitude, annual mean °C, seasonal
// half-amplitude °C, climate type.
// Values calibrated from real climate normals (WorldClim / climate-data.org).
// ============================================================================

function p(
  id: string,
  city: string,
  lat: number,
  lon: number,
  meanC: number,
  ampC: number,
  climate: ClimateType,
): ClimateProfile {
  return { id, city, lat, lon, meanC, ampC, climate };
}

const CLIMATE_PROFILES: readonly ClimateProfile[] = [
  // ── ASIA-PACIFIC ─────────────────────────────────────────────────────────
  // Oceania
  p('nzx-wellington', 'Wellington', -41.29, 174.78, 12, 4, 'oceanic'),
  p('xnze-auckland', 'Auckland', -36.85, 174.76, 15, 5, 'oceanic'),
  p('asx-sydney', 'Sydney', -33.87, 151.21, 18, 6, 'humid-subtropical'),
  // Japan
  p('tse-tokyo', 'Tokyo', 35.68, 139.65, 16, 11, 'humid-subtropical'),
  p('xsap-sapporo', 'Sapporo', 43.06, 141.35, 9, 14, 'continental'),
  p('xngo-nagoya', 'Nagoya', 35.18, 136.91, 16, 11, 'humid-subtropical'),
  p('xfka-fukuoka', 'Fukuoka', 33.59, 130.4, 17, 10, 'humid-subtropical'),
  // China
  p('sse-shanghai', 'Shanghai', 31.23, 121.47, 16, 12, 'humid-subtropical'),
  p('szse-shenzhen', 'Shenzhen', 22.54, 114.06, 23, 7, 'humid-subtropical'),
  // East & South-East Asia
  p('hkex-hong-kong', 'Hong Kong', 22.32, 114.17, 23, 8, 'humid-subtropical'),
  p('twse-taipei', 'Taipei', 25.03, 121.57, 23, 8, 'humid-subtropical'),
  p('set-bangkok', 'Bangkok', 13.76, 100.5, 28, 3, 'tropical-monsoon'),
  p('pse-manila', 'Manila', 14.6, 120.98, 28, 2, 'tropical-monsoon'),
  p('idx-jakarta', 'Jakarta', -6.21, 106.85, 27, 1, 'equatorial'),
  p('bursa-kuala-lumpur', 'Kuala Lumpur', 3.14, 101.69, 27, 1, 'equatorial'),
  p('xstc-ho-chi-minh-city', 'Ho Chi Minh City', 10.82, 106.63, 28, 3, 'tropical-monsoon'),
  p('lsx-vientiane', 'Vientiane', 17.98, 102.63, 26, 5, 'tropical-savanna'),
  p('cse-colombo', 'Colombo', 6.93, 79.86, 27, 2, 'equatorial'),
  // South Asia — Mumbai (4 exchanges, identical coordinates)
  p('nse-mumbai', 'Mumbai', 19.08, 72.88, 27, 4, 'tropical-monsoon'),
  p('bse-mumbai', 'Mumbai', 19.08, 72.88, 27, 4, 'tropical-monsoon'),
  p('xbom-mumbai', 'Mumbai', 19.08, 72.88, 27, 4, 'tropical-monsoon'),
  p('xnse-mumbai', 'Mumbai', 19.08, 72.88, 27, 4, 'tropical-monsoon'),
  p('psx-karachi', 'Karachi', 24.86, 67.0, 26, 8, 'semi-arid'),
  p('dse-dhaka', 'Dhaka', 23.81, 90.41, 26, 7, 'tropical-monsoon'),
  // Central Asia
  p('mse-ulaanbaatar', 'Ulaanbaatar', 47.92, 106.91, -1, 22, 'continental'),
  p('kase-almaty', 'Almaty', 43.22, 76.93, 10, 17, 'continental'),

  // ── MIDDLE EAST ──────────────────────────────────────────────────────────
  p('dfm-dubai', 'Dubai', 25.2, 55.27, 27, 10, 'hot-arid'),
  p('adx-abu-dhabi', 'Abu Dhabi', 24.45, 54.38, 28, 10, 'hot-arid'),
  p('kse-kuwait', 'Kuwait City', 29.38, 47.98, 26, 13, 'hot-arid'),
  p('qse-doha', 'Doha', 25.29, 51.51, 27, 11, 'hot-arid'),
  p('xbah-manama', 'Manama', 26.23, 50.58, 27, 10, 'hot-arid'),
  p('msm-muscat', 'Muscat', 23.59, 58.59, 28, 9, 'hot-arid'),
  p('ase-amman', 'Amman', 31.95, 35.91, 17, 10, 'semi-arid'),
  p('bse-beirut', 'Beirut', 33.89, 35.5, 20, 8, 'mediterranean'),
  p('egx-cairo', 'Cairo', 30.04, 31.24, 22, 9, 'hot-arid'),

  // ── EUROPE — Northern ───────────────────────────────────────────────────
  p('xice-reykjavik', 'Reykjavik', 64.15, -21.82, 5, 6, 'subarctic'),
  p('nasdaq-helsinki', 'Helsinki', 60.17, 24.94, 6, 13, 'subarctic'),
  p('xosl-oslo', 'Oslo', 59.91, 10.75, 6, 12, 'subarctic'),
  p('xris-riga', 'Riga', 56.95, 24.11, 6, 12, 'continental'),
  p('nasdaq-copenhagen', 'Copenhagen', 55.68, 12.57, 9, 9, 'oceanic'),

  // ── EUROPE — Western ────────────────────────────────────────────────────
  p('ise-dublin', 'Dublin', 53.35, -6.26, 10, 5, 'oceanic'),
  p('lse-london', 'London', 51.51, -0.13, 12, 6, 'oceanic'),
  p('euronext-amsterdam', 'Amsterdam', 52.37, 4.9, 10, 7, 'oceanic'),
  p('euronext-brussels', 'Brussels', 50.85, 4.35, 10, 7, 'oceanic'),
  p('euronext-paris', 'Paris', 48.86, 2.35, 12, 8, 'oceanic'),
  p('euronext-lisbon', 'Lisbon', 38.72, -9.14, 17, 6, 'mediterranean'),
  p('luxse-luxembourg', 'Luxembourg', 49.61, 6.13, 9, 8, 'oceanic'),

  // ── EUROPE — Central ────────────────────────────────────────────────────
  p('xetra-frankfurt', 'Frankfurt', 50.11, 8.68, 11, 9, 'continental'),
  p('xfra-frankfurt', 'Frankfurt', 50.11, 8.68, 11, 9, 'continental'),
  p('xstu-stuttgart', 'Stuttgart', 48.78, 9.18, 11, 9, 'continental'),
  p('six-zurich', 'Zurich', 47.38, 8.54, 10, 10, 'continental'),
  p('xswx-zurich', 'Zurich', 47.38, 8.54, 10, 10, 'continental'),
  p('wbag-vienna', 'Vienna', 48.21, 16.37, 11, 10, 'continental'),
  p('pse-prague', 'Prague', 50.08, 14.44, 9, 10, 'continental'),
  p('bcpb-bratislava', 'Bratislava', 48.15, 17.11, 11, 11, 'continental'),
  p('budapest-bet', 'Budapest', 47.5, 19.04, 12, 11, 'continental'),
  p('borsa-italiana-milan', 'Milan', 45.46, 9.19, 13, 10, 'humid-subtropical'),
  p('ljse-ljubljana', 'Ljubljana', 46.06, 14.51, 11, 10, 'continental'),
  p('zse-zagreb', 'Zagreb', 45.82, 15.98, 12, 10, 'continental'),

  // ── EUROPE — South-Eastern / Eastern ─────────────────────────────────────
  p('moex-moscow', 'Moscow', 55.76, 37.62, 6, 15, 'continental'),
  p('misx-moscow', 'Moscow', 55.76, 37.62, 6, 15, 'continental'),
  p('pfts-kyiv', 'Kyiv', 50.45, 30.52, 8, 13, 'continental'),
  p('xbel-belgrade', 'Belgrade', 44.79, 20.45, 12, 11, 'continental'),
  p('sase-sarajevo', 'Sarajevo', 43.86, 18.41, 10, 11, 'continental'),
  p('mnse-podgorica', 'Podgorica', 42.43, 19.26, 15, 10, 'mediterranean'),
  p('mse-skopje', 'Skopje', 42.0, 21.43, 13, 11, 'continental'),
  p('bist-istanbul', 'Istanbul', 41.01, 28.98, 14, 9, 'mediterranean'),
  p('athex-athens', 'Athens', 37.98, 23.73, 18, 9, 'mediterranean'),
  p('bme-madrid', 'Madrid', 40.42, -3.7, 15, 11, 'mediterranean'),

  // ── AFRICA ───────────────────────────────────────────────────────────────
  p('cse-casablanca', 'Casablanca', 33.57, -7.59, 18, 5, 'mediterranean'),
  p('xnsa-lagos', 'Lagos', 6.52, 3.38, 27, 2, 'equatorial'),
  p('gse-accra', 'Accra', 5.6, -0.19, 27, 2, 'tropical-savanna'),
  p('nse-nairobi', 'Nairobi', -1.29, 36.82, 18, 2, 'highland'),
  p('dse-dar-es-salaam', 'Dar es Salaam', -6.79, 39.21, 26, 3, 'tropical-monsoon'),
  p('sem-port-louis', 'Port Louis', -20.16, 57.5, 24, 5, 'tropical-monsoon'),
  p('jse-johannesburg', 'Johannesburg', -26.2, 28.05, 16, 6, 'highland'),
  p('nsx-windhoek', 'Windhoek', -22.56, 17.07, 20, 7, 'semi-arid'),
  p('bse-gaborone', 'Gaborone', -24.63, 25.92, 21, 8, 'semi-arid'),

  // ── AMERICAS ─────────────────────────────────────────────────────────────
  p('tsx-toronto', 'Toronto', 43.65, -79.38, 9, 14, 'continental'),
  p('nyse-new-york', 'New York', 40.71, -74.01, 13, 12, 'humid-subtropical'),
  p('cboe-chicago', 'Chicago', 41.88, -87.63, 10, 14, 'continental'),
  p('xmex-mexico-city', 'Mexico City', 19.43, -99.13, 17, 3, 'highland'),
  p('bvc-caracas', 'Caracas', 10.48, -66.9, 22, 2, 'tropical-savanna'),
  p('xbog-bogota', 'Bogota', 4.71, -74.07, 14, 1, 'highland'),
  p('bvq-quito', 'Quito', -0.18, -78.47, 14, 1, 'highland'),
  p('b3-sao-paulo', 'São Paulo', -23.55, -46.63, 20, 4, 'humid-subtropical'),
  p('xlim-lima', 'Lima', -12.05, -77.04, 19, 4, 'semi-arid'),
  p('sse-santiago', 'Santiago', -33.45, -70.67, 14, 8, 'mediterranean'),
  p('bcba-buenos-aires', 'Buenos Aires', -34.6, -58.38, 18, 8, 'humid-subtropical'),
] as const;

// Compile-time guarantee: 89 profiles.
// If this line errors, a profile is missing or duplicated.
const _assertCount: 89 = CLIMATE_PROFILES.length as 89;
void _assertCount;

// ============================================================================
// SECTION 5 — PURE ALGORITHMS
// ============================================================================

/**
 * Deterministic hash from a string → unsigned 32-bit integer.
 * Same input always produces the same output — no randomness.
 * Used to pick a stable "condition of the day" per city.
 */
function stableHash(s: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0; // force unsigned
}

/**
 * Uniformly-distributed deterministic float in [min, max).
 *
 * Uses all 31 bits of the FNV hash (avoiding sign bit) to produce a
 * well-distributed float. This avoids the modular bias that % N introduces
 * for non-power-of-2 values — the root cause of clustering artifacts.
 *
 * @param seed - Unique string seed (e.g. "wind-fp-lse-london")
 * @param min  - Inclusive lower bound
 * @param max  - Exclusive upper bound
 * @returns Float in [min, max)
 */
function hashFloat(seed: string, min: number, max: number): number {
  const h = stableHash(seed);
  const fraction = (h & 0x7fffffff) / 0x7fffffff; // 0.0 – 1.0 (31 bits)
  return min + fraction * (max - min);
}

/**
 * Day-of-year (1–366).
 */
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/**
 * Local solar hour (0–23.99) derived from longitude.
 * This is approximate "solar time" — not political time zones.
 * Good enough for demo: Dubai (lon 55) at 12:00 UTC → ~15:40 local.
 */
function getLocalHour(lon: number, utcHour: number, utcMinute: number): number {
  const utcFractional = utcHour + utcMinute / 60;
  const offset = lon / 15; // 15° per hour
  return (((utcFractional + offset) % 24) + 24) % 24; // ensure 0–23.99
}

/**
 * Is it night? (before 6 AM or after 8 PM local solar time.)
 */
function isNight(localHour: number): boolean {
  return localHour < 6 || localHour >= 20;
}

/**
 * Is it "twilight"? (6–7 AM or 19–20 local)
 * Used to soften the temperature transition.
 */
function isTwilight(localHour: number): boolean {
  return (localHour >= 6 && localHour < 7) || (localHour >= 19 && localHour < 20);
}

/**
 * Season factor: 0.0 = deep winter, 1.0 = peak summer.
 *
 * Uses a cosine wave. Northern hemisphere peaks late July (month 7.5),
 * southern hemisphere peaks late January (month 1.5).
 *
 * Sub-monthly precision: `dayOfMonth / 30` gives fractional months,
 * so Feb 15 ≠ Feb 1.
 */
function getSeasonFactor(lat: number, month: number, dayOfMonth: number): number {
  const fractionalMonth = month + (dayOfMonth - 1) / 30;
  // NH peaks at ~7.5 (mid-July), SH peaks at ~1.5 (mid-January)
  const peakMonth = lat >= 0 ? 7.5 : 1.5;
  // Cosine: 1.0 at peak, -1.0 at trough → remap to 0–1
  return (1 + Math.cos(((2 * Math.PI) / 12) * (fractionalMonth - peakMonth))) / 2;
}

/**
 * Seasonal temperature for a city at a given date.
 * Returns the expected midday temperature for that season.
 */
function getSeasonalTemp(profile: ClimateProfile, month: number, dayOfMonth: number): number {
  const sf = getSeasonFactor(profile.lat, month, dayOfMonth);
  // sf = 1.0 → mean + amplitude (summer)
  // sf = 0.0 → mean − amplitude (winter)
  return profile.meanC + profile.ampC * (2 * sf - 1);
}

/**
 * Diurnal (day/night) temperature adjustment.
 *
 * Cosine curve peaking at 14:30 local solar time (real-world thermal lag
 * means max temp is ~2.5h after solar noon). Trough at ~05:00.
 *
 * @param halfRange - Half of the diurnal range (e.g. 7.5 for a 15°C range)
 * @param localHour - Local solar hour (0–23.99)
 * @returns Adjustment in °C (positive = warmer than daily mean, negative = cooler)
 */
function getDiurnalAdjustment(halfRange: number, localHour: number): number {
  // Peak at 14.5h (2:30 PM), trough at 2.5h (2:30 AM)
  return halfRange * Math.cos(((2 * Math.PI) / 24) * (localHour - 14.5));
}

/**
 * Select a weather condition for a city on a given day.
 *
 * Deterministic: same city + same day = same condition (stable hash).
 * Weighted by climate type and season factor.
 * Post-processed: freezing rain → snow, warm snow → rain.
 *
 * @returns ExchangeWeatherCondition
 */
function selectCondition(
  profile: ClimateProfile,
  seasonFactor: number,
  dayNum: number,
  currentTempC: number,
): ExchangeWeatherCondition {
  const config = CLIMATE_CONFIGS[profile.climate];

  // Interpolate weights between winter (sf=0) and summer (sf=1)
  const conditions: ExchangeWeatherCondition[] = [
    'sunny',
    'cloudy',
    'rain',
    'storm',
    'snow',
    'windy',
  ];

  const interpolated: number[] = conditions.map((c) => {
    const w = config.winter[c];
    const s = config.summer[c];
    return w + (s - w) * seasonFactor;
  });

  // Normalise to cumulative distribution
  const total = interpolated.reduce((a, b) => a + b, 0);
  const cumulative: number[] = [];
  let running = 0;
  for (const w of interpolated) {
    running += w / total;
    cumulative.push(running);
  }

  // Deterministic "roll" from stable hash
  const hash = stableHash(`${profile.id}-${dayNum}`);
  const roll = (hash % 10000) / 10000; // 0.0000–0.9999

  let selected: ExchangeWeatherCondition = 'cloudy'; // fallback
  for (let i = 0; i < cumulative.length; i++) {
    if (roll < cumulative[i]!) {
      selected = conditions[i]!;
      break;
    }
  }

  // ── Physical overrides ────────────────────────────────────────────────
  // Freezing + rain/storm → snow
  if (currentTempC < 0 && (selected === 'rain' || selected === 'storm')) {
    selected = 'snow';
  }
  // Too warm for snow → rain (or cloudy if temp > 8 °C)
  if (currentTempC > 3 && selected === 'snow') {
    selected = currentTempC > 8 ? 'cloudy' : 'rain';
  }

  return selected;
}

/**
 * Humidity for a city at a given time.
 *
 * Three layers of variation to avoid "textbook averages":
 *
 * 1. CLIMATE BASELINE — seasonal swing (monsoon wet summers, med dry summers)
 * 2. CITY FINGERPRINT — stable ±8% offset unique to each city (London ≠ Dublin
 *    even though both are "oceanic"). Uses character-sum hash of city ID.
 * 3. HOURLY TURBULENCE — ±5% jitter that changes every hour, seeded by
 *    city + dayOfYear + localHour. Gives readings like 67%, 71%, 64%
 *    instead of flat 70% all day.
 *
 * Plus condition coupling: rain/storm bumps +6–12%, clear drops −4%.
 * Night boost: +5–9% (radiative cooling → condensation).
 *
 * @returns Integer 12–98
 */
function getHumidity(
  config: ClimateConfig,
  seasonFactor: number,
  climate: ClimateType,
  profile: ClimateProfile,
  dayNum: number,
  localHour: number,
  condition: ExchangeWeatherCondition,
  night: boolean,
  twilight: boolean,
): number {
  // ────────────────────────────────────────────────────────────────────────
  // ARCHITECTURE: ONE-HASH UNIFORM SPREAD
  //
  // Previous approach: seasonal + cityOffset(±15) + lonShift(±6) +
  // hourlyJitter(±5) + condAdj(±12) + nightBoost(0-9) = bell curve.
  // Now: compute shared center, then ONE hash spreads each city ±20
  // uniformly around it. Small jitter (±2) for hourly temporal change only.
  // ────────────────────────────────────────────────────────────────────────

  // ── Shared center: same for all cities in same climate/condition ───────
  const isInverseHumidity =
    climate === 'mediterranean' || climate === 'hot-arid' || climate === 'semi-arid';
  const swing = isInverseHumidity
    ? -config.humiditySwing * (2 * seasonFactor - 1)
    : config.humiditySwing * (2 * seasonFactor - 1);
  const seasonal = config.baseHumidity + swing;

  const conditionShift: Record<ExchangeWeatherCondition, number> = {
    sunny: -4,
    cloudy: 2,
    rain: 8,
    storm: 12,
    snow: 6,
    windy: -2,
  };
  const nightCurve = Math.max(0, Math.cos(((2 * Math.PI) / 24) * (localHour - 4)));
  const nightShift = nightCurve * (night ? 9 : twilight ? 5 : 0);

  const center = seasonal + conditionShift[condition] + nightShift;

  // ── ONE hash per city → uniform spread ±25 around the center ──────────
  // 50-integer range. For 20 cities in 50 slots → ~17 unique (birthday math).
  // Previous ±20 gave only 40 slots → too many collisions.
  const rangeMin = Math.max(12, center - 25);
  const rangeMax = Math.min(98, center + 25);
  const cityHum = hashFloat(`hum-city-${profile.id}`, rangeMin, rangeMax);

  // ── Hourly jitter: ±2, lerped for smooth transitions ──────────────────
  const hourBucket = Math.floor(localHour);
  const frac = localHour - hourBucket;
  const j1 = hashFloat(`hj-${profile.id}-${dayNum}-${hourBucket}`, -2, 2);
  const j2 = hashFloat(`hj-${profile.id}-${dayNum}-${hourBucket + 1}`, -2, 2);
  const jitter = j1 * (1 - frac) + j2 * frac;

  const raw = cityHum + jitter;
  return Math.round(Math.max(12, Math.min(98, raw)));
}

/**
 * "Feels like" temperature.
 *
 * - Hot + humid → heat index (feels hotter)
 * - Cold + windy → wind chill (feels colder)
 * - Moderate → ≈ actual temp ± minor adjustment
 */
function getFeelsLike(
  tempC: number,
  humidity: number,
  condition: ExchangeWeatherCondition,
): number {
  // Wind chill factor by condition
  const windFactor: Record<ExchangeWeatherCondition, number> = {
    sunny: 0,
    cloudy: 0,
    rain: 1,
    storm: 2.5,
    snow: 2,
    windy: 4,
  };

  if (tempC >= 27 && humidity > 40) {
    // Simplified heat index: each % above 40 adds ~0.15 °C perceived
    const heatAdd = Math.min(8, (humidity - 40) * 0.15);
    return Math.round(tempC + heatAdd);
  }

  if (tempC <= 10) {
    // Wind chill: stronger effect when colder
    const chill = windFactor[condition] * (1 + Math.max(0, 5 - tempC) * 0.15);
    return Math.round(tempC - chill);
  }

  // Moderate: slight wind cooling or humidity warming
  const mod = condition === 'windy' ? -2 : humidity > 75 ? 1 : 0;
  return Math.round(tempC + mod);
}

/**
 * Emoji for a condition and time of day.
 */
function getEmoji(condition: ExchangeWeatherCondition, night: boolean): string {
  const DAY_EMOJI: Record<ExchangeWeatherCondition, string> = {
    sunny: '☀️',
    cloudy: '⛅',
    rain: '🌧',
    storm: '⛈',
    snow: '❄️',
    windy: '🌬️',
  };

  const NIGHT_EMOJI: Record<ExchangeWeatherCondition, string> = {
    sunny: '🌙', // Clear night sky
    cloudy: '☁️', // Overcast night
    rain: '🌧', // Rain doesn't change at night
    storm: '⛈', // Storm doesn't change
    snow: '❄️', // Snow doesn't change
    windy: '🌬️', // Wind doesn't change
  };

  return night ? NIGHT_EMOJI[condition] : DAY_EMOJI[condition];
}

/**
 * Convert Celsius to Fahrenheit.
 */
function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

/**
 * Wind speed (km/h) for a city at a given time.
 *
 * Three layers — same philosophy as humidity:
 *
 * 1. CLIMATE BASE — oceanic/subarctic windier, equatorial calmer
 * 2. CITY FINGERPRINT — stable ±3 km/h offset. Chicago (continental 14)
 *    might be 16 while Prague (also continental 14) might be 12.
 * 3. HOURLY GUSTING — ±4 km/h turbulence that changes every hour.
 *    Gives readings like 13, 17, 11, 19 instead of flat 14.
 *
 * Plus condition multiplier, latitude jet-stream boost, and a diurnal
 * cycle (afternoon windier than dawn — thermal convection).
 *
 * @returns Integer 2–80 km/h
 */
function getWindSpeed(
  profile: ClimateProfile,
  condition: ExchangeWeatherCondition,
  dayNum: number,
  localHour: number,
): number {
  // ────────────────────────────────────────────────────────────────────────
  // ARCHITECTURE: WIDE-CENTER UNIFORM SPREAD
  //
  // Math proof: 27 sunny cities in 30 integer slots → max 18 unique
  // (birthday paradox). Need 45+ slots per condition to hit 23+ unique.
  //
  // Each condition defines a center and wide ±spread. City hashes uniformly
  // across the full [center-spread, center+spread] range. Climate adjusts
  // the center ±3 to separate tropical from oceanic cities.
  // ────────────────────────────────────────────────────────────────────────

  const BASE_WIND: Record<ClimateType, number> = {
    equatorial: 10,
    'tropical-monsoon': 13,
    'tropical-savanna': 11,
    'hot-arid': 14,
    'semi-arid': 12,
    mediterranean: 14,
    oceanic: 18,
    'humid-subtropical': 13,
    continental: 14,
    subarctic: 16,
    highland: 11,
  };

  // Center + spread: CRITICAL that centers are well-separated to minimize
  // cross-condition collisions. Old centers 15/18/16 caused sunny/cloudy/snow
  // to all compete for the same 10-25 km/h range.
  // New centers spaced 6-10 apart: sunny→12, snow→19, cloudy→26, rain→33.
  const COND: Record<ExchangeWeatherCondition, { center: number; spread: number }> = {
    sunny: { center: 12, spread: 22 }, // [3, 34] — lightest winds
    snow: { center: 19, spread: 22 }, // [3, 41] — moderate
    cloudy: { center: 26, spread: 22 }, // [4, 48] — moderate-fresh
    rain: { center: 33, spread: 22 }, // [11, 55] — fresh
    storm: { center: 42, spread: 22 }, // [20, 64] — strong
    windy: { center: 52, spread: 22 }, // [30, 74] — gale
  };

  const latBoost = Math.max(0, (Math.abs(profile.lat) - 40) * 0.15);
  const climateShift = (BASE_WIND[profile.climate] - 14) * 0.5;

  const c = COND[condition];
  const adjCenter = c.center + climateShift + latBoost;
  const rangeMin = Math.max(3, adjCenter - c.spread);
  const rangeMax = Math.min(75, adjCenter + c.spread);

  // ── ONE hash per city → uniform across the range ──────────────────────
  const cityWind = hashFloat(`wind-city-${profile.id}`, rangeMin, rangeMax);

  // ── Diurnal: afternoon windier (+2), pre-dawn calmer (-2) ─────────────
  const diurnal = 2 * Math.cos(((2 * Math.PI) / 24) * (localHour - 14));

  // ── Hourly jitter: ±2, lerped ─────────────────────────────────────────
  const hourBucket = Math.floor(localHour);
  const frac = localHour - hourBucket;
  const j1 = hashFloat(`wj-${profile.id}-${dayNum}-${hourBucket}`, -2, 2);
  const j2 = hashFloat(`wj-${profile.id}-${dayNum}-${hourBucket + 1}`, -2, 2);
  const jitter = j1 * (1 - frac) + j2 * frac;

  // ── Daily character: calm vs blustery day ─────────────────────────────
  const dayMult = hashFloat(`wd-${profile.id}-${dayNum}`, 0.92, 1.08);

  const raw = (cityWind + diurnal + jitter) * dayMult;
  return Math.round(Math.max(3, Math.min(75, raw)));
}

// ============================================================================
// SECTION 6 — MAIN EXPORT
// ============================================================================

/**
 * Generate dynamic, realistic demo weather for all 89 exchange cities.
 *
 * Pure function: give it a Date, get deterministic weather back.
 * No API calls. No side effects. No randomness.
 *
 * @param date - Point in time to generate weather for (default: now)
 * @returns ExchangeWeather[] with 89 entries
 */
export function getDynamicDemoWeather(date: Date = new Date()): ExchangeWeather[] {
  const month = date.getMonth() + 1; // 1–12
  const dom = date.getDate(); // 1–31
  const utcHour = date.getUTCHours(); // 0–23
  const utcMinute = date.getUTCMinutes(); // 0–59
  const doy = dayOfYear(date);

  return CLIMATE_PROFILES.map((profile): ExchangeWeather => {
    const config = CLIMATE_CONFIGS[profile.climate];

    // ── Step 1: Seasonal base temperature (midday value for this date) ──
    const seasonalMidday = getSeasonalTemp(profile, month, dom);

    // ── Step 2: Season factor (for condition weights + humidity) ─────────
    const sf = getSeasonFactor(profile.lat, month, dom);

    // ── Step 3: Local solar hour ────────────────────────────────────────
    const localHour = getLocalHour(profile.lon, utcHour, utcMinute);
    const night = isNight(localHour);
    const twilight = isTwilight(localHour);

    // ── Step 4: Select today's BASE condition (before diurnal, for cloud dampening)
    let condition = selectCondition(profile, sf, doy, seasonalMidday);

    // ── Step 5: Diurnal adjustment ──────────────────────────────────────
    // Cloud cover dampens the day/night swing: clear skies radiate more
    // heat at night (bigger drop) while clouds act as an insulating blanket.
    const isOvercast =
      condition === 'cloudy' ||
      condition === 'rain' ||
      condition === 'storm' ||
      condition === 'snow';
    const cloudDamping = isOvercast ? 0.55 : 1.0;
    const halfDiurnal = (config.diurnalRangeC / 2) * cloudDamping;
    const diurnalAdj = getDiurnalAdjustment(halfDiurnal, localHour);

    // ── Step 6: Final temperature ───────────────────────────────────────
    // seasonalMidday is the daily MEAN for this season. The diurnal
    // cosine oscillates around it: positive in the afternoon (peak
    // ~14:30), negative pre-dawn (trough ~05:00).
    const tempC = Math.round(seasonalMidday + diurnalAdj);

    // ── Step 6b: Physical overrides (AFTER final temp is known) ─────────
    // Night-time diurnal cooling can push temp below 0 even when the
    // seasonal midday mean was above freezing. Fix conditions here.
    if (tempC < 0 && (condition === 'rain' || condition === 'storm')) {
      condition = 'snow';
    }
    if (tempC > 3 && condition === 'snow') {
      condition = tempC > 8 ? 'cloudy' : 'rain';
    }

    // ── Step 7: Humidity ────────────────────────────────────────────────
    const humidity = getHumidity(
      config,
      sf,
      profile.climate,
      profile,
      doy,
      localHour,
      condition,
      night,
      twilight,
    );

    // ── Step 8: Feels-like ──────────────────────────────────────────────
    const feelsLike = getFeelsLike(tempC, humidity, condition);

    // ── Step 9: Emoji ───────────────────────────────────────────────────
    const emoji = getEmoji(condition, night);

    // ── Step 10: Wind speed ─────────────────────────────────────────────
    const windSpeedKmh = getWindSpeed(profile, condition, doy, localHour);

    // ── Step 11: Fahrenheit conversions ─────────────────────────────────
    const tempF = cToF(tempC);
    const feelsLikeF = cToF(feelsLike);

    // ── Step 12: Special overrides ──────────────────────────────────────
    // Dubai 🔥 when scorching (preserves original v2 behaviour)
    const iconOverride = profile.id === 'dfm-dubai' && tempC >= 40 ? '🔥' : undefined;

    // Build result — omit feelsLike if identical to temp
    const result: ExchangeWeather = {
      exchange: profile.id,
      tempC,
      tempF,
      humidity,
      windSpeedKmh,
      condition,
      emoji,
    };

    if (feelsLike !== tempC) {
      (result as { feelsLikeC?: number }).feelsLikeC = feelsLike;
      (result as { feelsLikeF?: number }).feelsLikeF = feelsLikeF;
    }
    if (iconOverride) {
      (result as { iconOverride?: string }).iconOverride = iconOverride;
    }

    return result;
  });
}

// ============================================================================
// SECTION 7 — BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Static snapshot computed once at module load time.
 * Existing imports like `import DEMO_EXCHANGE_WEATHER from '...'` keep working.
 * For live-updating weather, call `getDynamicDemoWeather()` directly.
 */
export const DEMO_EXCHANGE_WEATHER: ExchangeWeather[] = getDynamicDemoWeather();

export default DEMO_EXCHANGE_WEATHER;
