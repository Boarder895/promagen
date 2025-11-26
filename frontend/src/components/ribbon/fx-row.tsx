// frontend/src/components/ribbon/fx-row.tsx
'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { FxRibbonLoadResult, FxRibbonQuote } from '@/lib/fx/ribbon-source';
import { getFxRibbonQuotes } from '@/lib/fx/ribbon-source';
import { getWinningCurrency, type WinningCurrencyResult } from '@/lib/fx';
import { srOnboardingText } from '@/lib/fx/text';
import FxChip from './fx-chip';

type FxRowState =
  | { status: 'idle' | 'loading' }
  | { status: 'loaded'; data: FxRibbonLoadResult }
  | { status: 'error' };

function isLoaded(state: FxRowState): state is { status: 'loaded'; data: FxRibbonLoadResult } {
  return state.status === 'loaded';
}

function buildSkeletonKeys(count: number): number[] {
  return Array.from({ length: count }, (_v, index) => index);
}

function buildWinnerForQuote(quote: FxRibbonQuote): WinningCurrencyResult {
  return getWinningCurrency({
    pairId: quote.id,
    current: quote.value,
    prevClose: quote.prevClose,
  });
}

export function FxRow(): ReactElement {
  const [state, setState] = useState<FxRowState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: 'loading' });

      try {
        const data = await getFxRibbonQuotes();
        if (!cancelled) {
          setState({ status: 'loaded', data });
        }
      } catch {
        // getFxRibbonQuotes already falls back to demo on failure; if this
        // block is reached we simply expose an error state.
        if (!cancelled) {
          setState({ status: 'error' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = state.status === 'idle' || state.status === 'loading';
  const isError = state.status === 'error';

  const mode = isLoaded(state) ? state.data.mode : 'demo';
  const quotes: FxRibbonQuote[] = isLoaded(state) ? state.data.quotes : [];

  const skeletonKeys = buildSkeletonKeys(5);

  return (
    <section aria-label="Foreign exchange row" className="space-y-2">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Foreign exchange
        </h2>
        <p className="text-[11px] text-slate-400">
          {mode === 'live' ? 'Live FX' : 'Sample FX values, illustrative only'}
        </p>
      </header>

      <p className="sr-only" aria-live="polite">
        {srOnboardingText()}
      </p>

      {isError && (
        <p className="text-xs text-amber-400">
          FX values are temporarily unavailable; showing demo data instead.
        </p>
      )}

      <div className="flex gap-2" role="list">
        {isLoading &&
          skeletonKeys.map((key) => (
            <div
              key={key}
              className="flex min-h-[44px] flex-1 animate-pulse rounded-full border border-slate-800/80 bg-slate-900/40"
            />
          ))}

        {!isLoading &&
          quotes.map((quote) => {
            const winner = buildWinnerForQuote(quote);

            return (
              <FxChip
                key={quote.id}
                quote={quote}
                winnerSide={winner.winnerSide}
                showArrow={winner.direction === 'up'}
              />
            );
          })}
      </div>
    </section>
  );
}

export default FxRow;
