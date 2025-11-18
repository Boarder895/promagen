// src/lib/ribbon/selection.ts

import fxPairsJson from '@/data/fx/fx.pairs.json';
import freeFxPairIds from '@/data/selected/fx.pairs.free.json';

import freeCommodityIds from '@/data/selected/commodities.free.json';

import cryptoWhitelistJson from '@/data/crypto/whitelist.json';
import freeCryptoIds from '@/data/selected/crypto.free.json';

import type {
  Commodity,
  CommodityId,
  CryptoAsset,
  CryptoId,
  FxPair,
  FxPairId,
  CommoditySelectionValidation,
  SelectionResult,
} from '@/types/finance-ribbon.d';

// Cast JSON to typed arrays (runtime stays plain).
const FX_PAIRS = fxPairsJson as FxPair[];
const FREE_FX_IDS = freeFxPairIds as FxPairId[];

const FREE_COMMODITY_IDS = freeCommodityIds as CommodityId[];

const CRYPTO_WHITELIST = cryptoWhitelistJson as CryptoAsset[];
const FREE_CRYPTO_IDS = freeCryptoIds as CryptoId[];

/**
 * Lookup helpers
 */

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

const fxById = indexById(FX_PAIRS);
const cryptoById = indexById(CRYPTO_WHITELIST);

/**
 * Normalise an ID list:
 * - trim whitespace
 * - lowercase
 * - drop duplicates while preserving order
 */
function normaliseIds<TId extends string>(ids: TId[]): TId[] {
  const seen = new Set<string>();
  const result: TId[] = [];

  for (const raw of ids) {
    const id = String(raw).trim().toLowerCase() as TId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

/**
 * Resolve ids → items, dropping any ids that are not in the catalogue.
 */
function resolveFxPairs(ids: FxPairId[]): FxPair[] {
  return ids.map((id) => fxById.get(id)).filter((pair): pair is FxPair => Boolean(pair));
}

function resolveCryptoAssets(ids: CryptoId[]): CryptoAsset[] {
  return ids
    .map((id) => cryptoById.get(id))
    .filter((asset): asset is CryptoAsset => Boolean(asset));
}

/**
 * Free-tier helpers: simple wrappers that always give you the fixed 5 / 7 / 5.
 */

export function getFreeFxSelection(): SelectionResult<FxPair, FxPairId> {
  const ids = normaliseIds(FREE_FX_IDS);
  const items = resolveFxPairs(ids);

  return {
    items,
    ids,
    mode: 'free',
  };
}

export function getFreeCryptoSelection(): SelectionResult<CryptoAsset, CryptoId> {
  const ids = normaliseIds(FREE_CRYPTO_IDS);
  const items = resolveCryptoAssets(ids);

  return {
    items,
    ids,
    mode: 'free',
  };
}

/**
 * Paid-tier FX selection: enforce exactly 5 pairs.
 *
 * Behaviour:
 * - If userIds normalise to exactly 5 valid pairs → "paid".
 * - If not, you can either:
 *   (a) show a prompt using `reason`, OR
 *   (b) fall back to the free selection via `fallbackToFree = true`.
 */
export function getPaidFxSelection(
  userIds: FxPairId[],
  options?: { fallbackToFree?: boolean },
): SelectionResult<FxPair, FxPairId> {
  const targetCount = 5;
  const normalisedIds = normaliseIds(userIds);
  const items = resolveFxPairs(normalisedIds);

  if (items.length === targetCount) {
    return {
      items,
      ids: items.map((p) => p.id),
      mode: 'paid',
    };
  }

  const reason = items.length < targetCount ? 'too-few-items' : 'too-many-items';

  if (options?.fallbackToFree) {
    const free = getFreeFxSelection();
    return {
      ...free,
      mode: 'freeFallback',
      reason,
    };
  }

  return {
    items,
    ids: items.map((p) => p.id),
    mode: 'paid',
    reason,
  };
}

/**
 * Paid-tier crypto selection: enforce exactly 5 assets from the whitelist.
 *
 * Same contract as FX: you choose in the UI whether to fall back or prompt.
 */
export function getPaidCryptoSelection(
  userIds: CryptoId[],
  options?: { fallbackToFree?: boolean },
): SelectionResult<CryptoAsset, CryptoId> {
  const targetCount = 5;
  const normalisedIds = normaliseIds(userIds);
  const items = resolveCryptoAssets(normalisedIds);

  if (items.length === targetCount) {
    return {
      items,
      ids: items.map((a) => a.id),
      mode: 'paid',
    };
  }

  const reason = items.length < targetCount ? 'too-few-items' : 'too-many-items';

  if (options?.fallbackToFree) {
    const free = getFreeCryptoSelection();
    return {
      ...free,
      mode: 'freeFallback',
      reason,
    };
  }

  return {
    items,
    ids: items.map((a) => a.id),
    mode: 'paid',
    reason,
  };
}

/**
 * Commodities 2–3–2 validation.
 *
 * You pass in:
 * - `catalogue`: the full commodities catalogue,
 * - `selectedIds`: the 7 ids the user picked in their preferred visual order.
 *
 * We compute:
 * - counts per group,
 * - which group (if any) has 3 items (the “centre crown”),
 * - whether the selection obeys: total 7, each represented group ≥ 2, exactly one group with 3.
 *
 * Note: this does not apply the “free fallback” behaviour. You can decide in the UI:
 * - show a prompt when `isValid === false`, OR
 * - silently revert to FREE_COMMODITY_IDS using `getFreeCommodities`.
 */
export function validateCommoditySelection(
  catalogue: Commodity[],
  selectedIds: CommodityId[],
): CommoditySelectionValidation {
  const normalisedIds = normaliseIds(selectedIds);
  const items: Commodity[] = [];
  const countsByGroup: Record<string, number> = {};

  for (const id of normalisedIds) {
    const item = catalogue.find((c) => c.id === id);
    if (!item) continue;

    items.push(item);

    const groupId = item.group ?? 'unknown';
    countsByGroup[groupId] = (countsByGroup[groupId] ?? 0) + 1;
  }

  const total = items.length;

  if (total !== 7) {
    return {
      items,
      countsByGroup,
      isValid: false,
      reason: total < 7 ? 'too-few-items' : 'too-many-items',
    };
  }

  const groups = Object.keys(countsByGroup);
  if (groups.length < 2 || groups.length > 3) {
    return {
      items,
      countsByGroup,
      isValid: false,
      reason: 'invalid-group-count',
    };
  }

  // Every represented group must have at least 2 items
  if (groups.some((g) => (countsByGroup[g] ?? 0) < 2)) {
    return {
      items,
      countsByGroup,
      isValid: false,
      reason: 'group-underfilled',
    };
  }

  // Exactly one group must have 3 items (the “crown”)
  const crownGroups = groups.filter((g) => countsByGroup[g] === 3);

  if (crownGroups.length !== 1) {
    return {
      items,
      countsByGroup,
      isValid: false,
      reason: crownGroups.length === 0 ? 'no-centre-crown' : 'multiple-centre-crowns',
    };
  }

  return {
    items,
    countsByGroup,
    centreGroupId: crownGroups[0],
    isValid: true,
  };
}

/**
 * Helper to resolve the fixed free-tier 7-commodity set using the catalogue.
 * Use this when you need to fall back from an invalid paid selection.
 */
export function getFreeCommodities(catalogue: Commodity[]): CommoditySelectionValidation {
  const items: Commodity[] = [];
  const countsByGroup: Record<string, number> = {};

  for (const id of FREE_COMMODITY_IDS) {
    const item = catalogue.find((c) => c.id === id);
    if (!item) continue;

    items.push(item);
    const groupId = item.group ?? 'unknown';
    countsByGroup[groupId] = (countsByGroup[groupId] ?? 0) + 1;
  }

  // By definition your free set is valid 2–3–2.
  const groups = Object.keys(countsByGroup);
  const crownGroup = groups.find((g) => countsByGroup[g] === 3) ?? undefined;

  return {
    items,
    countsByGroup,
    centreGroupId: crownGroup,
    isValid: true,
  };
}
