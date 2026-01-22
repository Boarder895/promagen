// frontend/src/components/home/rails/exchange-column.tsx
// ============================================================================
// EXCHANGE COLUMN - VERTICAL LIST OF EXCHANGE CARDS
// ============================================================================
// Renders a vertical column of exchange cards for the homepage rails.
//
// UPDATES (20 Jan 2026):
// - Continues to pass `railPosition` prop to ExchangeCard
// - Note: Both rails now have tooltips that open to the LEFT
// - railPosition kept for potential future differentiation
//
// Existing features preserved: Yes
// ============================================================================
'use client';

import React from 'react';
import type { Exchange } from '@/data/exchanges/types';
import { ExchangeCard } from '@/components/exchanges';
import { toCardData } from '@/components/exchanges/adapters';

export type ExchangeColumnSide = 'left' | 'right';

type ExchangeColumnProps = {
  /**
   * Already-sorted list of exchanges for this side of the homepage.
   */
  exchanges: Exchange[];

  /**
   * Used for accessible labelling, analytics hooks, and tooltip positioning.
   * Note: Both left and right rails now open tooltips to the LEFT.
   */
  side: ExchangeColumnSide;

  /**
   * Prompt tier for weather tooltips (1-4). Default: 4 (free)
   */
  promptTier?: 1 | 2 | 3 | 4;

  /**
   * Whether user is Pro tier
   */
  isPro?: boolean;
};

/**
 * ExchangeColumn - Renders a vertical column of exchange cards.
 *
 * Used on the homepage to display the left (eastern) and right (western)
 * rails of stock exchanges.
 *
 * Passes the `side` prop as `railPosition` to each card.
 * Note: Tooltips now open LEFT for BOTH rails to ensure visibility.
 */
export default function ExchangeColumn({
  exchanges,
  side,
  promptTier = 4,
  isPro = false,
}: ExchangeColumnProps): JSX.Element {
  const ariaLabel = side === 'left' ? 'Eastern exchanges' : 'Western exchanges';

  return (
    <div className="space-y-3" role="list" aria-label={ariaLabel}>
      {exchanges.map((exchange) => (
        <div key={exchange.id} role="listitem">
          <ExchangeCard
            exchange={toCardData(exchange)}
            railPosition={side}
            promptTier={promptTier}
            isPro={isPro}
          />
        </div>
      ))}
    </div>
  );
}
