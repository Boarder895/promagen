// src/components/ribbon/finance-ribbon.tsx
// -----------------------------------------------------------------------------
// Homepage FX ribbon.
//
// Props (kept compatible with existing tests):
//   - demo?: boolean        → when true, no live calls; static labels only
//   - pairIds?: string[]    → optional explicit list of pair IDs
//   - intervalMs?: number   → optional polling hint for live mode
//
// It accepts pair IDs in either form:
//   - "EURUSD"  (no hyphen, upper case)
//   - "eur-usd" (hyphen slug, lower case)
//
// Data-testid remains fx-EURUSD / fx-GBPUSD / etc so your existing
// tests continue to work exactly as before.
// -----------------------------------------------------------------------------

'use client';

import React, { useMemo } from 'react';

import fxPairsJson from '@/data/fx/fx.pairs.json';
import type { FxPair } from '@/types/finance-ribbon';
import { useFxQuotes } from '@/hooks/use-fx-quotes';

export type FinanceRibbonProps = {
  /**
   * When true, the ribbon runs in “demo” mode:
   * - No live FX calls
   * - Safe for logged-out or preview states
   */
  demo?: boolean;

  /**
   * Explicit list of FX pair IDs to show, e.g. ["EURUSD", "GBPUSD"].
   * If omitted, a small, sensible default set is used.
   */
  pairIds?: string[];

  /**
   * Optional polling interval hint for live mode.
   * If omitted, the hook will fall back to 5 minutes, or use the
   * server-supplied nextUpdateAt value when present.
   */
  intervalMs?: number;
};

type FxRow = {
  slug: string; // "eur-usd"
  ticker: string; // "EURUSD"
  label: string; // "EUR/USD"
  precision: number;
};

const ALL_FX_PAIRS = fxPairsJson as FxPair[];

/**
 * Default set when no pairIds are provided:
 * EUR/USD, GBP/USD, EUR/GBP
 */
const DEFAULT_PAIR_SLUGS: string[] = ['eur-usd', 'gbp-usd', 'eur-gbp'];

const FX_ROWS_BY_SLUG: Map<string, FxRow> = buildFxRows(ALL_FX_PAIRS);

function buildFxRows(pairs: FxPair[]): Map<string, FxRow> {
  const map = new Map<string, FxRow>();

  for (const pair of pairs) {
    const slug = String(pair.id).toLowerCase();
    const base = String(pair.base).toUpperCase();
    const quote = String(pair.quote).toUpperCase();
    const ticker = `${base}${quote}`;
    const label = pair.label || `${base}/${quote}`;
    const precision =
      typeof pair.precision === 'number' && Number.isFinite(pair.precision) ? pair.precision : 4;

    map.set(slug, {
      slug,
      ticker,
      label,
      precision,
    });
  }

  return map;
}

/**
 * Normalise an incoming ID to the canonical "base-quote" slug.
 * - "EURUSD"  → "eur-usd"
 * - "eur-usd" → "eur-usd"
 */
function toSlug(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return '';

  if (trimmed.includes('-')) {
    return trimmed.toLowerCase();
  }

  const upper = trimmed.toUpperCase();
  if (upper.length < 6) {
    return upper.toLowerCase();
  }

  const base = upper.slice(0, 3).toLowerCase();
  const quote = upper.slice(3).toLowerCase();

  return `${base}-${quote}`;
}

function formatPrice(value: number | undefined, precision: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return value.toFixed(precision);
}

export default function FinanceRibbon({
  demo = false,
  pairIds,
  intervalMs,
}: FinanceRibbonProps): JSX.Element {
  // Decide which slugs we want to show.
  const slugs = useMemo(() => {
    const explicitIds = pairIds && pairIds.length > 0 ? pairIds : null;

    if (explicitIds) {
      return explicitIds.map(toSlug).filter(Boolean);
    }

    // No pairIds passed – fall back to the default three core pairs.
    return DEFAULT_PAIR_SLUGS.slice();
  }, [pairIds]);

  // Pull live quotes when not in demo mode.
  const { quotesByPairId } = useFxQuotes({
    enabled: !demo,
    intervalMs,
  });

  const rows: FxRow[] = slugs
    .map((slug) => FX_ROWS_BY_SLUG.get(slug) ?? null)
    .filter((row): row is FxRow => row !== null);

  return (
    <section aria-label="FX ribbon">
      <ul className="flex flex-row flex-wrap gap-2">
        {rows.map((row) => {
          const quote = quotesByPairId.get(row.slug);
          const mid = quote?.mid;
          const priceText = demo ? '—' : formatPrice(mid, row.precision);

          return (
            <li
              key={row.slug}
              className="whitespace-nowrap rounded-full bg-white/5 px-3 py-1 text-white/80 shadow-sm ring-1 ring-white/10"
              data-testid={`fx-${row.ticker}`}
            >
              <span className="font-mono tracking-tight">{row.label}</span>
              <span className="ml-2 text-xs tabular-nums text-slate-200">{priceText}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
