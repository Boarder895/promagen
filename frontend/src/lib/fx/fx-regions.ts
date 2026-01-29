// src/lib/fx/fx-regions.ts
// ============================================================================
// FX REGIONS - Currency to Region Mapping for FX Picker
// ============================================================================
// Maps ISO 3-letter currency codes to geographic regions.
// Used by the FX Picker to group pairs by BASE currency region.
//
// GROUPING RULE (Option A - Confirmed by user):
// - EUR/USD → Europe (EUR is base, EU region)
// - USD/JPY → Americas (USD is base, US region)
// - GBP/ZAR → Europe (GBP is base, GB region)
//
// DESIGN: Mirrors continents.ts pattern for consistency.
//
// Authority: docs/authority/paid_tier.md §5.5
// Version: 1.0.0
// ============================================================================

export type FxRegion =
  | 'AMERICAS'
  | 'EUROPE'
  | 'ASIA_PACIFIC'
  | 'MIDDLE_EAST_AFRICA';

/**
 * Maps ISO 3-letter currency codes to regions.
 * Based on the currency's issuing country/zone.
 */
const CURRENCY_TO_REGION: Record<string, FxRegion> = {
  // ========================================================================
  // AMERICAS
  // ========================================================================
  USD: 'AMERICAS', // United States Dollar
  CAD: 'AMERICAS', // Canadian Dollar
  MXN: 'AMERICAS', // Mexican Peso
  BRL: 'AMERICAS', // Brazilian Real
  ARS: 'AMERICAS', // Argentine Peso
  CLP: 'AMERICAS', // Chilean Peso
  COP: 'AMERICAS', // Colombian Peso
  PEN: 'AMERICAS', // Peruvian Sol
  UYU: 'AMERICAS', // Uruguayan Peso
  DOP: 'AMERICAS', // Dominican Peso
  JMD: 'AMERICAS', // Jamaican Dollar
  TTD: 'AMERICAS', // Trinidad & Tobago Dollar
  BSD: 'AMERICAS', // Bahamian Dollar
  BBD: 'AMERICAS', // Barbadian Dollar
  PAB: 'AMERICAS', // Panamanian Balboa
  CRC: 'AMERICAS', // Costa Rican Colón
  GTQ: 'AMERICAS', // Guatemalan Quetzal
  HNL: 'AMERICAS', // Honduran Lempira

  // ========================================================================
  // EUROPE
  // ========================================================================
  EUR: 'EUROPE', // Euro (Eurozone)
  GBP: 'EUROPE', // British Pound
  CHF: 'EUROPE', // Swiss Franc
  SEK: 'EUROPE', // Swedish Krona
  NOK: 'EUROPE', // Norwegian Krone
  DKK: 'EUROPE', // Danish Krone
  PLN: 'EUROPE', // Polish Złoty
  CZK: 'EUROPE', // Czech Koruna
  HUF: 'EUROPE', // Hungarian Forint
  RON: 'EUROPE', // Romanian Leu
  BGN: 'EUROPE', // Bulgarian Lev
  HRK: 'EUROPE', // Croatian Kuna (now EUR, kept for legacy)
  RUB: 'EUROPE', // Russian Ruble
  UAH: 'EUROPE', // Ukrainian Hryvnia
  TRY: 'EUROPE', // Turkish Lira
  ISK: 'EUROPE', // Icelandic Króna
  RSD: 'EUROPE', // Serbian Dinar
  MKD: 'EUROPE', // Macedonian Denar
  ALL: 'EUROPE', // Albanian Lek
  BAM: 'EUROPE', // Bosnia Convertible Mark
  MDL: 'EUROPE', // Moldovan Leu
  BYN: 'EUROPE', // Belarusian Ruble
  GEL: 'EUROPE', // Georgian Lari
  AMD: 'EUROPE', // Armenian Dram
  AZN: 'EUROPE', // Azerbaijani Manat

  // ========================================================================
  // ASIA PACIFIC
  // ========================================================================
  JPY: 'ASIA_PACIFIC', // Japanese Yen
  CNY: 'ASIA_PACIFIC', // Chinese Yuan
  CNH: 'ASIA_PACIFIC', // Chinese Yuan (Offshore)
  HKD: 'ASIA_PACIFIC', // Hong Kong Dollar
  SGD: 'ASIA_PACIFIC', // Singapore Dollar
  KRW: 'ASIA_PACIFIC', // South Korean Won
  TWD: 'ASIA_PACIFIC', // Taiwan Dollar
  INR: 'ASIA_PACIFIC', // Indian Rupee
  THB: 'ASIA_PACIFIC', // Thai Baht
  MYR: 'ASIA_PACIFIC', // Malaysian Ringgit
  IDR: 'ASIA_PACIFIC', // Indonesian Rupiah
  PHP: 'ASIA_PACIFIC', // Philippine Peso
  VND: 'ASIA_PACIFIC', // Vietnamese Dong
  PKR: 'ASIA_PACIFIC', // Pakistani Rupee
  BDT: 'ASIA_PACIFIC', // Bangladeshi Taka
  LKR: 'ASIA_PACIFIC', // Sri Lankan Rupee
  NPR: 'ASIA_PACIFIC', // Nepalese Rupee
  MMK: 'ASIA_PACIFIC', // Myanmar Kyat
  KHR: 'ASIA_PACIFIC', // Cambodian Riel
  LAK: 'ASIA_PACIFIC', // Lao Kip
  BND: 'ASIA_PACIFIC', // Brunei Dollar
  MNT: 'ASIA_PACIFIC', // Mongolian Tugrik
  KZT: 'ASIA_PACIFIC', // Kazakh Tenge
  UZS: 'ASIA_PACIFIC', // Uzbek Som
  AUD: 'ASIA_PACIFIC', // Australian Dollar
  NZD: 'ASIA_PACIFIC', // New Zealand Dollar
  FJD: 'ASIA_PACIFIC', // Fiji Dollar
  PGK: 'ASIA_PACIFIC', // Papua New Guinean Kina

  // ========================================================================
  // MIDDLE EAST & AFRICA
  // ========================================================================
  AED: 'MIDDLE_EAST_AFRICA', // UAE Dirham
  SAR: 'MIDDLE_EAST_AFRICA', // Saudi Riyal
  ILS: 'MIDDLE_EAST_AFRICA', // Israeli Shekel
  QAR: 'MIDDLE_EAST_AFRICA', // Qatari Riyal
  KWD: 'MIDDLE_EAST_AFRICA', // Kuwaiti Dinar
  BHD: 'MIDDLE_EAST_AFRICA', // Bahraini Dinar
  OMR: 'MIDDLE_EAST_AFRICA', // Omani Rial
  JOD: 'MIDDLE_EAST_AFRICA', // Jordanian Dinar
  LBP: 'MIDDLE_EAST_AFRICA', // Lebanese Pound
  IRR: 'MIDDLE_EAST_AFRICA', // Iranian Rial
  IQD: 'MIDDLE_EAST_AFRICA', // Iraqi Dinar
  SYP: 'MIDDLE_EAST_AFRICA', // Syrian Pound
  YER: 'MIDDLE_EAST_AFRICA', // Yemeni Rial
  EGP: 'MIDDLE_EAST_AFRICA', // Egyptian Pound
  ZAR: 'MIDDLE_EAST_AFRICA', // South African Rand
  NGN: 'MIDDLE_EAST_AFRICA', // Nigerian Naira
  KES: 'MIDDLE_EAST_AFRICA', // Kenyan Shilling
  MAD: 'MIDDLE_EAST_AFRICA', // Moroccan Dirham
  TND: 'MIDDLE_EAST_AFRICA', // Tunisian Dinar
  GHS: 'MIDDLE_EAST_AFRICA', // Ghanaian Cedi
  MUR: 'MIDDLE_EAST_AFRICA', // Mauritian Rupee
  BWP: 'MIDDLE_EAST_AFRICA', // Botswana Pula
  NAD: 'MIDDLE_EAST_AFRICA', // Namibian Dollar
  ZWL: 'MIDDLE_EAST_AFRICA', // Zimbabwean Dollar
  TZS: 'MIDDLE_EAST_AFRICA', // Tanzanian Shilling
  UGX: 'MIDDLE_EAST_AFRICA', // Ugandan Shilling
  ETB: 'MIDDLE_EAST_AFRICA', // Ethiopian Birr
  XOF: 'MIDDLE_EAST_AFRICA', // West African CFA Franc
  XAF: 'MIDDLE_EAST_AFRICA', // Central African CFA Franc
  DZD: 'MIDDLE_EAST_AFRICA', // Algerian Dinar
  LYD: 'MIDDLE_EAST_AFRICA', // Libyan Dinar
  AOA: 'MIDDLE_EAST_AFRICA', // Angolan Kwanza
  MZN: 'MIDDLE_EAST_AFRICA', // Mozambican Metical
  RWF: 'MIDDLE_EAST_AFRICA', // Rwandan Franc
  ZMW: 'MIDDLE_EAST_AFRICA', // Zambian Kwacha
  MWK: 'MIDDLE_EAST_AFRICA', // Malawian Kwacha
};

/**
 * Get the region for a given currency code.
 * Defaults to AMERICAS if currency code is not mapped.
 */
export function getFxRegion(currencyCode: string): FxRegion {
  return CURRENCY_TO_REGION[currencyCode.toUpperCase()] || 'AMERICAS';
}

/**
 * Get all currency codes for a given region.
 */
export function getCurrenciesInRegion(region: FxRegion): string[] {
  return Object.entries(CURRENCY_TO_REGION)
    .filter(([, r]) => r === region)
    .map(([code]) => code);
}

/**
 * Region display configuration for UI.
 */
export interface FxRegionConfig {
  id: FxRegion;
  label: string;
  emoji: string;
  gradient: string;
  glow: string;
}

export const FX_REGION_CONFIGS: FxRegionConfig[] = [
  {
    id: 'AMERICAS',
    label: 'Americas',
    emoji: '🌎',
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
  },
  {
    id: 'EUROPE',
    label: 'Europe',
    emoji: '🏰',
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
  },
  {
    id: 'ASIA_PACIFIC',
    label: 'Asia Pacific',
    emoji: '🌏',
    gradient: 'from-rose-500 via-orange-500 to-amber-500',
    glow: 'rgba(251, 113, 133, 0.15)',
  },
  {
    id: 'MIDDLE_EAST_AFRICA',
    label: 'Middle East & Africa',
    emoji: '🌍',
    gradient: 'from-emerald-500 via-green-500 to-lime-500',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
];

/**
 * Get region config by ID.
 */
export function getRegionConfig(regionId: FxRegion): FxRegionConfig | undefined {
  return FX_REGION_CONFIGS.find((c) => c.id === regionId);
}
