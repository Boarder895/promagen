// frontend/src/components/home/rails/exchange-card.tsx
'use client';

import * as React from 'react';
import type { Exchange } from '@/lib/exchanges';
import { getExchangeShortLabel } from '@/lib/exchanges';
import Flag from '@/components/ui/flag';
import { localTime } from '@/lib/time';
import {
  ExchangeWeatherBadge,
  type ExchangeWeatherSummary,
} from '@/components/weather/exchange-weather-badge';

type ExchangeCardProps = {
  exchange: Exchange;
  /**
   * Optional weather summary (from SSR route handler).
   * If missing, we render without the weather badge.
   */
  weatherSummary?: ExchangeWeatherSummary | null;
};

function formatGmtOffset(offsetMinutes: number) {
  if (!Number.isFinite(offsetMinutes)) return '';
  if (offsetMinutes === 0) return 'GMT';

  const sign = offsetMinutes > 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);

  const hours = Math.floor(abs / 60);
  const mins = abs % 60;

  return mins === 0 ? `GMT${sign}${hours}` : `GMT${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

function getOffsetMinutes(exchange: Exchange): number | null {
  // Canonical field in your data/tests is `offsetMinutes`.
  const asRecord = exchange as unknown as Record<string, unknown>;

  if (typeof asRecord.offsetMinutes === 'number' && Number.isFinite(asRecord.offsetMinutes)) {
    return asRecord.offsetMinutes;
  }

  // Back-compat: if any older data ever used `tzOffsetMinutes`.
  if (typeof asRecord.tzOffsetMinutes === 'number' && Number.isFinite(asRecord.tzOffsetMinutes)) {
    return asRecord.tzOffsetMinutes;
  }

  return null;
}

export function ExchangeCard({ exchange, weatherSummary }: ExchangeCardProps) {
  const { name, countryCode } = exchange;

  const shortLabel = getExchangeShortLabel(exchange);

  const offsetMinutes = getOffsetMinutes(exchange);
  const hasOffset = typeof offsetMinutes === 'number';

  const localTimeLabel = hasOffset ? localTime(offsetMinutes) : '—:—';
  const gmtLabel = hasOffset ? formatGmtOffset(offsetMinutes) : '';

  const timeAriaLabel = hasOffset ? `Local time ${localTimeLabel}` : 'Local time unavailable';

  return (
    <div
      className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs shadow-sm ring-1 ring-white/10"
      role="group"
      aria-label={`${name} stock exchange`}
      data-exchange-id={exchange.id}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-0.5">
          <div className="flex items-center gap-2">
            <Flag countryCode={countryCode} decorative={false} className="shrink-0" />
            <span className="truncate font-medium">{name}</span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {shortLabel} · {exchange.city}
          </p>
        </div>
      </div>

      <div className="ml-3 flex items-center gap-2">
        {weatherSummary ? <ExchangeWeatherBadge summary={weatherSummary} /> : null}

        <div className="text-right">
          <div className="font-medium" aria-label={timeAriaLabel}>
            {localTimeLabel}
          </div>
          {gmtLabel ? <div className="text-[11px] text-muted-foreground">{gmtLabel}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default ExchangeCard;
