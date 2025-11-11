/**
 * Number formatting helpers, locale aware.
 * - formatNumber(value, { dp, compact, sign, locale, strict })
 * - formatMoney(value, currencyCode, { locale, strict })
 */

export type NumberFormatOptions = {
  dp?: number;
  compact?: boolean;
  sign?: "auto" | "always";
  locale?: string;
  strict?: boolean; // throw on NaN/Infinity when true
};

function guardFinite(v: number, strict?: boolean): number {
  if (!Number.isFinite(v)) {
    if (strict) throw new Error("Non-finite number");
    return 0;
  }
  return v;
}

export function formatNumber(value: number, opts: NumberFormatOptions = {}): string {
  const { dp = 2, compact = false, sign = "auto", locale, strict } = opts;
  const v = guardFinite(value, strict);
  const style: Intl.NumberFormatOptions = compact
    ? { notation: "compact", maximumFractionDigits: dp, minimumFractionDigits: 0 }
    : { maximumFractionDigits: dp, minimumFractionDigits: 0 };
  const s = new Intl.NumberFormat(locale, style).format(v);
  return sign === "always" && v > 0 ? `+${s}` : s;
}

type MoneyOpts = { locale?: string; strict?: boolean };

export function formatMoney(value: number, currencyCode: string, opts: MoneyOpts = {}): string {
  const { locale, strict } = opts;
  const v = guardFinite(value, strict);
  try {
    // Let the UA decide spacing/symbol (GBP -> £, etc.)
    return new Intl.NumberFormat(locale ?? "en-GB", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    // Fallback if currency not recognised
    return `${currencyCode} ${formatNumber(v, { dp: 2, locale, strict })}`;
  }
}
