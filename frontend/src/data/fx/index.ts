// frontend/src/data/fx/index.ts
/**
 * FX SSOT Access Layer
 *
 * API BRAIN COMPLIANCE:
 * - This file is SSOT-only.
 * - It MUST NOT contain timing, freshness, or provider logic.
 * - It MUST return a deterministic, ordered list.
 * - Ordering MUST be stable across runs to preserve:
 *   - A/B group split
 *   - Cache keys
 *   - Trace diagnostics
 *
 * This file is allowed to:
 * - Read static JSON
 * - Filter by tier
 *
 * This file is NOT allowed to:
 * - Fetch
 * - Poll
 * - Randomise
 * - Read env vars
 * - React to traffic or time
 *
 * UPDATED: Now uses unified fx-pairs.json (single source of truth).
 */

import fxPairs from './fx-pairs.json';
import countryCurrencyMap from './country-currency.map.json';

export type FxTier = 'free' | 'paid';

export interface FxPairSSOT {
  id: string;
  base: string;
  quote: string;
  label: string;
  group: string;
  tiers: FxTier[];
  homeLongitude?: number;
  index: number; // deterministic SSOT index (critical for A/B)
}

function toUpperTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function resolveCurrencyCode(rawCurrency: unknown, rawCountryCode: unknown): string {
  const direct = toUpperTrim(rawCurrency);
  if (direct) return direct;

  const country = toUpperTrim(rawCountryCode);
  if (!country) return 'UNDEFINED';

  const map = countryCurrencyMap as unknown as Record<string, string>;
  const mapped = map[country];
  return toUpperTrim(mapped) || 'UNDEFINED';
}

function resolveTiers(raw: any): FxTier[] {
  if (Array.isArray(raw?.tiers)) return raw.tiers as FxTier[];

  const tiers: FxTier[] = [];
  if (raw?.isDefaultFree === true) tiers.push('free');
  if (raw?.isDefaultPaid === true) tiers.push('paid');

  // Safe fallback: if the SSOT row has no explicit tier flags, treat it as free.
  return tiers.length ? tiers : ['free'];
}

/**
 * Internal normalisation.
 * This ensures:
 * - Stable casing
 * - Predictable labels
 * - No accidental runtime mutation
 */
function normalisePair(raw: any, index: number): FxPairSSOT {
  const base = resolveCurrencyCode(raw?.base, raw?.baseCountryCode);
  const quote = resolveCurrencyCode(raw?.quote, raw?.quoteCountryCode);

  return {
    id: String(raw?.id),
    base,
    quote,
    label: raw?.label ? String(raw.label) : `${base} / ${quote}`,
    group: raw?.group ? String(raw.group) : 'fx',
    tiers: resolveTiers(raw),
    homeLongitude: typeof raw?.homeLongitude === 'number' ? raw.homeLongitude : undefined,
    index,
  };
}

/**
 * getDefaultFxPairsWithIndexForTier
 *
 * SINGLE SOURCE OF TRUTH for:
 * - FX ribbon membership
 * - Ordering
 * - A/B group slicing
 * - Cache key fingerprinting
 *
 * CRITICAL GUARANTEES:
 * - Output order == JSON order
 * - Index is assigned BEFORE filtering
 * - Filtering never reorders
 */
export function getDefaultFxPairsWithIndexForTier(tier: FxTier): FxPairSSOT[] {
  if (!Array.isArray(fxPairs)) {
    throw new Error('fx-pairs.json must export an array');
  }

  // Step 1: normalise + index in declared order
  const indexed: FxPairSSOT[] = fxPairs.map((raw, idx) => normalisePair(raw, idx));

  // Step 2: filter by tier ONLY (no sorting, no reshaping)
  return indexed.filter((pair) => pair.tiers.includes(tier));
}
