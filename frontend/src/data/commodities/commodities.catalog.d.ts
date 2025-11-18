// src/data/commodities/commodities.catalog.d.ts

export type CommodityGroup = 'energy' | 'metals' | 'agriculture';

export type CommoditySubGroup =
  | 'crude_oil'
  | 'natural_gas'
  | 'refined_products'
  | 'precious'
  | 'base'
  | 'grains'
  | 'oilseeds_products'
  | 'oilseeds'
  | 'softs'
  | 'livestock';

export interface Commodity {
  /**
   * Stable machine identifier, e.g. "brent_crude"
   */
  id: string;

  /**
   * Full display name, e.g. "Brent Crude"
   */
  name: string;

  /**
   * Short label for tight UI, e.g. "Brent", "Gold", "Wheat"
   */
  shortName: string;

  /**
   * Vendor-agnostic symbol or canonical code,
   * e.g. "BRENT", "XAU", "W"
   */
  symbol: string;

  /**
   * Top-level group: energy | metals | agriculture
   */
  group: CommodityGroup;

  /**
   * Finer classification within the group
   */
  subGroup: CommoditySubGroup;

  /**
   * Emoji used in the Ribbon and other UI hints
   */
  emoji: string;

  /**
   * Quote currency used for pricing on the Ribbon,
   * typically "USD" (or "EUR" for TTF, etc.)
   */
  quoteCurrency: string;

  /**
   * Whether this commodity is currently active in Promagen.
   * Lets you soft-delete without losing history.
   */
  isActive: boolean;

  /**
   * Whether this commodity can be selected for the Ribbon.
   * You can keep some contracts in the catalogue but not expose them.
   */
  isSelectableInRibbon: boolean;

  /**
   * Whether this is part of the default free-tier set.
   * Free tier: exactly one per group (Energy, Metals, Agriculture).
   */
  isDefaultFree: boolean;

  /**
   * Whether this is part of the suggested paid-tier pattern.
   * Paid tier: total of five instruments, 2 + 2 + 1 across the groups.
   */
  isDefaultPaid: boolean;

  /**
   * Sort priority within a group.
   * 1 = top / headline instrument.
   */
  priority: number;

  /**
   * Flexible tagging for future filtering and UI rules,
   * e.g. ["energy", "headline", "high_liquidity"].
   */
  tags: string[];
}

/**
 * The full commodities catalogue, as stored in commodities.catalog.json.
 */
export type CommoditiesCatalog = Commodity[];

/**
 * Module augmentation so that importing ./commodities.catalog.json
 * is strongly typed instead of `any`, assuming `resolveJsonModule` is enabled.
 */
declare module './commodities.catalog.json' {
  const value: import('./commodities.catalog').CommoditiesCatalog;
  export default value;
}
