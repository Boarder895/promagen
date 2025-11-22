'use client';

import React from 'react';

import { useFxQuotes } from '@/hooks/use-fx-quotes';
import {
  FREE_TIER_FX_PAIRS,
  DEFAULT_FREE_FX_PAIR_IDS,
  buildPairCode,
  type FxPairConfig,
} from '@/lib/finance/fx-pairs';

interface MiniFxWidgetProps {
  /**
   * Optional explicit list of FX codes, e.g. ['EURUSD', 'GBPUSD'].
   * When omitted, we fall back to the default free-tier selection.
   */
  pairIds?: string[];
  title?: string;
}

function buildDefaultFreePairs(): FxPairConfig[] {
  const byId = new Map<string, FxPairConfig>();

  for (const pair of FREE_TIER_FX_PAIRS) {
    byId.set(pair.id, pair);
  }

  return DEFAULT_FREE_FX_PAIR_IDS.map((id) => byId.get(id)).filter((pair): pair is FxPairConfig =>
    Boolean(pair),
  );
}

const DEFAULT_WIDGET_PAIRS: FxPairConfig[] = buildDefaultFreePairs();

/**
 * Resolve an optional list of FX codes (e.g. 'EURUSD') into concrete pair
 * configs. When nothing is supplied or we can't resolve any codes, we fall
 * back to the canonical free-tier set.
 */
function resolvePairs(pairIds?: string[]): FxPairConfig[] {
  if (!pairIds || pairIds.length === 0) {
    return DEFAULT_WIDGET_PAIRS;
  }

  const byCode = new Map<string, FxPairConfig>();

  for (const pair of FREE_TIER_FX_PAIRS) {
    const code = buildPairCode(pair.base, pair.quote);
    byCode.set(code, pair);
  }

  const resolved: FxPairConfig[] = [];

  for (const raw of pairIds) {
    const key = raw.toUpperCase();
    const match = byCode.get(key);

    if (match) {
      resolved.push(match);
    }
  }

  return resolved.length > 0 ? resolved : DEFAULT_WIDGET_PAIRS;
}

export function MiniFxWidget({ pairIds, title = 'FX' }: MiniFxWidgetProps) {
  const { status, quotesByPairId } = useFxQuotes();
  const isLoading = status === 'idle' || status === 'loading';

  // Mini widget is always capped to 5 pairs for a compact layout.
  const pairs = resolvePairs(pairIds).slice(0, 5);

  return (
    <section
      aria-label="FX mini widget"
      className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
    >
      <header className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </span>
      </header>

      <ul data-testid="mini-fx-widget" className="space-y-1 text-sm">
        {pairs.map((pair) => {
          const code = buildPairCode(pair.base, pair.quote);
          const quote = quotesByPairId.get(code);
          const mid = quote?.mid;

          const value = typeof mid === 'number' ? mid.toFixed(4) : isLoading ? '…' : '—';

          return (
            <li key={pair.id ?? code} className="flex items-center justify-between">
              <span className="font-medium">
                {pair.base}/{pair.quote}
              </span>
              <span className="text-xs text-slate-400">{value}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default MiniFxWidget;
