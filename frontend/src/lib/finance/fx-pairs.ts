// src/lib/finance/fx-pairs.ts

import freeTierPairsJson from '@/data/fx/fx.pairs.json';
import paidTierPairsJson from '@/data/fx/pairs.json';

/**
 * Canonical FX pair definition used across Promagen.
 *
 * Backed by:
 * - src/data/fx/fx.pairs.json  → free tier / ribbon core set
 * - src/data/fx/pairs.json     → full paid-tier universe
 *
 * This keeps the UI from ever hard-coding pairs, matching finance.config.json.
 */
export interface FxPair {
  id: string;
  base: string;
  quote: string;
  label: string;
  precision: number;
  group?: string;
  demo?: {
    value: number;
    prevClose: number;
  };
}

/**
 * Normalise raw JSON into the FxPair shape.
 * (Allows future schema tweaks without touching callers.)
 */
function mapJsonToFxPair(raw: any): FxPair {
  return {
    id: String(raw.id),
    base: String(raw.base),
    quote: String(raw.quote),
    label: String(raw.label),
    precision: typeof raw.precision === 'number' ? raw.precision : 5, // safe default
    group: raw.group,
    demo: raw.demo
      ? {
          value: Number(raw.demo.value),
          prevClose: Number(raw.demo.prevClose),
        }
      : undefined,
  };
}

/**
 * Free-tier FX pairs, as defined by:
 *   src/data/fx/fx.pairs.json
 *
 * This is the only source of truth for the free FX set.
 */
export const FREE_TIER_FX_PAIRS: FxPair[] = (freeTierPairsJson as any[]).map(mapJsonToFxPair);

/**
 * Paid-tier FX pairs, as defined by:
 *   src/data/fx/pairs.json
 *
 * finance.config.json sets:
 *   "pairs": "*"
 * which means: "allow all pair ids from src/data/fx/pairs.json".
 */
export const PAID_TIER_FX_PAIRS: FxPair[] = (paidTierPairsJson as any[]).map(mapJsonToFxPair);

/**
 * Logical 5-slot ribbon selection.
 *
 * These IDs **must** exist in src/data/fx/fx.pairs.json.
 * We read the definitions from JSON, but keep the slot choice here.
 *
 * This preserves your original 5:
 *   EUR/USD, GBP/USD, EUR/GBP, USD/JPY, USD/CNY
 */
export const RIBBON_FX_PAIR_IDS = ['eur-usd', 'gbp-usd', 'eur-gbp', 'usd-jpy', 'usd-cny'] as const;

export type RibbonFxPairId = (typeof RIBBON_FX_PAIR_IDS)[number];

/**
 * The actual objects used by the ribbon, pulled from the free-tier JSON.
 */
export const RIBBON_FX_PAIRS: FxPair[] = FREE_TIER_FX_PAIRS.filter((pair) =>
  (RIBBON_FX_PAIR_IDS as readonly string[]).includes(pair.id),
);

/**
 * Simple helpers so everything can go through the same lookup path.
 */

export function getFxPairById(id: string): FxPair | undefined {
  return FREE_TIER_FX_PAIRS.find((p) => p.id === id) ?? PAID_TIER_FX_PAIRS.find((p) => p.id === id);
}

export function isFreeTierFxPair(id: string): boolean {
  return FREE_TIER_FX_PAIRS.some((p) => p.id === id);
}

export function isPaidTierFxPair(id: string): boolean {
  return PAID_TIER_FX_PAIRS.some((p) => p.id === id);
}
