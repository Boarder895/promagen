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
   * - base stronger => arrow on the LEFT (near base)
   * - quote stronger => arrow on the RIGHT (near quote)
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

  /**
   * Weekend freeze: lock arrow state at Friday close.
   */
  weekendFreeze?: boolean;
}

function CurrencyWithFlag({
  currencyCode,
  countryCode,
}: {
  currencyCode: string;
  countryCode?: string | null;
}) {
  const code = (currencyCode ?? '').trim().toUpperCase();

  return (
    <span className="inline-flex items-center gap-1">
      <span>{code}</span>
      <Flag countryCode={countryCode} />
    </span>
  );
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
  weekendFreeze = false,
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

  return (
    <span className={className ?? 'inline-flex items-center gap-1'}>
      {/* One arrow total. Side indicates winner. Always green (CSS). */}
      {baseWins ? (
        <FxWinnerArrow
          winnerSide="base"
          opacity={winnerOpacity}
          weekendFreeze={weekendFreeze}
          hoverText={hoverText}
        />
      ) : null}

      <CurrencyWithFlag currencyCode={base} countryCode={baseCountryCode} />

      <span aria-hidden="true" className="text-slate-500">
        {separator}
      </span>

      <CurrencyWithFlag currencyCode={quote} countryCode={quoteCountryCode} />

      {quoteWins ? (
        <FxWinnerArrow
          winnerSide="quote"
          opacity={winnerOpacity}
          weekendFreeze={weekendFreeze}
          hoverText={hoverText}
        />
      ) : null}
    </span>
  );
}

export default FxPairLabel;
