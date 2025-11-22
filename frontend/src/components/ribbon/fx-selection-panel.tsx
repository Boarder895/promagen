// src/components/ribbon/finance-ribbon.tsx

'use client';

import React from 'react';
import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { useFxSelection } from '@/hooks/use-fx-selection';
import {
  FREE_TIER_FX_PAIRS,
  getAllFxPairs,
  buildPairCode,
  type FxPairConfig,
} from '@/lib/finance/fx-pairs';

export interface FinanceRibbonProps {
  /**
   * Demo mode is used in Jest tests and any static storybook/demo.
   * In this mode we do NOT call hooks that touch window/localStorage.
   */
  demo?: boolean;
  /**
   * Optional explicit list of pair codes, e.g. ['EURUSD', 'USDJPY'].
   * In demo mode this filters the rendered chips.
   */
  pairIds?: string[];
  /**
   * Optional polling interval override for live FX fetching.
   * The hook is free to ignore this if it has its own backoff logic.
   */
  intervalMs?: number;
}

/**
 * Map an optional list of codes like ['EURUSD'] to concrete FxPairConfig items.
 * Falls back to the free-tier pairs if nothing matches.
 */
function resolvePairsForCodes(codes?: string[]): FxPairConfig[] {
  const catalogue = getAllFxPairs();

  if (!codes || codes.length === 0) {
    return FREE_TIER_FX_PAIRS;
  }

  const byCode = new Map<string, FxPairConfig>();

  for (const pair of catalogue) {
    const code = buildPairCode(pair.base, pair.quote);
    byCode.set(code, pair);
  }

  const resolved: FxPairConfig[] = [];

  for (const raw of codes) {
    const key = raw.toUpperCase();
    const match = byCode.get(key);
    if (match) {
      resolved.push(match);
    }
  }

  return resolved.length ? resolved : FREE_TIER_FX_PAIRS;
}

function DemoFxRow(props: { pairIds?: string[] }) {
  const pairs = resolvePairsForCodes(props.pairIds);

  return (
    <section aria-label="Foreign exchange rates (demo)">
      <ul className="flex flex-row flex-wrap gap-2">
        {pairs.map((pair) => {
          const code = buildPairCode(pair.base, pair.quote);
          return (
            <li
              key={pair.id ?? code}
              data-testid={`fx-${code}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-3 py-1 text-xs font-medium"
            >
              <span className="font-semibold">
                {pair.base}/{pair.quote}
              </span>
              <span className="text-slate-400">demo</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LiveFxRow(props: { intervalMs?: number }) {
  const { pairIds } = useFxSelection();
  const pairs = resolvePairsForCodes(pairIds);

  const { status, error, quotesByPairId } = useFxQuotes(
    props.intervalMs != null ? { intervalMs: props.intervalMs } : undefined,
  );

  const isLoading = status === 'idle' || status === 'loading';

  if (status === 'error' && error && process.env.NODE_ENV !== 'production') {
    console.error('[FinanceRibbon] FX error:', error);
  }

  return (
    <section aria-label="Foreign exchange rates">
      <ul className="flex flex-row flex-wrap gap-2">
        {pairs.map((pair) => {
          const code = buildPairCode(pair.base, pair.quote);
          const hasQuote = Boolean(quotesByPairId?.has(code));
          const statusLabel = isLoading ? '…' : hasQuote ? 'live' : '—';

          return (
            <li
              key={pair.id ?? code}
              data-testid={`fx-${code}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-medium"
            >
              <span className="font-semibold">
                {pair.base}/{pair.quote}
              </span>
              <span className="text-slate-400">{statusLabel}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FinanceRibbon({ demo, pairIds, intervalMs }: FinanceRibbonProps) {
  // Important: early return BEFORE any hooks so demo mode does not touch
  // user-plan or localStorage in Jest / SSR.
  if (demo) {
    return <DemoFxRow pairIds={pairIds} />;
  }

  return <LiveFxRow intervalMs={intervalMs} />;
}

export default FinanceRibbon;
