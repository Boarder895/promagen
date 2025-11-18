// frontend/src/data/exchanges/tests/exchanges.index.test.ts

/**
 * Behavioural contract between:
 *
 * - exchanges.catalog.json (source of longitude + ids)
 * - exchanges.selected.json (free-tier subset)
 * - lib/exchange-order (east→west + rail split logic)
 *
 * Guarantees:
 * - homepage exchanges use the same id set as the selected list
 * - underlying east→west order (before display tweaks) is sorted by longitude
 *   in the same direction as sortEastToWest (most east → most west)
 * - left/right rails obey the "first half left, second half reversed right" rule
 * - splitIds behaves consistently for id-only splitting
 */

import catalog from '../exchanges.catalog.json';
import selected from '../exchanges.selected.json';

import {
  getHomepageExchanges,
  getRailsForHomepage,
  splitIds,
  type Exchange as OrderedExchange,
  type Rails,
  type ExchangeIds,
} from '@/lib/exchange-order';

type CatalogRow = {
  id: unknown;
  longitude: unknown;
};

type SelectedIds = {
  ids: string[];
};

function asCatalogRows(input: unknown): CatalogRow[] {
  if (!Array.isArray(input)) return [];
  return input as CatalogRow[];
}

function asSelected(input: unknown): SelectedIds {
  if (!input || typeof input !== 'object') {
    return { ids: [] };
  }
  const candidate = input as { ids?: unknown };
  const ids = Array.isArray(candidate.ids) ? candidate.ids : [];
  return {
    ids: ids.map((value) => String(value)),
  };
}

function normaliseNumber(value: unknown, fallback = NaN): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildLongitudeIndex(rows: CatalogRow[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;

    const numeric = normaliseNumber(row.longitude);
    // If there were duplicates (which catalog tests should forbid),
    // keep the first value; later entries are ignored.
    if (!map.has(id)) {
      map.set(id, numeric);
    }
  }

  return map;
}

function idsOf(exchanges: OrderedExchange[]): string[] {
  return exchanges.map((ex) => ex.id);
}

describe('exchange ordering + rails', () => {
  const rows = asCatalogRows(catalog);
  const selection = asSelected(selected);
  const longitudeById = buildLongitudeIndex(rows);

  it('homepage exchanges use the same id set as exchanges.selected.json', () => {
    const homepage = getHomepageExchanges();

    const homepageIds = new Set<string>(idsOf(homepage));
    const selectedIds = new Set<string>(selection.ids);

    // Every homepage id must be in the selected set.
    for (const id of homepageIds) {
      expect(selectedIds.has(id)).toBe(true);
    }

    // And every selected id must appear somewhere on the homepage.
    for (const id of selectedIds) {
      expect(homepageIds.has(id)).toBe(true);
    }

    // Sizes match too (free-tier contract).
    expect(homepageIds.size).toBe(selectedIds.size);
  });

  it('underlying east→west order (reconstructed from rails) is sorted most-east → most-west by longitude', () => {
    const rails: Rails = getRailsForHomepage();
    const { left, right } = rails;

    const ordered = [...left, ...right.slice().reverse()];
    expect(ordered.length).toBeGreaterThan(0);

    const longitudes = ordered.map((exchange) => {
      const lookup = longitudeById.get(exchange.id);
      const numeric = normaliseNumber(lookup);
      expect(Number.isFinite(numeric)).toBe(true);
      return numeric;
    });

    // sortEastToWest sorts *descending*: largest longitude (most east) first.
    for (let index = 1; index < longitudes.length; index += 1) {
      const previous = longitudes[index - 1]!;
      const current = longitudes[index]!;

      expect(previous).toBeGreaterThanOrEqual(current);
    }
  });

  it('rails split the east→west array into first half left, second half reversed right', () => {
    const rails: Rails = getRailsForHomepage();
    const { left, right } = rails;

    const ordered = [...left, ...right.slice().reverse()];
    const total = ordered.length;

    expect(total).toBeGreaterThan(0);

    const half = Math.ceil(total / 2);

    const expectedLeftIds = ordered.slice(0, half).map((ex) => ex.id);
    const expectedRightDisplayIds = ordered
      .slice(half)
      .reverse()
      .map((ex) => ex.id);

    const leftIds = rails.left.map((ex) => ex.id);
    const rightIds = rails.right.map((ex) => ex.id);

    expect(leftIds).toEqual(expectedLeftIds);
    expect(rightIds).toEqual(expectedRightDisplayIds);
  });

  it('flattening rails back to east→west recovers the homepage list', () => {
    const rails: Rails = getRailsForHomepage();
    const homepage = getHomepageExchanges();

    const flattenedIds = [
      ...rails.left.map((ex) => ex.id),
      ...rails.right.map((ex) => ex.id).reverse(),
    ];

    expect(flattenedIds).toEqual(idsOf(homepage));
  });

  it('splitIds behaves like the rail split for a simple id list', () => {
    const ids = selection.ids;
    expect(ids.length).toBeGreaterThan(0);

    const result = splitIds(ids as ExchangeIds);

    const half = Math.ceil(ids.length / 2);
    const expectedLeft = ids.slice(0, half);
    const expectedRight = ids.slice(half);

    expect(result.left.map((item) => item.id)).toEqual(expectedLeft);
    expect(result.right.map((item) => item.id)).toEqual(expectedRight);
  });
});
