// frontend/src/data/exchanges/tests/exchanges.selected.shape.test.ts

/**
 * Active/selected subset sanity:
 *
 * - ids array present
 * - exactly 12 entries (free-tier contract)
 * - no duplicates
 * - every id exists in exchanges.catalog.json
 * - selected set matches the catalogue intersection exactly
 */

import catalog from '../exchanges.catalog.json';
import selected from '../exchanges.selected.json';

type CatalogRow = {
  id: string;
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
  const candidate = input as SelectedIds;
  return {
    ids: Array.isArray(candidate.ids) ? candidate.ids.slice() : [],
  };
}

const FREE_TIER_EXCHANGE_COUNT = 12;

describe('exchanges.selected.json shape', () => {
  const rows = asCatalogRows(catalog);
  const selection = asSelected(selected);

  it('has an ids array and matches the free-tier count', () => {
    expect(Array.isArray(selection.ids)).toBe(true);
    expect(selection.ids.length).toBe(FREE_TIER_EXCHANGE_COUNT);
  });

  it('contains no duplicate ids', () => {
    const seen = new Set<string>();

    for (const id of selection.ids) {
      expect(typeof id).toBe('string');
      expect(id.trim().length).toBeGreaterThan(0);

      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }

    expect(seen.size).toBe(selection.ids.length);
  });

  it('every selected id exists in the full catalogue', () => {
    const catalogIds = new Set<string>(rows.map((row) => row.id));

    for (const id of selection.ids) {
      expect(catalogIds.has(id)).toBe(true);
    }
  });

  it('selected ids set matches the intersection between selected and catalogue ids', () => {
    const catalogIds = new Set<string>(rows.map((row) => row.id));
    const selectedIds = new Set<string>(selection.ids);

    // There should be no ids that are "selected" but absent from the catalogue.
    for (const id of selectedIds) {
      expect(catalogIds.has(id)).toBe(true);
    }

    // And we expect the selected ids to be a strict subset of catalogue ids.
    expect(selectedIds.size).toBeLessThanOrEqual(catalogIds.size);
  });
});
