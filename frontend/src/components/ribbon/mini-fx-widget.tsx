// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\mini-fx-widget.tsx
//
// Mini FX widget (SSOT-driven).
//
// True SSOT behaviour:
// - Default pairs come ONLY from src/data/fx/fx-ribbon.pairs.json
// - If you edit that one file, the widget changes automatically.
// - No demo mode. No synthetic values.

'use client';

import React, { useMemo } from 'react';

import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { assertFxRibbonSsotValid, buildSlashPair, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

interface MiniFxWidgetProps {
  title?: string;
  intervalMs?: number;
}

function normaliseCode(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase();
}

function formatPrice(value: number | null, isLoading: boolean): string {
  if (isLoading) return '…';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(4);
}

export function MiniFxWidget({ title = 'FX', intervalMs }: MiniFxWidgetProps) {
  const { status, quotesByProviderSymbol } = useFxQuotes({ intervalMs });
  const isLoading = status === 'idle' || status === 'loading';

  const rows = useMemo(() => {
    assertFxRibbonSsotValid();
    const pairs = getFxRibbonPairs();

    return pairs.map((p) => {
      const code = normaliseCode(p.id);
      const quote = quotesByProviderSymbol.get(code) ?? null;

      return {
        key: code,
        label: buildSlashPair(p.base, p.quote),
        value: formatPrice(quote?.price ?? null, isLoading),
      };
    });
  }, [quotesByProviderSymbol, isLoading]);

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
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between">
            <span className="font-medium">{row.label}</span>
            <span className="text-xs text-slate-400 tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MiniFxWidget;
