// frontend/src/lib/flags.ts

export type CountryCode = string;

// Minimal aliases people actually use
const ALIAS: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
  EU: 'EU', // handled specially
  XK: 'XK', // Kosovo (vendor-supported)
};

const UNKNOWN = '❓';

const NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  US: 'United States',
  EU: 'European Union',
  AE: 'United Arab Emirates',
  IN: 'India',
  SG: 'Singapore',
  HK: 'Hong Kong',
  JP: 'Japan',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  BR: 'Brazil',
  CA: 'Canada',
};

export function flag(code?: CountryCode): string {
  if (!code) return UNKNOWN;
  const c = code.trim().toUpperCase();
  const iso = ALIAS[c] ?? c;

  if (iso === 'EU') return '🇪🇺'; // special-case EU

  if (!/^[A-Z]{2}$/.test(iso)) return UNKNOWN;

  const a = iso.codePointAt(0)! - 65 + 0x1f1e6;
  const b = iso.codePointAt(1)! - 65 + 0x1f1e6;
  return String.fromCodePoint(a, b);
}

/**
 * Human-facing label used by tests; includes the country/region name
 * so screen readers and snapshots are meaningful.
 */
export function flagLabel(code?: CountryCode): string {
  if (!code) return `${UNKNOWN} Unknown`;
  const c = code.trim().toUpperCase();
  const iso = ALIAS[c] ?? c;
  const emoji = flag(iso);
  const name = NAMES[iso] ?? iso;
  return `${emoji} ${name}`;
}

/** Optional: accessible label if you need it elsewhere */
export function flagAriaLabel(code?: CountryCode): string {
  if (!code) return 'Unknown flag';
  const c = code.trim().toUpperCase();
  const iso = ALIAS[c] ?? c;
  if (iso === 'EU') return 'European Union flag';
  const name = NAMES[iso] ?? iso;
  return `${name} flag`;
}

export const FLAGS_INTERNAL_TEST_EXPORTS = { UNKNOWN };
