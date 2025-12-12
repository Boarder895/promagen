// C:\Users\Proma\Projects\promagen\frontend\src\types\finance-ribbon.ts
//
// Finance ribbon types.
// This file is the type contract used by the FX API route + ribbon UI.
//
// Rules for this phase:
// - Demo mode is not supported for FX anymore.
// - Keep this compatible with existing runtime code while we remove legacy/demo references.
// - SSOT lives in src/data/* (pairs, defaults, etc). This file must not hard-code pair lists.

export type FxApiRole = 'fx_ribbon';

/**
 * Demo is intentionally excluded.
 * If any file still tries to use "demo", TypeScript should shout — that’s the point.
 */
export type FxApiMode = 'live' | 'fallback' | 'cached';

export type FxProviderId = string;

export type FxPairId = string;

export interface FxPair {
  id: FxPairId;
  base: string;
  quote: string;
  label?: string;
  category?: string;
  emoji?: string;
}

/**
 * Canonical FX quote shape returned by /api/fx (frontend contract).
 */
export interface FxApiQuote {
  id: string; // e.g. "GBPUSD"
  base: string; // e.g. "GBP"
  quote: string; // e.g. "USD"
  label: string; // e.g. "GBP/USD"
  category: string; // e.g. "fx_major"

  price: number | null;
  change: number | null;
  changePct: number | null;
}

export interface FxApiMeta {
  buildId: string;
  mode: FxApiMode;
  sourceProvider: string;
  asOf: string;
}

export interface FxApiResponse {
  meta: FxApiMeta;
  data: FxApiQuote[];
  error?: string;
}

/**
 * Compatibility aliases used by some components/helpers.
 * These should slowly converge on the canonical FxApi* contract.
 */
export type FxQuote = FxApiQuote & {
  // Legacy/compat fields used in some helpers (optional on purpose)
  pairId?: string; // e.g. "gbp-usd"
  pair?: string; // e.g. "GBP/USD"
  providerSymbol?: string; // e.g. "GBPUSD"
  provider?: FxProviderId;
  asOf?: string;
  asOfUtc?: string;
  mid?: number;
  bid?: number;
  ask?: number;
};

export interface FxQuotesPayload {
  meta?: FxApiMeta;
  data: FxQuote[];
  quotes?: FxQuote[];

  // Legacy top-level fallbacks (keep optional)
  buildId?: string;
  mode?: FxApiMode;
  sourceProvider?: string;
  asOf?: string;
}

// ----------------------------------------------------------------------------
// Commodity/Crypto placeholders (so non-FX runtime code compiles cleanly)
// ----------------------------------------------------------------------------

export type CommodityId = string;

export interface Commodity {
  id: CommodityId;
  name?: string;
  symbol?: string;
  group?: string;
}

export type CommoditySelectionReason = 'too-few-items' | 'too-many-items' | 'bad-distribution';

export interface CommoditySelectionValidation {
  isValid: boolean;
  reason?: CommoditySelectionReason;
  centreGroupId?: string;
  errors?: string[];
}

export type CryptoId = string;

export interface CryptoAsset {
  id: CryptoId;
  symbol?: string;
  name?: string;
}
