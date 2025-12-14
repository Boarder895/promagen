// C:\Users\Proma\Projects\promagen\gateway\lib\types.ts

export type FxMode = 'live' | 'cached';

export type FxRibbonPair = {
  id: string; // e.g. "gbp-usd"
  base: string; // "GBP"
  quote: string; // "USD"
  label: string; // "GBP / USD"
  category?: string; // keep optional to avoid SSOT/type fights
};

export type FxRibbonQuote = {
  pair: string; // pair id, e.g. "gbp-usd"
  base: string;
  quote: string;
  label: string;
  price: number;

  // Optional extras (providers may supply)
  change?: number | null;
  changePct?: number | null;
  timestamp?: number | null;
};

// Back-compat name used by gateway/index.ts
export type FxRibbonPairQuote = FxRibbonQuote;

export type FxRibbonResult = {
  mode: FxMode;
  sourceProvider: string;
  pairs: FxRibbonPairQuote[];
};

// What gateway passes into adapters
export type FxAdapterRequest = {
  roleId: string;
  requestedPairs: FxRibbonPair[];
};

// What adapters must return
export type FxAdapterResponse = {
  providerId: string;
  mode: 'live';
  pairs: FxRibbonPairQuote[];
};
