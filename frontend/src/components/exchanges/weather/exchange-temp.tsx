// frontend/src/components/exchanges/weather/exchange-temp.tsx
'use client';

import * as React from 'react';

export type ExchangeTempProps = {
  /** Temperature in Celsius; null shows fallback */
  tempC: number | null;
  /** Optional className for styling */
  className?: string;
};

/**
 * ExchangeTemp - Displays temperature in Celsius.
 *
 * Shows "—" when temperature data is unavailable.
 * Never shows fake/demo temperatures.
 */
export const ExchangeTemp = React.memo(function ExchangeTemp({
  tempC,
  className = '',
}: ExchangeTempProps) {
  const hasTemp = typeof tempC === 'number' && Number.isFinite(tempC);

  return (
    <span
      className={`font-medium tabular-nums ${className}`}
      aria-label={hasTemp ? `${Math.round(tempC)}°C` : 'Temperature unavailable'}
    >
      {hasTemp ? `${Math.round(tempC)}°C` : '—'}
    </span>
  );
});

export default ExchangeTemp;
