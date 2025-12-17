// frontend/src/types/finance-ribbon.ts
/**
 * Finance Ribbon API Types
 *
 * API BRAIN COMPLIANCE:
 * - This file defines DATA SHAPE ONLY.
 * - It MUST NOT encode authority, timing, or refresh semantics.
 * - Clients must NOT infer permission/freshness from structure.
 */

/**
 * API mode is descriptive only.
 * It MUST NOT be used to infer permission or freshness.
 */
export type FxApiMode = 'live' | 'cached' | 'fallback';

/**
 * Provider label for display/diagnostics only.
 * Keep this flexible so adding providers never becomes a type-breaking event.
 */
export type FxSourceProvider = 'twelvedata' | 'cache' | 'fallback' | (string & {});

/**
 * Meta is informational only.
 * It must not be used to make refresh decisions on the client.
 */
export interface FxApiMeta {
  buildId: string;
  mode: FxApiMode;

  /**
   * Descriptive provenance only (UI/diagnostics).
   * MUST NOT affect client behaviour.
   */
  sourceProvider: FxSourceProvider;

  /**
   * Descriptive “as of” timestamp for the payload.
   * Not a refresh-eligibility signal.
   */
  asOf: string; // ISO string
}

/**
 * A single FX quote.
 *
 * IMPORTANT:
 * - price MAY be null (bootstrap/fallback/ride-cache).
 * - `asOf` fields are optional and descriptive only.
 */
export interface FxApiQuote {
  id: string;
  base: string;
  quote: string;
  label: string;
  category: string;

  price: number | null;

  change: number | null;
  changePct: number | null;

  /**
   * Optional per-quote timestamps (descriptive only).
   * Some UI components use these for a “fresh/delayed/stale” badge.
   */
  asOf?: string;
  asOfUtc?: string;
}

/**
 * Backwards-compatible alias used by UI/components.
 */
export type FxQuote = FxApiQuote;

/**
 * FX API response contract.
 */
export interface FxApiResponse {
  meta: FxApiMeta;
  data: FxApiQuote[];
  error?: string;
}

/**
 * ---------------------------------------------------------------------------
 * Selection catalogue types (FX / Commodities / Crypto)
 * ---------------------------------------------------------------------------
 * These are used by ribbon selection helpers and local selection state.
 * They remain data-shape only.
 */

export type FxPairId = string;

export interface FxPair {
  id: FxPairId;
  base: string;
  quote: string;
  label: string;

  precision?: number;

  baseCountryCode?: string;
  quoteCountryCode?: string;

  group?: string;
  homeLongitude?: number;

  demo?: {
    value: number;
    prevClose: number;
  };
}

export type CommodityId = string;

export interface Commodity {
  id: CommodityId;
  name: string;

  shortName?: string;
  symbol?: string;

  group?: string;
  subGroup?: string;

  emoji?: string;
  quoteCurrency?: string;

  isActive?: boolean;
  isSelectableInRibbon?: boolean;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;

  priority?: number;
  tags?: string[];

  ribbonLabel?: string;
  ribbonSubtext?: string;

  geoLevel?: string;
  displayCountryCodes?: string[];
}

export interface CommoditySelectionValidation {
  isValid: boolean;
  reason?: string;
  centreGroupId?: string;
}

export type CryptoId = string;

export interface CryptoAsset {
  id: CryptoId;
  symbol: string;
  name: string;
  rankHint?: number;
}
