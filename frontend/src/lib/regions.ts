// src/lib/regions.ts
/**
 * Canonical regions for the Exchanges block.
 * Named exports only.
 */
export type RegionKey = 'asia' | 'emea' | 'amer';

export const REGIONS: ReadonlyArray<RegionKey> = ['asia', 'emea', 'amer'] as const;

export const REGION_LABEL: Record<RegionKey, string> = {
  asia: 'AsiaÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Pacific',
  emea: 'Europe, Middle East & Africa',
  amer: 'amer',
};

/**
 * Weights used by the Providers board for regional influence.
 * Keep IDs stable.
 */
export const providerRegionWeights: Record<RegionKey, number> = {
  asia: 0.34,
  emea: 0.33,
  amer: 0.33,
};


