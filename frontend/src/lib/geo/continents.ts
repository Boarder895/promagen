// src/lib/geo/continents.ts
// ============================================================================
// CONTINENT MAPPING FOR EXCHANGE PICKER
// ============================================================================
// Maps ISO2 country codes to continents for the Pro Promagen exchange picker.
//
// Authority: docs/authority/paid_tier.md §5.3
// ============================================================================

export type Continent =
  | 'ASIA'
  | 'OCEANIA'
  | 'EUROPE'
  | 'MIDDLE_EAST'
  | 'AFRICA'
  | 'NORTH_AMERICA'
  | 'SOUTH_AMERICA';

/**
 * Maps ISO2 country codes to continents.
 * Uses geographic boundaries rather than political/economic groupings.
 */
const COUNTRY_TO_CONTINENT: Record<string, Continent> = {
  // ========================================================================
  // ASIA
  // ========================================================================
  JP: 'ASIA',
  CN: 'ASIA',
  HK: 'ASIA',
  SG: 'ASIA',
  KR: 'ASIA',
  TW: 'ASIA',
  IN: 'ASIA',
  TH: 'ASIA',
  MY: 'ASIA',
  ID: 'ASIA',
  PH: 'ASIA',
  VN: 'ASIA',
  PK: 'ASIA',
  BD: 'ASIA',
  LK: 'ASIA',
  NP: 'ASIA',
  MM: 'ASIA',
  KH: 'ASIA',
  LA: 'ASIA',
  BN: 'ASIA',
  MN: 'ASIA',
  KZ: 'ASIA',
  UZ: 'ASIA',
  TM: 'ASIA',
  KG: 'ASIA',
  TJ: 'ASIA',
  AF: 'ASIA',
  BT: 'ASIA',
  MV: 'ASIA',

  // ========================================================================
  // OCEANIA
  // ========================================================================
  AU: 'OCEANIA',
  NZ: 'OCEANIA',
  FJ: 'OCEANIA',
  PG: 'OCEANIA',
  WS: 'OCEANIA',
  TO: 'OCEANIA',
  VU: 'OCEANIA',
  SB: 'OCEANIA',
  NC: 'OCEANIA',
  PF: 'OCEANIA',

  // ========================================================================
  // EUROPE
  // ========================================================================
  GB: 'EUROPE',
  DE: 'EUROPE',
  FR: 'EUROPE',
  IT: 'EUROPE',
  ES: 'EUROPE',
  NL: 'EUROPE',
  BE: 'EUROPE',
  CH: 'EUROPE',
  AT: 'EUROPE',
  SE: 'EUROPE',
  NO: 'EUROPE',
  DK: 'EUROPE',
  FI: 'EUROPE',
  PL: 'EUROPE',
  CZ: 'EUROPE',
  HU: 'EUROPE',
  RO: 'EUROPE',
  GR: 'EUROPE',
  PT: 'EUROPE',
  IE: 'EUROPE',
  RU: 'EUROPE',
  UA: 'EUROPE',
  TR: 'EUROPE',
  BG: 'EUROPE',
  HR: 'EUROPE',
  RS: 'EUROPE',
  SK: 'EUROPE',
  SI: 'EUROPE',
  LT: 'EUROPE',
  LV: 'EUROPE',
  EE: 'EUROPE',
  LU: 'EUROPE',
  CY: 'EUROPE',
  MT: 'EUROPE',
  IS: 'EUROPE',
  BA: 'EUROPE',
  AL: 'EUROPE',
  MK: 'EUROPE',
  ME: 'EUROPE',
  XK: 'EUROPE',
  BY: 'EUROPE',
  MD: 'EUROPE',

  // ========================================================================
  // MIDDLE EAST
  // ========================================================================
  AE: 'MIDDLE_EAST',
  SA: 'MIDDLE_EAST',
  IL: 'MIDDLE_EAST',
  QA: 'MIDDLE_EAST',
  KW: 'MIDDLE_EAST',
  BH: 'MIDDLE_EAST',
  OM: 'MIDDLE_EAST',
  JO: 'MIDDLE_EAST',
  LB: 'MIDDLE_EAST',
  IR: 'MIDDLE_EAST',
  IQ: 'MIDDLE_EAST',
  SY: 'MIDDLE_EAST',
  YE: 'MIDDLE_EAST',
  PS: 'MIDDLE_EAST',

  // ========================================================================
  // AFRICA
  // ========================================================================
  ZA: 'AFRICA',
  EG: 'AFRICA',
  NG: 'AFRICA',
  KE: 'AFRICA',
  MA: 'AFRICA',
  TN: 'AFRICA',
  GH: 'AFRICA',
  MU: 'AFRICA',
  BW: 'AFRICA',
  NA: 'AFRICA',
  ZW: 'AFRICA',
  TZ: 'AFRICA',
  UG: 'AFRICA',
  ET: 'AFRICA',
  CI: 'AFRICA',
  SN: 'AFRICA',
  CM: 'AFRICA',
  DZ: 'AFRICA',
  LY: 'AFRICA',
  AO: 'AFRICA',
  MZ: 'AFRICA',
  RW: 'AFRICA',
  ZM: 'AFRICA',
  MW: 'AFRICA',

  // ========================================================================
  // NORTH AMERICA
  // ========================================================================
  US: 'NORTH_AMERICA',
  CA: 'NORTH_AMERICA',
  MX: 'NORTH_AMERICA',
  PA: 'NORTH_AMERICA',
  CR: 'NORTH_AMERICA',
  GT: 'NORTH_AMERICA',
  HN: 'NORTH_AMERICA',
  SV: 'NORTH_AMERICA',
  NI: 'NORTH_AMERICA',
  BZ: 'NORTH_AMERICA',
  JM: 'NORTH_AMERICA',
  TT: 'NORTH_AMERICA',
  BB: 'NORTH_AMERICA',
  BS: 'NORTH_AMERICA',
  DO: 'NORTH_AMERICA',
  HT: 'NORTH_AMERICA',
  CU: 'NORTH_AMERICA',
  PR: 'NORTH_AMERICA',

  // ========================================================================
  // SOUTH AMERICA
  // ========================================================================
  BR: 'SOUTH_AMERICA',
  AR: 'SOUTH_AMERICA',
  CL: 'SOUTH_AMERICA',
  CO: 'SOUTH_AMERICA',
  PE: 'SOUTH_AMERICA',
  VE: 'SOUTH_AMERICA',
  EC: 'SOUTH_AMERICA',
  UY: 'SOUTH_AMERICA',
  PY: 'SOUTH_AMERICA',
  BO: 'SOUTH_AMERICA',
  GY: 'SOUTH_AMERICA',
  SR: 'SOUTH_AMERICA',
};

/**
 * Get the continent for a given ISO2 country code.
 * Defaults to EUROPE if country code is not mapped.
 */
export function getContinent(iso2: string): Continent {
  return COUNTRY_TO_CONTINENT[iso2.toUpperCase()] || 'EUROPE';
}

/**
 * Get all country codes for a given continent.
 */
export function getCountriesInContinent(continent: Continent): string[] {
  return Object.entries(COUNTRY_TO_CONTINENT)
    .filter(([, c]) => c === continent)
    .map(([code]) => code);
}

/**
 * Continent display configuration for UI.
 */
export interface ContinentConfig {
  id: Continent;
  label: string;
  emoji: string;
  gradient: string;
  glow: string;
}

export const CONTINENT_CONFIGS: ContinentConfig[] = [
  {
    id: 'ASIA',
    label: 'Asia',
    emoji: '🌏',
    gradient: 'from-rose-500 via-orange-500 to-amber-500',
    glow: 'rgba(251, 113, 133, 0.15)',
  },
  {
    id: 'OCEANIA',
    label: 'Oceania',
    emoji: '🏝️',
    gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
    glow: 'rgba(34, 211, 238, 0.15)',
  },
  {
    id: 'EUROPE',
    label: 'Europe',
    emoji: '🏰',
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
  },
  {
    id: 'MIDDLE_EAST',
    label: 'Middle East',
    emoji: '🕌',
    gradient: 'from-amber-500 via-yellow-500 to-orange-500',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: 'AFRICA',
    label: 'Africa',
    emoji: '🌍',
    gradient: 'from-emerald-500 via-green-500 to-lime-500',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  {
    id: 'NORTH_AMERICA',
    label: 'North America',
    emoji: '🗽',
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
  },
  {
    id: 'SOUTH_AMERICA',
    label: 'South America',
    emoji: '🌎',
    gradient: 'from-lime-500 via-emerald-500 to-teal-500',
    glow: 'rgba(132, 204, 22, 0.15)',
  },
];
