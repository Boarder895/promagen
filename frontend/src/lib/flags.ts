// frontend/src/lib/flags.ts
//
// Canonical flag helpers for Promagen.
// - SVG first (served from /public/flags/<code>.svg)
// - Emoji fallback (works everywhere)
// - Designed to be SSOT-driven: FX pairs supply country codes, UI just renders them.
//
// Notes:
// - ISO-3166 alpha-2 codes expected (US, GB, AE, ZA, etc) plus "EU".
// - Aliases supported: UK -> GB, EL -> GR.

export type CountryCode = string;

const REGIONAL_INDICATOR_A = 0x1f1e6;

// Explicit Unicode escapes behave better across Windows consoles/editors.
const EU_FLAG_EMOJI = '\uD83C\uDDEA\uD83C\uDDFA'; // 🇪🇺
const UNKNOWN_FLAG_EMOJI = '\u2753'; // ❓

const ALIAS: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
};

function isoToFlagEmoji(iso: string): string | null {
  if (!/^[A-Z]{2}$/.test(iso)) return null;

  const first = iso.charCodeAt(0) - 0x41; // 'A'
  const second = iso.charCodeAt(1) - 0x41;

  if (first < 0 || first > 25 || second < 0 || second > 25) return null;

  return String.fromCodePoint(REGIONAL_INDICATOR_A + first, REGIONAL_INDICATOR_A + second);
}

/**
 * Normalise input into a supported country/region code.
 * - trims
 * - uppercases
 * - applies aliases (UK->GB, EL->GR)
 * - allows EU
 * Returns null for invalid input.
 */
export function normaliseCountryCode(code?: CountryCode | null): string | null {
  if (!code) return null;

  const trimmed = String(code).trim().toUpperCase();
  if (!trimmed) return null;

  const normalised = ALIAS[trimmed] ?? trimmed;

  if (normalised === 'EU') return 'EU';
  if (!/^[A-Z]{2}$/.test(normalised)) return null;

  return normalised;
}

/**
 * Returns an emoji flag for a country code (or EU). Returns null if invalid/missing.
 */
export function countryCodeToFlagEmoji(countryCode?: CountryCode | null): string | null {
  const iso = normaliseCountryCode(countryCode);
  if (!iso) return null;

  if (iso === 'EU') return EU_FLAG_EMOJI;

  return isoToFlagEmoji(iso);
}

/**
 * Returns the SVG path for a flag in /public/flags, or null if the code is invalid/missing.
 * Example: "/flags/gb.svg"
 */
export function flagSrc(countryCode?: CountryCode | null): string | null {
  const iso = normaliseCountryCode(countryCode);
  if (!iso) return null;

  return `/flags/${iso.toLowerCase()}.svg`;
}

/**
 * Accessible label for screen readers / titles.
 * Keeps a small friendly map and falls back to "XX flag".
 */
export function flagAriaLabel(countryCode?: CountryCode | null): string {
  const iso = normaliseCountryCode(countryCode);
  if (!iso) return 'Unknown flag';
  if (iso === 'EU') return 'European Union flag';

  const common: Record<string, string> = {
    GB: 'United Kingdom flag',
    US: 'United States flag',
    AE: 'United Arab Emirates flag',
    ZA: 'South Africa flag',
    EU: 'European Union flag',
    JP: 'Japan flag',
    CN: 'China flag',
    AU: 'Australia flag',
    NZ: 'New Zealand flag',
    CA: 'Canada flag',
    BR: 'Brazil flag',
    IN: 'India flag',
    SG: 'Singapore flag',
    HK: 'Hong Kong flag',
    DE: 'Germany flag',
    FR: 'France flag',
    NL: 'Netherlands flag',
    CH: 'Switzerland flag',
  };

  return common[iso] ?? `${iso} flag`;
}

/**
 * Backwards-compatible helpers (kept because other parts of the site may use them).
 * flag(): always returns a symbol (emoji), even if unknown.
 */
export function flag(code?: CountryCode | null): string {
  return countryCodeToFlagEmoji(code) ?? UNKNOWN_FLAG_EMOJI;
}

export function flagLabel(code?: CountryCode | null): string {
  return `${flag(code)} ${flagAriaLabel(code)}`;
}

/**
 * FX label helpers (string form).
 * Used for tooltips, logs, compact text-only contexts.
 */
export function formatCurrencyWithFlag(
  currencyCode: string,
  countryCode?: CountryCode | null,
): string {
  const code = (currencyCode ?? '').trim().toUpperCase();
  const emoji = countryCodeToFlagEmoji(countryCode);
  return emoji ? `${code} ${emoji}` : code;
}

export function formatFxPairLabelWithFlags(
  base: string,
  baseCountryCode: CountryCode | null | undefined,
  quote: string,
  quoteCountryCode: CountryCode | null | undefined,
  separator = ' / ',
): string {
  return `${formatCurrencyWithFlag(base, baseCountryCode)}${separator}${formatCurrencyWithFlag(
    quote,
    quoteCountryCode,
  )}`;
}
