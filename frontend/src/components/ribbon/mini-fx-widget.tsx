// src/components/ribbon/mini-fx-widget.tsx
'use client';

import React from 'react';

import countryCurrencyMap from '@/data/fx/country-currency.map.json';
import { flag } from '@/lib/flags';
import { getFreeFxSelection } from '@/lib/ribbon/selection';
import { useFxQuotes } from '@/hooks/use-fx-quotes';
import type { FxPair } from '@/types/finance-ribbon';

export type MiniFxWidgetProps = {
  title?: string;
  /**
   * When true, the widget stays in demo mode:
   * - No live FX calls
   * - Prices rendered as "—"
   */
  demo?: boolean;
};

type CountryCurrencyMap = Record<string, string>;

/**
 * Build a stable currency → country map from the ISO2 → CCY map.
 * We only care about having one sensible country per currency for flag purposes.
 */
const CURRENCY_TO_COUNTRY: Record<string, string> = buildCurrencyToCountryMap(
  countryCurrencyMap as CountryCurrencyMap,
);

function buildCurrencyToCountryMap(map: CountryCurrencyMap): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [countryCode, currencyCode] of Object.entries(map)) {
    const upperCurrency = String(currencyCode).trim().toUpperCase();
    if (!upperCurrency) continue;

    // First hit wins so the mapping is deterministic but simple.
    if (!result[upperCurrency]) {
      result[upperCurrency] = countryCode;
    }
  }

  return result;
}

function currencyFlag(currencyCode: string): string {
  const upper = String(currencyCode).trim().toUpperCase();
  if (!upper) return '❓';

  const countryCode = CURRENCY_TO_COUNTRY[upper];
  if (!countryCode) return '❓';

  return flag(countryCode);
}

function formatPrice(value: number | undefined, precision: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return value.toFixed(precision);
}

export default function MiniFxWidget({
  title = 'FX pairs',
  demo = false,
}: MiniFxWidgetProps): JSX.Element {
  const selection = getFreeFxSelection();
  const items: FxPair[] = selection.items.slice(0, 5);

  // Share the same FX feed as the main ribbon.
  const { status, quotesByPairId } = useFxQuotes({
    enabled: !demo,
  });

  const statusLabel = demo
    ? 'Demo'
    : status === 'ready'
      ? 'Live'
      : status === 'loading'
        ? 'Loading'
        : status === 'error'
          ? 'Offline'
          : 'Waiting';

  return (
    <section
      aria-label="Mini FX widget"
      className="rounded-2xl bg-slate-900 px-3 py-2 text-xs text-slate-50 shadow-sm ring-1 ring-slate-800"
    >
      <header className="mb-1 flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{statusLabel}</span>
      </header>

      <ul className="flex flex-col gap-1.5" data-testid="mini-fx-widget">
        {items.map((pair) => {
          const baseFlagEmoji = currencyFlag(pair.base);
          const quoteFlagEmoji = currencyFlag(pair.quote);

          const slug = String(pair.id).toLowerCase();
          const quote = quotesByPairId.get(slug);
          const valueText = !demo && quote ? formatPrice(quote.mid, pair.precision) : '—';

          return (
            <li
              key={pair.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/40 px-2 py-1"
            >
              <span className="flex items-center gap-1 text-[11px]" aria-hidden="true">
                <span>{baseFlagEmoji}</span>
                <span className="text-slate-500">→</span>
                <span>{quoteFlagEmoji}</span>
              </span>

              <span className="flex flex-col items-end">
                <span className="font-mono text-[11px]">{pair.label}</span>
                <span className="text-[10px] text-slate-200">{valueText}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
