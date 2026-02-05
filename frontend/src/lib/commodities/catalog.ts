// frontend/src/lib/commodities/catalog.ts
//
// Typed helper layer over src/data/commodities SSOT.
//
// The commodities movers grid uses ALL active commodities from the catalog.
// The grid dynamically sorts them to display top 4 winners and top 4 losers.
//
// Authority: Compacted conversation 2026-02-03 (commodities movers grid)

import commoditiesJson from '@/data/commodities/commodities.catalog.json';
import paidSelectedJson from '@/data/commodities/commodities.paid.selected.json';
import type {
  Commodity,
  CommoditiesCatalog,
  CommodityGroup,
  CommoditySubGroup,
} from '@/data/commodities/commodities.catalog';

type SelectedList = { ids: string[] };

// Canonical in-memory catalogue.
const ALL_COMMODITIES_INTERNAL = commoditiesJson as CommoditiesCatalog;
const BY_ID = new Map<string, Commodity>(ALL_COMMODITIES_INTERNAL.map((c) => [c.id, c]));

function resolveSelected(ids: string[], label: string): Commodity[] {
  const out: Commodity[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const item = BY_ID.get(id);
    if (!item || !item.isActive) {
      missing.push(id);
      continue;
    }
    out.push(item);
  }

  if (missing.length > 0) {
    throw new Error(
      `commodities SSOT integrity error: ${label} contains ids not present/active in commodities.catalog.json: ${missing.join(
        ', ',
      )}`,
    );
  }

  return out;
}

/**
 * Return the raw commodities catalogue exactly as stored in JSON.
 *
 * Callers should treat the returned array as read-only.
 */
export function getAllCommodities(): CommoditiesCatalog {
  return ALL_COMMODITIES_INTERNAL;
}

/**
 * Active commodities only (isActive === true).
 */
export function getActiveCommodities(): Commodity[] {
  return ALL_COMMODITIES_INTERNAL.filter((item) => item.isActive);
}

/**
 * Default free-tier commodities.
 *
 * Returns ALL active commodities for the movers grid.
 * The grid dynamically sorts these to find top winners/losers.
 */
export function getDefaultFreeCommodities(): Commodity[] {
  return getActiveCommodities();
}

/**
 * Default paid-tier commodities.
 *
 * SSOT rule: order MUST match commodities.paid.selected.json.
 */
export function getDefaultPaidCommodities(): Commodity[] {
  const ids = (paidSelectedJson as SelectedList).ids;
  return resolveSelected(ids, 'commodities.paid.selected.json');
}

/**
 * Filter active commodities by top-level group (energy, metals, agriculture).
 */
export function getCommoditiesByGroup(group: CommodityGroup): Commodity[] {
  return getActiveCommodities().filter((item) => item.group === group);
}

/**
 * Filter active commodities by more detailed subgroup (e.g. "precious", "grains").
 */
export function getCommoditiesBySubGroup(subGroup: CommoditySubGroup): Commodity[] {
  return getActiveCommodities().filter((item) => item.subGroup === subGroup);
}

/**
 * Lookup a commodity by id.
 */
export function getCommodityById(id: string): Commodity | undefined {
  return BY_ID.get(id);
}

// Re-export for any other helpers that want direct access.
export const ALL_COMMODITIES: CommoditiesCatalog = ALL_COMMODITIES_INTERNAL;

// Type re-exports so callers do not need to know about the .d.ts path.
export type { Commodity, CommoditiesCatalog, CommodityGroup, CommoditySubGroup };
