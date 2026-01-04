// frontend/src/components/exchanges/exchange-card.tsx
'use client';

import * as React from 'react';
import type { ExchangeCardProps } from './types';
import Flag from '@/components/ui/flag';
import { LedClock } from './time/led-clock';
import { MarketStatusIndicator } from './time/market-status';
import { ExchangeTemp } from './weather/exchange-temp';
import { ExchangeCondition } from './weather/exchange-condition';

/**
 * ExchangeCard - Unified exchange card component with fixed proportional columns.
 *
 * Layout (CSS Grid with 50%/25%/25% fixed proportions):
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │        50% (2fr)              │     25% (1fr)    │    25% (1fr)           │
 * │     LEFT-ALIGNED              │     CENTERED     │    CENTERED            │
 * │                               │                  │                        │
 * │  New Zealand Exchange (NZX)   │  ┌───────────┐   │                        │
 * │  Wellington           🇳🇿     │  │  14:23    │   │      18°C              │
 * │                      (2x)     │  └───────────┘   │       ☀️               │
 * │                               │     ● Open       │                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Fixed height (h-[76px]) ensures uniform card sizes for rail alignment
 * - Fixed proportions ensure vertical alignment across all cards
 * - Exchange name wraps to 2-3 lines if needed (font size unchanged)
 * - Flag is 2x size (24px), positioned right of city with small gap
 * - Retro 7-segment LED clock with green digits
 * - Time and weather columns are centered
 * - Market open/closed status
 * - Weather temp + condition emoji
 * - Graceful fallbacks when data unavailable
 */
export const ExchangeCard = React.memo(function ExchangeCard({
  exchange,
  className = '',
}: ExchangeCardProps) {
  const { id, name, city, countryCode, tz, hoursTemplate, weather } = exchange;

  return (
    <div
      className={`grid h-[76px] grid-cols-[2fr_1fr_1fr] items-center rounded-lg bg-white/5 px-4 text-sm shadow-sm ring-1 ring-white/10 ${className}`}
      role="group"
      aria-label={`${name} stock exchange`}
      data-exchange-id={id}
      data-testid="exchange-card"
    >
      {/* COLUMN 1 (50%): Exchange Info - LEFT ALIGNED */}
      <div className="min-w-0 pr-2">
        {/* Exchange name (wraps if long) */}
        <p className="font-medium leading-tight text-slate-100 line-clamp-2">{name}</p>
        {/* City + Flag row */}
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-slate-400">{city}</span>
          <Flag
            countryCode={countryCode}
            size={24}
            decorative={false}
            className="shrink-0"
          />
        </div>
      </div>

      {/* COLUMN 2 (25%): LED Clock & Status - CENTERED */}
      <div className="flex flex-col items-center gap-1.5">
        {tz ? (
          <LedClock
            tz={tz}
            showSeconds={false}
            ariaLabel={`Local time in ${city || name}`}
          />
        ) : (
          <div className="inline-flex items-center justify-center rounded bg-slate-900/80 px-2 py-1.5 ring-1 ring-slate-700/50">
            <span className="font-mono text-sm text-slate-500">--:--</span>
          </div>
        )}
        <MarketStatusIndicator tz={tz} hoursTemplate={hoursTemplate} />
      </div>

      {/* COLUMN 3 (25%): Weather - CENTERED */}
      <div className="flex flex-col items-center gap-0.5">
        <ExchangeTemp
          tempC={weather?.tempC ?? null}
          className="text-sm text-slate-200"
        />
        <ExchangeCondition
          emoji={weather?.emoji ?? null}
          condition={weather?.condition ?? null}
        />
      </div>
    </div>
  );
});

export default ExchangeCard;
