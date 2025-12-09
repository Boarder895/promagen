// src/lib/finance/fx-client.ts
// -----------------------------------------------------------------------------
// Legacy server-side FX client for Promagen.
//
// NOTE:
// The current production FX pipeline is driven by the API gateway and the
// /api/fx route. This module is kept as a small, self-contained helper so
// that older imports and tests continue to compile and so that we always
// have a deterministic demo snapshot available.
//
// It **never** calls third-party providers directly; it synthesises a
// deterministic demo snapshot from the canonical FX pair catalogue.
// -----------------------------------------------------------------------------

import type { FxPair, FxQuote, FxProviderId } from '@/types/finance-ribbon';
import { FREE_TIER_FX_PAIRS, buildPairCode } from '@/lib/finance/fx-pairs';

type FxSnapshot = {
  quotes: FxQuote[];
  mode: 'demo';
  fetchedAt: number;
};

const DEMO_PROVIDER_ID: FxProviderId = 'demo';

// ... keep whatever other helpers you already have above ...

/**
 * Build a deterministic demo quote for a given pair.
 * This keeps tests stable without depending on real-provider data.
 */
function buildDemoQuote(pair: FxPair, index: number, asOf: string): FxQuote {
  const baseValue = 1 + index * 0.01;
  const mid = Number(baseValue.toFixed(pair.precision));

  return {
    base: pair.base,
    quote: pair.quote,
    pairId: pair.id,
    mid,
    bid: mid,
    ask: mid,
    changeAbs: 0,
    changePct: 0,
    asOf,
    asOfUtc: asOf,
    provider: DEMO_PROVIDER_ID,
    providerSymbol: 'DEMO',
  };
}

/**
 * Fetch a deterministic demo snapshot for the default free FX pairs.
 */
export async function fetchFxSnapshot(): Promise<FxSnapshot> {
  const now = new Date().toISOString();
  const quotes = FREE_TIER_FX_PAIRS.map((pair, index) => buildDemoQuote(pair, index, now));

  return {
    quotes,
    mode: 'demo',
    fetchedAt: Date.now(),
  };
}

/**
 * Convenience helper that returns a simple map from compact FX pair codes
 * (e.g. 'EURUSD') to mid values.
 */
export async function fetchFxMidMap(): Promise<Record<string, number>> {
  const snapshot = await fetchFxSnapshot();
  const result: Record<string, number> = {};

  for (const quote of snapshot.quotes) {
    const [base, quoteCcy] = quote.pairId.split('-');

    // Defensive guards keep TypeScript happy and avoid accidental "undefined"
    // creeping into buildPairCode.
    if (!base || !quoteCcy) {
      continue;
    }

    const code = buildPairCode(base.toUpperCase(), quoteCcy.toUpperCase());
    result[code] = quote.mid;
  }

  return result;
}
