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
  | 'power'
  | 'emissions'
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
   * Stable identifier (SSOT key). Used for selection lists and quote mapping.
   */
  id: string;

  /**
   * Canonical full name.
   */
  name: string;

  /**
   * Shorter display name where space is tight.
   */
  shortName: string;

  /**
   * Provider-facing symbol (e.g. "XAU/USD", "BRENT", etc.).
   */
  symbol: string;

  /**
   * Top-level grouping used for filtering and UI sections.
   */
  group: CommodityGroup;

  /**
   * More granular grouping.
   */
  subGroup: CommoditySubGroup;

  /**
   * Emoji used in the ribbon chip.
   */
  emoji: string;

  /**
   * Quote currency used for display conventions.
   */
  quoteCurrency: QuoteCurrency;

  /**
   * Whether this commodity is active in the catalogue.
   */
  isActive: boolean;

  /**
   * Whether this commodity may appear in user ribbon selection.
   */
  isSelectableInRibbon: boolean;

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

  /**
   * Optional tooltip metadata.
   */
  yearFirstTraded?: number;

  /**
   * Optional short "did you know" fact (kept compact for tooltips).
   */
  fact?: string;
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
