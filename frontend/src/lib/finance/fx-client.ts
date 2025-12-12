// C:\Users\Proma\Projects\promagen\frontend\src\lib\finance\fx-client.ts
// -----------------------------------------------------------------------------
// Lightweight client helpers for FX data.
//
// Goals (current phase):
// - No demo behaviour, no synthetic values.
// - Always read from the internal FX API: /api/fx
// - Keep legacy imports compiling while we migrate older code.
// -----------------------------------------------------------------------------

import type { FxApiResponse } from '@/types/finance-ribbon';
import { buildPairCode } from '@/lib/finance/fx-pairs';

export type FxSnapshot = {
  payload: FxApiResponse;
  fetchedAt: number;
};

/**
 * Fetch the canonical FX payload from the internal API.
 *
 * NOTE:
 * - This helper is safe for both server and client usage.
 * - Callers can supply a baseUrl when running server-side (e.g. during jobs/tests).
 */
export async function fetchFxSnapshot(baseUrl?: string): Promise<FxSnapshot> {
  const url = `${baseUrl ?? ''}/api/fx`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    // Let the API route own caching; do not add extra caching here.
  });

  if (!res.ok) {
    throw new Error(`FX API responded with HTTP ${res.status}`);
  }

  const payload = (await res.json()) as FxApiResponse;

  return {
    payload,
    fetchedAt: Date.now(),
  };
}

/**
 * Convenience helper: returns a map from compact FX pair codes (e.g. "EURUSD") to mid/price values.
 *
 * For now, we treat FxApiQuote.price as the mid.
 */
export async function fetchFxMidMap(baseUrl?: string): Promise<Record<string, number>> {
  const snapshot = await fetchFxSnapshot(baseUrl);
  const result: Record<string, number> = {};

  for (const q of snapshot.payload.data ?? []) {
    if (typeof q.price !== 'number' || Number.isNaN(q.price)) continue;
    const code = buildPairCode(q.base, q.quote);
    result[code] = q.price;
  }

  return result;
}
