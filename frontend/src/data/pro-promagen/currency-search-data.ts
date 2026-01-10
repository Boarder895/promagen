// src/data/pro-promagen/currency-search-data.ts
// ============================================================================
// CURRENCY SEARCH DATA - Country Names & Trader Slang
// ============================================================================
// Maps ISO currency codes to searchable terms including:
// - Full country/region names
// - Currency names
// - Trader slang/nicknames
//
// Used by FX dropdown to enable intuitive searching:
// - Type "South Africa" → finds all ZAR pairs
// - Type "Pound" → finds all GBP pairs
// - Type "Loonie" → finds all CAD pairs
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

/**
 * Maps 3-letter ISO currency codes to searchable terms.
 * Terms include country names, currency names, and trader slang.
 */
export const CURRENCY_SEARCH_TERMS: Record<string, string[]> = {
  // Major Currencies
  USD: ['United States', 'US', 'USA', 'America', 'American', 'Dollar', 'Buck', 'Greenback'],
  EUR: ['Europe', 'European', 'Euro', 'Eurozone', 'EU', 'Fiber'],
  GBP: ['United Kingdom', 'UK', 'Britain', 'British', 'England', 'Pound', 'Sterling', 'Cable', 'Quid'],
  JPY: ['Japan', 'Japanese', 'Yen', 'Ninja'],
  CHF: ['Switzerland', 'Swiss', 'Franc', 'Swissie'],
  AUD: ['Australia', 'Australian', 'Aussie', 'Oz'],
  CAD: ['Canada', 'Canadian', 'Loonie', 'Funds'],
  NZD: ['New Zealand', 'Kiwi', 'NZ'],

  // European Currencies
  SEK: ['Sweden', 'Swedish', 'Krona', 'Stockie'],
  NOK: ['Norway', 'Norwegian', 'Krone'],
  DKK: ['Denmark', 'Danish', 'Krone'],
  PLN: ['Poland', 'Polish', 'Zloty'],
  CZK: ['Czech', 'Czechia', 'Koruna', 'Czech Republic'],
  HUF: ['Hungary', 'Hungarian', 'Forint'],
  RON: ['Romania', 'Romanian', 'Leu'],
  BGN: ['Bulgaria', 'Bulgarian', 'Lev'],
  HRK: ['Croatia', 'Croatian', 'Kuna'],
  ISK: ['Iceland', 'Icelandic', 'Krona'],
  RUB: ['Russia', 'Russian', 'Ruble', 'Rouble'],
  TRY: ['Turkey', 'Turkish', 'Lira'],
  UAH: ['Ukraine', 'Ukrainian', 'Hryvnia'],

  // Asia Pacific
  CNY: ['China', 'Chinese', 'Yuan', 'Renminbi', 'RMB', 'CNH'],
  CNH: ['China', 'Chinese', 'Yuan', 'Renminbi', 'RMB', 'Offshore'],
  HKD: ['Hong Kong', 'HK', 'Dollar'],
  SGD: ['Singapore', 'Sing', 'Singdollar'],
  KRW: ['Korea', 'Korean', 'South Korea', 'Won'],
  TWD: ['Taiwan', 'Taiwanese', 'Dollar', 'NT'],
  THB: ['Thailand', 'Thai', 'Baht'],
  MYR: ['Malaysia', 'Malaysian', 'Ringgit'],
  IDR: ['Indonesia', 'Indonesian', 'Rupiah'],
  PHP: ['Philippines', 'Filipino', 'Peso'],
  VND: ['Vietnam', 'Vietnamese', 'Dong'],
  INR: ['India', 'Indian', 'Rupee'],
  PKR: ['Pakistan', 'Pakistani', 'Rupee'],
  BDT: ['Bangladesh', 'Bangladeshi', 'Taka'],
  LKR: ['Sri Lanka', 'Sri Lankan', 'Rupee'],
  NPR: ['Nepal', 'Nepalese', 'Rupee'],

  // Middle East
  AED: ['UAE', 'Emirates', 'Dubai', 'Dirham', 'United Arab Emirates'],
  SAR: ['Saudi', 'Saudi Arabia', 'Riyal'],
  QAR: ['Qatar', 'Qatari', 'Riyal'],
  KWD: ['Kuwait', 'Kuwaiti', 'Dinar'],
  BHD: ['Bahrain', 'Bahraini', 'Dinar'],
  OMR: ['Oman', 'Omani', 'Rial'],
  JOD: ['Jordan', 'Jordanian', 'Dinar'],
  ILS: ['Israel', 'Israeli', 'Shekel', 'Sheqel'],
  EGP: ['Egypt', 'Egyptian', 'Pound'],

  // Africa
  ZAR: ['South Africa', 'South African', 'Rand', 'SA'],
  NGN: ['Nigeria', 'Nigerian', 'Naira'],
  KES: ['Kenya', 'Kenyan', 'Shilling'],
  GHS: ['Ghana', 'Ghanaian', 'Cedi'],
  MAD: ['Morocco', 'Moroccan', 'Dirham'],
  TND: ['Tunisia', 'Tunisian', 'Dinar'],
  MUR: ['Mauritius', 'Mauritian', 'Rupee'],
  BWP: ['Botswana', 'Pula'],
  UGX: ['Uganda', 'Ugandan', 'Shilling'],
  TZS: ['Tanzania', 'Tanzanian', 'Shilling'],

  // Americas
  MXN: ['Mexico', 'Mexican', 'Peso'],
  BRL: ['Brazil', 'Brazilian', 'Real'],
  ARS: ['Argentina', 'Argentine', 'Peso'],
  CLP: ['Chile', 'Chilean', 'Peso'],
  COP: ['Colombia', 'Colombian', 'Peso'],
  PEN: ['Peru', 'Peruvian', 'Sol'],
  UYU: ['Uruguay', 'Uruguayan', 'Peso'],
  VES: ['Venezuela', 'Venezuelan', 'Bolivar'],
  DOP: ['Dominican', 'Dominican Republic', 'Peso'],
  GTQ: ['Guatemala', 'Guatemalan', 'Quetzal'],
  CRC: ['Costa Rica', 'Costa Rican', 'Colon'],
  PAB: ['Panama', 'Panamanian', 'Balboa'],
  JMD: ['Jamaica', 'Jamaican', 'Dollar'],
  TTD: ['Trinidad', 'Tobago', 'Trinidad and Tobago', 'Dollar'],
  BSD: ['Bahamas', 'Bahamian', 'Dollar'],
  BBD: ['Barbados', 'Barbadian', 'Dollar'],

  // Oceania
  FJD: ['Fiji', 'Fijian', 'Dollar'],
  PGK: ['Papua New Guinea', 'PNG', 'Kina'],
  XPF: ['Pacific Franc', 'CFP', 'French Pacific'],

  // Precious Metals (often traded as currencies)
  XAU: ['Gold', 'Bullion'],
  XAG: ['Silver'],
  XPT: ['Platinum'],
  XPD: ['Palladium'],

  // Crypto (if needed)
  BTC: ['Bitcoin', 'Crypto'],
  ETH: ['Ethereum', 'Ether', 'Crypto'],
};

/**
 * Get all searchable terms for a currency pair.
 * Returns terms for both base and quote currencies.
 *
 * @example
 * getSearchTermsForPair('EUR/USD')
 * // Returns: ['EUR', 'USD', 'Europe', 'European', 'Euro', ..., 'United States', 'Dollar', ...]
 */
export function getSearchTermsForPair(pairId: string): string[] {
  // Handle different pair formats: 'EUR/USD', 'EURUSD', 'EUR_USD'
  const normalized = pairId.toUpperCase().replace(/[/_-]/g, '');
  
  // Most pairs are 6 characters (3 + 3)
  if (normalized.length === 6) {
    const base = normalized.slice(0, 3);
    const quote = normalized.slice(3, 6);
    
    const baseTerms = CURRENCY_SEARCH_TERMS[base] || [];
    const quoteTerms = CURRENCY_SEARCH_TERMS[quote] || [];
    
    return [base, quote, ...baseTerms, ...quoteTerms];
  }
  
  // Fallback: just return the pair ID
  return [pairId];
}

/**
 * Check if a pair matches a search query.
 * Matches against pair ID and all currency search terms.
 *
 * @example
 * pairMatchesSearch('EUR/USD', 'euro') // true
 * pairMatchesSearch('USD/ZAR', 'south africa') // true
 * pairMatchesSearch('GBP/USD', 'loonie') // false (that's CAD)
 */
export function pairMatchesSearch(pairId: string, query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return true; // Empty query matches all
  
  // Direct match on pair ID
  if (pairId.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  // Match on search terms
  const terms = getSearchTermsForPair(pairId);
  return terms.some(term => term.toLowerCase().includes(lowerQuery));
}

export default CURRENCY_SEARCH_TERMS;
