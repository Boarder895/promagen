// Consistent number formatting across Promagen.
// Defaults to British English and tabular numerals for clean alignment.

export type FormatOptions = {
  locale?: string;                 // default "en-GB"
  digits?: number;                 // fraction digits
  style?: "decimal" | "percent" | "currency" | "unit";
  currency?: string;               // e.g. "GBP"
  unit?: Intl.NumberFormatOptions["unit"]; // e.g. "celsius"
};

export function formatNumber(value: number, opts: FormatOptions = {}): string {
  const {
    locale = "en-GB",
    digits,
    style = "decimal",
    currency,
    unit,
  } = opts;

  const nf = new Intl.NumberFormat(locale, {
    style,
    currency,
    unit,
    minimumFractionDigits: typeof digits === "number" ? digits : undefined,
    maximumFractionDigits: typeof digits === "number" ? digits : undefined,
    // keep grouping sensible; we want tabular-nums via CSS not here
    useGrouping: true,
  });

  return nf.format(value);
}

/**
 * Utility for labelled values that need a consistent “as of HH:mm” suffix.
 * Pass a date (default now) and locale; returns e.g. "as of 14:37".
 */
export function asOfLabel(date = new Date(), locale = "en-GB"): string {
  return `as of ${date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}
