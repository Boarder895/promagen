// C:\Users\Proma\Projects\promagen\frontend\src\types\finance-ribbon.d.ts
//
// Central type definitions for the finance ribbon and related helpers.
// This file is deliberately framework-agnostic so it can be imported from
// components, hooks and pure helper modules without causing React coupling.

// ---------------------------------------------------------------------------
// Core id types
// ---------------------------------------------------------------------------

export type FxPairId = string;
export type CommodityId = string;
export type CryptoId = string;

// ---------------------------------------------------------------------------
// FX core types
// ---------------------------------------------------------------------------

/**
 * Canonical description of an FX pair in Promagen.
 */
export interface FxPair {
  id: FxPairId;
  base: string; // e.g. "GBP"
  quote: string; // e.g. "USD"
  /**
   * Human-readable label, e.g. "GBP / USD".
   */
  label: string;
  /**
   * Number of decimal places to display.
   */
  precision: number;

  /**
   * Optional country codes that can be used for flag lookups.
   */
  baseCountryCode?: string;
  quoteCountryCode?: string;

  /**
   * Optional grouping metadata (core / extended / exotic, etc.).
   */
  group?: string;
  subgroup?: string;
}

/**
 * Identifier for an FX data provider (e.g. "fmp", "twelvedata", "demo").
 */
export type FxProviderId = string;

/**
 * Normalised FX quote used throughout the frontend.
 *
 * NOTE: We keep this broad enough to cover both the /api/fx route and
 * any future mini-widgets. Some properties may legitimately be missing
 * for demo / fallback data.
 */
export interface FxQuote {
  /**
   * Stable identifier for this quote, usually the compact pair string
   * like "GBPUSD" or a slug like "gbp-usd".
   */
  pairId: FxPairId;

  base: string;
  quote: string;

  /**
   * Mid price for the pair.
   */
  mid: number;

  /**
   * Optional bid / ask when available.
   */
  bid?: number;
  ask?: number;

  /**
   * Absolute and percentage change vs previous close, when known.
   */
  changeAbs?: number;
  changePct?: number;

  /**
   * ISO timestamp from the provider.
   */
  asOf: string;

  /**
   * Optional UTC-normalised timestamp for convenience.
   */
  asOfUtc?: string;

  /**
   * Provider that produced this quote.
   */
  provider: FxProviderId;

  /**
   * Short provider symbol for UI display (e.g. "FMP", "TD", "DEMO").
   */
  providerSymbol?: string;
}

/**
 * Ribbon mode used in the UI and payload metadata.
 */
export type RibbonMode = 'live' | 'demo' | 'fallback' | 'cached';

/**
 * Minimal metadata that accompanies an FX quotes payload.
 */
export interface FxQuotesMeta {
  /**
   * How the data was produced – live, demo, fallback, cached, etc.
   */
  mode: RibbonMode;

  /**
   * Optional build identifier so tests can assert stable contracts.
   */
  buildId?: string;

  /**
   * When the data was generated (UTC).
   */
  asOfUtc?: string;

  /**
   * When the next automatic refresh should occur, if known.
   */
  nextUpdateAt?: string | null;

  /**
   * Provider that produced the payload, if applicable.
   */
  sourceProviderId?: FxProviderId;

  /**
   * Logical role for the payload, e.g. "fx_ribbon".
   */
  role?: string;

  /**
   * Preferred provider id for the role (from roles.policies.json).
   */
  primaryProviderId?: FxProviderId;
}

/**
 * Contract for the FX payload returned by /api/fx as seen by hooks.
 *
 * NOTE:
 * - `quotes`, `mode` and `nextUpdateAt` are optional because older
 *   versions of the route only exposed `meta` + `data.pairs`. Code that
 *   consumes them should handle `undefined` gracefully.
 */
export interface FxQuotesPayload {
  meta: FxQuotesMeta;
  /**
   * Optional flattened quotes list for newer clients.
   */
  quotes?: FxQuote[];

  /**
   * Convenience top-level copy of `meta.mode` for legacy callers.
   */
  mode?: RibbonMode;

  /**
   * Optional server-suggested next refresh time.
   */
  nextUpdateAt?: string | null;
}

/**
 * DTO used specifically by the finance ribbon component. For now this is
 * an alias of FxQuote so that the component can evolve independently from
 * the raw payload if needed.
 */
export type FxRibbonQuoteDto = FxQuote;

// ---------------------------------------------------------------------------
// Commodities
// ---------------------------------------------------------------------------

export interface Commodity {
  id: CommodityId;
  name: string;
  /**
   * Top-level group, e.g. "energy", "metals", "agriculture".
   */
  group: string;
  /**
   * Optional subgroup for more detailed grouping (e.g. "precious").
   */
  subgroup?: string;
  symbol?: string;
  unit?: string;

  /**
   * Whether this commodity is currently active/visible.
   */
  isActive?: boolean;

  /**
   * Flags used by the free / paid finance ribbon presets.
   */
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;

  /**
   * Optional sort priority – lower numbers appear first.
   */
  priority?: number;
}

/**
 * Simple catalogue wrapper used by some helpers.
 */
export interface CommoditiesCatalog {
  items: Commodity[];
}

// ---------------------------------------------------------------------------
// Crypto assets
// ---------------------------------------------------------------------------

/**
 * Canonical crypto asset description used by the ribbon selectors.
 */
export interface CryptoAsset {
  id: CryptoId;
  symbol: string; // e.g. "BTC"
  name: string; // e.g. "Bitcoin"
  /**
   * Optional group, e.g. "layer1", "stablecoin", "defi".
   */
  group?: string;
  /**
   * Optional sort priority – lower numbers appear first.
   */
  priority?: number;
  /**
   * Flags to drive free / paid defaults.
   */
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
}

// ---------------------------------------------------------------------------
// Generic ribbon selection types
// ---------------------------------------------------------------------------

/**
 * Aggregate counters for a selection operation.
 */
export interface SelectionCounts {
  requested: number;
  matched: number;
  selected: number;
  extras: number;
  missing: number;
}

/**
 * Generic selection result for ribbon-style UIs.
 *
 * TItem – the concrete item type (FX pair, commodity, crypto asset, etc.)
 * TId   – the ID type used to address items (usually string).
 */
export interface SelectionResult<TItem, TId extends string | number = string> {
  /**
   * Items that made it into the final selection, in display order.
   */
  items: TItem[];
  /**
   * IDs that the caller originally requested (after normalisation).
   */
  requestedIds: TId[];
  /**
   * IDs that were requested but could not be included because the
   * selection cap was exceeded.
   */
  extraIds: TId[];
  /**
   * IDs that were requested but not found in the catalogue at all.
   */
  missingIds: TId[];
  /**
   * Simple aggregate counters for debugging / analytics.
   */
  counts: SelectionCounts;
  /**
   * Optional mode/reason pair used by helpers that may fall back to
   * defaults (e.g. "paid" vs "freeFallback").
   */
  mode?: string;
  reason?: string | null;
}

/**
 * Validation result for the 2-3-2 commodities crown pattern on the
 * finance ribbon.
 */
export interface CommoditySelectionValidation {
  /**
   * When valid, indicates the id of the centre group (the "crown").
   */
  centreGroupId?: string;
  /**
   * True when:
   *  - total selected = 7
   *  - every group represented has at least 2 items
   *  - exactly one group has 3 items (the crown)
   */
  isValid: boolean;
  /**
   * If invalid, a short machine-readable reason string
   * (e.g. "too-few-items", "no-centre-crown", "group-underfilled").
   */
  reason?: string;
}
