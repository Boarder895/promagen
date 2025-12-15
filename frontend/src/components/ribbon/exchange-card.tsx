// frontend/src/components/ribbon/exchange-card.tsx

import React from 'react';

import type { Exchange } from '@/lib/exchange-order';
import Flag from '@/components/ui/flag';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import { localTime } from '@/lib/time';

export type ExchangeRailCardProps = {
  exchange: Exchange;
  weather?: ExchangeWeather | null;
};

function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;

  if (mins === 0) return `GMT${sign}${hours}`;
  return `GMT${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

function getOffsetMinutes(exchange: Exchange): number | null {
  const asRecord = exchange as unknown as Record<string, unknown>;

  if (typeof asRecord.offsetMinutes === 'number' && Number.isFinite(asRecord.offsetMinutes)) {
    return asRecord.offsetMinutes;
  }

  if (typeof asRecord.tzOffsetMinutes === 'number' && Number.isFinite(asRecord.tzOffsetMinutes)) {
    return asRecord.tzOffsetMinutes;
  }

  if (typeof asRecord.tzOffsetMinutes === 'number' && Number.isFinite(asRecord.tzOffsetMinutes)) {
    return asRecord.tzOffsetMinutes;
  }

  return null;
}

function getCountryCode(exchange: Exchange): string | null {
  const asRecord = exchange as unknown as Record<string, unknown>;

  // Prefer a real ISO-2 country code if present.
  if (typeof asRecord.countryCode === 'string' && asRecord.countryCode.trim().length > 0) {
    return asRecord.countryCode.trim();
  }

  // Some older shapes may have used `country` for the code.
  if (typeof asRecord.country === 'string' && asRecord.country.trim().length > 0) {
    return asRecord.country.trim();
  }

  return null;
}

function getWeatherLine(weather: ExchangeWeather | null | undefined): string | null {
  if (!weather) return null;

  const w = weather as unknown as Record<string, unknown>;

  const emoji = typeof w.emoji === 'string' ? w.emoji : null;
  const condition = typeof w.condition === 'string' ? w.condition : null;

  if (emoji && condition) return `${emoji} ${condition}`;
  if (emoji) return emoji;
  if (condition) return condition;

  return null;
}

export function ExchangeRailCard({ exchange, weather }: ExchangeRailCardProps) {
  const offsetMinutes = getOffsetMinutes(exchange);
  const hasOffset = typeof offsetMinutes === 'number';

  const gmt = hasOffset ? formatOffsetMinutes(offsetMinutes) : '';
  const local = hasOffset ? localTime(offsetMinutes) : '';

  const countryCode = getCountryCode(exchange) ?? undefined;
  const weatherLine = getWeatherLine(weather);

  return (
    <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs shadow-sm ring-1 ring-white/10">
      <span className="min-w-0">
        <span className="inline-flex items-center">
          <Flag countryCode={countryCode} className="mr-2" />
          <span className="font-medium">{exchange.name}</span>
        </span>

        <span className="flex flex-col text-[11px] text-slate-500">
          <span className="truncate">{exchange.city}</span>
          <span className="truncate">{gmt}</span>
        </span>
      </span>

      <span className="flex flex-col items-end text-xs text-slate-500">
        {local ? <span className="font-medium text-slate-200">{local}</span> : null}

        {weatherLine ? <span className="inline-flex items-center gap-1">{weatherLine}</span> : null}
      </span>
    </div>
  );
}

export default ExchangeRailCard;
