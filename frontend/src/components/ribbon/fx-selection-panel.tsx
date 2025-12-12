// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\fx-selection-panel.tsx
//
// FX selection panel (SSOT-driven).
//
// True SSOT behaviour:
// - The list of available pairs comes ONLY from src/data/fx/fx-ribbon.pairs.json
// - If you edit that one file, this panel updates automatically.
// - No demo mode. No synthetic values.

'use client';

import React, { useMemo } from 'react';

import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { useFxSelection } from '@/hooks/use-fx-selection';
import { assertFxRibbonSsotValid, buildSlashPair, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

export interface FxSelectionPanelProps {
  intervalMs?: number;
}

function normaliseCode(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase();
}

function formatPrice(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(4);
}

export function FxSelectionPanel({ intervalMs }: FxSelectionPanelProps) {
  const { status, quotesByProviderSymbol } = useFxQuotes({ intervalMs });
  const { pairIds } = useFxSelection();

  const derived = useMemo(() => {
    assertFxRibbonSsotValid();
    const ssotPairs = getFxRibbonPairs();

    const allowed = new Map<string, (typeof ssotPairs)[number]>();
    for (const p of ssotPairs) {
      allowed.set(normaliseCode(p.id), p);
    }

    const requested = Array.isArray(pairIds) ? pairIds.map((x) => normaliseCode(String(x))) : [];
    const pickedCodes = requested.filter((code) => allowed.has(code));

    const pairsToShow = pickedCodes.length
      ? pickedCodes.map((code) => allowed.get(code)!).filter(Boolean)
      : ssotPairs;

    const statusLabel =
      status === 'idle' || status === 'loading'
        ? 'loading'
        : status === 'error'
        ? 'unavailable'
        : 'live';

    const rows = pairsToShow.map((p) => {
      const code = normaliseCode(p.id);
      const quote = quotesByProviderSymbol.get(code) ?? null;

      return {
        key: code,
        display: buildSlashPair(p.base, p.quote),
        statusLabel,
        value: formatPrice(quote?.price ?? null),
      };
    });

    return { rows };
  }, [pairIds, quotesByProviderSymbol, status]);

  return (
    <section aria-label="Foreign exchange rates">
      <ul className="flex flex-row flex-wrap gap-2">
        {derived.rows.map((row) => (
          <li
            key={row.key}
            data-testid={`fx-${row.key}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-medium"
          >
            <span className="font-semibold">{row.display}</span>
            <span className="text-slate-400">{row.statusLabel}</span>
            <span className="text-xs text-slate-300 tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default FxSelectionPanel;
