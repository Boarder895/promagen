// frontend/src/lib/commodities/catalog.ts
//
// Typed helper layer over src/data/commodities/commodities.catalog.json.
//
// Goal:
//   - Keep components away from JSON imports.
//   - Provide a small, predictable API for common use-cases:
//       * full catalogue
//       * active only
//       * default free / paid sets
//       * lookups by id / group / subgroup

import commoditiesJson from '@/data/commodities/commodities.catalog.json';
import type {
  Commodity,
  CommoditiesCatalog,
  CommodityGroup,
  CommoditySubGroup,
} from '@/data/commodities/commodities.catalog';

// Canonical in-memory catalogue.
const ALL_COMMODITIES_INTERNAL = commoditiesJson as CommoditiesCatalog;

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
 * SSOT rule: order MUST match commodities.catalog.json (no sorting).
 */
export function getDefaultFreeCommodities(): Commodity[] {
  return getActiveCommodities().filter((item) => item.isDefaultFree);
}

/**
 * Default paid-tier commodities.
 *
 * SSOT rule: order MUST match commodities.catalog.json (no sorting).
 */
export function getDefaultPaidCommodities(): Commodity[] {
  return getActiveCommodities().filter((item) => item.isDefaultPaid);
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
  return ALL_COMMODITIES_INTERNAL.find((item) => item.id === id);
}

// ───────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────────

// Re-export for any other helpers that want direct access.
export const ALL_COMMODITIES: CommoditiesCatalog = ALL_COMMODITIES_INTERNAL;

// Type re-exports so callers do not need to know about the .d.ts path.
export type { Commodity, CommoditiesCatalog, CommodityGroup, CommoditySubGroup };
