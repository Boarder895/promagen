/**
 * Demo FX adapter for Promagen.
 *
 * This adapter does not make any network calls.
 * It returns a fixed, predictable set of FX pairs for use when:
 * - Running locally without real API keys, or
 * - All live providers have failed and the gateway falls back to demo.
 */

import type { ProviderConfig, FxRibbonQuote } from '../index';

export async function fetchDemoFxQuotes(options: {
  provider: ProviderConfig;
  role: string;
}): Promise<FxRibbonQuote[]> {
  // The provider + role are not strictly required for demo data,
  // but they are accepted for parity with real adapters and future extension.
  const { role } = options;

  // You can tailor this per role if needed in future (e.g. more pairs for mini widget),
  // but for now we keep both fx_ribbon and fx_mini_widget on the same predictable set.
  const pairs = getBaseDemoPairs();

  const now = Date.now();

  // Add a tiny, deterministic wobble based on time + pair name
  // so values are not completely static but remain stable and safe.
  const quotes: FxRibbonQuote[] = pairs.map((baseQuote, index) => {
    const jitterSeed = (now / 60000) | 0; // minute-level granularity
    const hash = simpleHash(`${role}:${baseQuote.pair}:${jitterSeed}`);
    const wobble = (hash % 9) / 10000; // up to 0.0008

    const sign = hash % 2 === 0 ? 1 : -1;
    const price = round4(baseQuote.price + sign * wobble);
    const changeAbs = round4(price - baseQuote.price);
    const changePct = baseQuote.price === 0 ? 0 : round4((changeAbs / baseQuote.price) * 100);

    return {
      pair: baseQuote.pair,
      base: baseQuote.base,
      quote: baseQuote.quote,
      price,
      bid: round4(price - 0.0005),
      ask: round4(price + 0.0005),
      change_24h: changeAbs,
      change_24h_pct: changePct,
    };
  });

  return quotes;
}

/**
 * Core, deterministic demo prices for the homepage ribbon.
 * These should be stable over time and represent sensible ballpark FX levels.
 *
 * You can adjust these if you later decide to change which pairs the ribbon shows.
 */
function getBaseDemoPairs(): FxRibbonQuote[] {
  return [
    {
      pair: 'GBPUSD',
      base: 'GBP',
      quote: 'USD',
      price: 1.26,
      bid: 1.2595,
      ask: 1.2605,
      change_24h: 0.0025,
      change_24h_pct: 0.2,
    },
    {
      pair: 'EURUSD',
      base: 'EUR',
      quote: 'USD',
      price: 1.09,
      bid: 1.0895,
      ask: 1.0905,
      change_24h: -0.0015,
      change_24h_pct: -0.14,
    },
    {
      pair: 'USDJPY',
      base: 'USD',
      quote: 'JPY',
      price: 148.2,
      bid: 148.18,
      ask: 148.22,
      change_24h: 0.35,
      change_24h_pct: 0.24,
    },
    {
      pair: 'USDCAD',
      base: 'USD',
      quote: 'CAD',
      price: 1.35,
      bid: 1.3495,
      ask: 1.3505,
      change_24h: -0.001,
      change_24h_pct: -0.07,
    },
    {
      pair: 'AUDUSD',
      base: 'AUD',
      quote: 'USD',
      price: 0.66,
      bid: 0.6595,
      ask: 0.6605,
      change_24h: 0.0018,
      change_24h_pct: 0.27,
    },
  ];
}

/**
 * Very small, deterministic hash for jittering demo prices.
 * Not cryptographic, just enough to produce stable pseudo-randomness.
 */
function simpleHash(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
