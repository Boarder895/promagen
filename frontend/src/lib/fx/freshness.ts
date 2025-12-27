// frontend/src/lib/fx/freshness.ts
//
// UX helper: buckets FX quotes by age so the UI can degrade gracefully
// (fresh → ageing → delayed) when CDN caching / WAF challenge mode is active.

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

  const asOfMs = Date.parse(asOfIso);
  if (!Number.isFinite(asOfMs)) {
    return 'delayed';
  }

  const ageMs = now.getTime() - asOfMs;

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
