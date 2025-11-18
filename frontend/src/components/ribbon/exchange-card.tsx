// src/components/ribbon/exchange-card.tsx

import React from 'react';

import type { Exchange } from '@/lib/exchange-order';
import { flag } from '@/lib/flags';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import { resolveFeelsLike, resolveWeatherIcon } from '@/lib/weather/weather';

export type ExchangeRailCardProps = {
  exchange: Exchange;
  weather?: ExchangeWeather | null;
};

/**
 * Compact exchange card used in the homepage and provider-detail rails.
 *
 * Responsibility:
 * - Render flag, name, longitude and optional weather snapshot.
 * - Stay completely stateless; all data is passed in via props.
 */
export default function ExchangeRailCard({
  exchange,
  weather,
}: ExchangeRailCardProps): JSX.Element {
  const hasWeather = Boolean(weather);

  const feelsLike = weather != null ? resolveFeelsLike(weather.tempC, weather.feelsLikeC) : null;

  const icon = weather != null ? resolveWeatherIcon(weather) : null;

  const rawCondition = weather?.condition ?? '';
  const conditionLabel =
    rawCondition.length > 0 ? rawCondition.charAt(0).toUpperCase() + rawCondition.slice(1) : '';

  const longitudeLabel = exchange.longitude.toFixed(2);

  return (
    <article
      className="flex items-center justify-between rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-slate-200"
      aria-label={`${exchange.name} exchange`}
    >
      <span className="inline-flex items-center">
        <span className="mr-2" aria-hidden="true">
          {flag(exchange.country)}
        </span>
        <span className="font-medium">{exchange.name}</span>
      </span>

      <span className="flex flex-col items-end text-xs text-slate-500">
        {hasWeather && (
          <span className="mb-0.5 inline-flex items-center gap-1 leading-none">
            {icon && (
              <span aria-hidden="true" className="text-base">
                {icon}
              </span>
            )}
            {typeof feelsLike === 'number' && Number.isFinite(feelsLike) ? (
              <span className="tabular-nums">{Math.round(feelsLike)}°C</span>
            ) : (
              <span className="tabular-nums">{weather ? Math.round(weather.tempC) : '–'}°C</span>
            )}
          </span>
        )}

        <span className="tabular-nums" aria-label={`Longitude ${longitudeLabel} degrees`}>
          {longitudeLabel}°
        </span>

        {hasWeather && conditionLabel && (
          <span className="text-[11px] leading-tight text-slate-400">{conditionLabel}</span>
        )}
      </span>
    </article>
  );
}
