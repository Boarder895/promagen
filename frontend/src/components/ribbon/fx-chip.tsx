// frontend/src/components/ribbon/fx-chip.tsx
'use client';

import React from 'react';

import type { FxRibbonQuote } from '@/lib/fx/ribbon-source';
import type { WinningSide } from '@/lib/fx';

type FxChipProps = {
  quote: FxRibbonQuote;
  winnerSide: WinningSide;
  showArrow: boolean;
};

function formatRate(value: number, precision: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  const decimals = precision >= 0 && precision <= 6 ? precision : 4;
  return value.toFixed(decimals);
}

/**
 * Presentational FX chip for the legacy FX row.
 *
 * - Always shows base/quote in canonical order.
 * - Draws a single up arrow on the winning side when showArrow is true.
 */
function FxChip({ quote, winnerSide, showArrow }: FxChipProps): React.ReactElement {
  const { base, quote: quoteCode, label, value, precision } = quote;

  const rateText = formatRate(value, precision);
  const isBaseWinner = showArrow && winnerSide === 'base';
  const isQuoteWinner = showArrow && winnerSide === 'quote';

  const ariaSegments: string[] = [label];

  if (rateText) {
    ariaSegments.push(rateText);
  }

  if (isBaseWinner) {
    ariaSegments.push(`${base} is stronger today`);
  } else if (isQuoteWinner) {
    ariaSegments.push(`${quoteCode} is stronger today`);
  }

  const ariaLabel = ariaSegments.join(', ');

  return (
    <div
      role="listitem"
      aria-label={ariaLabel}
      className="flex min-h-[44px] flex-1 items-center justify-between rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
    >
      <div className="flex items-baseline gap-1">
        <span className="font-semibold tracking-wide">{base}</span>
        <span className="text-[10px] text-slate-400">/</span>
        <span className="font-semibold tracking-wide">{quoteCode}</span>
      </div>

      <div className="flex items-center gap-1">
        {rateText ? (
          <span className="tabular-nums text-xs text-slate-200">{rateText}</span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}

        {showArrow && (isBaseWinner || isQuoteWinner) && (
          <span aria-hidden="true" className="ml-1 text-xs leading-none text-emerald-400">
            ↑
          </span>
        )}
      </div>
    </div>
  );
}

export default FxChip;
