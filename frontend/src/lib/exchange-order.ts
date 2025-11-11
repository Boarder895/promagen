// Exchange ordering + validation helper for Promagen rails.
// Reads the selected exchanges list, validates fields, and returns a left/right split.

import exchanges from "@/data/exchanges.selected.json";

export type Exchange = {
  id: string;
  name: string;
  country: string;
  longitude: number; // degrees east positive, west negative
};

export type RailSplit = { left: Exchange[]; right: Exchange[] };

// Even counts allowed for paid tiers (free = 12 total)
export const PAID_VALID_COUNTS = new Set([6, 8, 10, 12, 14, 16]);

/**
 * Returns validated exchanges only.
 * Filters out items with missing or invalid longitude or country.
 */
export function getValidatedExchanges(): Exchange[] {
  const valid: Exchange[] = [];
  for (const e of exchanges as any[]) {
    if (
      !e ||
      typeof e.id !== "string" ||
      typeof e.name !== "string" ||
      typeof e.country !== "string" ||
      typeof e.longitude !== "number" ||
      Number.isNaN(e.longitude) ||
      e.longitude < -180 ||
      e.longitude > 180
    ) {
      // eslint-disable-next-line no-console
      console.warn("[exchange-order] invalid exchange skipped:", e);
      continue;
    }
    valid.push(e as Exchange);
  }
  return valid;
}

/**
 * Sort east→west by longitude (small→large).
 */
export function sortEastToWest(xs: Exchange[]): Exchange[] {
  return [...xs].sort((a, b) => a.longitude - b.longitude);
}

/**
 * Splits exchanges into left/right rails.
 * - Left = first half top→bottom (east→west)
 * - Right = second half reversed so the whole page reads east→west visually.
 */
export function splitRails(xs: Exchange[]): RailSplit {
  const sorted = sortEastToWest(xs);
  const half = Math.ceil(sorted.length / 2);
  const left = sorted.slice(0, half);
  const right = sorted.slice(half).reverse();
  return { left, right };
}

/**
 * Guards paid-tier counts.
 */
export function isValidCount(n: number): boolean {
  return PAID_VALID_COUNTS.has(n);
}

/**
 * Convenience wrapper for homepage.
 * Returns { left, right } already validated and sorted.
 */
export function getRailsForHomepage(): RailSplit {
  const valid = getValidatedExchanges();
  return splitRails(valid);
}
