// src/components/ribbon/mini-crypto-widget.tsx

'use client';

import React from 'react';

export type MiniCryptoWidgetProps = {
  title?: string;
};

type CryptoAssetDemo = {
  id: string;
  symbol: string;
  name: string;
};

const DEMO_CRYPTO_ASSETS: CryptoAssetDemo[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum' },
  { id: 'ada', symbol: 'ADA', name: 'Cardano' },
  { id: 'xrp', symbol: 'XRP', name: 'XRP' },
  { id: 'sol', symbol: 'SOL', name: 'Solana' },
];

export default function MiniCryptoWidget({ title = 'Crypto' }: MiniCryptoWidgetProps): JSX.Element {
  return (
    <section
      aria-label="Mini crypto widget"
      className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
    >
      <header className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </span>
      </header>

      <ul data-testid="mini-crypto-widget" className="space-y-1 text-sm">
        {DEMO_CRYPTO_ASSETS.map((asset) => (
          <li key={asset.id} className="flex items-center justify-between">
            <span className="font-medium">
              {asset.symbol} / {asset.name}
            </span>
            <span className="text-xs text-slate-400">—</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
