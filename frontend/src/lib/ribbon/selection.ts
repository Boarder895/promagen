// C:\Users\Proma\Projects\promagen\frontend\src\lib\ribbon\selection.ts
// -----------------------------------------------------------------------------
// Pure helpers for the finance ribbon free / paid selection logic.
//
// These are intentionally framework-agnostic and only deal with plain data
// structures so they are easy to test and reason about.
//
// This module is also the bridge between the finance ribbon and the
// single-source-of-truth data under src/data.
// -----------------------------------------------------------------------------

import fxPairsJson from '@/data/fx/pairs.json';
import fxPairsIndexJson from '@/data/fx/fx.pairs.json';
import commoditiesCatalogJson from '@/data/commodities/commodities.catalog.json';
import cryptoWhitelistJson from '@/data/crypto/whitelist.json';

import type {
  Commodity,
  CommodityId,
  CommoditySelectionValidation,
  CryptoAsset,
  CryptoId,
  FxPair,
  FxPairId,
} from '@/types/finance-ribbon';

// ---------------------------------------------------------------------------
// Generic selection helpers
// ---------------------------------------------------------------------------

export interface SelectionCounts {
  requested: number;
  matched: number;
  selected: number;
  extras: number;
  missing: number;
}

export interface SelectionResult<TItem, TId extends string | number = string> {
  /**
   * All catalogue items that matched the requested ids (deduped),
   * in display order.
   */
  items: TItem[];
  /**
   * The items actually used in the ribbon (respecting maxItems).
   */
  selected: TItem[];
  /**
   * Matched items that overflowed past maxItems.
   */
  extras: TItem[];
  /**
   * Ids requested by the caller that were not found in the catalogue.
   */
  missing: TId[];
  /**
   * Simple aggregate counters for debugging / analytics.
   */
  counts: SelectionCounts;
}

/**
 * Public helper used by tests and by some higher-level selection flows.
 */
export function selectForRibbon<TItem, TId extends string | number = string>(opts: {
  allItems: TItem[];
  requestedIds: TId[] | null | undefined;
  maxItems: number;
  getId: (item: TItem) => TId;
}): SelectionResult<TItem, TId> {
  const { allItems, requestedIds, maxItems, getId } = opts;

  const normalisedRequested: TId[] = (requestedIds ?? []).filter((id): id is TId => id != null);

  const requestedCount = normalisedRequested.length;

  const byId = new Map<TId, TItem>();
  for (const item of allItems) {
    const id = getId(item);
    byId.set(id, item);
  }

  const items: TItem[] = [];
  const missing: TId[] = [];

  for (const id of normalisedRequested) {
    const item = byId.get(id);
    if (item) {
      if (!items.includes(item)) {
        items.push(item);
      }
    } else {
      missing.push(id);
    }
  }

  const cap = Math.max(0, maxItems);
  const selected = items.slice(0, cap);
  const extras = items.slice(cap);

  const counts: SelectionCounts = {
    requested: requestedCount,
    matched: items.length,
    selected: selected.length,
    extras: extras.length,
    missing: missing.length,
  };

  return { items, selected, extras, missing, counts };
}

// ---------------------------------------------------------------------------
// FX helpers – powered by src/data/fx
// ---------------------------------------------------------------------------

type FxPairsIndexEntry = {
  id: FxPairId;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
};

const FX_UNIVERSE: FxPair[] = fxPairsJson as FxPair[];
const FX_INDEX: FxPairsIndexEntry[] = fxPairsIndexJson as FxPairsIndexEntry[];

export type FxSelectionWithMode = SelectionResult<FxPair, FxPairId> & {
  mode: 'free' | 'paid' | 'freeFallback' | 'invalid';
};

/**
 * Default free-tier FX selection – all pairs flagged isDefaultFree in the canonical index.
 */
export function getFreeFxSelection(): SelectionResult<FxPair, FxPairId> {
  const requestedIds: FxPairId[] = FX_INDEX.filter((entry) => entry.isDefaultFree).map(
    (entry) => entry.id,
  );

  return selectForRibbon<FxPair, FxPairId>({
    allItems: FX_UNIVERSE,
    requestedIds,
    maxItems: requestedIds.length,
    getId: (pair) => pair.id,
  });
}

/**
 * Paid FX selection for a user-chosen set of FX pair IDs.
 */
export function getPaidFxSelection(
  requestedIds: FxPairId[] | null | undefined,
  options: { fallbackToFree: boolean; minItems: number },
): FxSelectionWithMode {
  const { fallbackToFree, minItems } = options;

  const selection = selectForRibbon<FxPair, FxPairId>({
    allItems: FX_UNIVERSE,
    requestedIds,
    maxItems: minItems,
    getId: (pair) => pair.id,
  });

  if (selection.selected.length >= minItems) {
    return { ...selection, mode: 'paid' };
  }

  if (!requestedIds || requestedIds.length === 0) {
    const free = getFreeFxSelection();
    return { ...free, mode: 'free' };
  }

  if (!fallbackToFree) {
    return { ...selection, mode: 'invalid' };
  }

  const free = getFreeFxSelection();
  return { ...free, mode: 'freeFallback' };
}

// ---------------------------------------------------------------------------
// Commodity helpers – powered by src/data/commodities
// ---------------------------------------------------------------------------

const COMMODITIES_UNIVERSE: Commodity[] = commoditiesCatalogJson as Commodity[];

export type CommoditySelectionResult = SelectionResult<Commodity, CommodityId> &
  CommoditySelectionValidation;

function buildCommodityValidation(requestedIds: CommodityId[]): CommoditySelectionResult {
  const baseSelection = selectForRibbon<Commodity, CommodityId>({
    allItems: COMMODITIES_UNIVERSE,
    requestedIds,
    maxItems: 7,
    getId: (item) => item.id,
  });

  const groupCounts: Record<string, number> = {};

  for (const item of baseSelection.selected) {
    const group = (item as Commodity).group ?? 'unknown';
    groupCounts[group] = (groupCounts[group] ?? 0) + 1;
  }

  const countsArray = Object.values(groupCounts).sort((a, b) => b - a);
  const [first = 0, second = 0, third = 0] = countsArray;

  let isValid = false;
  let reason: CommoditySelectionValidation['reason'] = undefined;
  let centreGroupId: string | undefined;

  if (baseSelection.selected.length < 7) {
    isValid = false;
    reason = 'too-few-items';
  } else if (baseSelection.selected.length > 7) {
    isValid = false;
    reason = 'too-many-items';
  } else if (first === 3 && second === 2 && third === 2) {
    isValid = true;
    centreGroupId = Object.entries(groupCounts).find(([, count]) => count === 3)?.[0];
  } else {
    isValid = false;
    reason = 'bad-distribution';
  }

  return {
    ...baseSelection,
    isValid,
    reason,
    centreGroupId,
  };
}

export function getFreeCommodities(): CommoditySelectionResult {
  const defaultIds: CommodityId[] = COMMODITIES_UNIVERSE.slice()
    .sort((a, b) => {
      const aPriority = (a as Commodity & { priority?: number }).priority ?? 999;
      const bPriority = (b as Commodity & { priority?: number }).priority ?? 999;
      return aPriority - bPriority;
    })
    .map((c) => c.id as CommodityId)
    .slice(0, 7);

  return buildCommodityValidation(defaultIds);
}

/**
 * Validate a user-chosen commodity set against the 2–3–2 pattern.
 */
export function validateCommoditySelection(
  catalogue: Commodity[] = COMMODITIES_UNIVERSE,
  commodityIds: CommodityId[] | null | undefined,
): CommoditySelectionResult {
  if (!commodityIds || commodityIds.length === 0) {
    // Empty selection is always invalid and will cause callers to fall back to free.
    return {
      ...buildCommodityValidation([]),
      isValid: false,
      reason: 'too-few-items',
      centreGroupId: undefined,
    };
  }

  const allowedIds = new Set(catalogue.map((c) => c.id));
  const normalisedIds = commodityIds.filter((id) => allowedIds.has(id));

  return buildCommodityValidation(normalisedIds);
}

// ---------------------------------------------------------------------------
// Crypto helpers – powered by src/data/crypto
// ---------------------------------------------------------------------------

const CRYPTO_UNIVERSE: CryptoAsset[] = cryptoWhitelistJson as CryptoAsset[];

export type CryptoSelectionWithMode = SelectionResult<CryptoAsset, CryptoId> & {
  mode: 'free' | 'paid' | 'freeFallback' | 'invalid';
};

export function getFreeCryptoSelection(): SelectionResult<CryptoAsset, CryptoId> {
  const requestedIds: CryptoId[] = CRYPTO_UNIVERSE.slice(0, 5).map((asset) => asset.id as CryptoId);

  return selectForRibbon<CryptoAsset, CryptoId>({
    allItems: CRYPTO_UNIVERSE,
    requestedIds,
    maxItems: 5,
    getId: (asset) => asset.id,
  });
}

/**
 * Paid-tier crypto selection with optional fallback to free.
 */
export function getPaidCryptoSelection(
  requestedIds: CryptoId[] | null | undefined,
  options: { fallbackToFree: boolean; minItems: number },
): CryptoSelectionWithMode {
  const { fallbackToFree, minItems } = options;

  if (!requestedIds || requestedIds.length === 0) {
    const free = getFreeCryptoSelection();
    return { ...free, mode: 'free' };
  }

  const selection = selectForRibbon<CryptoAsset, CryptoId>({
    allItems: CRYPTO_UNIVERSE,
    requestedIds,
    maxItems: minItems,
    getId: (asset) => asset.id,
  });

  if (selection.selected.length >= minItems) {
    return { ...selection, mode: 'paid' };
  }

  if (!fallbackToFree) {
    return { ...selection, mode: 'invalid' };
  }

  const free = getFreeCryptoSelection();
  return { ...free, mode: 'freeFallback' };
}
