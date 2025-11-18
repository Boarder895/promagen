// src/components/ribbon/exchange-rail.tsx

import React from 'react';

import type { Exchange } from '@/lib/exchange-order';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import ExchangeRailCard from '@/components/ribbon/exchange-card';

export type ExchangeRailProps = {
  exchanges: ReadonlyArray<Exchange>;
  weatherByExchange?: Map<string, ExchangeWeather>;
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
 * Shared exchange rail used on the homepage and provider-detail route.
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
        <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200" aria-live="polite">
          <p className="text-sm text-slate-600">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section role="complementary" aria-label={ariaLabel} className="space-y-3" data-testid={testId}>
      {exchanges.map((exchange) => (
        <ExchangeRailCard
          key={exchange.id}
          exchange={exchange}
          weather={weatherByExchange?.get(exchange.id) ?? null}
        />
      ))}
    </section>
  );
}
