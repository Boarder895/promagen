// C:\Users\Proma\Projects\promagen\frontend\src\lib\finance\fx-pairs.ts
//
// FX ribbon pairs — SSOT access layer.
//
// SSOT sources (your repo):
//   - src/data/fx/pairs.json     (canonical pair metadata: base, quote, label, precision, demo, etc.)
//   - src/data/fx/fx.pairs.json  (index of defaults + flags, references pairs by id)
//
// This module provides:
//  - getFxRibbonPairs(): the 5 default free pairs used in the homepage ribbon
//  - getFxRibbonPairCodes(): provider symbols like "GBPUSD"
//  - buildPairCode(), buildSlashPair()
//  - strict runtime validation (so "missing data" fails loudly during dev/build)

import pairsCatalogJson from '@/data/fx/pairs.json';
import fxPairsIndexJson from '@/data/fx/fx.pairs.json';

export interface FxRibbonPairMeta {
  id: string; // e.g. "gbp-usd" (catalog id)
  base: string; // e.g. "GBP"
  quote: string; // e.g. "USD"
  label: string; // e.g. "GBP / USD"
  category: string; // we’ll set this to "fx" for now (your UI expects a category string)
  emoji?: string;
  precision?: number;
}

type FxPairCatalogEntry = {
  id: string;
  base: string;
  quote: string;
  label?: string;
  precision?: number;
  demo?: unknown;
};

type FxPairIndexEntry = {
  id: string;
  baseCountryCode?: string;
  quoteCountryCode?: string;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  group?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normaliseCurrency(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase();
}

export function buildPairCode(base: string, quote: string): string {
  return `${normaliseCurrency(base)}${normaliseCurrency(quote)}`;
}

export function buildSlashPair(base: string, quote: string): string {
  return `${normaliseCurrency(base)}/${normaliseCurrency(quote)}`;
}

function getCatalog(): FxPairCatalogEntry[] {
  return pairsCatalogJson as FxPairCatalogEntry[];
}

function getIndex(): FxPairIndexEntry[] {
  return fxPairsIndexJson as FxPairIndexEntry[];
}

function getCatalogMap(): Map<string, FxPairCatalogEntry> {
  const map = new Map<string, FxPairCatalogEntry>();
  for (const p of getCatalog()) {
    if (!p || typeof p !== 'object') continue;
    if (!isNonEmptyString(p.id)) continue;
    map.set(p.id, p);
  }
  return map;
}

/**
 * The single “truthy” ribbon list:
 * - take default free entries from fx.pairs.json
 * - join against pairs.json to get base/quote/label/precision
 * - enforce exactly 5 pairs
 */
export function getFxRibbonPairs(): FxRibbonPairMeta[] {
  const index = getIndex();
  const catalogById = getCatalogMap();

  const defaultFree = index.filter((e) => Boolean(e?.isDefaultFree));

  // Preserve the order defined in fx.pairs.json.
  const joined: FxRibbonPairMeta[] = defaultFree.map((e) => {
    const id = String(e.id);
    const cat = catalogById.get(id);

    return {
      id,
      base: cat?.base ? normaliseCurrency(cat.base) : '',
      quote: cat?.quote ? normaliseCurrency(cat.quote) : '',
      label: cat?.label ?? (cat?.base && cat?.quote ? `${cat.base} / ${cat.quote}` : id),
      precision: cat?.precision,
      category: 'fx',
    };
  });

  return joined;
}

export function getFxRibbonPairCodes(): string[] {
  return getFxRibbonPairs()
    .map((p) => buildPairCode(p.base, p.quote))
    .filter(Boolean);
}

/**
 * Strict validation: fail loudly if SSOT breaks.
 * Call this from API route + container (as we do) so problems surface immediately.
 */
export function assertFxRibbonSsotValid(): void {
  const index = getIndex();
  const catalog = getCatalog();

  if (!Array.isArray(index) || index.length === 0) {
    throw new Error('FX SSOT: src/data/fx/fx.pairs.json must be a non-empty array.');
  }

  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('FX SSOT: src/data/fx/pairs.json must be a non-empty array.');
  }

  const catalogById = getCatalogMap();
  const ribbon = getFxRibbonPairs();

  // Your homepage ribbon is designed for 5 FX chips.
  if (ribbon.length !== 5) {
    throw new Error(`FX SSOT: expected exactly 5 default free FX pairs; found ${ribbon.length}.`);
  }

  const seenCodes = new Set<string>();

  for (const p of ribbon) {
    if (!isNonEmptyString(p.id)) {
      throw new Error('FX SSOT: ribbon pair id must be a non-empty string.');
    }

    const cat = catalogById.get(p.id);
    if (!cat) {
      throw new Error(`FX SSOT: pair id "${p.id}" exists in fx.pairs.json but not in pairs.json.`);
    }

    if (!isNonEmptyString(cat.base) || !isNonEmptyString(cat.quote)) {
      throw new Error(`FX SSOT: pair "${p.id}" must have base and quote in pairs.json.`);
    }

    const base = normaliseCurrency(cat.base);
    const quote = normaliseCurrency(cat.quote);

    if (base.length !== 3 || quote.length !== 3) {
      throw new Error(`FX SSOT: pair "${p.id}" base/quote must be 3-letter currency codes.`);
    }

    const code = buildPairCode(base, quote);
    if (seenCodes.has(code)) {
      throw new Error(`FX SSOT: duplicate ribbon currency pair code "${code}".`);
    }
    seenCodes.add(code);
  }
}

// -----------------------------------------------------------------------------
// Backwards-compatible aliases (older modules used these names)
// -----------------------------------------------------------------------------

export const assertFxPairsSsotValid = assertFxRibbonSsotValid;
export const getFxPairs = getFxRibbonPairs;
export const getFxPairCodes = getFxRibbonPairCodes;

// Legacy constants some older code may reference
export const ALL_FX_PAIRS: FxRibbonPairMeta[] = getFxRibbonPairs();
export const DEFAULT_FREE_FX_PAIR_IDS: string[] = getFxRibbonPairCodes();
export const FREE_TIER_FX_PAIRS: FxRibbonPairMeta[] = ALL_FX_PAIRS;
