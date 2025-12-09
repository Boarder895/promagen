// src/lib/finance/fx-pairs.ts

import fxPairsJson from '@/data/fx/fx.pairs.json';
import freeFxPairIdsJson from '@/data/selected/fx.pairs.free.json';

import type { FxPair, FxPairId } from '@/types/finance-ribbon.d';

/**
 * Normalise ids so everything is lower-case "gbp-usd" style.
 */
function normaliseId(id: string): FxPairId {
  return id.trim().toLowerCase() as FxPairId;
}

/**
 * The raw JSON is already shaped like FxPair, but we still normalise ids and
 * make sure we never accidentally mutate the imported array.
 */
export const ALL_FX_PAIRS: FxPair[] = (fxPairsJson as unknown as FxPair[]).map((row) => ({
  ...row,
  id: normaliseId(row.id),
}));

/**
 * Convenience map for quick lookup by id.
 */
const FX_BY_ID: Map<FxPairId, FxPair> = new Map(ALL_FX_PAIRS.map((pair) => [pair.id, pair]));

/**
 * Free-tier ids from JSON, normalised.
 */
export const DEFAULT_FREE_FX_PAIR_IDS: FxPairId[] = (freeFxPairIdsJson as string[]).map((id) =>
  normaliseId(id),
);

/**
 * The actual FxPair objects used on the free tier.
 */
export const FREE_TIER_FX_PAIRS: FxPair[] = DEFAULT_FREE_FX_PAIR_IDS.map((id) => {
  const pair = FX_BY_ID.get(id);

  if (!pair) {
    throw new Error(
      `DEFAULT_FREE_FX_PAIR_IDS contains unknown pair id "${id}" – check fx.pairs.free.json against fx.pairs.json`,
    );
  }

  return pair;
});

/**
 * Small config shape used by various selectors / ribbons so we don't push
 * full FxPair objects everywhere when we only need ids + labels.
 */
export interface FxPairConfig {
  id: FxPairId;
  label: string;
}

/**
 * Utility for building a display code ("GBP / USD") from a pair.
 */
export function buildPairCode(base: string, quote: string): string {
  return `${base} / ${quote}`;
}

/**
 * Helper to hydrate a list of ids from JSON into real FxPair objects.
 * Used by the free-tier tests and any paid-tier selection logic.
 */
export function getFxPairsByIds(ids: FxPairId[]): FxPair[] {
  return ids.map((rawId) => {
    const id = normaliseId(rawId);
    const pair = FX_BY_ID.get(id);

    if (!pair) {
      throw new Error(
        `getFxPairsByIds() called with unknown pair id "${id}" – check against fx.pairs.json`,
      );
    }

    return pair;
  });
}

/**
 * Convenience export when you genuinely need *all* pairs as typed objects.
 */
export function getAllFxPairs(): FxPair[] {
  return ALL_FX_PAIRS;
}
