// frontend/src/lib/fx/calculate.ts
//
// Single "winner arrow" helper for the FX ribbon (and any future mini widgets).
// It works off the daily move (current vs previous close) and the canonical
// pair metadata in src/data/fx/pairs.json so that everything is driven by
// data files rather than hard-coded logic.

import pairsJson from '@/data/fx/pairs.json';

type PairConfig = {
  id: string;
  base: string;
  quote: string;
};

const pairs = pairsJson as PairConfig[];

/**
 * Direction for the pair as a whole in ribbon terms:
 *
 * - "up"   → show an up arrow next to the currency that is winning
 * - "none" → no arrow; visually calm
 *
 * We do not expose a separate "down" state here – a strong move in either
 * direction is still rendered as an up arrow on whichever currency is up.
 */
export type DailyArrowDirection = 'up' | 'none';

export type WinningSide = 'base' | 'quote' | null;

export type WinningCurrencyResult = {
  /**
   * ISO currency code for the "winner" on today’s move, or null if flat.
   */
  winnerCurrency: string | null;
  /**
   * Which side of the on-screen pair is winning, or null if flat.
   * - "base"  → arrow goes on the left label
   * - "quote" → arrow goes on the right label
   */
  winnerSide: WinningSide;
  /**
   * Direction of the daily move in ribbon terms:
   * - "up"   → show an up arrow
   * - "none" → no arrow
   */
  direction: DailyArrowDirection;
};

const DEFAULT_FLAT_TOLERANCE_PCT = 0.0001;

function createNoWinnerResult(): WinningCurrencyResult {
  return {
    winnerCurrency: null,
    winnerSide: null,
    direction: 'none',
  };
}

/**
 * Determine which side of an FX pair is "winning" for the current daily move.
 *
 * Inputs:
 *  - pairId: canonical slug, e.g. "gbp-usd"
 *  - current: current mid value
 *  - prevClose: yesterday’s close (or previous reference value)
 *
 * Behaviour:
 *  - If the move is tiny (within DEFAULT_FLAT_TOLERANCE_PCT), we treat it as flat:
 *      → no arrow, no winner.
 *  - For a meaningful move:
 *      → if current > prevClose  → base currency is up   → arrow on the left.
 *      → if current < prevClose  → quote currency is up  → arrow on the right.
 *  - In all non-flat cases we return direction: "up" – the side of the arrow
 *    tells you which currency is stronger.
 */
export function getWinningCurrency(params: {
  pairId: string;
  current: number;
  prevClose: number;
}): WinningCurrencyResult {
  const { pairId, current, prevClose } = params;

  if (!Number.isFinite(prevClose) || !Number.isFinite(current) || prevClose === 0) {
    return createNoWinnerResult();
  }

  const pctChange = (current - prevClose) / prevClose;

  if (Math.abs(pctChange) <= DEFAULT_FLAT_TOLERANCE_PCT) {
    // Effectively flat – keep the visuals calm.
    return createNoWinnerResult();
  }

  const pair = pairs.find((p) => p.id === pairId);

  let base: string;
  let quote: string;

  if (pair) {
    ({ base, quote } = pair);
  } else {
    // Fallback: derive from id, e.g. "gbp-usd" → "GBP" / "USD".
    const normalised = pairId.replace(/_/g, '-').toUpperCase();
    const [parsedBase, parsedQuote] = normalised.split('-');

    base = parsedBase ?? pairId.toUpperCase();
    quote = parsedQuote ?? '';
  }

  if (!base || !quote) {
    // Defensive fallback – if we cannot trust the pair metadata, do not
    // claim a winner.
    return createNoWinnerResult();
  }

  // Positive move → base is up → arrow on the left.
  // Negative move → quote is up → arrow on the right.
  const winnerSide: WinningSide = pctChange > 0 ? 'base' : 'quote';
  const winnerCurrency = winnerSide === 'base' ? base : quote;

  return {
    winnerCurrency,
    winnerSide,
    direction: 'up',
  };
}
