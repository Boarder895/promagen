// C:\Users\Proma\Projects\promagen\gateway\adapters\demo.fx.ts

import type { FxRibbonQuote } from '..';

/**
 * Demo FX adapter.
 *
 * No network calls, no keys, just safe sample values for the 5 ribbon pairs:
 * GBP/USD, EUR/USD, GBP/EUR, USD/JPY, USD/CNY.
 */

const BASE_DEMO_QUOTES: FxRibbonQuote[] = [
  {
    base: 'GBP',
    quote: 'USD',
    price: 1.26,
    change_24h: 0.0025,
    change_24h_pct: 0.2,
    providerSymbol: 'GBPUSD',
  },
  {
    base: 'EUR',
    quote: 'USD',
    price: 1.09,
    change_24h: -0.001,
    change_24h_pct: -0.09,
    providerSymbol: 'EURUSD',
  },
  {
    base: 'GBP',
    quote: 'EUR',
    price: 1.16,
    change_24h: 0.0008,
    change_24h_pct: 0.07,
    providerSymbol: 'GBPEUR',
  },
  {
    base: 'USD',
    quote: 'JPY',
    price: 151.2,
    change_24h: 0.4,
    change_24h_pct: 0.26,
    providerSymbol: 'USDJPY',
  },
  {
    base: 'USD',
    quote: 'CNY',
    price: 7.18,
    change_24h: -0.003,
    change_24h_pct: -0.04,
    providerSymbol: 'USDCNY',
  },
];

/**
 * Very small jitter so the UI isn’t completely static.
 */
function jitterPrice(price: number): number {
  const maxJitter = price * 0.001; // 0.1%
  const delta = (Math.random() - 0.5) * 2 * maxJitter;
  return Number((price + delta).toFixed(5));
}

export default function demoFxAdapter(): FxRibbonQuote[] {
  return BASE_DEMO_QUOTES.map((q) => ({
    ...q,
    price: jitterPrice(q.price),
  }));
}
