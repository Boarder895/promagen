// src/lib/geo/tz-longitudes.ts
// ============================================================================
// TIMEZONE → LONGITUDE STATIC LOOKUP
// ============================================================================
// Maps IANA timezone names to representative city longitudes.
// Used by useExchangeOrder to determine Pro user's anchor point for
// exchange rail rotation — no Geolocation API prompt needed.
//
// Source: Representative city coordinates from IANA tz database.
// Covers all major population centres. Unknown timezones fall back to null.
//
// Authority: docs/authority/exchange-ordering.md §3.3
// ============================================================================

/**
 * Static mapping of IANA timezone → representative longitude.
 * Covers ~120 major timezones (all population centres >500K).
 */
const TZ_LONGITUDES: Record<string, number> = {
  // ── Pacific ─────────────────────────────────────────────────────────
  'Pacific/Auckland': 174.8,
  'Pacific/Fiji': 178.4,
  'Pacific/Chatham': -176.5,
  'Pacific/Tongatapu': -175.2,
  'Pacific/Apia': -171.8,
  'Pacific/Honolulu': -155.5,
  'Pacific/Pago_Pago': -170.7,
  'Pacific/Tahiti': -149.4,
  'Pacific/Marquesas': -139.5,
  'Pacific/Gambier': -134.9,
  'Pacific/Pitcairn': -130.1,
  'Pacific/Galapagos': -90.3,
  'Pacific/Easter': -109.4,
  'Pacific/Norfolk': 167.9,
  'Pacific/Guam': 144.8,
  'Pacific/Port_Moresby': 147.2,

  // ── Australasia ─────────────────────────────────────────────────────
  'Australia/Sydney': 151.2,
  'Australia/Melbourne': 145.0,
  'Australia/Brisbane': 153.0,
  'Australia/Perth': 115.9,
  'Australia/Adelaide': 138.6,
  'Australia/Darwin': 130.8,
  'Australia/Hobart': 147.3,
  'Australia/Lord_Howe': 159.1,

  // ── East Asia ───────────────────────────────────────────────────────
  'Asia/Tokyo': 139.7,
  'Asia/Seoul': 127.0,
  'Asia/Shanghai': 121.5,
  'Asia/Chongqing': 106.6,
  'Asia/Hong_Kong': 114.2,
  'Asia/Taipei': 121.5,
  'Asia/Macau': 113.5,
  'Asia/Ulaanbaatar': 106.9,

  // ── Southeast Asia ──────────────────────────────────────────────────
  'Asia/Singapore': 103.8,
  'Asia/Kuala_Lumpur': 101.7,
  'Asia/Bangkok': 100.5,
  'Asia/Ho_Chi_Minh': 106.7,
  'Asia/Jakarta': 106.8,
  'Asia/Makassar': 119.4,
  'Asia/Jayapura': 140.7,
  'Asia/Manila': 121.0,
  'Asia/Phnom_Penh': 104.9,
  'Asia/Yangon': 96.2,
  'Asia/Brunei': 114.9,
  'Asia/Vientiane': 102.6,

  // ── South Asia ──────────────────────────────────────────────────────
  'Asia/Kolkata': 72.9,
  'Asia/Colombo': 79.9,
  'Asia/Kathmandu': 85.3,
  'Asia/Dhaka': 90.4,
  'Asia/Karachi': 67.0,
  'Asia/Thimphu': 89.6,

  // ── Central Asia ────────────────────────────────────────────────────
  'Asia/Almaty': 76.9,
  'Asia/Tashkent': 69.3,
  'Asia/Bishkek': 74.6,
  'Asia/Ashgabat': 58.4,
  'Asia/Dushanbe': 68.8,

  // ── Middle East ─────────────────────────────────────────────────────
  'Asia/Dubai': 55.3,
  'Asia/Qatar': 51.5,
  'Asia/Bahrain': 50.6,
  'Asia/Riyadh': 46.7,
  'Asia/Kuwait': 47.9,
  'Asia/Muscat': 58.4,
  'Asia/Tehran': 51.4,
  'Asia/Baghdad': 44.4,
  'Asia/Jerusalem': 35.2,
  'Asia/Beirut': 35.5,
  'Asia/Amman': 35.9,
  'Asia/Damascus': 36.3,
  'Asia/Nicosia': 33.4,
  'Asia/Tbilisi': 44.8,
  'Asia/Yerevan': 44.5,
  'Asia/Baku': 49.9,

  // ── Africa ──────────────────────────────────────────────────────────
  'Africa/Johannesburg': 28.0,
  'Africa/Cairo': 31.2,
  'Africa/Lagos': 3.4,
  'Africa/Nairobi': 36.8,
  'Africa/Casablanca': -7.6,
  'Africa/Accra': -0.2,
  'Africa/Dar_es_Salaam': 39.3,
  'Africa/Addis_Ababa': 38.7,
  'Africa/Khartoum': 32.5,
  'Africa/Tunis': 10.2,
  'Africa/Algiers': 3.1,
  'Africa/Tripoli': 13.2,
  'Africa/Maputo': 32.6,
  'Africa/Harare': 31.0,
  'Africa/Windhoek': 17.1,
  'Africa/Luanda': 13.2,
  'Africa/Abidjan': -4.0,
  'Africa/Dakar': -17.4,

  // ── Europe ──────────────────────────────────────────────────────────
  'Europe/London': -0.1,
  'Europe/Dublin': -6.3,
  'Europe/Lisbon': -9.1,
  'Europe/Paris': 2.3,
  'Europe/Berlin': 13.4,
  'Europe/Madrid': -3.7,
  'Europe/Rome': 12.5,
  'Europe/Amsterdam': 4.9,
  'Europe/Brussels': 4.4,
  'Europe/Zurich': 8.5,
  'Europe/Vienna': 16.4,
  'Europe/Stockholm': 18.1,
  'Europe/Oslo': 10.7,
  'Europe/Copenhagen': 12.6,
  'Europe/Helsinki': 24.9,
  'Europe/Warsaw': 21.0,
  'Europe/Prague': 14.4,
  'Europe/Budapest': 19.0,
  'Europe/Bucharest': 26.1,
  'Europe/Athens': 23.7,
  'Europe/Istanbul': 29.0,
  'Europe/Moscow': 37.6,
  'Europe/Kiev': 30.5,
  'Europe/Belgrade': 20.5,
  'Europe/Zagreb': 16.0,
  'Europe/Ljubljana': 14.5,
  'Europe/Bratislava': 17.1,
  'Europe/Riga': 24.1,
  'Europe/Tallinn': 24.7,
  'Europe/Vilnius': 25.3,
  'Europe/Luxembourg': 6.1,
  'Europe/Skopje': 21.4,
  'Europe/Podgorica': 19.3,
  'Europe/Sarajevo': 18.4,
  'Europe/Reykjavik': -22.0,
  'Atlantic/Reykjavik': -22.0,

  // ── Americas — North ────────────────────────────────────────────────
  'America/New_York': -74.0,
  'America/Chicago': -87.6,
  'America/Denver': -104.9,
  'America/Los_Angeles': -118.2,
  'America/Phoenix': -112.1,
  'America/Anchorage': -149.9,
  'America/Toronto': -79.4,
  'America/Vancouver': -123.1,
  'America/Edmonton': -113.5,
  'America/Winnipeg': -97.1,
  'America/Halifax': -63.6,
  'America/St_Johns': -52.7,
  'America/Mexico_City': -99.1,
  'America/Monterrey': -100.3,
  'America/Tijuana': -117.0,

  // ── Americas — Central & Caribbean ──────────────────────────────────
  'America/Guatemala': -90.5,
  'America/Tegucigalpa': -87.2,
  'America/Managua': -86.3,
  'America/San_Jose': -84.1,
  'America/Panama': -79.5,
  'America/Havana': -82.4,
  'America/Jamaica': -76.8,
  'America/Port-au-Prince': -72.3,
  'America/Santo_Domingo': -69.9,

  // ── Americas — South ────────────────────────────────────────────────
  'America/Sao_Paulo': -46.6,
  'America/Buenos_Aires': -58.4,
  'America/Santiago': -70.7,
  'America/Lima': -77.0,
  'America/Bogota': -74.1,
  'America/Caracas': -66.9,
  'America/Guayaquil': -79.9,
  'America/La_Paz': -68.1,
  'America/Asuncion': -57.6,
  'America/Montevideo': -56.2,

  // ── Indian Ocean ────────────────────────────────────────────────────
  'Indian/Maldives': 73.5,
  'Indian/Mauritius': 57.5,
  'Indian/Reunion': 55.5,
};

/**
 * Get a representative longitude for the user's browser timezone.
 * Returns null if the timezone is not in the lookup table.
 *
 * Uses `Intl.DateTimeFormat().resolvedOptions().timeZone` —
 * no Geolocation API, no permission prompt, works silently.
 *
 * @returns longitude in decimal degrees, or null if unknown
 */
export function getUserLongitude(): number | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_LONGITUDES[tz] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get a human-readable city name from the browser's timezone.
 * e.g. "Asia/Tokyo" → "Tokyo", "America/New_York" → "New York"
 *
 * @returns city name string, or "Your Location" as fallback
 */
export function getUserCityFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = tz.split('/').pop()?.replace(/_/g, ' ');
    return city || 'Your Location';
  } catch {
    return 'Your Location';
  }
}

export default TZ_LONGITUDES;
