// frontend/src/components/ribbon/exchange-rail.tsx

import React from 'react';
import type { Exchange } from '@/data/exchanges/types';
import { ExchangeCard } from '@/components/exchanges';
import { toCardData } from '@/components/exchanges/adapters';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

export type ExchangeRailProps = {
  /**
   * List of exchanges to display in the rail.
   */
  exchanges: ReadonlyArray<Exchange>;

  /**
   * Optional weather data keyed by exchange id.
   * When API is connected, this will contain real weather data.
   */
  weatherByExchange?: Map<string, ExchangeWeatherData>;

  /**
   * Accessible label for the rail, e.g. "Eastern exchanges".
   */
  ariaLabel: string;

  /**
   * Optional test id so route-level tests can assert the rails exist.
   */
  testId?: string;

  /**
   * Message to show when no exchanges are available for this rail.
   */
  emptyMessage: string;
};

/**
 * ExchangeRail - Shared exchange rail used on the homepage and provider-detail route.
 *
 * It stays "dumb": receives pre-sorted exchanges and an optional weather
 * index, and renders a vertical column of cards or a friendly empty state.
 */
export default function ExchangeRail({
  exchanges,
  weatherByExchange,
  ariaLabel,
  testId,
  emptyMessage,
}: ExchangeRailProps): JSX.Element {
  if (!exchanges.length) {
    return (
      <section
        role="complementary"
        aria-label={ariaLabel}
        className="space-y-3"
        data-testid={testId}
      >
        <div
          className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200"
          aria-live="polite"
        >
          <p className="text-sm text-slate-600">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      role="complementary"
      aria-label={ariaLabel}
      className="space-y-3"
      data-testid={testId}
    >
      {exchanges.map((exchange) => {
        const weather = weatherByExchange?.get(exchange.id) ?? null;
        return (
          <ExchangeCard
            key={exchange.id}
            exchange={toCardData(exchange, weather)}
          />
        );
      })}
    </section>
  );
}
