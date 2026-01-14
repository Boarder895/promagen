// src/types/crypto-ribbon.ts
/**
 * Crypto Ribbon API Types (data shape only)
 *
 * API Brain rules:
 * - No authority encoded here.
 * - No freshness inference.
 * - Allow null prices to avoid synthetic/demo numbers.
 */

export type CryptoApiMode = 'live' | 'cached' | 'fallback';

export type CryptoSourceProvider = 'twelvedata' | 'cache' | 'fallback' | (string & {});

export type CryptoBudgetState = 'ok' | 'warning' | 'blocked';

export type CryptoBudgetIndicator = {
  state: CryptoBudgetState;
  emoji?: string;
};

export type CryptoApiQuote = {
  id: string;
  value: number | null;
  prevClose: number | null;
};

export type CryptoApiResponse = {
  meta: {
    mode: CryptoApiMode;
    sourceProvider: CryptoSourceProvider;
    budget?: CryptoBudgetIndicator;
    requestId?: string;
    buildId?: string;
    generatedAt: string;
  };
  data: {
    quotes: CryptoApiQuote[];
  };
};
