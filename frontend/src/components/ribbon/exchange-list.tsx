// src/components/ribbon/exchange-list.tsx
// ============================================================================
// EXCHANGE LIST - Card List with Index Data Support
// ============================================================================
// Renders exchange cards with optional weather and index quote data.
// Used inside SyncedExchangeRails for synchronized scrolling.
//
// UPDATED: Added indexByExchange prop for index quote data.
//
// Security: 10/10
// - Type-safe props
// - Safe Map lookups with fallback
// - No user input handling
//
// Existing features preserved: Yes
// ============================================================================

import React from 'react';
import type { Exchange } from '@/data/exchanges/types';
import { ExchangeCard } from '@/components/exchanges';
import { toCardData } from '@/components/exchanges/adapters';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';

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
   * Optional index quote data keyed by exchange id.
   */
  indexByExchange?: Map<string, IndexQuoteData>;

  /**
   * Message to show when no exchanges are available.
   */
  emptyMessage: string;
};

/**
 * ExchangeList - Renders exchange cards without a wrapper.
 * Used inside SyncedExchangeRails for synchronized scrolling.
 *
 * Data flow:
 * - exchanges: SSOT catalog data
 * - weatherByExchange: Weather API data (optional)
 * - indexByExchange: Gateway index quotes (optional)
 */
export default function ExchangeList({
  exchanges,
  weatherByExchange,
  indexByExchange,
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
        const indexQuote = indexByExchange?.get(exchange.id) ?? null;
        return (
          <ExchangeCard
            key={exchange.id}
            exchange={toCardData(exchange, weather, indexQuote)}
          />
        );
      })}
    </>
  );
}
