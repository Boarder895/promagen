// gateway/adapters/demo.fx.quote_short.ts

import type { RoleAdapter, RoleAdapterContext } from '../lib/adapters';

/**
 * One FX pair quote for the ribbon.
 */
export interface FxRibbonPairQuote {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  change: number;
  changePct: number;
  timestamp: string;
}

/**
 * Parameters accepted by the FX ribbon role.
 */
export interface FxRibbonParams {
  /**
   * List of FX pairs in "BASEQUOTE" format, e.g. "EURUSD".
   * If omitted, the adapter will fall back to a sensible default set.
   */
  pairs?: string[];
}

/**
 * Normalised payload returned by the FX ribbon adapter.
 */
export interface FxRibbonData {
  pairs: FxRibbonPairQuote[];
}

/**
 * Static demo quotes used for UI development and testing.
 * These values are intentionally simple and stable.
 */
const DEMO_QUOTES: Record<
  string,
  {
    bid: number;
    ask: number;
    mid: number;
    change: number;
    changePct: number;
  }
> = {
  EURUSD: {
    bid: 1.0849,
    ask: 1.0851,
    mid: 1.085,
    change: 0.0005,
    changePct: 0.046,
  },
  GBPUSD: {
    bid: 1.2695,
    ask: 1.2699,
    mid: 1.2697,
    change: -0.0008,
    changePct: -0.063,
  },
  USDJPY: {
    bid: 150.12,
    ask: 150.16,
    mid: 150.14,
    change: 0.23,
    changePct: 0.153,
  },
  EURGBP: {
    bid: 0.8532,
    ask: 0.8535,
    mid: 0.8534,
    change: 0.0002,
    changePct: 0.023,
  },
};

/**
 * Demo adapter for the "demo.fx.quote_short" endpoint.
 * This does not call any external API – it just returns static data.
 */
export const demoFxQuoteShortAdapter: RoleAdapter<FxRibbonData, FxRibbonParams> = async (
  context: RoleAdapterContext<FxRibbonParams>,
): Promise<FxRibbonData> => {
  const nowIso = new Date().toISOString();

  const requestedPairs =
    context.params?.pairs && context.params.pairs.length > 0
      ? context.params.pairs
      : ['EURUSD', 'GBPUSD', 'USDJPY'];

  const pairs: FxRibbonPairQuote[] = requestedPairs.map((pair) => {
    const base =
      DEMO_QUOTES[pair] ??
      ({
        bid: 1.0,
        ask: 1.0,
        mid: 1.0,
        change: 0,
        changePct: 0,
      } as const);

    return {
      pair,
      bid: base.bid,
      ask: base.ask,
      mid: base.mid,
      change: base.change,
      changePct: base.changePct,
      timestamp: nowIso,
    };
  });

  return { pairs };
};
