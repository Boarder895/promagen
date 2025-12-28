// frontend/src/components/home/rails/exchange-column.tsx
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
   * Used for accessible labelling and analytics hooks.
   */
  side: ExchangeColumnSide;
};

/**
 * ExchangeColumn - Renders a vertical column of exchange cards.
 *
 * Used on the homepage to display the left (eastern) and right (western)
 * rails of stock exchanges.
 */
export default function ExchangeColumn({
  exchanges,
  side,
}: ExchangeColumnProps): JSX.Element {
  const ariaLabel = side === 'left' ? 'Eastern exchanges' : 'Western exchanges';

  return (
    <div className="space-y-3" role="list" aria-label={ariaLabel}>
      {exchanges.map((exchange) => (
        <div key={exchange.id} role="listitem">
          <ExchangeCard exchange={toCardData(exchange)} />
        </div>
      ))}
    </div>
  );
}
