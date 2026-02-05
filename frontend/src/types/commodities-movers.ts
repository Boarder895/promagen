// src/types/commodities-movers.ts
// ============================================================================
// COMMODITIES MOVERS GRID - TYPE DEFINITIONS
// ============================================================================
// Types for the 2×2 Winners + 2×2 Losers commodities grid component.
// Replaces the single-line commodities ribbon with dynamic sorting by % change.
//
// Design spec:
// - LEFT BOX:  Top 4 biggest winners (highest positive % change) - green
// - RIGHT BOX: Top 4 biggest losers (highest negative % change) - red
//
// v2.1: Added EUR/GBP conversion support (4 Feb 2026)
// - Each card shows base price + EUR/GBP conversions
// - Conversions use live FX rates from the gateway
//
// Authority: Compacted conversation 2026-02-04
// Existing features preserved: Yes
// ============================================================================

import type { RichTooltipLine } from '@/components/ui/rich-tooltip';

/**
 * Direction indicator for price movement.
 */
export type MoverDirection = 'winner' | 'loser';

/**
 * Data for a single commodity mover card.
 * 
 * v2.1: Added priceEur, priceGbp, eurGbpText for conversion display
 */
export interface CommodityMoverData {
  /** Commodity ID from catalog (e.g., "gold", "coffee") */
  id: string;
  /** Display name (e.g., "Gold", "Arabica Coffee") */
  name: string;
  /** Short name for compact display */
  shortName: string;
  /** Emoji for visual identification */
  emoji: string;
  /** Formatted price with currency and unit (e.g., "$2,630.50 /oz") */
  priceText: string;
  /** Percentage change from previous close */
  deltaPct: number;
  /** Direction: winner (positive) or loser (negative) */
  direction: MoverDirection;
  /** Brand color for this commodity (hex) */
  brandColor: string;
  /** Tooltip title */
  tooltipTitle?: string;
  /** Tooltip lines (year first traded, fun fact) */
  tooltipLines?: RichTooltipLine[];

  // ============================================================================
  // CURRENCY CONVERSION FIELDS (v2.4)
  // ============================================================================

  /** EUR equivalent price (null if conversion not available) */
  priceEur: number | null;
  /** GBP equivalent price (null if conversion not available) */
  priceGbp: number | null;
  /** USD equivalent price (null if already USD or conversion not available) */
  priceUsd: number | null;
  /** Native currency code (e.g., "USD", "EUR", "GBP", "INR", "BRL") */
  quoteCurrency: string;
  /** First conversion line: { countryCode, priceText } */
  conversionLine1: { countryCode: string; priceText: string };
  /** Second conversion line: { countryCode, priceText } */
  conversionLine2: { countryCode: string; priceText: string };
  /** Third conversion line - only for non-USD/EUR/GBP commodities */
  conversionLine3: { countryCode: string; priceText: string } | null;
  /** ISO country code for base currency flag (e.g., "US", "EU", "GB", "IN") */
  baseFlagCode: string | null;
  /** @deprecated Use conversionLine1/conversionLine2 instead */
  eurGbpText: string;
}

/**
 * Props for the CommodityMoverCard component.
 */
export interface CommodityMoverCardProps {
  data: CommodityMoverData;
  /** Optional: show "updating..." indicator for stale data */
  isStale?: boolean;
}

/**
 * Props for the CommoditiesMoversGrid component.
 */
export interface CommoditiesMoversGridProps {
  /** Top 4 winners (sorted by highest positive % change) */
  winners: CommodityMoverData[];
  /** Top 4 losers (sorted by highest negative % change) */
  losers: CommodityMoverData[];
  /** Show skeleton placeholders when loading */
  isLoading?: boolean;
  /** Show "updating..." indicators for stale data */
  isStale?: boolean;
}

/**
 * Result from sorting commodities into winners and losers.
 */
export interface SortedCommodityMovers {
  winners: CommodityMoverData[];
  losers: CommodityMoverData[];
  /** Timestamp of last sort */
  sortedAt: number;
}
