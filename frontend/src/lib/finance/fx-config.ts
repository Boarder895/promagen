// frontend/src/lib/finance/fx-config.ts
//
// FX configuration helpers for the ribbon and any mini widgets.
//
// - Drives from src/data/fx/finance.config.json + src/data/fx/fx-pairs.json
// - Free-tier pairs derived from isDefaultFree flag in fx-pairs.json (TRUE SSOT)
//
// Rule: components and hooks should import from this file (or from
// lib/finance/fx-pairs if you add a higher-level helper), never from JSON
// directly.

import financeConfigJson from '@/data/fx/finance.config.json';
import pairsJson from '@/data/fx/fx-pairs.json';
import type { FxPair } from '@/types/fx';

type FxPairId = string;

type FinancePairsConfig =
  | '*'
  | FxPairId[]
  | {
      include?: FxPairId[];
      exclude?: FxPairId[];
    };

type FinanceConfig = {
  pairs: FinancePairsConfig;
};

// ───────────────────────────────────────────────────────────────────────────────
// Internal helpers (must be defined before usage)
// ───────────────────────────────────────────────────────────────────────────────

function normaliseId(id: string): string {
  return id.trim().toLowerCase();
}

// Canonical full catalogue of FX pairs (data-driven).
const ALL_FX_PAIRS_INTERNAL = pairsJson as FxPair[];

// Map for fast lookups by id (case-insensitive).
const ALL_FX_PAIRS_BY_ID_INTERNAL = new Map<string, FxPair>(
  ALL_FX_PAIRS_INTERNAL.map((pair) => [normaliseId(pair.id), pair]),
);

// Free-tier ids derived from isDefaultFree flag in fx-pairs.json (TRUE SSOT).
// No separate file needed - change fx-pairs.json to update free tier.
const FREE_FX_PAIR_IDS_INTERNAL = ALL_FX_PAIRS_INTERNAL
  .filter((pair) => (pair as FxPair & { isDefaultFree?: boolean }).isDefaultFree === true)
  .map((pair) => normaliseId(pair.id));

// Finance config is allowed to be more expressive later; we treat it as typed.
const financeConfig = financeConfigJson as FinanceConfig;

// ───────────────────────────────────────────────────────────────────────────────
// More internal helpers
// ───────────────────────────────────────────────────────────────────────────────

function resolveConfigIds(config: FinancePairsConfig | undefined): FxPairId[] {
  // Default: if config is missing or "*", we allow every known pair in
  // the canonical order defined by pairs.json.
  if (!config || config === '*') {
    return ALL_FX_PAIRS_INTERNAL.map((pair) => pair.id);
  }

  // Simple explicit list.
  if (Array.isArray(config)) {
    return config;
  }

  // Object form: include / exclude.
  const include =
    config.include && config.include.length > 0
      ? config.include
      : ALL_FX_PAIRS_INTERNAL.map((pair) => pair.id);

  const excludeSet = new Set((config.exclude ?? []).map(normaliseId));

  return include.filter((id) => !excludeSet.has(normaliseId(id)));
}

// ───────────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Canonical, config-driven list of all FX pairs that the app should use.
 *
 * Respects src/data/fx/finance.config.json:
 *   - pairs = "*" → all ids from pairs.json, in file order
 *   - pairs = string[] → that explicit list (duplicates removed)
 *   - pairs = { include, exclude } → include list minus any excluded ids
 */
export function getAllFxPairsOrdered(): FxPair[] {
  const ids = resolveConfigIds(financeConfig.pairs);
  const seen = new Set<string>();
  const result: FxPair[] = [];

  for (const rawId of ids) {
    const id = normaliseId(rawId);
    if (seen.has(id)) continue;

    const pair = ALL_FX_PAIRS_BY_ID_INTERNAL.get(id);
    if (!pair) continue;

    seen.add(id);
    result.push(pair);
  }

  return result;
}

/**
 * Free-tier FX pair ids – derived from isDefaultFree flag in fx-pairs.json.
 *
 * Returned as a fresh array so callers can sort / slice without mutating
 * the internal state.
 */
export function getFreeFxPairIds(): FxPairId[] {
  return [...FREE_FX_PAIR_IDS_INTERNAL];
}

/**
 * Free-tier FX pairs metadata.
 *
 * Uses pairs with isDefaultFree=true from fx-pairs.json and orders them
 * to be consistent with getAllFxPairsOrdered().
 */
export function getFreeFxPairs(): FxPair[] {
  const orderIndex = new Map<string, number>();
  getAllFxPairsOrdered().forEach((pair, index) => {
    orderIndex.set(normaliseId(pair.id), index);
  });

  const seen = new Set<string>();
  const result: FxPair[] = [];

  for (const rawId of FREE_FX_PAIR_IDS_INTERNAL) {
    const id = normaliseId(rawId);
    if (seen.has(id)) continue;

    const pair = ALL_FX_PAIRS_BY_ID_INTERNAL.get(id);
    if (!pair) continue;

    seen.add(id);
    result.push(pair);
  }

  // Keep the same visual ordering as the full config.
  result.sort((a, b) => {
    const aIndex = orderIndex.get(normaliseId(a.id)) ?? 0;
    const bIndex = orderIndex.get(normaliseId(b.id)) ?? 0;
    return aIndex - bIndex;
  });

  return result;
}

/**
 * Direct access to the full FX catalogue for other helpers.
 * Components should use the higher-level functions above, not this constant.
 */
export const ALL_FX_PAIRS: FxPair[] = ALL_FX_PAIRS_INTERNAL;

/**
 * Map of pair id → pair config.
 * Always uses lower-cased ids as keys.
 */
export const ALL_FX_PAIRS_BY_ID: ReadonlyMap<string, FxPair> = ALL_FX_PAIRS_BY_ID_INTERNAL;
