// frontend/src/data/fx/index.ts
//
// Canonical view of FX pairs and default selections.
//
// Rules:
//  - All FX pair metadata (base, quote, label, precision, demo)
//    comes from pairs.json only.
//  - fx.pairs.json is an index of defaults and flags that
//    references pairs by id only.
//  - This module is the single TS entry point for FX pair data.
//    Other code should import from here, not raw JSON files.

import pairsJson from './pairs.json';
import fxPairsIndexJson from './fx.pairs.json';
import type { FxPair } from '@/types/fx';

export type FxPairMeta = FxPair;
export type FxTier = 'free' | 'paid';

export interface FxPairIndexEntry {
  id: string;
  baseCountryCode?: string;
  quoteCountryCode?: string;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  group?: string;
}

export interface FxPairWithIndexMeta extends FxPairMeta, FxPairIndexEntry {}

/**
 * Normalise an FX pair id into the canonical form used throughout the app.
 *
 * Examples:
 *   "GBP-USD"   → "gbp-usd"
 *   "gbp_usd"   → "gbp-usd"
 *   "  Gbp-Usd" → "gbp-usd"
 */
export function normaliseFxPairId(rawId: string): string {
  const trimmed = rawId.trim();

  if (!trimmed) {
    return trimmed;
  }

  return trimmed
    .replace(/[_\s]+/g, '-') // underscores / spaces → hyphen
    .toLowerCase();
}

/**
 * Canonical FX pair catalogue.
 *
 * This is the single source of truth for all FX pairs that appear in Promagen:
 *  - homepage FX ribbon (free)
 *  - paid FX picker
 *  - any future mini widgets
 *
 * It comes from a JSON file that is validated by tests.
 */
const ALL_PAIRS: FxPairMeta[] = (pairsJson as FxPairMeta[]).map((pair) => {
  const base = pair.base.toUpperCase();
  const quote = pair.quote.toUpperCase();
  const id = normaliseFxPairId(pair.id);
  const label = pair.label ?? `${base} / ${quote}`;

  return {
    ...pair,
    id,
    base,
    quote,
    label,
  };
});

/**
 * Map for fast id → meta lookup.
 */
const PAIR_BY_ID: Map<string, FxPairMeta> = new Map(ALL_PAIRS.map((pair) => [pair.id, pair]));

/**
 * FX index entries (defaults + flags).
 *
 * These entries must:
 *  - reference FX pairs by id only
 *  - never redefine base / quote / label / precision / demo
 */
const INDEX_ENTRIES: FxPairIndexEntry[] = fxPairsIndexJson as FxPairIndexEntry[];

/**
 * Default free and paid pair id lists.
 *
 * Order is preserved from fx.pairs.json.
 */
const DEFAULT_FREE_PAIR_IDS: string[] = INDEX_ENTRIES.filter((entry) => entry.isDefaultFree).map(
  (entry) => normaliseFxPairId(entry.id),
);

const DEFAULT_PAID_PAIR_IDS: string[] = INDEX_ENTRIES.filter((entry) => entry.isDefaultPaid).map(
  (entry) => normaliseFxPairId(entry.id),
);

/**
 * Return the full FX pair catalogue.
 *
 * Callers should treat the returned array as read-only.
 */
export function getAllFxPairs(): FxPairMeta[] {
  return ALL_PAIRS;
}

/**
 * Look up an FX pair by id.
 *
 * Accepts any reasonably formatted id; it will be normalised first.
 */
export function getFxPairById(id: string): FxPairMeta | undefined {
  const normalised = normaliseFxPairId(id);
  return PAIR_BY_ID.get(normalised);
}

/**
 * Look up an FX pair by id and throw if it does not exist.
 */
export function requireFxPairById(id: string): FxPairMeta {
  const pair = getFxPairById(id);

  if (!pair) {
    throw new Error(`Unknown FX pair id "${id}"`);
  }

  return pair;
}

/**
 * Default FX pairs for a given tier.
 *
 * - Free tier → DEFAULT_FREE_PAIR_IDS
 * - Paid tier → DEFAULT_PAID_PAIR_IDS
 *
 * Any missing ids are silently skipped, but this should be prevented
 * by the FX SSoT Jest tests.
 */
export function getDefaultFxPairsForTier(tier: FxTier): FxPairMeta[] {
  const ids = tier === 'free' ? DEFAULT_FREE_PAIR_IDS : DEFAULT_PAID_PAIR_IDS;

  return ids
    .map((pairId) => PAIR_BY_ID.get(pairId))
    .filter((pair): pair is FxPairMeta => Boolean(pair));
}

/**
 * Raw index entries from fx.pairs.json.
 *
 * Mostly useful for flags (isDefaultFree / isDefaultPaid / group / country codes).
 */
export function getFxPairIndexEntries(): FxPairIndexEntry[] {
  return INDEX_ENTRIES;
}

/**
 * Look up a raw index entry by id.
 */
export function getFxPairIndexEntryById(id: string): FxPairIndexEntry | undefined {
  const normalised = normaliseFxPairId(id);
  return INDEX_ENTRIES.find((entry) => normaliseFxPairId(entry.id) === normalised);
}

/**
 * Merge canonical pair metadata with any index flags (defaults, group, country codes).
 */
export function mergeFxPairWithIndexMeta(pair: FxPairMeta): FxPairWithIndexMeta {
  const indexEntry = getFxPairIndexEntryById(pair.id);

  if (!indexEntry) {
    return pair;
  }

  const { id: _ignored, ...restIndex } = indexEntry;

  return {
    ...pair,
    ...restIndex,
  };
}

/**
 * Convenience helper: default FX pairs for a tier with index flags applied.
 *
 * Useful for:
 *  - homepage default FX row (free)
 *  - starting state of the paid FX picker
 */
export function getDefaultFxPairsWithIndexForTier(tier: FxTier): FxPairWithIndexMeta[] {
  return getDefaultFxPairsForTier(tier).map(mergeFxPairWithIndexMeta);
}
