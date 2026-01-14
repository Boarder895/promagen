// src/types/commodities-selection.ts
// =============================================================================
// Commodities Picker Selection Types
// Authority: docs/authority/paid_tier.md (mirrors FX selection posture)
// =============================================================================

/**
 * Commodities selection limits
 * - Exactly 7 commodities for the Ribbon (2–3–2 group pattern)
 */
export const COMMODITIES_SELECTION_LIMITS = {
  min: 7,
  max: 7,
} as const;

export type CommoditySelectionTier = 'free' | 'paid';

export interface CommoditySelectionRecord {
  commodityIds: string[];
  updatedAt: string; // ISO string
}

export interface CommoditiesSelectionPublicMetadata {
  tier?: CommoditySelectionTier;
  commoditiesSelection?: CommoditySelectionRecord;
}
