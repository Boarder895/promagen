// C:\Users\Proma\Projects\promagen\frontend\src\lib\fx\freshness.ts

import type { FxQuote } from '@/types/finance-ribbon';

/**
 * Freshness buckets for FX data, aligned with the Promagen
 * Global Standard:
 *
 *   - fresh   → age ≤ 60 minutes
 *   - ageing  → 60 < age ≤ 90 minutes
 *   - delayed → age > 90 minutes
 */
export type FxFreshness = 'fresh' | 'ageing' | 'delayed';

const FRESH_MS = 60 * 60_000;
const AGEING_MS = 90 * 60_000;

/**
 * Given an ISO timestamp, returns the freshness bucket.
 * If the timestamp is missing or invalid, we treat it as delayed.
 */
export function getFxFreshnessFromTimestamp(
  asOfIso: string | null | undefined,
  now: Date = new Date(),
): FxFreshness {
  if (!asOfIso) {
    return 'delayed';
  }

  const ts = Date.parse(asOfIso);
  if (!Number.isFinite(ts)) {
    return 'delayed';
  }

  const ageMs = now.getTime() - ts;

  if (ageMs <= FRESH_MS) {
    return 'fresh';
  }

  if (ageMs <= AGEING_MS) {
    return 'ageing';
  }

  return 'delayed';
}

/**
 * Convenience helper that derives freshness from a quote's `asOf`
 * timestamp. If the quote is missing `asOf`, it is considered delayed.
 */
export function getFxFreshnessFromQuote(
  quote: FxQuote | null | undefined,
  now?: Date,
): FxFreshness {
  if (!quote) {
    return 'delayed';
  }

  return getFxFreshnessFromTimestamp(quote.asOf, now ?? new Date());
}
