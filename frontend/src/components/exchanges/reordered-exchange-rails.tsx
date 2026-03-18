// src/components/exchanges/reordered-exchange-rails.tsx
// ============================================================================
// REORDERED EXCHANGE RAILS — Client-side Pro-aware exchange rail split
// ============================================================================
// Drop-in replacement for server-side getRailsRelative(exchanges, GREENWICH).
// Uses useExchangeOrder() to rotate exchanges for Pro users based on their
// browser timezone. Free/anonymous users see standard Greenwich east→west.
//
// Used on pages that previously did server-side Greenwich splitting:
//   - /providers/[id] (prompt builder)
//   - /studio/playground (prompt lab)
//
// Authority: docs/authority/exchange-ordering.md
// Existing features preserved: Yes — free users see identical ordering.
// ============================================================================

'use client';

import React from 'react';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import { useExchangeOrder } from '@/hooks/use-exchange-order';
import ExchangeList from '@/components/ribbon/exchange-list';

export interface ReorderedExchangeRailsProps {
  /** All exchanges (flat, east→west from server) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data map keyed by exchange ID */
  weatherByExchange: Map<string, ExchangeWeatherData>;
  /** Empty message for left rail */
  leftEmptyMessage?: string;
  /** Empty message for right rail */
  rightEmptyMessage?: string;
}

/**
 * Client component that splits exchanges into left/right rails with
 * Pro-aware ordering. Pro users see exchanges anchored to their timezone.
 * Free/anonymous users see standard Greenwich east→west ordering.
 */
export function ReorderedExchangeRails({
  exchanges,
  weatherByExchange,
  leftEmptyMessage = 'No eastern exchanges selected yet.',
  rightEmptyMessage = 'No western exchanges selected yet.',
}: ReorderedExchangeRailsProps) {
  const { left, right } = useExchangeOrder(exchanges);

  return {
    leftContent: (
      <ExchangeList
        exchanges={left}
        weatherByExchange={weatherByExchange}
        emptyMessage={leftEmptyMessage}
        side="left"
      />
    ),
    rightContent: (
      <ExchangeList
        exchanges={right}
        weatherByExchange={weatherByExchange}
        emptyMessage={rightEmptyMessage}
        side="right"
      />
    ),
  };
}

/**
 * Hook-style wrapper that returns left/right ReactNode content.
 * Avoids fragment issues — callers destructure { leftContent, rightContent }.
 */
export function useReorderedRails(
  exchanges: ReadonlyArray<Exchange>,
  weatherByExchange: Map<string, ExchangeWeatherData>,
) {
  const { left, right } = useExchangeOrder(exchanges);

  const leftContent = React.useMemo(() => (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherByExchange}
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
      side="left"
    />
  ), [left, weatherByExchange]);

  const rightContent = React.useMemo(() => (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherByExchange}
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
      side="right"
    />
  ), [right, weatherByExchange]);

  return { leftContent, rightContent };
}
