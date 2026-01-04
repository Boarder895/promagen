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
 * Layout:
 * - Card wrapper matches AI providers table styling (rounded, dark bg, ring border)
 * - Fills available height from parent (flex-1)
 * - Scrolls internally when exchanges overflow
 * - Subtle thin scrollbar styling
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
        className="flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
        data-testid={testId}
      >
        <div
          className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
          aria-live="polite"
        >
          <p className="text-sm text-slate-400">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      role="complementary"
      aria-label={ariaLabel}
      className="flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid={testId}
    >
      {/* Scrollable container - fills available height, scrolls when needed */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        {exchanges.map((exchange) => {
          const weather = weatherByExchange?.get(exchange.id) ?? null;
          return (
            <ExchangeCard
              key={exchange.id}
              exchange={toCardData(exchange, weather)}
            />
          );
        })}
      </div>
    </section>
  );
}
