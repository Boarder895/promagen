// Quick region mapping by currency, coarse but useful for facets.
// Adjust as your catalog grows.

const EUROPE = new Set(['EUR','GBP','CHF','SEK','NOK','DKK','PLN','CZK','HUF','ISK','RON','BGN']);
const AMERICAS = new Set(['USD','CAD','BRL','MXN','ARS','CLP','COP','PEN','UYU','PYG','BBD','TTD']);
const APAC = new Set(['JPY','CNY','HKD','TWD','KRW','INR','SGD','MYR','IDR','THB','PHP','AUD','NZD','VND','PKR','BDT','LKR']);
const MIDDLE_EAST = new Set(['AED','SAR','ILS','TRY','IRR','QAR','KWD','OMR','BHD']);
const AFRICA = new Set(['ZAR','EGP','NGN','KES','MAD','TND','CFA','XOF','XAF']);

export type Region = 'EUROPE' | 'AMERICAS' | 'APAC' | 'MIDDLE_EAST' | 'AFRICA';

export function regionOfCurrency(code: string): Region | 'ALL' {
  if (EUROPE.has(code)) {return 'EUROPE';}
  if (AMERICAS.has(code)) {return 'AMERICAS';}
  if (APAC.has(code)) {return 'APAC';}
  if (MIDDLE_EAST.has(code)) {return 'MIDDLE_EAST';}
  if (AFRICA.has(code)) {return 'AFRICA';}
  return 'ALL';
}
