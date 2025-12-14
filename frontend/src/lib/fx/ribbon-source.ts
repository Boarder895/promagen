// C:\Users\Proma\Projects\promagen\frontend\src\lib\fx\ribbon-source.ts
//
// Client-side entry point for the finance ribbon's FX row.
//
// IMPORTANT:
// - Default pair list comes from SSOT (fx.pairs.json via fx-pairs.ts).
// - No hard slice(0, 5). The number of default FREE pairs is SSOT-driven.

'use client';

import pairsJson from '@/data/fx/pairs.json';
import { getFxRibbonPairs } from '@/lib/finance/fx-pairs';
import { buildDemoSnapshots } from './demo-walk';
import type { FxSnapshot } from './fetch';
import { fetchFxSnapshot } from './fetch';

type PairConfig = {
  id: string;
  base: string;
  quote: string;
  label?: string;
  precision?: number;
};

const pairs = pairsJson as PairConfig[];

export type FxRibbonMode = 'live' | 'demo';

export type FxRibbonQuote = {
  id: string; // canonical id, e.g. "gbp-usd"
  base: string;
  quote: string;
  label: string;
  precision: number;
  value: number;
  prevClose: number;
  asOf: string; // ISO-8601 timestamp
};

export type FxRibbonLoadResult = {
  mode: FxRibbonMode;
  quotes: FxRibbonQuote[];
};

function normaliseId(value: string): string {
  return value
    .trim()
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function dedupeKeepOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = normaliseId(raw);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

/**
 * Default FREE ids come from SSOT:
 * - frontend/src/data/fx/fx.pairs.json (isDefaultFree)
 * - joined with pairs.json for metadata
 */
function getFreeDefaultPairIds(): string[] {
  const metas = getFxRibbonPairs({ tier: 'free', order: 'ssot' });
  return metas.map((m) => m.id);
}

/**
 * Helper: look up label & metadata for a given pair id.
 */
function findPairConfig(id: string): PairConfig {
  const match = pairs.find((item) => normaliseId(item.id) === normaliseId(id));
  if (match) return match;

  // Fallback: synthesise a label from the id, e.g. "gbp-usd" → "GBP / USD".
  const normalised = normaliseId(id).toUpperCase();
  const [base, quote] = normalised.split('-');

  return {
    id,
    base: base ?? id.toUpperCase(),
    quote: quote ?? '',
    label: `${base ?? id.toUpperCase()} / ${quote ?? ''}`.trim(),
    precision: 4,
  };
}

/**
 * Map raw FxSnapshot values into FxRibbonQuote objects, attaching metadata.
 */
function mapSnapshotsToRibbonQuotes(_mode: FxRibbonMode, snapshots: FxSnapshot[]): FxRibbonQuote[] {
  return snapshots.map((snapshot) => {
    const meta = findPairConfig(snapshot.id);

    const label = meta.label ?? `${meta.base}/${meta.quote}`;
    const precision =
      typeof meta.precision === 'number' && meta.precision >= 0 ? meta.precision : 4;

    return {
      id: snapshot.id,
      base: meta.base,
      quote: meta.quote,
      label,
      precision,
      value: snapshot.value,
      prevClose: snapshot.prevClose,
      asOf: snapshot.asOf,
    };
  });
}

/**
 * Core loader for the FX ribbon.
 *
 * - Uses SSOT default free-tier ids when no explicit ids are provided.
 * - If the "force demo" feature flag is set, always returns demo data.
 * - Otherwise:
 *    - tries live snapshots via fetchFxSnapshot;
 *    - falls back to demo values when live fails or returns empty.
 */
export async function getFxRibbonQuotes(explicitIds?: string[]): Promise<FxRibbonLoadResult> {
  const defaultIds = getFreeDefaultPairIds();
  const ids = dedupeKeepOrder(explicitIds && explicitIds.length > 0 ? explicitIds : defaultIds);

  const FORCE_DEMO =
    process.env.NEXT_PUBLIC_FX_RIBBON_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // In demo mode we do not even attempt to hit the live endpoint.
  if (FORCE_DEMO) {
    const demoSnapshots = buildDemoSnapshots(ids);
    const quotes = mapSnapshotsToRibbonQuotes('demo', demoSnapshots);
    return { mode: 'demo', quotes };
  }

  try {
    const liveSnapshots = await fetchFxSnapshot(ids);

    if (!Array.isArray(liveSnapshots) || liveSnapshots.length === 0) {
      const demoSnapshots = buildDemoSnapshots(ids);
      const quotes = mapSnapshotsToRibbonQuotes('demo', demoSnapshots);
      return { mode: 'demo', quotes };
    }

    const quotes = mapSnapshotsToRibbonQuotes('live', liveSnapshots);
    return { mode: 'live', quotes };
  } catch {
    const demoSnapshots = buildDemoSnapshots(ids);
    const quotes = mapSnapshotsToRibbonQuotes('demo', demoSnapshots);
    return { mode: 'demo', quotes };
  }
}
