// src/components/ribbon/mini-crypto-widget.tsx

import React from 'react';

import { getFreeCryptoSelection } from '@/lib/ribbon/selection';
import type { CryptoAsset } from '@/types/finance-ribbon';

export type MiniCryptoWidgetProps = {
  title?: string;
};

function cryptoMonogram(symbol: string): string {
  const safe = String(symbol).trim();
  if (!safe) return '?';

  // Keep it short and readable; most crypto tickers are 3–4 chars anyway.
  if (safe.length <= 3) {
    return safe.toUpperCase();
  }

  return safe.slice(0, 3).toUpperCase();
}

export default function MiniCryptoWidget({ title = 'Crypto' }: MiniCryptoWidgetProps): JSX.Element {
  const selection = getFreeCryptoSelection();
  const items: CryptoAsset[] = selection.items.slice(0, 5);

  return (
    <section
      aria-label="Mini crypto widget"
      className="rounded-2xl bg-slate-900 px-3 py-2 text-xs text-slate-50 shadow-sm ring-1 ring-slate-800"
    >
      <header className="mb-1 flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">Free set snapshot</p>
      </header>

      <ul className="flex flex-wrap gap-1.5" data-testid="mini-crypto-widget">
        {items.map((asset) => (
          <li
            key={asset.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 ring-1 ring-white/10"
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold uppercase"
              aria-hidden="true"
            >
              {cryptoMonogram(asset.symbol)}
            </span>

            <span className="font-mono text-[11px]">{asset.symbol}</span>
            <span className="text-[10px] text-white/70">{asset.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
