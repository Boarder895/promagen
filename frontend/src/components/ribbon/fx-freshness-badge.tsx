// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\fx-freshness-badge.tsx

'use client';

import { useMemo } from 'react';
import type { FxQuote } from '@/types/finance-ribbon';
import { getFxFreshnessFromQuote, type FxFreshness } from '@/lib/fx/freshness';

export interface FxFreshnessBadgeProps {
  /**
   * The quote whose freshness we want to display.
   */
  quote: FxQuote | null | undefined;
  /**
   * When false (default), we only show badges for "ageing"
   * and "delayed". When true, we also show a subtle "Fresh"
   * badge for ≤ 60 minutes old.
   */
  showWhenFresh?: boolean;
}

/**
 * Small pill badge indicating how fresh an individual FX quote is.
 *
 * - No badge for missing quotes.
 * - Optional badge for fresh values.
 * - Explicit badge for "Ageing" (60–90 min).
 * - Explicit badge for "Delayed" (> 90 min).
 */
export function FxFreshnessBadge({ quote, showWhenFresh = false }: FxFreshnessBadgeProps) {
  const freshness: FxFreshness = useMemo(() => getFxFreshnessFromQuote(quote), [quote]);

  if (!quote) {
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
    case 'ageing':
      text = 'Ageing';
      className =
        'rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300';
      break;
    case 'delayed':
    default:
      text = 'Delayed';
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
