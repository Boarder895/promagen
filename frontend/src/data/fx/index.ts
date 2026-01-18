// frontend/src/data/fx/index.ts
/**
 * FX SSOT Access Layer
 *
 * OPTION A (selected.json):
 * - fx-pairs.json is the FX catalogue (universe)
 * - fx.selected.json is the ordered default selection for the free ribbon
 *
 * API BRAIN COMPLIANCE:
 * - This file is SSOT-only.
 * - It MUST return a deterministic, ordered list.
 * - It MUST NOT fetch, poll, randomise, or read env vars.
 */

import fxPairs from './fx-pairs.json';
import fxSelected from './fx.selected.json';
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

interface FxPairRaw {
  id: string;
  base?: unknown;
  quote?: unknown;
  label?: unknown;
  group?: unknown;
  baseCountryCode?: unknown;
  quoteCountryCode?: unknown;
  homeLongitude?: unknown;
}

interface FxSelectedRaw {
  version?: number;
  ssot?: string;
  selectedIds?: unknown;
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

function normalisePair(raw: FxPairRaw, index: number): FxPairSSOT {
  const base = resolveCurrencyCode(raw.base, raw.baseCountryCode);
  const quote = resolveCurrencyCode(raw.quote, raw.quoteCountryCode);

  return {
    id: String(raw.id),
    base,
    quote,
    label: raw.label ? String(raw.label) : `${base} / ${quote}`,
    group: raw.group ? String(raw.group) : 'fx',
    // In Option A, tiers are not stored in the catalogue.
    // Defaults are selected via fx.selected.json. Paid users can later choose any subset.
    tiers: ['free', 'paid'],
    homeLongitude: typeof raw.homeLongitude === 'number' ? raw.homeLongitude : undefined,
    index,
  };
}

function readSelectedIds(): string[] {
  const parsed = fxSelected as unknown as FxSelectedRaw;
  const raw = parsed?.selectedIds;

  if (!Array.isArray(raw)) {
    throw new Error('fx.selected.json must contain a selectedIds array');
  }

  const ids = raw.map((v) => String(v));
  if (!ids.length) {
    throw new Error('fx.selected.json selectedIds must not be empty');
  }

  return ids;
}

/**
 * getDefaultFxPairsWithIndexForTier
 *
 * SINGLE SOURCE OF TRUTH for:
 * - FX ribbon default membership
 * - Ordering (now driven by fx.selected.json)
 * - A/B group slicing
 * - Cache key fingerprinting
 */
export function getDefaultFxPairsWithIndexForTier(_tier: FxTier): FxPairSSOT[] {
  if (!Array.isArray(fxPairs)) {
    throw new Error('fx-pairs.json must export an array');
  }

  const selectedIds = readSelectedIds();

  // Build a lookup from catalogue by ID.
  const catalogue = fxPairs as unknown as FxPairRaw[];
  const byId = new Map<string, FxPairRaw>();
  for (const row of catalogue) {
    if (!row?.id) continue;
    byId.set(String(row.id), row);
  }

  // Output order MUST match selectedIds order.
  const out: FxPairSSOT[] = [];
  selectedIds.forEach((id, idx) => {
    const raw = byId.get(id);
    if (!raw) {
      throw new Error(`fx.selected.json references unknown FX pair id: ${id}`);
    }
    out.push(normalisePair(raw, idx));
  });

  return out;
}

/**
 * getFxCataloguePairs
 *
 * Returns the full FX catalogue as a normalised array.
 * Useful for building pickers / paid-tier selection UIs.
 *
 * Order is the declared JSON order.
 */
export function getFxCataloguePairs(): FxPairSSOT[] {
  if (!Array.isArray(fxPairs)) {
    throw new Error('fx-pairs.json must export an array');
  }

  const catalogue = fxPairs as unknown as FxPairRaw[];
  return catalogue.map((raw, idx) => normalisePair(raw, idx));
}
