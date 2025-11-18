// src/components/ribbon/mini-fx-widget.tsx

import React from 'react';

import countryCurrencyMap from '@/data/fx/country-currency.map.json';
import { flag } from '@/lib/flags';
import { getFreeFxSelection } from '@/lib/ribbon/selection';
import type { FxPair } from '@/types/finance-ribbon';

export type MiniFxWidgetProps = {
  title?: string;
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

export default function MiniFxWidget({ title = 'FX pairs' }: MiniFxWidgetProps): JSX.Element {
  const selection = getFreeFxSelection();
  const items: FxPair[] = selection.items.slice(0, 5);

  return (
    <section
      aria-label="Mini FX widget"
      className="rounded-2xl bg-slate-900 px-3 py-2 text-xs text-slate-50 shadow-sm ring-1 ring-slate-800"
    >
      <header className="mb-1 flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">Free set snapshot</p>
      </header>

      <ul className="flex flex-wrap gap-1.5" data-testid="mini-fx-widget">
        {items.map((pair) => {
          const baseFlagEmoji = currencyFlag(pair.base);
          const quoteFlagEmoji = currencyFlag(pair.quote);

          return (
            <li
              key={pair.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 ring-1 ring-white/10"
            >
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                <span>{baseFlagEmoji}</span>
                <span>{quoteFlagEmoji}</span>
              </span>

              <span className="font-mono text-[11px]">{pair.label}</span>

              <span className="text-[10px] text-slate-200">
                {pair.base}/{pair.quote}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
