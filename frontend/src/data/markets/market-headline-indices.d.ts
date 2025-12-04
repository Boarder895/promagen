// frontend/src/data/markets/market-headline-indices.d.ts

declare module '@/data/markets/market-headline-indices.json' {
  /**
   * A fully specified headline index that can be wired to live data.
   * These are the ones the worker is allowed to query and show in the UI.
   */
  export interface HeadlineIndexReal {
    /** Discriminator: this index is live and valid. */
    kind: 'real';
    /** Stable identifier used internally (e.g. 'ftse-100'). */
    id: string;
    /** Short label used in tight UI spaces (rails, chips). */
    shortName: string;
    /** Full, marketing-neutral name of the index. */
    longName: string;
    /** Provider-agnostic symbol or code for the index. */
    symbol: string;
    /** ISO 4217 currency code for the index quotation. */
    currency: string;
    /** Display unit for the index value (normally 'points'). */
    unit: string;
    /** Classification bucket – reserved for future index types. */
    category: 'headline-index';
  }

  /**
   * Placeholder for an exchange where we haven't chosen a headline index yet.
   * This keeps the bundle structurally complete without faking data.
   */
  export interface HeadlineIndexPlaceholder {
    /** Discriminator: this entry is a TODO / not wired to live data. */
    kind: 'unassigned';
    /** Human-readable note explaining why this is unassigned. */
    reason: string;
  }

  /** Discriminated union of either a real index or a placeholder. */
  export type HeadlineIndexMeta = HeadlineIndexReal | HeadlineIndexPlaceholder;

  /** Mapping for a single exchange to its headline index configuration. */
  export interface ExchangeHeadlineIndex {
    /** Exchange id – must match the id from the exchanges catalogue. */
    id: string;
    /** Metadata describing the index used for “points + up/down” views. */
    headlineIndex: HeadlineIndexMeta;
  }

  /**
   * Global bundle: one entry per exchange id from exchanges.catalog.json.
   * This supports both the free 'selected' bundle and the full paid catalogue.
   */
  export interface MarketHeadlineIndexBundle {
    [exchangeId: string]: ExchangeHeadlineIndex;
  }

  interface MarketHeadlineIndexFile {
    /** Schema identifier for tooling and validation. */
    $schema?: string;
    /** Semantic version of this mapping. */
    version: number;
    /** Core data bundle keyed by exchange id. */
    bundle: MarketHeadlineIndexBundle;
  }

  const data: MarketHeadlineIndexFile;
  export default data;
}
