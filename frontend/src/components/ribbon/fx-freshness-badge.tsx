// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\fx-freshness-badge.tsx

'use client';

import { useMemo } from 'react';
import type { FxQuote } from '@/types/finance-ribbon';

export interface FxFreshnessBadgeProps {
  /**
   * The quote whose freshness we want to display.
   */
  quote: FxQuote | null | undefined;
  /**
   * When false (default), we only show badges for "Delayed"
   * and "Stale". When true, we also show a subtle "Fresh"
   * badge for very recent quotes.
   */
  showWhenFresh?: boolean;
}

type FxFreshnessLevel = 'fresh' | 'delayed' | 'stale';

function computeFreshnessFromQuote(quote: FxQuote | null | undefined): FxFreshnessLevel | null {
  if (!quote) {
    return null;
  }

  const asOfSource = quote.asOfUtc ?? quote.asOf;
  const asOfTime = typeof asOfSource === 'string' ? Date.parse(asOfSource) : NaN;

  if (Number.isNaN(asOfTime)) {
    // If we can't parse a timestamp, treat it as unknown – no badge.
    return null;
  }

  const now = Date.now();
  const ageMinutes = (now - asOfTime) / 60_000;

  if (ageMinutes < 30) {
    return 'fresh';
  }

  if (ageMinutes <= 90) {
    return 'delayed';
  }

  return 'stale';
}

/**
 * Small pill badge indicating how fresh an individual FX quote is.
 *
 * - No badge for missing/invalid quotes.
 * - Optional badge for fresh values (when showWhenFresh is true).
 * - "Delayed" for moderately old quotes.
 * - "Stale" for very old quotes.
 */
export function FxFreshnessBadge({ quote, showWhenFresh = false }: FxFreshnessBadgeProps) {
  const freshness = useMemo(() => computeFreshnessFromQuote(quote), [quote]);

  if (!quote || freshness === null) {
    return null;
  }

  if (freshness === 'fresh' && !showWhenFresh) {
    return null;
  }

  let text: string;
  let className: string;

  switch (freshness) {
    case 'fresh':
      text = 'Fresh';
      className =
        'rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300';
      break;
    case 'delayed':
      text = 'Delayed';
      className =
        'rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300';
      break;
    case 'stale':
    default:
      text = 'Stale';
      className = 'rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-300';
      break;
  }

  return (
    <span
      className={className}
      aria-label={`Rate freshness: ${text.toLowerCase()}`}
      data-testid="fx-freshness-badge"
    >
      {text}
    </span>
  );
}

export default FxFreshnessBadge;
