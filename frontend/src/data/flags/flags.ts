// frontend/src/data/flags/flags.ts
//
// Country/region flag helpers for Promagen.
//
// Upgrade 1: Build-time SVG manifest
// - scripts/generate-flags-manifest.ts generates ./flags.manifest.json from /public/flags/*.svg.
// - flagSrc() only returns a URL when the manifest says the SVG exists.
//   That means: no missing-flag 404 requests from the UI.
//
// Notes
// - Emoji flags only exist for ISO-3166 alpha-2 codes (US, GB, AE, ZA, etc) plus EU.
// - SVG flags can support extra codes as long as a matching SVG exists in /public/flags
//   (e.g. gb-eng, gb-sct, bq-sa, xk, etc).

import flagsManifestRaw from './flags.manifest.json';

export type CountryCode = string;

type FlagsManifest = {
  count: number;
  codes: string[];
};

const manifest = flagsManifestRaw as FlagsManifest;

const manifestCodes = Array.isArray(manifest.codes) ? manifest.codes : [];

export const AVAILABLE_SVG_FLAG_CODES = new Set(
  manifestCodes.map((code) => String(code).trim().toLowerCase()).filter((code) => code.length > 0),
);

// Explicit Unicode escapes behave better across Windows consoles/editors.
const EU_FLAG_EMOJI = '\uD83C\uDDEA\uD83C\uDDFA'; // 🇪🇺
const UNKNOWN_FLAG_EMOJI = '\u2753'; // ❓

const REGIONAL_INDICATOR_A = 0x1f1e6;

const ALIAS: Record<string, string> = {
  // common “human” aliases
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
 * Normalise an input into a strict emoji-supported code:
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
 * Normalise an input into a *manifest-backed SVG code*.
 * The manifest becomes the validator: if the SVG doesn't exist, we return null.
 */
function normaliseSvgCode(code?: CountryCode | null): string | null {
  if (!code) return null;

  const raw = String(code).trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  const aliased = ALIAS[upper] ?? upper;

  const lower = aliased.toLowerCase();
  return AVAILABLE_SVG_FLAG_CODES.has(lower) ? lower : null;
}

export function hasSvgFlag(code?: CountryCode | null): boolean {
  return normaliseSvgCode(code) != null;
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
 * Returns the SVG path for a flag in /public/flags, or null if it doesn't exist.
 * Example: "/flags/gb.svg"
 *
 * This is manifest-backed (known-good): it won't return paths that would 404.
 */
export function flagSrc(countryCode?: CountryCode | null): string | null {
  const svgCode = normaliseSvgCode(countryCode);
  if (!svgCode) return null;

  return `/flags/${svgCode}.svg`;
}

/**
 * Accessible label for screen readers / titles.
 * Keeps a small friendly map and falls back to "<CODE> flag".
 */
export function flagAriaLabel(countryCode?: CountryCode | null): string {
  const iso = normaliseCountryCode(countryCode);
  if (iso === 'EU') return 'European Union flag';
  if (iso) {
    const common: Record<string, string> = {
      GB: 'United Kingdom flag',
      US: 'United States flag',
      AE: 'United Arab Emirates flag',
      ZA: 'South Africa flag',
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
      GR: 'Greece flag',
    };

    return common[iso] ?? `${iso} flag`;
  }

  const svgCode = normaliseSvgCode(countryCode);
  if (svgCode) return `${svgCode.toUpperCase()} flag`;

  return 'Unknown flag';
}

/**
 * Emoji-first helper used in parts of the site that render emoji flags.
 * Always returns a symbol (emoji), even if unknown.
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
