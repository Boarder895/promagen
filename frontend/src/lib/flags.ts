// frontend/src/lib/flags.ts

// Normalises country/region codes to a displayable flag (emoji first, fallback).
// Keeps logic tiny and local; no heavy i18n dependency needed for the homepage rails.

export type CountryCode = string;

const REGIONAL_INDICATOR_A = 0x1f1e6;

// Explicit Unicode escapes to behave on Windows consoles as well.
const EU_FLAG = "\uD83C\uDDEA\uD83C\uDDFA"; // 🇪🇺
const UNKNOWN_FLAG = "\u2753";              // ❓

/**
 * Minimal alias table for friendly / legacy codes used around Promagen.
 * - UK → GB (Unicode flag is 🇬🇧)
 * - EL → GR (Greece “Ellás”)
 */
const ALIAS: Record<string, string> = {
  UK: "GB",
  EL: "GR",
};

/**
 * Convert a two-letter ISO code like "GB" into the corresponding Unicode flag emoji.
 */
function isoToFlagEmoji(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return UNKNOWN_FLAG;

  const codePoints = Array.from(iso).map((char) => {
    const offset = char.codePointAt(0)! - 0x41; // 'A'
    return REGIONAL_INDICATOR_A + offset;
  });

  return String.fromCodePoint(...codePoints);
}

/**
 * Main flag helper.
 *
 * - Accepts loose codes like "uk", "GB", " eu " etc.
 * - Applies alias mapping.
 * - Returns emoji where possible, otherwise the UNKNOWN_FLAG.
 */
export function flag(code?: CountryCode): string {
  if (!code) return UNKNOWN_FLAG;

  const trimmed = code.trim().toUpperCase();
  const iso = ALIAS[trimmed] ?? trimmed;

  if (iso === "EU") {
    return EU_FLAG;
  }

  if (!/^[A-Z]{2}$/.test(iso)) {
    return UNKNOWN_FLAG;
  }

  return isoToFlagEmoji(iso);
}

/**
 * Human-friendly label combining emoji and a readable name.
 * Example: "🇬🇧 United Kingdom flag"
 */
export function flagLabel(code?: CountryCode): string {
  const emoji = flag(code);
  const label = flagAriaLabel(code);
  return `${emoji} ${label}`;
}

/**
 * Accessible label text for screen readers (“United Kingdom flag”, “European Union flag”).
 * Keeps a small common mapping and falls back to a generic “XX flag” or “Unknown flag”.
 */
export function flagAriaLabel(code?: CountryCode): string {
  if (!code) return "Unknown flag";

  const trimmed = code.trim().toUpperCase();
  const iso = ALIAS[trimmed] ?? trimmed;

  if (iso === "EU") return "European Union flag";
  if (!/^[A-Z]{2}$/.test(iso)) return "Unknown flag";

  const common: Record<string, string> = {
    GB: "United Kingdom flag",
    UK: "United Kingdom flag",
    US: "United States flag",
    AE: "United Arab Emirates flag",
    IN: "India flag",
    SG: "Singapore flag",
    HK: "Hong Kong flag",
    JP: "Japan flag",
    AU: "Australia flag",
    NZ: "New Zealand flag",
    CN: "China flag",
    DE: "Germany flag",
    FR: "France flag",
    NL: "Netherlands flag",
    BR: "Brazil flag",
    CA: "Canada flag",
  };

  return common[iso] ?? `${iso} flag`;
}
