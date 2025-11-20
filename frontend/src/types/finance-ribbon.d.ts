// src/types/finance-ribbon.d.ts

export type FxPairId = string;
export type CommodityId = string;
export type CryptoId = string;

/**
 * Canonical description of an FX pair in Promagen.
 *
 * Both src/data/fx/fx.pairs.json (free tier) and src/data/fx/pairs.json
 * (full catalogue + demo values) use this as their base shape.
 */
export interface FxPair {
  id: FxPairId;
  base: string; // e.g. "GBP"
  quote: string; // e.g. "USD"
  label: string; // e.g. "GBP / USD"
  group?: 'core' | 'major' | 'apac' | string;
  precision: number; // number of decimal places
}

/**
 * Extended FX pair used by src/data/fx/pairs.json which includes
 * static demo values for offline / demo mode.
 */
export interface FxPairWithDemo extends FxPair {
  demo: {
    /** Current demo value for the pair. */
    value: number;
    /** Previous close used to compute up/down arrows. */
    prevClose: number;
  };
}

/**
 * Identifier for an upstream FX provider.
 *
 * These are intentionally narrow so we can branch on them safely
 * inside the fx-client adapter.
 */
export type FxProviderId = 'exchangerate-host' | 'exchange-rate-api';

/**
 * Normalised FX quote consumed by UI components.
 *
 * All upstream FX vendors are adapted into this shape by the
 * server-side FX client.
 */
export interface FxQuote {
  /** ID of the pair, matching a canonical hyphenated id. */
  pairId: FxPairId;
  /** Mid-market rate or single representative price. */
  mid: number;
  /** Optional bid price if exposed by the provider. */
  bid?: number;
  /** Optional ask price if exposed by the provider. */
  ask?: number;
  /** ISO-8601 UTC timestamp when this quote was observed. */
  asOf: string;
  /** Which upstream provider produced this quote. */
  provider: FxProviderId;
}

/**
 * Payload returned by /api/fx.
 *
 * This doubles as the contract between the API route and any
 * hooks/components (e.g. useFxQuotes, mini widgets, etc).
 */
export interface FxQuotesPayload {
  ok: boolean;
  /** Whether values are real-time, demo-only, or from the fallback provider. */
  mode: 'demo' | 'live' | 'fallback';
  quotes: FxQuote[];
  /** When the client should next refresh, as an ISO-8601 UTC timestamp. */
  nextUpdateAt: string;
  /** Optional build identifier for provenance in logs and badges. */
  buildId?: string;
}

/**
 * Commodity metadata for the ribbon and mini-widgets.
 */
export interface Commodity {
  id: CommodityId;
  name: string;
  group: 'energy' | 'agriculture' | 'metals' | string;
  symbol?: string; // e.g. "Brent", "Gold"
  unit?: string; // e.g. "USD/bbl", "USD/oz"
  emoji?: string; // optional micro-UI emoji
}

/**
 * Crypto metadata for the ribbon and mini-widgets.
 */
export interface CryptoAsset {
  id: CryptoId; // lowercase id, e.g. "btc"
  symbol: string; // ticker symbol, e.g. "BTC"
  name: string; // human name, e.g. "Bitcoin"
  rankHint: number; // approximate market-cap rank (1 = highest)
}

/**
 * Result of enforcing “exact count” rules for ribbon selections.
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

/**
 * Detailed validation result for the 2–3–2 commodities crown.
 */
export interface CommoditySelectionValidation {
  /** All resolved commodities (if valid) in the 2–3–2 visual order. */
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
