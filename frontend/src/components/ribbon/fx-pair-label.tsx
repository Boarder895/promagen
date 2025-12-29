'use client';

import * as React from 'react';

import Flag from '@/components/ui/flag';
import FxWinnerArrow from '@/components/ribbon/fx-winner-arrow';
import type { FxWinnerSide } from '@/hooks/use-fx-quotes';

export interface FxPairLabelProps {
  base: string;
  baseCountryCode?: string | null;
  quote: string;
  quoteCountryCode?: string | null;
  separator?: string;
  className?: string;

  /**
   * Direction logic:
   * - base stronger => green ↑ arrow next to base currency
   * - quote stronger => green ↑ arrow next to quote currency
   * - neutral => no arrow
   */
  winnerSide?: FxWinnerSide;

  /**
   * 0..1 confidence => opacity.
   */
  winnerOpacity?: number;

  /**
   * 24h delta (percentage), used only for hover copy.
   */
  deltaPct?: number | null;
}

function formatSignedPct(deltaPct: number | null | undefined): string | null {
  if (typeof deltaPct !== 'number' || !Number.isFinite(deltaPct)) return null;
  const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '−' : '';
  const abs = Math.abs(deltaPct);
  return `${sign}${abs.toFixed(2)}%`;
}

export function FxPairLabel({
  base,
  baseCountryCode,
  quote,
  quoteCountryCode,
  separator = '/',
  className,
  winnerSide = 'neutral',
  winnerOpacity = 1,
  deltaPct = null,
}: FxPairLabelProps) {
  const baseWins = winnerSide === 'base';
  const quoteWins = winnerSide === 'quote';

  const pct = formatSignedPct(deltaPct);
  const hoverText =
    pct && winnerSide !== 'neutral'
      ? `${winnerSide === 'base' ? base : quote} strengthened vs ${
          winnerSide === 'base' ? quote : base
        } over 24h (${pct})`
      : null;

  // Arrow component - only rendered once, position determined by winner
  const winnerArrow =
    baseWins || quoteWins ? (
      <FxWinnerArrow winnerSide={winnerSide} opacity={winnerOpacity} hoverText={hoverText} />
    ) : null;

  // Spec: "A single green winner arrow may appear next to one side of the pair label,
  // pointing at the currency that has strengthened."
  // Layout: arrow appears immediately adjacent to the winning currency.
  // - Base wins: "AUD ↑ 🇦🇺 / GBP 🇬🇧" (arrow after base code, before base flag)
  // - Quote wins: "AUD 🇦🇺 / ↑ GBP 🇬🇧" (arrow before quote code)

  return (
    <span className={className ?? 'inline-flex items-center gap-1'}>
      {/* Base currency with optional winner arrow */}
      <span className="inline-flex items-center gap-0.5">
        <span>{base.trim().toUpperCase()}</span>
        {baseWins && winnerArrow}
        <Flag countryCode={baseCountryCode} />
      </span>

      {/* Separator */}
      <span aria-hidden="true" className="text-slate-500">
        {separator}
      </span>

      {/* Quote currency with optional winner arrow */}
      <span className="inline-flex items-center gap-0.5">
        {quoteWins && winnerArrow}
        <span>{quote.trim().toUpperCase()}</span>
        <Flag countryCode={quoteCountryCode} />
      </span>
    </span>
  );
}

export default FxPairLabel;
