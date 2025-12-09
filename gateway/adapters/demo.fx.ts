// C:\Users\Proma\Projects\promagen\gateway\adapters\demo.fx.ts
//
// Demo FX adapter wired to the FX single source of truth.
//
// Responsibilities:
// - Read the canonical FX pair catalogue and default flags from
//   frontend/src/data/fx.
// - Build a stable default "free tier" ribbon set using the same
//   order as the homepage.
// - Provide slightly jittered prices so the UI feels alive, but
//   without any external HTTP calls.

import fs from 'node:fs';
import path from 'node:path';

import type { FxRibbonQuote } from '..';

interface FxPairDemoMeta {
  value: number;
  prevClose: number;
}

interface FxPairCatalogEntry {
  id: string;
  base: string;
  quote: string;
  label?: string;
  precision?: number;
  demo?: FxPairDemoMeta;
}

interface FxIndexEntry {
  id: string;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  group?: string;
}

/**
 * Normalise FX pair ids so "GBP-USD" and "gbp-usd" are treated the same.
 */
function normaliseFxPairId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Resolve a path relative to the repository root, working whether the
 * current working directory is the repo root or the frontend folder.
 *
 * Example:
 *  resolveFromRepo('frontend/src/data/fx/pairs.json')
 */
function resolveFromRepo(relativeFromRoot: string): string {
  const cwd = process.cwd();

  const direct = path.join(cwd, relativeFromRoot);
  if (fs.existsSync(direct)) {
    return direct;
  }

  const parent = path.join(cwd, '..', relativeFromRoot);
  if (fs.existsSync(parent)) {
    return parent;
  }

  throw new Error(
    `demo.fx: unable to resolve path "${relativeFromRoot}". Tried:\n` +
      `  ${direct}\n` +
      `  ${parent}\n` +
      `CWD was: ${cwd}`,
  );
}

function loadJsonFromRepo<T>(relativeFromRoot: string): T {
  const fullPath = resolveFromRepo(relativeFromRoot);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw) as T;
}

/**
 * Build the base (non-jittered) FX quotes from the FX single source
 * of truth:
 *
 * - frontend/src/data/fx/pairs.json      → full catalogue
 * - frontend/src/data/fx/fx.pairs.json  → default/flags index
 *
 * We use:
 * - only entries where isDefaultFree === true
 * - only pairs that have demo metadata
 * - the file order from fx.pairs.json as the ribbon order.
 */
function buildDemoBaseQuotesFromSsot(): FxRibbonQuote[] {
  const allPairs = loadJsonFromRepo<FxPairCatalogEntry[]>('frontend/src/data/fx/pairs.json');
  const indexEntries = loadJsonFromRepo<FxIndexEntry[]>('frontend/src/data/fx/fx.pairs.json');

  const pairsById = new Map<string, FxPairCatalogEntry>();

  for (const pair of allPairs) {
    if (!pair || typeof pair !== 'object') {
      continue;
    }

    if (!pair.id) {
      continue;
    }

    const normalisedId = normaliseFxPairId(pair.id);
    pairsById.set(normalisedId, pair);
  }

  const baseQuotes: FxRibbonQuote[] = [];

  for (const entry of indexEntries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    if (!entry.id || !entry.isDefaultFree) {
      continue;
    }

    const id = normaliseFxPairId(entry.id);
    const pair = pairsById.get(id);

    if (!pair || !pair.demo) {
      continue;
    }

    const baseCode = String(pair.base ?? '')
      .trim()
      .toUpperCase();
    const quoteCode = String(pair.quote ?? '')
      .trim()
      .toUpperCase();

    if (!baseCode || !quoteCode) {
      continue;
    }

    const canonicalPair = `${baseCode}/${quoteCode}`;

    const demoValue =
      typeof pair.demo.value === 'number' && Number.isFinite(pair.demo.value) ? pair.demo.value : 0;

    baseQuotes.push({
      base: baseCode,
      quote: quoteCode,
      pair: canonicalPair,
      price: demoValue,
      providerSymbol: canonicalPair,
      // We deliberately leave change_24h / change_24h_pct undefined here;
      // the demo adapter does not pretend to offer real 24h history.
    });
  }

  if (baseQuotes.length === 0) {
    throw new Error('demo.fx: FX SSoT produced zero default free pairs');
  }

  return baseQuotes;
}

/**
 * Built-in hard-coded fallback in case the FX SSoT files cannot be
 * loaded for any reason (missing files, JSON parse error, etc.).
 *
 * This preserves the original behaviour: a small, fixed set of
 * recognisable pairs with stable baseline prices.
 */
const FALLBACK_QUOTES: FxRibbonQuote[] = [
  { base: 'GBP', quote: 'USD', pair: 'GBP/USD', price: 1.27, providerSymbol: 'GBPUSD' },
  { base: 'EUR', quote: 'USD', pair: 'EUR/USD', price: 1.09, providerSymbol: 'EURUSD' },
  { base: 'GBP', quote: 'JPY', pair: 'GBP/JPY', price: 187.5, providerSymbol: 'GBPJPY' },
  { base: 'USD', quote: 'JPY', pair: 'USD/JPY', price: 148.2, providerSymbol: 'USDJPY' },
  { base: 'USD', quote: 'CNY', pair: 'USD/CNY', price: 7.14, providerSymbol: 'USDCNY' },
];

/**
 * Canonical base quotes the demo adapter will jitter around on each
 * call.
 */
let DEMO_BASE_QUOTES: FxRibbonQuote[];

try {
  DEMO_BASE_QUOTES = buildDemoBaseQuotesFromSsot();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('[demo.fx] Falling back to built-in demo FX pairs', error);
  DEMO_BASE_QUOTES = FALLBACK_QUOTES;
}

function jitter(value: number): number {
  const r = (Math.random() - 0.5) * 0.002; // ±0.1%
  return Number((value * (1 + r)).toFixed(6));
}

/**
 * Demo FX adapter: returns a slightly jittered copy of the canonical
 * demo base quotes so the UI feels "alive" without making any real
 * HTTP requests.
 */
export default function demoFxAdapter(): FxRibbonQuote[] {
  return DEMO_BASE_QUOTES.map((q) => ({
    ...q,
    price: jitter(q.price),
    change_24h: 0,
    change_24h_pct: 0,
  }));
}
