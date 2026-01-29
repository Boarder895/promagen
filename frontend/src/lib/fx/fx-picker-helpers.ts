// src/lib/fx/fx-picker-helpers.ts
// ============================================================================
// FX PICKER HELPERS - Utility functions for the FX Picker component
// ============================================================================
// Provides grouping, search, and validation for FX pair selection.
// Mirrors exchange-picker-helpers.ts pattern for consistency.
//
// Authority: docs/authority/paid_tier.md §5.5
// Version: 1.0.0
// ============================================================================

import { type FxRegion, getFxRegion, FX_REGION_CONFIGS } from './fx-regions';

// ============================================================================
// TYPES
// ============================================================================

/**
 * FX pair option for the picker (derived from FxPairCatalogEntry).
 */
export interface FxPairOption {
  /** Unique pair ID, e.g. "eur-usd" */
  id: string;
  /** Base currency code, e.g. "EUR" */
  base: string;
  /** Quote currency code, e.g. "USD" */
  quote: string;
  /** Display label, e.g. "EUR/USD" */
  label: string;
  /** ISO 2-letter country code for base currency flag */
  baseCountryCode: string;
  /** ISO 2-letter country code for quote currency flag */
  quoteCountryCode: string;
  /** Human-readable label, e.g. "Eurozone / United States" */
  countryLabel?: string;
  /** FX category: major, cross, or emerging */
  category?: 'major' | 'cross' | 'emerging';
  /** Liquidity rank (1 = most liquid) */
  rank?: number;
  /** Region derived from base currency (computed) */
  region?: FxRegion;
}

/**
 * Selection validation result.
 */
export interface FxValidationResult {
  valid: boolean;
  message?: string;
}

// ============================================================================
// SELECTION LIMITS (from paid_tier.md §5.5)
// ============================================================================

export const FX_SELECTION_LIMITS = {
  MIN_PAIRS: 0,
  MAX_PAIRS: 16,
} as const;

// ============================================================================
// GROUPING FUNCTIONS
// ============================================================================

/**
 * Groups FX pairs by the BASE currency's region.
 * Option A: EUR/USD → Europe (EUR is base, EU region)
 */
export function groupByRegion(pairs: FxPairOption[]): Map<FxRegion, FxPairOption[]> {
  const groups = new Map<FxRegion, FxPairOption[]>();

  // Initialize all regions (ensures consistent order)
  for (const config of FX_REGION_CONFIGS) {
    groups.set(config.id, []);
  }

  // Group pairs by base currency region
  for (const pair of pairs) {
    const region = getFxRegion(pair.base);
    const regionPairs = groups.get(region);
    if (regionPairs) {
      regionPairs.push({ ...pair, region });
    }
  }

  return groups;
}

/**
 * Sorts pairs within a region by rank (liquidity), then alphabetically.
 */
export function sortPairsInRegion(pairs: FxPairOption[]): FxPairOption[] {
  return [...pairs].sort((a, b) => {
    // Major pairs first (rank 1-7)
    const rankA = a.rank ?? 999;
    const rankB = b.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;

    // Then alphabetically by label
    return a.label.localeCompare(b.label);
  });
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search FX pairs by query string.
 * Matches against: id, base, quote, label, countryLabel
 */
export function searchFxPairs(pairs: FxPairOption[], query: string): FxPairOption[] {
  if (!query.trim()) {
    return pairs;
  }

  const lowerQuery = query.toLowerCase().trim();

  return pairs.filter((pair) => {
    return (
      pair.id.toLowerCase().includes(lowerQuery) ||
      pair.base.toLowerCase().includes(lowerQuery) ||
      pair.quote.toLowerCase().includes(lowerQuery) ||
      pair.label.toLowerCase().includes(lowerQuery) ||
      (pair.countryLabel?.toLowerCase().includes(lowerQuery) ?? false)
    );
  });
}

/**
 * Filters pairs by region and optional search query.
 */
export function filterPairsByRegion(
  pairsByRegion: Map<FxRegion, FxPairOption[]>,
  query: string,
): Map<FxRegion, FxPairOption[]> {
  if (!query.trim()) {
    return pairsByRegion;
  }

  const filtered = new Map<FxRegion, FxPairOption[]>();

  for (const [region, pairs] of pairsByRegion) {
    filtered.set(region, searchFxPairs(pairs, query));
  }

  return filtered;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates the current FX pair selection.
 */
export function validateFxSelection(
  selectedIds: string[],
  min: number = FX_SELECTION_LIMITS.MIN_PAIRS,
  max: number = FX_SELECTION_LIMITS.MAX_PAIRS,
): FxValidationResult {
  if (selectedIds.length < min) {
    return {
      valid: false,
      message: `Select at least ${min} pair${min !== 1 ? 's' : ''} (currently ${selectedIds.length})`,
    };
  }

  if (selectedIds.length > max) {
    return {
      valid: false,
      message: `Maximum ${max} pairs allowed (currently ${selectedIds.length})`,
    };
  }

  return { valid: true };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets FX pairs by their IDs (preserves order).
 */
export function getPairsByIds(pairs: FxPairOption[], ids: string[]): FxPairOption[] {
  const pairMap = new Map(pairs.map((p) => [p.id.toLowerCase(), p]));
  return ids
    .map((id) => pairMap.get(id.toLowerCase()))
    .filter((p): p is FxPairOption => p !== undefined);
}

/**
 * Checks if a pair ID is in the selection.
 */
export function isPairSelected(selectedIds: string[], pairId: string): boolean {
  return selectedIds.some((id) => id.toLowerCase() === pairId.toLowerCase());
}

/**
 * Adds a pair ID to selection (with limit check).
 */
export function addPairToSelection(
  currentIds: string[],
  pairId: string,
  max: number = FX_SELECTION_LIMITS.MAX_PAIRS,
): string[] {
  if (currentIds.length >= max) {
    return currentIds;
  }

  const normalizedId = pairId.toLowerCase();
  if (currentIds.some((id) => id.toLowerCase() === normalizedId)) {
    return currentIds;
  }

  return [...currentIds, normalizedId];
}

/**
 * Removes a pair ID from selection (with minimum check).
 */
export function removePairFromSelection(
  currentIds: string[],
  pairId: string,
  min: number = FX_SELECTION_LIMITS.MIN_PAIRS,
): string[] {
  if (currentIds.length <= min) {
    return currentIds;
  }

  const normalizedId = pairId.toLowerCase();
  return currentIds.filter((id) => id.toLowerCase() !== normalizedId);
}

/**
 * Gets pairs in a specific region from the selection.
 */
export function getSelectedInRegion(
  allPairs: FxPairOption[],
  selectedIds: string[],
  region: FxRegion,
): FxPairOption[] {
  const selectedSet = new Set(selectedIds.map((id) => id.toLowerCase()));

  return allPairs.filter((pair) => {
    return selectedSet.has(pair.id.toLowerCase()) && getFxRegion(pair.base) === region;
  });
}

/**
 * Counts selected pairs in each region.
 */
export function countSelectedByRegion(
  allPairs: FxPairOption[],
  selectedIds: string[],
): Map<FxRegion, number> {
  const counts = new Map<FxRegion, number>();

  // Initialize all regions
  for (const config of FX_REGION_CONFIGS) {
    counts.set(config.id, 0);
  }

  const selectedSet = new Set(selectedIds.map((id) => id.toLowerCase()));

  for (const pair of allPairs) {
    if (selectedSet.has(pair.id.toLowerCase())) {
      const region = getFxRegion(pair.base);
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
  }

  return counts;
}
