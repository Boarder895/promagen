// src/lib/fx/fx-currency-city-map.ts
// ============================================================================
// FX CURRENCY → CITY MAP — Tooltip Data for FX Ribbon Flags
// ============================================================================
// Maps each currency code to the financial city whose weather data
// drives the city-vibes image prompt on that flag's tooltip.
//
// USD flags alternate deterministically between New York (NYSE) and
// Chicago (CBOE) based on their SSOT pair index. The SSOT pair order
// is fixed (fx.selected.json) so the distribution is stable:
//   5 × New York, 4 × Chicago.
//
// Each entry matches an exchange in exchanges.catalog.json so the
// weatherIndex Map (keyed by exchange ID) resolves real weather data.
//
// Authority: docs/authority/ribbon-homepage.md
// Existing features preserved: Yes
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface CurrencyCityInfo {
  /** City name as it appears in exchanges.catalog.json */
  city: string;
  /** City key for city-vibes.json lookup (lowercase) */
  vibesKey: string;
  /** Exchange ID in exchanges.catalog.json (used to look up weatherIndex) */
  exchangeId: string;
  /** Latitude for solar elevation / lighting engine */
  latitude: number;
  /** Longitude for solar elevation / lighting engine */
  longitude: number;
  /** IANA timezone for local hour derivation */
  tz: string;
}

// ============================================================================
// STATIC CURRENCY → CITY MAP (non-USD currencies)
// ============================================================================

const CURRENCY_CITY_MAP: Record<string, CurrencyCityInfo> = {
  EUR: {
    city: 'Frankfurt',
    vibesKey: 'frankfurt',
    exchangeId: 'xetra-frankfurt',
    latitude: 50.1109,
    longitude: 8.6821,
    tz: 'Europe/Berlin',
  },
  GBP: {
    city: 'London',
    vibesKey: 'london',
    exchangeId: 'lse-london',
    latitude: 51.5074,
    longitude: -0.1276,
    tz: 'Europe/London',
  },
  ZAR: {
    city: 'Johannesburg',
    vibesKey: 'johannesburg',
    exchangeId: 'jse-johannesburg',
    latitude: -26.2041,
    longitude: 28.0473,
    tz: 'Africa/Johannesburg',
  },
  CAD: {
    city: 'Toronto',
    vibesKey: 'toronto',
    exchangeId: 'tsx-toronto',
    latitude: 43.6532,
    longitude: -79.3832,
    tz: 'America/Toronto',
  },
  CNY: {
    city: 'Shanghai',
    vibesKey: 'shanghai',
    exchangeId: 'sse-shanghai',
    latitude: 31.2304,
    longitude: 121.4737,
    tz: 'Asia/Shanghai',
  },
  INR: {
    city: 'Mumbai',
    vibesKey: 'mumbai',
    exchangeId: 'nse-mumbai',
    latitude: 19.076,
    longitude: 72.8777,
    tz: 'Asia/Kolkata',
  },
  BRL: {
    city: 'São Paulo',
    vibesKey: 'são paulo',
    exchangeId: 'b3-sao-paulo',
    latitude: -23.5505,
    longitude: -46.6333,
    tz: 'America/Sao_Paulo',
  },
  AUD: {
    city: 'Sydney',
    vibesKey: 'sydney',
    exchangeId: 'asx-sydney',
    latitude: -33.8688,
    longitude: 151.2093,
    tz: 'Australia/Sydney',
  },
  NOK: {
    city: 'Oslo',
    vibesKey: 'oslo',
    exchangeId: 'xosl-oslo',
    latitude: 59.9139,
    longitude: 10.7522,
    tz: 'Europe/Oslo',
  },
  MYR: {
    city: 'Kuala Lumpur',
    vibesKey: 'kuala lumpur',
    exchangeId: 'bursa-kuala-lumpur',
    latitude: 3.139,
    longitude: 101.6869,
    tz: 'Asia/Kuala_Lumpur',
  },
};

// ============================================================================
// USD ALTERNATION — New York / Chicago
// ============================================================================

const USD_NEW_YORK: CurrencyCityInfo = {
  city: 'New York',
  vibesKey: 'new york',
  exchangeId: 'nyse-new-york',
  latitude: 40.7128,
  longitude: -74.006,
  tz: 'America/New_York',
};

const USD_CHICAGO: CurrencyCityInfo = {
  city: 'Chicago',
  vibesKey: 'chicago',
  exchangeId: 'cboe-chicago',
  latitude: 41.8781,
  longitude: -87.6298,
  tz: 'America/Chicago',
};

/**
 * SSOT pair order from fx.selected.json — NEVER re-sort.
 * Each entry records where USD appears (base or quote) and which
 * US city that USD flag maps to. Non-USD pairs have no entry.
 *
 * Distribution: 5 × New York, 4 × Chicago (alternating encounters).
 *
 * Index  Pair      USD side   US city     Encounter#
 * ─────  ────────  ─────────  ──────────  ──────────
 *   0    EUR/USD   quote      New York    1 (even)
 *   1    GBP/USD   quote      Chicago     2 (odd)
 *   2    GBP/ZAR   —          —           —
 *   3    USD/CAD   base       New York    3 (even)
 *   4    USD/CNY   base       Chicago     4 (odd)
 *   5    USD/INR   base       New York    5 (even)
 *   6    USD/BRL   base       Chicago     6 (odd)
 *   7    USD/AUD   base       New York    7 (even)
 *   8    USD/NOK   base       Chicago     8 (odd)
 *   9    USD/MYR   base       New York    9 (even)
 */
const USD_ASSIGNMENT_BY_PAIR_INDEX: Record<number, { side: 'base' | 'quote'; info: CurrencyCityInfo }> = {
  0: { side: 'quote', info: USD_NEW_YORK },
  1: { side: 'quote', info: USD_CHICAGO },
  3: { side: 'base', info: USD_NEW_YORK },
  4: { side: 'base', info: USD_CHICAGO },
  5: { side: 'base', info: USD_NEW_YORK },
  6: { side: 'base', info: USD_CHICAGO },
  7: { side: 'base', info: USD_NEW_YORK },
  8: { side: 'base', info: USD_CHICAGO },
  9: { side: 'base', info: USD_NEW_YORK },
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Resolve the city info for a currency at a given SSOT pair index and side.
 *
 * For USD, uses the deterministic NY/CHI alternation table.
 * For all other currencies, uses the static CURRENCY_CITY_MAP.
 *
 * @param currencyCode - e.g. "USD", "EUR", "GBP"
 * @param pairIndex    - 0-based index in the SSOT pair array
 * @param side         - 'base' or 'quote' position within the pair
 * @returns CurrencyCityInfo or null if currency has no mapping
 */
export function getCurrencyCityInfo(
  currencyCode: string,
  pairIndex: number,
  side: 'base' | 'quote',
): CurrencyCityInfo | null {
  const upper = currencyCode.toUpperCase();

  // Non-USD: straightforward lookup
  if (upper !== 'USD') {
    return CURRENCY_CITY_MAP[upper] ?? null;
  }

  // USD: use the deterministic alternation table
  const assignment = USD_ASSIGNMENT_BY_PAIR_INDEX[pairIndex];
  if (!assignment || assignment.side !== side) {
    // This pair index + side combo doesn't have a USD flag
    // (shouldn't happen with valid SSOT data, but defensive)
    return USD_NEW_YORK; // fallback
  }

  return assignment.info;
}
