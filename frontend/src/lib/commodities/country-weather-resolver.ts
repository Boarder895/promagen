// src/lib/commodities/country-weather-resolver.ts
// ============================================================================
// COUNTRY-WEATHER RESOLVER — Phase 1 of Commodity Prompt System
// ============================================================================
// Maps every commodity flag country code (69 total + EU) to the nearest
// exchange for weather data. Derives season from hemisphere + date.
// Provides reverse lookup: commodity → country pool for scene selection.
//
// Coverage:
//   49/69 countries have in-country exchange (direct match)
//   20/69 countries use nearest exchange (proxy match)
//   EU flag → euronext-amsterdam (European financial context)
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 1
// Existing features preserved: Yes
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Hemisphere quadrant from exchanges.catalog.json.
 * N/S = latitude, E/W = longitude.
 */
export type Hemisphere = 'NE' | 'NW' | 'SE' | 'SW';

export interface WeatherResolution {
  /** Exchange ID to look up weather (e.g., "euronext-amsterdam") */
  exchangeId: string;
  /** true if no in-country exchange exists; weather is from nearest neighbour */
  proxy: boolean;
}

// ============================================================================
// DIRECT EXCHANGE MAPPINGS (49 countries)
// ============================================================================
// Country code → exchange ID. These countries have at least one exchange
// in exchanges.catalog.json. When multiple exist (e.g., IN has 4), we pick
// the primary/largest.
// ============================================================================

const DIRECT_EXCHANGE_MAP: Record<string, string> = {
  AE: 'adx-abu-dhabi',
  AR: 'bcba-buenos-aires',
  AT: 'wbag-vienna',
  AU: 'asx-sydney',
  BD: 'dse-dhaka',
  BE: 'euronext-brussels',
  BR: 'b3-sao-paulo',
  CA: 'tsx-toronto',
  CH: 'six-zurich',
  CL: 'sse-santiago',
  CN: 'sse-shanghai',
  CO: 'xbog-bogota',
  CZ: 'pse-prague',
  DE: 'xetra-frankfurt',
  DK: 'nasdaq-copenhagen',
  EG: 'egx-cairo',
  ES: 'bme-madrid',
  FI: 'nasdaq-helsinki',
  FR: 'euronext-paris',
  GB: 'lse-london',
  GR: 'athex-athens',
  HK: 'hkex-hong-kong',
  HU: 'budapest-bet',
  ID: 'idx-jakarta',
  IE: 'ise-dublin',
  IN: 'bse-mumbai',
  IS: 'xice-reykjavik',
  IT: 'borsa-italiana-milan',
  JP: 'tse-tokyo',
  KE: 'nse-nairobi',
  LK: 'cse-colombo',
  LV: 'xris-riga',
  MA: 'cse-casablanca',
  MX: 'xmex-mexico-city',
  MY: 'bursa-kuala-lumpur',
  NG: 'xnsa-lagos',
  NL: 'euronext-amsterdam',
  NO: 'xosl-oslo',
  NZ: 'nzx-wellington',
  PE: 'xlim-lima',
  PH: 'pse-manila',
  PK: 'psx-karachi',
  RU: 'moex-moscow',
  TH: 'set-bangkok',
  TR: 'bist-istanbul',
  TW: 'twse-taipei',
  US: 'nyse-new-york',
  VN: 'xstc-ho-chi-minh-city',
  ZA: 'jse-johannesburg',
};

// ============================================================================
// PROXY EXCHANGE MAPPINGS (20 countries)
// ============================================================================
// These countries have no exchange in the catalog. Each is mapped to the
// geographically nearest exchange. Weather will be approximate but
// climatically reasonable.
// ============================================================================

const PROXY_EXCHANGE_MAP: Record<string, string> = {
  BG: 'athex-athens', // Bulgaria → Athens (Balkans neighbour)
  BM: 'nyse-new-york', // Bermuda → New York (Atlantic)
  CI: 'gse-accra', // Côte d'Ivoire → Accra, Ghana (West Africa)
  CM: 'xnsa-lagos', // Cameroon → Lagos, Nigeria (Central/West Africa)
  EE: 'xris-riga', // Estonia → Riga, Latvia (Baltic neighbour)
  IL: 'bist-istanbul', // Israel → Istanbul, Turkey (Eastern Med)
  IR: 'bist-istanbul', // Iran → Istanbul, Turkey (nearest major)
  JM: 'nyse-new-york', // Jamaica → New York (Caribbean)
  KR: 'tse-tokyo', // South Korea → Tokyo (East Asia)
  LT: 'xris-riga', // Lithuania → Riga, Latvia (Baltic neighbour)
  PA: 'xbog-bogota', // Panama → Bogotá, Colombia (Central America)
  PL: 'pse-prague', // Poland → Prague, Czech Republic (Central Europe)
  PY: 'bcba-buenos-aires', // Paraguay → Buenos Aires (South America)
  RO: 'budapest-bet', // Romania → Budapest, Hungary (neighbours)
  SA: 'adx-abu-dhabi', // Saudi Arabia → Abu Dhabi (Gulf)
  SE: 'xosl-oslo', // Sweden → Oslo, Norway (Scandinavia)
  SG: 'bursa-kuala-lumpur', // Singapore → Kuala Lumpur (SE Asia)
  TN: 'cse-casablanca', // Tunisia → Casablanca, Morocco (North Africa)
  TT: 'bvc-caracas', // Trinidad & Tobago → Caracas (Caribbean)
  UY: 'bcba-buenos-aires', // Uruguay → Buenos Aires (neighbours)
};

// ============================================================================
// EU SPECIAL CASE
// ============================================================================
// The EU flag (🇪🇺) appears on EUR conversion lines. It represents European
// financial context, not a physical country. Amsterdam is the chosen exchange
// for EU weather context.
// ============================================================================

const EU_EXCHANGE_ID = 'euronext-amsterdam';

// ============================================================================
// HEMISPHERE LOOKUP
// ============================================================================
// Hemisphere for every commodity country code. Used for season derivation.
// Format matches exchanges.catalog.json: N/S = latitude, E/W = longitude.
//
// For direct-match countries, hemisphere comes from the exchange catalog.
// For proxy countries, hemisphere is assigned from geographical position.
// ============================================================================

const HEMISPHERE_MAP: Record<string, Hemisphere> = {
  // Direct exchange countries (from exchanges.catalog.json)
  AE: 'NE',
  AR: 'SW',
  AT: 'NE',
  AU: 'SE',
  BD: 'NE',
  BE: 'NE',
  BR: 'SW',
  CA: 'NW',
  CH: 'NE',
  CL: 'SW',
  CN: 'NE',
  CO: 'NW',
  CZ: 'NE',
  DE: 'NE',
  DK: 'NE',
  EG: 'NE',
  ES: 'NE',
  FI: 'NE',
  FR: 'NE',
  GB: 'NW',
  GR: 'NE',
  HK: 'NE',
  HU: 'NE',
  ID: 'SE',
  IE: 'NW',
  IN: 'NE',
  IS: 'NW',
  IT: 'NE',
  JP: 'NE',
  KE: 'NE',
  LK: 'NE',
  LV: 'NE',
  MA: 'NW',
  MX: 'NW',
  MY: 'NE',
  NG: 'NE',
  NL: 'NE',
  NO: 'NE',
  NZ: 'SE',
  PE: 'SW',
  PH: 'NE',
  PK: 'NE',
  RU: 'NE',
  TH: 'NE',
  TR: 'NE',
  TW: 'NE',
  US: 'NW',
  VN: 'NE',
  ZA: 'SE',
  // Proxy countries (from geographical position)
  BG: 'NE',
  BM: 'NW',
  CI: 'NW',
  CM: 'NE',
  EE: 'NE',
  IL: 'NE',
  IR: 'NE',
  JM: 'NW',
  KR: 'NE',
  LT: 'NE',
  PA: 'NW',
  PL: 'NE',
  PY: 'SW',
  RO: 'NE',
  SA: 'NE',
  SE: 'NE',
  SG: 'NE',
  TN: 'NE',
  TT: 'NW',
  UY: 'SW',
  // EU special case
  EU: 'NE',
};

// ============================================================================
// COMMODITY → COUNTRY POOL (Reverse Lookup)
// ============================================================================
// Pre-built from country-commodities.map.json. Maps each commodity ID to
// the full list of producer country codes. Used by Phase 2 to randomly
// select a scene country for prompt generation.
//
// Pool sizes range from 1 (cobalt=CM only) to 64 (brent_crude).
// ============================================================================

const COMMODITY_COUNTRY_POOL: Record<string, readonly string[]> = {
  aluminium: ['AE', 'AT', 'DK', 'FR', 'HU', 'IS', 'JM', 'NL', 'NO', 'RO'],
  barley: [
    'AT',
    'AU',
    'BE',
    'BG',
    'CA',
    'CH',
    'CL',
    'CZ',
    'DE',
    'DK',
    'EE',
    'ES',
    'FI',
    'FR',
    'GB',
    'GR',
    'HU',
    'IE',
    'IR',
    'IS',
    'IT',
    'LT',
    'LV',
    'MA',
    'NO',
    'NZ',
    'PE',
    'PL',
    'RO',
    'RU',
    'SA',
    'SE',
    'TN',
    'TR',
    'UY',
    'ZA',
  ],
  bauxite: ['AU', 'BR', 'GR', 'ID', 'IN', 'JM', 'MY'],
  brent_crude: [
    'AE',
    'AR',
    'AT',
    'AU',
    'BE',
    'BG',
    'BM',
    'BR',
    'CH',
    'CI',
    'CL',
    'CM',
    'CN',
    'CO',
    'CZ',
    'DE',
    'DK',
    'EE',
    'EG',
    'ES',
    'FI',
    'FR',
    'GB',
    'GR',
    'HK',
    'HU',
    'ID',
    'IE',
    'IL',
    'IN',
    'IR',
    'IS',
    'IT',
    'JM',
    'JP',
    'KE',
    'KR',
    'LK',
    'LT',
    'LV',
    'MA',
    'MX',
    'MY',
    'NG',
    'NL',
    'NO',
    'NZ',
    'PA',
    'PE',
    'PH',
    'PK',
    'PL',
    'PY',
    'RO',
    'SA',
    'SE',
    'SG',
    'TH',
    'TN',
    'TR',
    'TW',
    'UY',
    'VN',
    'ZA',
  ],
  chromium: ['TR', 'ZA'],
  coal: [
    'AU',
    'BD',
    'BG',
    'CI',
    'CL',
    'CM',
    'CN',
    'CO',
    'CZ',
    'DE',
    'EE',
    'EG',
    'FI',
    'HK',
    'HU',
    'ID',
    'IN',
    'JM',
    'JP',
    'KE',
    'KR',
    'LK',
    'LT',
    'LV',
    'MA',
    'MY',
    'NG',
    'NZ',
    'PE',
    'PH',
    'PK',
    'PL',
    'RO',
    'RU',
    'SE',
    'TH',
    'TN',
    'TR',
    'TW',
    'VN',
    'ZA',
  ],
  cobalt: ['CM'],
  cocoa: ['CI', 'CM', 'NG'],
  coffee: ['BR', 'CI', 'CM', 'CO', 'ID', 'JM', 'KE', 'MX', 'PE', 'VN'],
  copper: [
    'AE',
    'AR',
    'AT',
    'BD',
    'BE',
    'BG',
    'BM',
    'CI',
    'CL',
    'CN',
    'CO',
    'CZ',
    'DE',
    'DK',
    'EE',
    'ES',
    'FI',
    'FR',
    'GB',
    'GR',
    'HK',
    'HU',
    'IL',
    'IR',
    'IT',
    'JP',
    'KR',
    'LT',
    'LV',
    'MA',
    'MX',
    'MY',
    'NL',
    'PA',
    'PE',
    'PH',
    'PK',
    'PL',
    'RO',
    'SA',
    'SE',
    'SG',
    'TH',
    'TR',
    'TW',
    'US',
    'VN',
  ],
  corn: [
    'AR',
    'AT',
    'BG',
    'BM',
    'CH',
    'CL',
    'CN',
    'CO',
    'CZ',
    'EG',
    'ES',
    'FR',
    'HK',
    'HU',
    'IS',
    'IT',
    'JM',
    'JP',
    'KE',
    'KR',
    'MX',
    'NO',
    'PA',
    'PE',
    'PY',
    'RO',
    'RU',
    'TT',
    'TW',
    'US',
    'VN',
    'ZA',
  ],
  cotton: ['GR', 'IL', 'PK', 'TR'],
  dates: ['AE', 'SA'],
  dubai_crude: ['AE', 'IR', 'SA'],
  ethanol: ['AR', 'BR', 'PY', 'UY'],
  gasoil_ulsd: [
    'AT',
    'BE',
    'BM',
    'CH',
    'CI',
    'CM',
    'DK',
    'ES',
    'FR',
    'GB',
    'GR',
    'IE',
    'IL',
    'IS',
    'IT',
    'JM',
    'KE',
    'MA',
    'NL',
    'PA',
    'SG',
    'TN',
  ],
  gasoline_rbob: ['BM', 'MX', 'PA', 'US'],
  gold: [
    'AE',
    'AR',
    'AU',
    'BM',
    'BR',
    'CA',
    'CH',
    'CI',
    'CL',
    'CM',
    'CO',
    'EG',
    'GB',
    'HK',
    'IE',
    'IL',
    'JM',
    'KE',
    'LK',
    'MA',
    'MX',
    'NZ',
    'PA',
    'PE',
    'PH',
    'PY',
    'RU',
    'SA',
    'SG',
    'TN',
    'TT',
    'US',
    'UY',
    'ZA',
  ],
  heating_oil: ['CA'],
  iron_ore: [
    'AU',
    'BD',
    'BR',
    'CI',
    'CM',
    'CN',
    'EE',
    'EG',
    'IN',
    'IR',
    'IS',
    'KE',
    'LK',
    'LT',
    'LV',
    'NG',
    'NZ',
    'PK',
    'PY',
    'SE',
    'TN',
    'TT',
    'US',
    'UY',
    'VN',
  ],
  lead: ['BG', 'IE'],
  lithium: ['AR', 'CL'],
  live_cattle: ['IE', 'NZ'],
  lng_jkm: [
    'AU',
    'BD',
    'BR',
    'CL',
    'CN',
    'HK',
    'ID',
    'IN',
    'JP',
    'KR',
    'LK',
    'MY',
    'NO',
    'NZ',
    'PE',
    'PH',
    'PK',
    'SG',
    'TH',
    'TT',
    'TW',
    'VN',
  ],
  natural_gas_henry_hub: [
    'AE',
    'AR',
    'BD',
    'CA',
    'CO',
    'EG',
    'IL',
    'IR',
    'MX',
    'NG',
    'PY',
    'RU',
    'SA',
    'TT',
    'US',
    'UY',
    'ZA',
  ],
  nbp_natural_gas: ['GB'],
  nickel: ['CA', 'CO', 'FI', 'ID', 'PH', 'RU', 'TW'],
  palladium: ['RU'],
  palm_oil: ['CI', 'CM', 'ID', 'MY', 'NG', 'PH', 'SG', 'TH'],
  phosphates: ['MA', 'TN'],
  platinum: ['CH', 'ZA'],
  potash: ['IL'],
  rapeseed_canola: ['AU', 'CA', 'DE', 'DK', 'EE', 'FI', 'GB', 'LT', 'LV', 'NL', 'PL', 'SE'],
  rice: [
    'AE',
    'BD',
    'BM',
    'CN',
    'EG',
    'HK',
    'ID',
    'IN',
    'IR',
    'JP',
    'KR',
    'LK',
    'MY',
    'PA',
    'PH',
    'PK',
    'SG',
    'TH',
    'TT',
    'TW',
    'UY',
    'VN',
  ],
  salmon: ['CA', 'CL', 'GB', 'NO', 'US'],
  silver: ['BM', 'CH', 'IL', 'MA', 'MX', 'PA', 'PL'],
  soybeans: ['AR', 'BR', 'CN', 'HK', 'JP', 'KR', 'PY', 'TW', 'US', 'UY'],
  steel_rebar: [
    'AT',
    'BD',
    'BE',
    'CN',
    'CZ',
    'DE',
    'DK',
    'EE',
    'EG',
    'ES',
    'FI',
    'FR',
    'GB',
    'GR',
    'HK',
    'HU',
    'IN',
    'IS',
    'IT',
    'JP',
    'KR',
    'LK',
    'LT',
    'LV',
    'NG',
    'NL',
    'NO',
    'NZ',
    'PK',
    'PL',
    'PY',
    'RO',
    'SA',
    'SE',
    'SG',
    'TH',
    'TN',
    'TR',
    'TT',
    'TW',
    'UY',
    'VN',
  ],
  sugar: [
    'BE',
    'BR',
    'CO',
    'IN',
    'JM',
    'LK',
    'MX',
    'MY',
    'NG',
    'NL',
    'PA',
    'PH',
    'PY',
    'SG',
    'TH',
    'TT',
  ],
  tea: ['BD', 'KE', 'LK'],
  tin: ['ID', 'MY', 'NG'],
  titanium_ore: ['KE', 'NO'],
  ttf_natural_gas: [
    'AT',
    'BE',
    'BG',
    'CH',
    'CZ',
    'DE',
    'DK',
    'EE',
    'ES',
    'FI',
    'FR',
    'GR',
    'HU',
    'IE',
    'IS',
    'IT',
    'LT',
    'LV',
    'NL',
    'NO',
    'PL',
    'RO',
    'SE',
    'TR',
  ],
  uk_gas: ['GB'],
  urals_crude: ['RU'],
  uranium: ['CA'],
  wcs_crude: ['CA'],
  wheat: [
    'AE',
    'AR',
    'AT',
    'AU',
    'BD',
    'BE',
    'BG',
    'BM',
    'CA',
    'CH',
    'CL',
    'CZ',
    'DE',
    'DK',
    'EE',
    'EG',
    'ES',
    'FI',
    'FR',
    'GB',
    'GR',
    'HU',
    'IE',
    'IL',
    'IN',
    'IR',
    'IS',
    'IT',
    'LT',
    'LV',
    'MA',
    'NL',
    'NO',
    'NZ',
    'PK',
    'PL',
    'RO',
    'RU',
    'SA',
    'SE',
    'TN',
    'TR',
    'US',
    'ZA',
  ],
  wti_crude: ['TT', 'US'],
  zinc: ['BE', 'BG', 'CZ', 'DE', 'ES', 'IE', 'IR', 'IT', 'JP', 'KR', 'PE', 'TH'],
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Resolve a commodity flag country code to the nearest exchange for weather.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code (e.g., "ZA", "PL") or "EU"
 * @returns Exchange ID and whether it's a proxy (approximate weather)
 *
 * @example
 * resolveWeather('ZA')  // → { exchangeId: 'jse-johannesburg', proxy: false }
 * resolveWeather('PL')  // → { exchangeId: 'pse-prague', proxy: true }
 * resolveWeather('EU')  // → { exchangeId: 'euronext-amsterdam', proxy: false }
 */
export function resolveWeather(countryCode: string): WeatherResolution | null {
  const code = countryCode.toUpperCase();

  // EU special case — Amsterdam for European financial context
  if (code === 'EU') {
    return { exchangeId: EU_EXCHANGE_ID, proxy: false };
  }

  // Direct match — in-country exchange exists
  const direct = DIRECT_EXCHANGE_MAP[code];
  if (direct) {
    return { exchangeId: direct, proxy: false };
  }

  // Proxy match — nearest neighbour exchange
  const proxy = PROXY_EXCHANGE_MAP[code];
  if (proxy) {
    return { exchangeId: proxy, proxy: true };
  }

  // Unknown country code — should not happen with valid data
  return null;
}

/**
 * Derive the current meteorological season for a country.
 *
 * Uses hemisphere to determine season:
 * - Northern hemisphere: Mar–May=spring, Jun–Aug=summer, Sep–Nov=autumn, Dec–Feb=winter
 * - Southern hemisphere: Reversed (Mar–May=autumn, Jun–Aug=winter, etc.)
 *
 * Equatorial countries (|latitude| < 10°) are technically seasonless,
 * but we still assign seasons for vocabulary variety.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code or "EU"
 * @param date - Date to derive season from (defaults to now)
 * @returns Season string, or null if country code is unknown
 *
 * @example
 * deriveSeason('GB', new Date('2026-01-15'))  // → 'winter'
 * deriveSeason('AU', new Date('2026-01-15'))  // → 'summer' (southern hemisphere)
 * deriveSeason('BR', new Date('2026-07-01'))  // → 'winter' (southern hemisphere)
 */
export function deriveSeason(countryCode: string, date?: Date): Season | null {
  const code = countryCode.toUpperCase();
  const hemisphere = HEMISPHERE_MAP[code];
  if (!hemisphere) return null;

  const month = (date ?? new Date()).getMonth(); // 0-indexed: 0=Jan, 11=Dec

  // Northern hemisphere seasons (NE or NW)
  const isNorthern = hemisphere === 'NE' || hemisphere === 'NW';

  // Meteorological seasons by month
  // Spring: Mar(2), Apr(3), May(4)
  // Summer: Jun(5), Jul(6), Aug(7)
  // Autumn: Sep(8), Oct(9), Nov(10)
  // Winter: Dec(11), Jan(0), Feb(1)
  const northernSeason = monthToNorthernSeason(month);

  if (isNorthern) {
    return northernSeason;
  }

  // Southern hemisphere — flip by 6 months
  return flipSeason(northernSeason);
}

/**
 * Get all producer country codes for a commodity.
 *
 * Returns the full pool of countries that produce/trade this commodity,
 * as defined in country-commodities.map.json. Phase 2 uses this to
 * randomly select a scene country for prompt generation.
 *
 * @param commodityId - Commodity ID (e.g., "gold", "brent_crude", "coffee")
 * @returns Array of ISO country codes, or empty array if commodity unknown
 *
 * @example
 * getCommodityCountryPool('cobalt')       // → ['CM']           (1 country)
 * getCommodityCountryPool('gold')         // → ['AE', 'AR', ...] (34 countries)
 * getCommodityCountryPool('brent_crude')  // → ['AE', 'AR', ...] (64 countries)
 * getCommodityCountryPool('unknown')      // → []
 */
export function getCommodityCountryPool(commodityId: string): readonly string[] {
  return COMMODITY_COUNTRY_POOL[commodityId] ?? [];
}

/**
 * Check whether a country code has a direct exchange or uses a proxy.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code or "EU"
 * @returns true if the country uses a neighbouring exchange for weather
 */
export function isProxyCountry(countryCode: string): boolean {
  const code = countryCode.toUpperCase();
  return code in PROXY_EXCHANGE_MAP;
}

/**
 * Get the hemisphere quadrant for a country.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code or "EU"
 * @returns Hemisphere quadrant or null if unknown
 */
export function getHemisphere(countryCode: string): Hemisphere | null {
  return HEMISPHERE_MAP[countryCode.toUpperCase()] ?? null;
}

/**
 * Get the total number of known commodity country codes.
 * Useful for validation / test assertions.
 */
export function getTotalCountryCodes(): number {
  return Object.keys(HEMISPHERE_MAP).length; // 69 + EU = 70
}

/**
 * Get all known commodity IDs that have country pools.
 */
export function getAllCommodityIds(): string[] {
  return Object.keys(COMMODITY_COUNTRY_POOL);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function monthToNorthernSeason(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter'; // 11, 0, 1
}

function flipSeason(season: Season): Season {
  switch (season) {
    case 'spring':
      return 'autumn';
    case 'summer':
      return 'winter';
    case 'autumn':
      return 'spring';
    case 'winter':
      return 'summer';
  }
}
