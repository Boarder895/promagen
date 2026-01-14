// src/types/commodities-ribbon.ts
/**
 * Commodities Ribbon API Types (data shape only)
 *
 * API Brain rules:
 * - No authority encoded here.
 * - No freshness inference.
 */

export type CommoditiesApiMode = 'live' | 'cached' | 'fallback';

export type CommoditiesSourceProvider = 'twelvedata' | 'cache' | 'fallback' | (string & {});

export type CommoditiesBudgetState = 'ok' | 'warning' | 'blocked';

export type CommoditiesBudgetIndicator = {
  state: CommoditiesBudgetState;
  emoji?: string;
};

export type CommoditiesApiQuote = {
  id: string;
  value: number;
  prevClose: number;
};

export type CommoditiesApiResponse = {
  meta: {
    mode: CommoditiesApiMode;
    sourceProvider: CommoditiesSourceProvider;
    budget?: CommoditiesBudgetIndicator;
    requestId?: string;
    buildId?: string;
    generatedAt: string;
  };
  data: {
    quotes: CommoditiesApiQuote[];
  };
};
