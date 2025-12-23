/**
 * Number formatting helpers, locale aware.
 * - formatNumber(value, { dp, compact, sign, locale, strict })
 * - formatMoney(value, currencyCode, { locale, strict })
 * - toRomanNumeral(value, { strict })
 */

export type NumberFormatOptions = {
  dp?: number;
  compact?: boolean;
  sign?: 'auto' | 'always';
  locale?: string;
  strict?: boolean; // throw on NaN/Infinity when true
};

function guardFinite(v: number, strict?: boolean): number {
  if (!Number.isFinite(v)) {
    if (strict) throw new Error('Non-finite number');
    return 0;
  }
  return v;
}

export function formatNumber(value: number, opts: NumberFormatOptions = {}): string {
  const { dp = 2, compact = false, sign = 'auto', locale, strict } = opts;
  const v = guardFinite(value, strict);
  const style: Intl.NumberFormatOptions = compact
    ? { notation: 'compact', maximumFractionDigits: dp, minimumFractionDigits: 0 }
    : { maximumFractionDigits: dp, minimumFractionDigits: 0 };
  const s = new Intl.NumberFormat(locale, style).format(v);
  return sign === 'always' && v > 0 ? `+${s}` : s;
}

type MoneyOpts = { locale?: string; strict?: boolean };

export function formatMoney(value: number, currencyCode: string, opts: MoneyOpts = {}): string {
  const { locale, strict } = opts;
  const v = guardFinite(value, strict);
  try {
    // Let the UA decide spacing/symbol (GBP -> £, etc.)
    return new Intl.NumberFormat(locale ?? 'en-GB', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    // Fallback if currency not recognised
    return `${currencyCode} ${formatNumber(v, { dp: 2, locale, strict })}`;
  }
}

export type RomanNumeralOptions = {
  /**
   * When true:
   * - throw if the value is non-finite, negative, or not an integer.
   * When false:
   * - coerce to a safe integer (floor), and return "" for <= 0.
   */
  strict?: boolean;
};

/**
 * Convert a positive integer to a Roman numeral string.
 * - Returns "" for 0 or negative values (non-strict mode).
 * - Roman numerals are display-only; use the underlying Arabic number for tooltips/aria-label elsewhere.
 */
export function toRomanNumeral(value: number, opts: RomanNumeralOptions = {}): string {
  const { strict } = opts;
  const v0 = guardFinite(value, strict);

  const isInt = Number.isInteger(v0);
  if (strict && (!isInt || v0 < 0)) {
    throw new Error('Roman numeral requires a non-negative integer');
  }

  const v = strict ? v0 : Math.floor(v0);
  if (v <= 0) return '';

  // Standard Roman mapping. For values > 3999 we fall back to repeated "M" for thousands.
  const map: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let n = v;
  let out = '';

  for (const [num, sym] of map) {
    while (n >= num) {
      out += sym;
      n -= num;
    }
  }

  return out;
}
