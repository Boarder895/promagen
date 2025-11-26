// frontend/src/lib/fx/map-api-to-quotes.ts
//
// Provider → internal quote mapping.
// This keeps the FastForex-specific response details out of the rest of the FX code.

import type { FxSnapshot } from './fetch';

export type FxPairMeta = {
  id: string;
  base: string;
  quote: string;
  label?: string;
};

export type FastForexFetchOneResponse = {
  base: string;
  result?: Record<string, number>;
  results?: Record<string, number>;
  updated?: string;
  ms?: number;
};

export type FastForexErrorResponse = {
  error?: string;
  message?: string;
};

/**
 * Extracts a single rate from a FastForex response (fetch-one or fetch-multi style).
 */
export function extractFastForexRate(
  meta: FxPairMeta,
  payload: FastForexFetchOneResponse,
): number | null {
  const { quote } = meta;

  if (payload.result && typeof payload.result === 'object') {
    const value = payload.result[quote];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  if (payload.results && typeof payload.results === 'object') {
    const value = payload.results[quote];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  return null;
}

/**
 * Convert a FastForex payload for a given pair into Promagen's internal snapshot.
 * We currently do not have a true "previous close" from the provider, so we
 * duplicate the live value into prevClose. The daily arrow logic will treat
 * this as "no arrow" on a fresh snapshot.
 */
export function mapFastForexToSnapshot(
  meta: FxPairMeta,
  payload: FastForexFetchOneResponse,
  now: Date,
): FxSnapshot | null {
  const value = extractFastForexRate(meta, payload);

  if (value === null) {
    return null;
  }

  const asOf =
    typeof payload.updated === 'string' && payload.updated.trim().length > 0
      ? new Date(payload.updated).toISOString()
      : now.toISOString();

  return {
    id: meta.id,
    value,
    prevClose: value,
    asOf,
  };
}
