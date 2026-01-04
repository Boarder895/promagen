// src/components/ribbon/exchange-list.tsx

import React from 'react';
import type { Exchange } from '@/data/exchanges/types';
import { ExchangeCard } from '@/components/exchanges';
import { toCardData } from '@/components/exchanges/adapters';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

export type ExchangeListProps = {
  /**
   * List of exchanges to display.
   */
  exchanges: ReadonlyArray<Exchange>;

  /**
   * Optional weather data keyed by exchange id.
   */
  weatherByExchange?: Map<string, ExchangeWeatherData>;

  /**
   * Message to show when no exchanges are available.
   */
  emptyMessage: string;
};

/**
 * ExchangeList - Renders exchange cards without a wrapper.
 * Used inside SyncedExchangeRails for synchronized scrolling.
 */
export default function ExchangeList({
  exchanges,
  weatherByExchange,
  emptyMessage,
}: ExchangeListProps): JSX.Element {
  if (!exchanges.length) {
    return (
      <div
        className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
        aria-live="polite"
      >
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {exchanges.map((exchange) => {
        const weather = weatherByExchange?.get(exchange.id) ?? null;
        return (
          <ExchangeCard
            key={exchange.id}
            exchange={toCardData(exchange, weather)}
          />
        );
      })}
    </>
  );
}
