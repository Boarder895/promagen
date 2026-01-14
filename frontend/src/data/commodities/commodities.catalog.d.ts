// src/data/commodities/commodities.catalog.d.ts

export type CommodityGroup = 'energy' | 'agriculture' | 'metals';

export type CommoditySubGroup =
  // Energy
  | 'crude_oil'
  | 'natural_gas'
  | 'refined_products'
  | 'distillates'
  | 'gasoline'
  | 'lng'
  | 'coal'
  | 'biofuels'
  // Agriculture
  | 'grains'
  | 'softs'
  | 'livestock'
  | 'oilseeds'
  | 'oilseeds_products'
  | 'fertilisers'
  // Metals
  | 'precious'
  | 'base'
  | 'battery_metals';

export type QuoteCurrency = 'USD' | 'EUR' | 'GBP';

export type CommodityGeoLevel = 'country' | 'region' | 'multi_country';

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
   * Vendor-agnostic symbol or canonical code, e.g. "BRENT", "XAU"
   */
  symbol: string;

  /**
   * Top-level group: energy | agriculture | metals
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
   * Quote currency used for pricing on the Ribbon, typically USD (or EUR for TTF, etc.)
   */
  quoteCurrency: QuoteCurrency;

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
   * Free tier: exactly 7 commodities, in a 2–3–2 group pattern.
   */
  isDefaultFree: boolean;

  /**
   * Whether this is part of the default paid-tier set.
   * Paid tier: currently mirrors free until Pro defaults are explicitly defined.
   */
  isDefaultPaid: boolean;

  /**
   * Sort priority within a group. 1 = most important.
   */
  priority: number;

  /**
   * Flexible tagging for future filtering and UI rules.
   */
  tags: string[];

  /**
   * Primary text shown on the Ribbon.
   */
  ribbonLabel: string;

  /**
   * Secondary text shown on the Ribbon.
   */
  ribbonSubtext: string;

  /**
   * How the commodity should be presented geographically.
   */
  geoLevel: CommodityGeoLevel;

  /**
   * ISO-3166-1 alpha-2 country codes used for flag display.
   */
  displayCountryCodes: string[];
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
