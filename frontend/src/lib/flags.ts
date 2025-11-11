// Emoji-first flags with accessible labels and safe fallbacks.
// Adds back-compat alias `flagLabel` for tests that import it.

export type CountryCode = string;

const ALIAS: Record<string, string> = { UK: "GB", EU: "EU" };

export function flag(code?: CountryCode): string {
  if (!code) return "??";
  const iso = (ALIAS[code.trim().toUpperCase()] ?? code.trim().toUpperCase());
  if (iso === "EU") return "????";
  if (!/^[A-Z]{2}$/.test(iso)) return "??";

  const A = 0x1f1e6; // regional indicator A
  const codePoints = [...iso].map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

export function flagAriaLabel(code?: CountryCode): string {
  if (!code) return "World flag";
  const iso = (ALIAS[code.trim().toUpperCase()] ?? code.trim().toUpperCase());
  if (iso === "EU") return "European Union flag";
  if (!/^[A-Z]{2}$/.test(iso)) return "World flag";
  return `${iso} flag`;
}

// Back-compat alias used by some tests
export const flagLabel = flagAriaLabel;
