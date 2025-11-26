import countriesJson from '../../data/geo/countries.catalog.json';

export interface CountryMeta {
  code: string;
  name: string;
  emoji: string;
  region: string;
  subRegion?: string;
  timeZoneKey?: string;
}

const countries = countriesJson as CountryMeta[];

/**
 * Map of ISO country code -> CountryMeta for fast lookups.
 */
const countryByCode = new Map<string, CountryMeta>(
  countries.map((country) => [country.code, country]),
);

/**
 * Get full metadata for a single country code.
 *
 * Returns undefined if the code is not present in countries.catalog.json.
 */
export function getCountryMeta(code: string): CountryMeta | undefined {
  return countryByCode.get(code);
}

/**
 * Resolve a list of country codes to metadata, discarding any unknown codes.
 *
 * This is useful for safely rendering flag sequences in the UI.
 */
export function getCountriesMeta(codes: string[]): CountryMeta[] {
  if (!Array.isArray(codes) || codes.length === 0) {
    return [];
  }

  return codes
    .map((code) => countryByCode.get(code))
    .filter((meta): meta is CountryMeta => Boolean(meta));
}

/**
 * Convenience helper: return a string of flag emojis for the given codes,
 * in order, skipping any unknown codes.
 *
 * Example: ["US", "GB"] -> "🇺🇸🇬🇧"
 */
export function getFlagEmojiSequence(codes: string[]): string {
  return getCountriesMeta(codes)
    .map((country) => country.emoji)
    .join('');
}

/**
 * Convenience helper: return a human-readable list of country names for
 * the given codes, suitable for tooltips or screen reader labels.
 *
 * Examples:
 * - ["US"] -> "United States"
 * - ["GB", "US"] -> "United Kingdom and United States"
 * - ["BR", "ET", "KE"] -> "Brazil, Ethiopia and Kenya"
 */
export function getCountryNamesLabel(codes: string[]): string {
  const metas = getCountriesMeta(codes);

  if (metas.length === 0) {
    return '';
  }

  const names = metas.map((country) => country.name);

  if (names.length === 1) {
    return names[0] ?? '';
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  const allButLast = names.slice(0, -1).join(', ');
  const last = names[names.length - 1];

  return `${allButLast} and ${last}`;
}

/**
 * Expose all countries as a list, in case you need to build drop-downs
 * or filters later (e.g. "show commodities with exposure to Latin America").
 */
export function getAllCountries(): CountryMeta[] {
  return countries.slice();
}
