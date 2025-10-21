// src/lib/market/layout.ts

export type MarketStatus = 'open' | 'closed' | 'pre' | 'post' | 'holiday' | 'unknown';

export type RibbonItem = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
  weather: { tempC: number; condition: string };
  market: { status: MarketStatus; nextChangeISO: string | null };
};

export type EastWest = { east: RibbonItem[]; west: RibbonItem[] };

/**
 * Split the ribbon items by longitude into east vs west buckets.
 * We sort by longitude ascending (west/negatives first, east/positives last)
 * then return EAST on the LEFT per your UX rule: east half left, west half right.
 */
export function splitEastWest(items: RibbonItem[] | null | undefined): EastWest {
  if (!Array.isArray(items) || items.length === 0) {
    return { east: [], west: [] };
  }

  const sorted = [...items].sort((a, b) => a.longitude - b.longitude);
  const half = Math.floor(sorted.length / 2);

  // east = positive longitudes (second half); west = negative longitudes (first half)
  return { east: sorted.slice(half), west: sorted.slice(0, half) };
}

