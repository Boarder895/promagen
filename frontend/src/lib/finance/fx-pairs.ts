// src/lib/finance/fx-pairs.ts

import freeTierPairsJson from '@/data/fx/fx.pairs.json';
import allPairsJson from '@/data/fx/pairs.json';

export interface FxPairConfig {
  id: string; // slug, e.g. "eur-usd"
  base: string; // e.g. "EUR"
  quote: string; // e.g. "USD"
  label?: string;
}

/**
 * Free-tier FX pairs – taken from src/data/fx/fx.pairs.json.
 */
export const FREE_TIER_FX_PAIRS = freeTierPairsJson as FxPairConfig[];

/**
 * Full catalogue of FX pairs – taken from src/data/fx/pairs.json.
 */
export const ALL_FX_PAIRS = allPairsJson as FxPairConfig[];

/**
 * Convenience: default free-tier pair ids as a mutable string[].
 */
export const DEFAULT_FREE_FX_PAIR_IDS: string[] = FREE_TIER_FX_PAIRS.map((pair) => pair.id);

/**
 * Return the complete FX catalogue (paid tier / internal use).
 */
export function getAllFxPairs(): FxPairConfig[] {
  return ALL_FX_PAIRS.length ? ALL_FX_PAIRS : FREE_TIER_FX_PAIRS;
}

/**
 * Build a canonical slug from base + quote, e.g. "eur-usd".
 */
export function normalisePairId(base: string, quote: string): string {
  return `${base.toLowerCase()}-${quote.toLowerCase()}`;
}

/**
 * Build a canonical "code" for looking up quotes, e.g. "EURUSD".
 */
export function buildPairCode(base: string, quote: string): string {
  return `${base}${quote}`.toUpperCase();
}
