// C:\Users\Proma\Projects\promagen\frontend\src\lib\finance\fx-pairs.ts
//
// FX ribbon pairs — SSOT access layer.
//
// SSOT sources (your repo):
//   - src/data/fx/pairs.json     (canonical pair metadata: base, quote, label, precision, demo, etc.)
//   - src/data/fx/fx.pairs.json  (index of defaults + flags + optional homeLongitude; references pairs by id)
//
// This module provides:
//  - getFxRibbonPairs(): default tier pairs used in the homepage ribbon (count is SSOT-driven)
//  - getFxRibbonPairCodes(): provider symbols like "GBPUSD"
//  - buildPairCode(), buildSlashPair()
//  - getClientLongitudeHint(): permission-free user longitude hint (timezone-based)
//  - strict runtime validation (so "missing data" fails loudly during dev/build)

import pairsCatalogJson from '@/data/fx/pairs.json';
import fxPairsIndexJson from '@/data/fx/fx.pairs.json';

export type FxTier = 'free' | 'paid';

export type FxRibbonOrder = 'ssot' | 'homeLongitude' | 'relativeToUser';

export interface FxRibbonPairsOptions {
  tier?: FxTier;
  /**
   * Ordering strategy:
   *  - "ssot"            → preserve fx.pairs.json file order (default; stable for server/caching)
   *  - "homeLongitude"   → sort by homeLongitude east→west (descending longitude)
   *  - "relativeToUser"  → sort by longitude relative to the user’s estimated longitude (east→west)
   */
  order?: FxRibbonOrder;
  /**
   * Optional user longitude in degrees (east positive).
   * Only used when order === "relativeToUser".
   */
  userLongitude?: number | null;
}

export interface FxRibbonPairMeta {
  id: string; // e.g. "gbp-usd" (catalog id)
  base: string; // e.g. "GBP"
  quote: string; // e.g. "USD"
  label: string; // e.g. "GBP / USD"
  category: string; // "fx"
  emoji?: string;
  precision?: number;
  homeLongitude?: number;
  // Optional country/region codes used to render flags alongside currency codes.
  // These live ONLY in src/data/fx/fx.pairs.json (index metadata), not pairs.json.
  baseCountryCode?: string;
  quoteCountryCode?: string;
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
  homeLongitude?: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalisePairId(value: string): string {
  return value
    .trim()
    .replace(/[_\s]+/g, '-') // underscores/spaces → hyphen
    .toLowerCase();
}

function normaliseCurrency(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase();
}

function normaliseCountryCode(value: string): string {
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

    map.set(normalisePairId(p.id), p);
  }

  return map;
}

function normaliseLongitude(lon: number): number {
  // Wrap into (-180, 180]
  let x = lon;

  while (x <= -180) x += 360;
  while (x > 180) x -= 360;

  // Avoid negative zero (cosmetics)
  if (Object.is(x, -0)) x = 0;

  return x;
}

function relativeLongitude(targetLon: number, originLon: number): number {
  return normaliseLongitude(targetLon - originLon);
}

/**
 * Permission-free “where on Earth are you” guess.
 *
 * We do NOT ask for geolocation permission; instead we approximate longitude from the browser
 * timezone offset:
 *   GMT (0) → ~0°, CET (+1) → ~15°E, EST (-5) → ~75°W.
 *
 * Coarse, but deterministic and zero-friction.
 */
export function getClientLongitudeHint(): number | null {
  if (typeof window === 'undefined') return null;

  const offsetMinutes = new Date().getTimezoneOffset(); // minutes to add to local to get UTC
  const hoursFromUtc = -offsetMinutes / 60;
  const approx = hoursFromUtc * 15;

  return normaliseLongitude(approx);
}

function sortStable<T>(items: T[], compare: (a: T, b: T) => number): T[] {
  const tagged = items.map((item, index) => ({ item, index }));

  tagged.sort((a, b) => {
    const c = compare(a.item, b.item);
    if (c !== 0) return c;
    return a.index - b.index;
  });

  return tagged.map((t) => t.item);
}

function sortPairs(
  pairs: FxRibbonPairMeta[],
  options: FxRibbonPairsOptions | undefined,
): FxRibbonPairMeta[] {
  const order = options?.order ?? 'ssot';

  if (order === 'ssot') return pairs;

  if (order === 'homeLongitude') {
    return sortStable(pairs, (a, b) => {
      const aLon = isFiniteNumber(a.homeLongitude) ? a.homeLongitude : -9999;
      const bLon = isFiniteNumber(b.homeLongitude) ? b.homeLongitude : -9999;
      return bLon - aLon; // east→west (desc)
    });
  }

  // relativeToUser
  const userLon = isFiniteNumber(options?.userLongitude)
    ? normaliseLongitude(options!.userLongitude as number)
    : getClientLongitudeHint() ?? 0;

  return sortStable(pairs, (a, b) => {
    const aHas = isFiniteNumber(a.homeLongitude);
    const bHas = isFiniteNumber(b.homeLongitude);

    if (!aHas && !bHas) return 0;
    if (!aHas) return 1;
    if (!bHas) return -1;

    const aRel = relativeLongitude(a.homeLongitude as number, userLon);
    const bRel = relativeLongitude(b.homeLongitude as number, userLon);

    return bRel - aRel; // east→west relative (desc)
  });
}

function pickIndexForTier(index: FxPairIndexEntry[], tier: FxTier): FxPairIndexEntry[] {
  const flag = tier === 'paid' ? 'isDefaultPaid' : 'isDefaultFree';
  return index.filter((e) => Boolean(e && (e as FxPairIndexEntry)[flag]));
}

/**
 * The ribbon list:
 * - take default tier entries from fx.pairs.json
 * - join against pairs.json to get base/quote/label/precision
 * - optionally sort by longitude (runtime) instead of file order
 *
 * Count is SSOT-driven: number of isDefaultFree entries = number of chips.
 */
export function getFxRibbonPairs(options?: FxRibbonPairsOptions): FxRibbonPairMeta[] {
  const tier = options?.tier ?? 'free';

  const index = getIndex();
  const catalogById = getCatalogMap();

  const picked = pickIndexForTier(index, tier);

  const joined: FxRibbonPairMeta[] = picked.map((e) => {
    const id = normalisePairId(String(e.id));
    const cat = catalogById.get(id);

    const homeLongitude = isFiniteNumber(e.homeLongitude)
      ? normaliseLongitude(e.homeLongitude)
      : undefined;

    const baseCountryCode = isNonEmptyString(e.baseCountryCode)
      ? normaliseCountryCode(e.baseCountryCode)
      : undefined;
    const quoteCountryCode = isNonEmptyString(e.quoteCountryCode)
      ? normaliseCountryCode(e.quoteCountryCode)
      : undefined;

    return {
      id,
      base: cat?.base ? normaliseCurrency(cat.base) : '',
      quote: cat?.quote ? normaliseCurrency(cat.quote) : '',
      label: cat?.label ?? (cat?.base && cat?.quote ? `${cat.base} / ${cat.quote}` : id),
      precision: cat?.precision,
      category: 'fx',
      baseCountryCode,
      quoteCountryCode,
      homeLongitude,
    };
  });

  return sortPairs(joined, options);
}

export function getFxRibbonPairCodes(options?: FxRibbonPairsOptions): string[] {
  return getFxRibbonPairs(options)
    .map((p) => buildPairCode(p.base, p.quote))
    .filter(Boolean);
}

/**
 * Strict validation: fail loudly if SSOT breaks.
 * (Build-time SSoT coverage is already enforced by frontend/src/data/fx/tests/fx-ssot.test.ts,
 * but this gives fast feedback during local dev and API route execution.)
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

  // Invariant: every id in fx.pairs.json exists in pairs.json
  for (const row of index) {
    const rawId = row?.id;

    if (!isNonEmptyString(rawId)) {
      throw new Error('FX SSOT: every index row must have a non-empty string "id".');
    }

    const id = normalisePairId(rawId);
    const cat = catalogById.get(id);

    if (!cat) {
      throw new Error(`FX SSOT: pair id "${rawId}" exists in fx.pairs.json but not in pairs.json.`);
    }

    if (!isNonEmptyString(cat.base) || !isNonEmptyString(cat.quote)) {
      throw new Error(`FX SSOT: pair "${id}" must have base and quote in pairs.json.`);
    }

    const base = normaliseCurrency(cat.base);
    const quote = normaliseCurrency(cat.quote);

    if (base.length !== 3 || quote.length !== 3) {
      throw new Error(`FX SSOT: pair "${id}" base/quote must be 3-letter currency codes.`);
    }

    if (row.homeLongitude !== undefined && !isFiniteNumber(row.homeLongitude)) {
      throw new Error(`FX SSOT: pair "${id}" homeLongitude must be a finite number (degrees).`);
    }

    if (isFiniteNumber(row.homeLongitude)) {
      const lon = row.homeLongitude;
      if (lon < -180 || lon > 180) {
        throw new Error(
          `FX SSOT: pair "${id}" homeLongitude must be between -180 and 180; got ${lon}.`,
        );
      }
    }

    if (row.baseCountryCode !== undefined) {
      const cc = normaliseCountryCode(String(row.baseCountryCode));
      if (cc.length !== 2) {
        throw new Error(
          `FX SSOT: pair "${id}" baseCountryCode must be a 2-letter code; got "${row.baseCountryCode}".`,
        );
      }
    }

    if (row.quoteCountryCode !== undefined) {
      const cc = normaliseCountryCode(String(row.quoteCountryCode));
      if (cc.length !== 2) {
        throw new Error(
          `FX SSOT: pair "${id}" quoteCountryCode must be a 2-letter code; got "${row.quoteCountryCode}".`,
        );
      }
    }
  }

  // Invariant: default free ribbon must contain at least 1 pair, and no duplicates.
  const ribbon = getFxRibbonPairs({ tier: 'free', order: 'ssot' });

  if (ribbon.length < 1) {
    throw new Error('FX SSOT: expected at least 1 default free FX pair; found 0.');
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

    const code = buildPairCode(cat.base, cat.quote);
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
