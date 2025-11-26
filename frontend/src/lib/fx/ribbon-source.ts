// frontend/src/lib/fx/ribbon-source.ts
//
// Client-side entry point for the finance ribbon's FX row.
// Knows about:
//   - free default pair ids (from src/data/selected/fx.pairs.free.json)
//   - live vs demo mode
//   - daily arrow calculation (via calculate.ts)
//   - "force demo" feature flag
//
// It does NOT talk directly to the external FX provider; it calls the internal
// API helper in fetch.ts, which in turn talks to /api/ribbon/fx on the server.

'use client';

import pairsJson from '@/data/fx/pairs.json';
import freePairIdsJson from '@/data/selected/fx.pairs.free.json';
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

/**
 * Helper: read the free default ids from src/data/selected/fx.pairs.free.json,
 * clamp to 5 for the homepage ribbon.
 */
function getFreeDefaultPairIds(): string[] {
  const ids = (freePairIdsJson as string[]) ?? [];
  return ids.slice(0, 5);
}

/**
 * Helper: look up label & metadata for a given pair id.
 */
function findPairConfig(id: string): PairConfig {
  const match = pairs.find((item) => item.id === id);

  if (match) {
    return match;
  }

  // Fallback: synthesise a label from the id, e.g. "gbp-usd" → "GBP / USD".
  const normalised = id.replace(/_/g, '-').toUpperCase();
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
 * - Uses the selected free-tier pair ids when no explicit ids are provided.
 * - If the "force demo" feature flag is set, always returns demo data.
 * - Otherwise:
 *    - tries live snapshots via fetchFxSnapshot;
 *    - falls back to demo values when live fails or returns empty.
 */
export async function getFxRibbonQuotes(explicitIds?: string[]): Promise<FxRibbonLoadResult> {
  const defaultIds = getFreeDefaultPairIds();
  const ids = (explicitIds && explicitIds.length > 0 ? explicitIds : defaultIds).slice(0, 5);

  const FORCE_DEMO =
    process.env.NEXT_PUBLIC_FX_RIBBON_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // In demo mode we do not even attempt to hit the live endpoint.
  if (FORCE_DEMO) {
    const demoSnapshots = buildDemoSnapshots(ids);
    const quotes = mapSnapshotsToRibbonQuotes('demo', demoSnapshots);
    return {
      mode: 'demo',
      quotes,
    };
  }

  try {
    const liveSnapshots = await fetchFxSnapshot(ids);

    if (!Array.isArray(liveSnapshots) || liveSnapshots.length === 0) {
      const demoSnapshots = buildDemoSnapshots(ids);
      const quotes = mapSnapshotsToRibbonQuotes('demo', demoSnapshots);
      return {
        mode: 'demo',
        quotes,
      };
    }

    const quotes = mapSnapshotsToRibbonQuotes('live', liveSnapshots);
    return {
      mode: 'live',
      quotes,
    };
  } catch {
    // Any failure falls back to demo mode; this keeps the ribbon looking
    // healthy even if the FX provider is down.
    const demoSnapshots = buildDemoSnapshots(ids);
    const quotes = mapSnapshotsToRibbonQuotes('demo', demoSnapshots);
    return {
      mode: 'demo',
      quotes,
    };
  }
}
