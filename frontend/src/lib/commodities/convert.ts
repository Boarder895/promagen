// src/lib/commodities/convert.ts
// ============================================================================
// COMMODITY CURRENCY CONVERSION
// ============================================================================
// Converts commodity prices from their native currency to EUR and GBP
// using live FX rates from the gateway.
//
// Conversion paths:
// - USD commodities: USD → EUR, USD → GBP (direct)
// - Non-USD commodities: Native → USD → EUR/GBP (two-step)
//
// FX Pair Convention:
// - EUR/USD means: 1 EUR = X USD → to get EUR from USD: USD / rate
// - GBP/USD means: 1 GBP = X USD → to get GBP from USD: USD / rate
// - USD/INR means: 1 USD = X INR → to get USD from INR: INR / rate
// - USD/AUD means: 1 USD = X AUD → to get USD from AUD: AUD / rate
//
// v2.5: Cross-rate USD→ZAR via GBP + formatZarPrice (5 Feb 2026)
// v2.4: Flag emoji support + 3-line conversion for non-major currencies (5 Feb 2026)
// v2.3: Smart conversion lines (5 Feb 2026)
// v2.2: EUR/GBP conversion (4 Feb 2026)
//
// Authority: Compacted conversation 2026-02-04
// Existing features preserved: Yes
// ============================================================================

import type { FxApiQuote } from '@/types/finance-ribbon';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversionRates {
  /** EUR/USD rate (1 EUR = X USD) */
  eurUsd: number | null;
  /** GBP/USD rate (1 GBP = X USD) */
  gbpUsd: number | null;
  /** USD/INR rate (1 USD = X INR) */
  usdInr: number | null;
  /** USD/BRL rate (1 USD = X BRL) */
  usdBrl: number | null;
  /** USD/CNY rate (1 USD = X CNY) */
  usdCny: number | null;
  /** USD/CAD rate (1 USD = X CAD) */
  usdCad: number | null;
  /** USD/NOK rate (1 USD = X NOK) */
  usdNok: number | null;
  /** USD/MYR rate (1 USD = X MYR) */
  usdMyr: number | null;
  /** USD/AUD rate (1 USD = X AUD) */
  usdAud: number | null;
  /** GBP/ZAR rate (1 GBP = X ZAR) - for ZAR commodities */
  gbpZar: number | null;
}

export interface ConvertedPrices {
  /** Price in EUR (null if conversion not possible) */
  eur: number | null;
  /** Price in GBP (null if conversion not possible) */
  gbp: number | null;
  /** Price in USD (null if already USD or conversion not possible) */
  usd: number | null;
}

// ============================================================================
// CURRENCY → COUNTRY CODE MAPPING (for flag emojis)
// ============================================================================
// Maps currency codes to ISO 3166-1 alpha-2 country codes.
// Used to display the appropriate flag emoji next to prices.
//
// Note: EUR uses 'EU' for the European Union flag.
// ============================================================================

const CURRENCY_TO_COUNTRY_CODE: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  INR: 'IN',
  CNY: 'CN',
  BRL: 'BR',
  ZAR: 'ZA',
  CAD: 'CA',
  AUD: 'AU',
  NOK: 'NO',
  MYR: 'MY',
  JPY: 'JP',
  CHF: 'CH',
  NZD: 'NZ',
  SGD: 'SG',
  HKD: 'HK',
  SEK: 'SE',
  DKK: 'DK',
  PLN: 'PL',
  THB: 'TH',
  IDR: 'ID',
  MXN: 'MX',
  KRW: 'KR',
  TRY: 'TR',
  RUB: 'RU',
  PHP: 'PH',
  CZK: 'CZ',
  ILS: 'IL',
  CLP: 'CL',
  COP: 'CO',
  TWD: 'TW',
  ARS: 'AR',
  SAR: 'SA',
  AED: 'AE',
  EGP: 'EG',
  VND: 'VN',
  PKR: 'PK',
  NGN: 'NG',
  BDT: 'BD',
  UAH: 'UA',
  KES: 'KE',
  GHS: 'GH',
  MAD: 'MA',
  QAR: 'QA',
  KWD: 'KW',
  OMR: 'OM',
  BHD: 'BH',
  JOD: 'JO',
  LKR: 'LK',
  MMK: 'MM',
  PEN: 'PE',
};

/**
 * Get the ISO country code for a currency (for flag display).
 * @param currencyCode - e.g., "USD", "EUR", "GBP"
 * @returns ISO 3166-1 alpha-2 code (e.g., "US", "EU", "GB") or null
 */
export function getCurrencyCountryCode(currencyCode: string): string | null {
  if (!currencyCode) return null;
  const code = currencyCode.toUpperCase();
  return CURRENCY_TO_COUNTRY_CODE[code] ?? null;
}

// ============================================================================
// FX PAIR ID TO RATE KEY MAPPING
// ============================================================================

const FX_PAIR_TO_RATE_KEY: Record<string, keyof ConversionRates> = {
  'eur-usd': 'eurUsd',
  'gbp-usd': 'gbpUsd',
  'usd-inr': 'usdInr',
  'usd-brl': 'usdBrl',
  'usd-cny': 'usdCny',
  'usd-cad': 'usdCad',
  'usd-nok': 'usdNok',
  'usd-myr': 'usdMyr',
  'usd-aud': 'usdAud',
  'gbp-zar': 'gbpZar',
};

// ============================================================================
// EXTRACT RATES FROM FX QUOTES
// ============================================================================

/**
 * Build ConversionRates object from FX quotes Map.
 * Extracts only the rates needed for commodity conversions.
 */
export function buildConversionRates(
  quotesById: Map<string, FxApiQuote>,
): ConversionRates {
  const rates: ConversionRates = {
    eurUsd: null,
    gbpUsd: null,
    usdInr: null,
    usdBrl: null,
    usdCny: null,
    usdCad: null,
    usdNok: null,
    usdMyr: null,
    usdAud: null,
    gbpZar: null,
  };

  for (const [pairId, rateKey] of Object.entries(FX_PAIR_TO_RATE_KEY)) {
    const quote = quotesById.get(pairId);
    if (quote && quote.price !== null && Number.isFinite(quote.price) && quote.price > 0) {
      rates[rateKey] = quote.price;
    }
  }

  return rates;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert a commodity price to USD.
 * If already in USD, returns the original price.
 * 
 * @param price - The commodity price in its native currency
 * @param quoteCurrency - The native currency code (e.g., 'USD', 'INR', 'BRL')
 * @param rates - The current FX rates
 * @returns USD price or null if conversion not possible
 */
export function convertToUsd(
  price: number,
  quoteCurrency: string,
  rates: ConversionRates,
): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;

  const currency = quoteCurrency.toUpperCase();

  switch (currency) {
    case 'USD':
      // Already in USD
      return price;

    case 'EUR':
      // EUR → USD: multiply by EUR/USD rate
      if (rates.eurUsd && rates.eurUsd > 0) {
        return price * rates.eurUsd;
      }
      return null;

    case 'GBP':
      // GBP → USD: multiply by GBP/USD rate
      if (rates.gbpUsd && rates.gbpUsd > 0) {
        return price * rates.gbpUsd;
      }
      return null;

    case 'INR':
      // INR → USD: divide by USD/INR rate (1 USD = X INR)
      if (rates.usdInr && rates.usdInr > 0) {
        return price / rates.usdInr;
      }
      return null;

    case 'BRL':
      // BRL → USD: divide by USD/BRL rate (1 USD = X BRL)
      if (rates.usdBrl && rates.usdBrl > 0) {
        return price / rates.usdBrl;
      }
      return null;

    case 'CNY':
      // CNY → USD: divide by USD/CNY rate (1 USD = X CNY)
      if (rates.usdCny && rates.usdCny > 0) {
        return price / rates.usdCny;
      }
      return null;

    case 'CAD':
      // CAD → USD: divide by USD/CAD rate (1 USD = X CAD)
      if (rates.usdCad && rates.usdCad > 0) {
        return price / rates.usdCad;
      }
      return null;

    case 'NOK':
      // NOK → USD: divide by USD/NOK rate (1 USD = X NOK)
      if (rates.usdNok && rates.usdNok > 0) {
        return price / rates.usdNok;
      }
      return null;

    case 'MYR':
      // MYR → USD: divide by USD/MYR rate (1 USD = X MYR)
      if (rates.usdMyr && rates.usdMyr > 0) {
        return price / rates.usdMyr;
      }
      return null;

    case 'AUD':
      // AUD → USD: divide by USD/AUD rate (1 USD = X AUD)
      if (rates.usdAud && rates.usdAud > 0) {
        return price / rates.usdAud;
      }
      return null;

    case 'ZAR':
      // ZAR → GBP → USD (two steps)
      // First: ZAR → GBP: divide by GBP/ZAR rate (1 GBP = X ZAR)
      // Then: GBP → USD: multiply by GBP/USD rate
      if (rates.gbpZar && rates.gbpZar > 0 && rates.gbpUsd && rates.gbpUsd > 0) {
        const gbpPrice = price / rates.gbpZar;
        return gbpPrice * rates.gbpUsd;
      }
      return null;

    default:
      // Unknown currency - cannot convert
      return null;
  }
}

/**
 * Convert USD to EUR.
 * 
 * @param usdPrice - The price in USD
 * @param rates - The current FX rates
 * @returns EUR price or null if conversion not possible
 */
export function usdToEur(usdPrice: number | null, rates: ConversionRates): number | null {
  if (usdPrice === null || !Number.isFinite(usdPrice) || usdPrice <= 0) return null;
  if (!rates.eurUsd || rates.eurUsd <= 0) return null;

  // EUR/USD means: 1 EUR = X USD
  // To get EUR from USD: USD / rate
  return usdPrice / rates.eurUsd;
}

/**
 * Convert USD to GBP.
 * 
 * @param usdPrice - The price in USD
 * @param rates - The current FX rates
 * @returns GBP price or null if conversion not possible
 */
export function usdToGbp(usdPrice: number | null, rates: ConversionRates): number | null {
  if (usdPrice === null || !Number.isFinite(usdPrice) || usdPrice <= 0) return null;
  if (!rates.gbpUsd || rates.gbpUsd <= 0) return null;

  // GBP/USD means: 1 GBP = X USD
  // To get GBP from USD: USD / rate
  return usdPrice / rates.gbpUsd;
}

// ============================================================================
// CROSS-RATE CONVERSION: USD → ZAR (via GBP)
// ============================================================================
// Path: USD → GBP → ZAR
// Uses existing pairs: gbp-usd and gbp-zar
// 
// Math:
//   Step 1: USD → GBP = USD ÷ gbpUsd  (since 1 GBP = X USD)
//   Step 2: GBP → ZAR = GBP × gbpZar  (since 1 GBP = X ZAR)
//   Combined: ZAR = (USD ÷ gbpUsd) × gbpZar
//
// v2.5: Cross-rate support for Gold in ZAR (5 Feb 2026)
// ============================================================================

/**
 * Convert USD to ZAR using cross-rate via GBP.
 * Path: USD → GBP → ZAR
 * 
 * @param usdPrice - The price in USD
 * @param rates - The current FX rates (requires gbpUsd and gbpZar)
 * @returns ZAR price or null if conversion not possible
 * 
 * @example
 * // Gold at $2,890 USD with GBP/USD=1.26 and GBP/ZAR=23.50
 * usdToZarCrossRate(2890, rates)
 * // Step 1: $2,890 ÷ 1.26 = £2,293.65
 * // Step 2: £2,293.65 × 23.50 = R53,900.78
 * // → 53900.78
 */
export function usdToZarCrossRate(
  usdPrice: number | null,
  rates: ConversionRates,
): number | null {
  if (usdPrice === null || !Number.isFinite(usdPrice) || usdPrice <= 0) return null;
  if (!rates.gbpUsd || rates.gbpUsd <= 0) return null;
  if (!rates.gbpZar || rates.gbpZar <= 0) return null;

  // Step 1: USD → GBP
  const gbpPrice = usdPrice / rates.gbpUsd;
  
  // Step 2: GBP → ZAR
  const zarPrice = gbpPrice * rates.gbpZar;
  
  return zarPrice;
}

/**
 * Convert a commodity price to EUR and GBP.
 * Handles all supported commodity currencies.
 * 
 * @param price - The commodity price in its native currency
 * @param quoteCurrency - The native currency code (e.g., 'USD', 'INR', 'BRL')
 * @param rates - The current FX rates
 * @returns Object with eur, gbp, and usd prices (null if conversion not possible)
 * 
 * @example
 * // USD commodity (Brent Crude at $63.34)
 * convertCommodityPrice(63.34, 'USD', rates)
 * // → { eur: 58.12, gbp: 48.90, usd: 63.34 }
 * 
 * @example
 * // INR commodity (Barley at ₹12,500)
 * convertCommodityPrice(12500, 'INR', rates)
 * // → { eur: 136.45, gbp: 114.80, usd: 148.81 }
 */
export function convertCommodityPrice(
  price: number,
  quoteCurrency: string,
  rates: ConversionRates,
): ConvertedPrices {
  const result: ConvertedPrices = {
    eur: null,
    gbp: null,
    usd: null,
  };

  // Step 1: Convert to USD (if not already)
  const usdPrice = convertToUsd(price, quoteCurrency, rates);
  
  if (usdPrice === null) {
    return result;
  }

  // Store USD price (unless commodity was already in USD)
  if (quoteCurrency.toUpperCase() !== 'USD') {
    result.usd = usdPrice;
  }

  // Step 2: Convert USD to EUR and GBP
  result.eur = usdToEur(usdPrice, rates);
  result.gbp = usdToGbp(usdPrice, rates);

  return result;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format USD price for display.
 * @param price - USD price
 * @returns Formatted string like "$63.34" or "—" if null
 */
export function formatUsdPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '—';
  
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 10) {
    return `$${price.toFixed(2)}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(3)}`;
  }
  return `$${price.toFixed(4)}`;
}

/**
 * Format EUR price for display.
 * @param price - EUR price
 * @returns Formatted string like "€58.12" or "—" if null
 */
export function formatEurPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '—';
  
  if (price >= 1000) {
    return `€${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 10) {
    return `€${price.toFixed(2)}`;
  }
  if (price >= 1) {
    return `€${price.toFixed(3)}`;
  }
  return `€${price.toFixed(4)}`;
}

/**
 * Format GBP price for display.
 * @param price - GBP price
 * @returns Formatted string like "£48.90" or "—" if null
 */
export function formatGbpPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '—';
  
  if (price >= 1000) {
    return `£${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 10) {
    return `£${price.toFixed(2)}`;
  }
  if (price >= 1) {
    return `£${price.toFixed(3)}`;
  }
  return `£${price.toFixed(4)}`;
}

/**
 * Format ZAR price for display.
 * Uses "R" prefix (South African Rand symbol).
 * @param price - ZAR price
 * @returns Formatted string like "R52,450.00" or "—" if null
 */
export function formatZarPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '—';
  
  if (price >= 1000) {
    return `R${price.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 10) {
    return `R${price.toFixed(2)}`;
  }
  if (price >= 1) {
    return `R${price.toFixed(3)}`;
  }
  return `R${price.toFixed(4)}`;
}

/**
 * Format both EUR and GBP prices as a single line.
 * @param eur - EUR price
 * @param gbp - GBP price
 * @returns Formatted string like "€58.12 · £48.90" or "—" if both null
 * @deprecated Use formatSmartConversionLines instead for v2.2+ display
 */
export function formatEurGbpLine(eur: number | null, gbp: number | null): string {
  const eurText = formatEurPrice(eur);
  const gbpText = formatGbpPrice(gbp);
  
  if (eurText === '—' && gbpText === '—') {
    return '—';
  }
  
  return `${eurText} · ${gbpText}`;
}

// ============================================================================
// SMART CONVERSION LINES (v2.4)
// ============================================================================
// Shows 2-3 converted currency lines with flag country codes for rendering.
// Avoids redundancy when base currency is already EUR, GBP, or USD.
//
// Logic:
// - Base USD: Show EUR + GBP (2 lines)
// - Base EUR: Show USD + GBP (2 lines, no EUR→EUR)
// - Base GBP: Show USD + EUR (2 lines, no GBP→GBP)
// - Base other (INR, BRL, etc.): Show EUR + GBP + USD (3 lines)
//
// v2.4: Returns structured data with country codes for Flag component rendering
// ============================================================================

/** Single conversion line with country code and formatted price */
export interface ConversionLineData {
  /** ISO country code for Flag component (e.g., "EU", "GB", "US") */
  countryCode: string;
  /** Formatted price string (e.g., "€58.12", "£48.90", "$63.34") */
  priceText: string;
}

export interface SmartConversionLines {
  /** First conversion line */
  line1: ConversionLineData;
  /** Second conversion line */
  line2: ConversionLineData;
  /** Third conversion line - only for non-USD/EUR/GBP base */
  line3: ConversionLineData | null;
}

/**
 * Format smart conversion lines based on base currency.
 * Avoids showing redundant conversions (EUR→EUR or GBP→GBP).
 * Shows 3 lines for non-major currencies to include USD.
 * 
 * @param quoteCurrency - The base currency (USD, EUR, GBP, etc.)
 * @param priceEur - EUR converted price
 * @param priceGbp - GBP converted price
 * @param priceUsd - USD converted price (for non-USD base commodities)
 * @returns Two or three conversion lines with country codes and formatted prices
 */
export function formatSmartConversionLines(
  quoteCurrency: string,
  priceEur: number | null,
  priceGbp: number | null,
  priceUsd: number | null,
): SmartConversionLines {
  const currency = quoteCurrency.toUpperCase();
  
  // Build line data for each currency
  const eurLine: ConversionLineData = {
    countryCode: 'EU',
    priceText: formatEurPrice(priceEur),
  };
  const gbpLine: ConversionLineData = {
    countryCode: 'GB',
    priceText: formatGbpPrice(priceGbp),
  };
  const usdLine: ConversionLineData = {
    countryCode: 'US',
    priceText: formatUsdPrice(priceUsd),
  };
  
  switch (currency) {
    case 'EUR':
      // Base is EUR → show USD + GBP (no EUR→EUR)
      return { line1: usdLine, line2: gbpLine, line3: null };
      
    case 'GBP':
      // Base is GBP → show USD + EUR (no GBP→GBP)
      return { line1: usdLine, line2: eurLine, line3: null };
      
    case 'USD':
      // Base is USD → show EUR + GBP (standard 2 lines)
      return { line1: eurLine, line2: gbpLine, line3: null };
      
    default:
      // Base is other (INR, BRL, CNY, etc.) → show EUR + GBP + USD (3 lines)
      return { line1: eurLine, line2: gbpLine, line3: usdLine };
  }
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

/**
 * Get debug snapshot of conversion rates.
 * Useful for verifying FX data availability.
 */
export function getConversionRatesDebugSnapshot(rates: ConversionRates) {
  return {
    at: new Date().toISOString(),
    available: Object.entries(rates)
      .filter(([, v]) => v !== null)
      .map(([k]) => k),
    missing: Object.entries(rates)
      .filter(([, v]) => v === null)
      .map(([k]) => k),
    rates: { ...rates },
  };
}
