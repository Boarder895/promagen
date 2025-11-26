import countryCommodityMapJson from './country-commodities.map.json';

export interface CountryCommodityMapRowRaw {
  country: string;
  energy_1?: string | null;
  energy_2?: string | null;
  energy_3?: string | null;
  agriculture_1?: string | null;
  agriculture_2?: string | null;
  agriculture_3?: string | null;
  metals_1?: string | null;
  metals_2?: string | null;
  metals_3?: string | null;
}

export type CommodityGroupKey = 'energy' | 'agriculture' | 'metals';

export interface CountryCommodityMapEntry {
  country: string;
  /**
   * Country name without emoji / flag.
   * e.g. "🇬🇧 United Kingdom" -> "United Kingdom"
   */
  countryName: string;
  energy: string[];
  agriculture: string[];
  metals: string[];
}

function stripLeadingEmojiAndSymbols(label: string): string {
  // Drop any leading non-letter characters (flags, punctuation, NBSP etc)
  return label.replace(/^[^\p{L}]+/u, '').trim();
}

function normaliseCountryName(name: string): string {
  return stripLeadingEmojiAndSymbols(name).toLowerCase();
}

function toIdArray(...ids: Array<string | null | undefined>): string[] {
  return ids.map((id) => (id ?? '').trim()).filter((id) => id.length > 0);
}

const rawRows = countryCommodityMapJson as CountryCommodityMapRowRaw[];

const countryCommodityMap: CountryCommodityMapEntry[] = rawRows.map((row) => {
  const countryName = stripLeadingEmojiAndSymbols(row.country);

  return {
    country: row.country,
    countryName,
    energy: toIdArray(row.energy_1, row.energy_2, row.energy_3),
    agriculture: toIdArray(row.agriculture_1, row.agriculture_2, row.agriculture_3),
    metals: toIdArray(row.metals_1, row.metals_2, row.metals_3),
  };
});

const countryIndex = new Map<string, CountryCommodityMapEntry>();

countryCommodityMap.forEach((entry) => {
  const key = normaliseCountryName(entry.countryName);
  countryIndex.set(key, entry);
});

export function getAllMappedCountries(): CountryCommodityMapEntry[] {
  return countryCommodityMap;
}

export function getCommoditiesForCountryName(
  countryName: string,
): CountryCommodityMapEntry | undefined {
  const key = normaliseCountryName(countryName);
  return countryIndex.get(key);
}
