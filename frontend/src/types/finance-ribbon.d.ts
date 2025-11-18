// src/types/finance-ribbon.d.ts

export type FxPairId = string;
export type CommodityId = string;
export type CryptoId = string;

export interface FxPair {
  id: FxPairId;
  base: string; // e.g. "GBP"
  quote: string; // e.g. "USD"
  label: string; // e.g. "GBP/USD"
  group: 'core' | 'major' | 'apac' | string;
  precision: number; // number of decimal places
}

export interface Commodity {
  id: CommodityId;
  name: string;
  group: 'energy' | 'agriculture' | 'metals' | string;
  symbol?: string; // e.g. "Brent", "Gold"
  unit?: string; // e.g. "USD/bbl", "USD/oz"
  emoji?: string; // optional micro-UI emoji
}

export interface CryptoAsset {
  id: CryptoId; // lowercase id, e.g. "btc"
  symbol: string; // ticker symbol, e.g. "BTC"
  name: string; // human name, e.g. "Bitcoin"
  rankHint: number; // approximate market-cap rank (1 = highest)
}

/**
 * Result of enforcing the “exact count” rules.
 *
 * If `mode` is "freeFallback", the `items` array will contain the free-tier
 * defaults rather than the user’s selection, and `reason` explains why.
 */
export interface SelectionResult<TItem, TId extends string> {
  /** Effective items to render in the ribbon, in display order. */
  items: TItem[];
  /** The IDs used to derive `items` (after deduping/normalising). */
  ids: TId[];
  /**
   * Whether we’re using the user’s paid selection, the fixed free selection,
   * or a mixed state (future use).
   */
  mode: 'free' | 'paid' | 'freeFallback';
  /** Optional explanation for analytics / debug / UI messaging. */
  reason?: string;
}

export interface CommoditySelectionValidation {
  /** All 7 resolved commodities (if valid) in the 2–3–2 visual order. */
  items: Commodity[];
  /** Counts per group, derived from the selected IDs. */
  countsByGroup: Record<string, number>;
  /** The group that forms the 3-item “crown” in the middle, if any. */
  centreGroupId?: string;
  /**
   * True when:
   * - total selected = 7,
   * - every group represented has at least 2 items,
   * - exactly one group has 3 items (the crown).
   */
  isValid: boolean;
  /**
   * If invalid, a short machine-readable reason string
   * (e.g. "too-few-items", "no-centre-crown", "group-underfilled").
   */
  reason?: string;
}
