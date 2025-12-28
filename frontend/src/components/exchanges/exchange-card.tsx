// frontend/src/components/exchanges/exchange-card.tsx
'use client';

import * as React from 'react';
import type { ExchangeCardProps } from './types';
import Flag from '@/components/ui/flag';
import { ExchangeClock } from './time/exchange-clock';
import { MarketStatusIndicator } from './time/market-status';
import { ExchangeTemp } from './weather/exchange-temp';
import { ExchangeCondition } from './weather/exchange-condition';

/**
 * ExchangeCard - Unified exchange card component with 3-column layout.
 *
 * Layout (fixed column widths for consistent spacing):
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  LEFT COLUMN (flex)  │  CENTER (80px)       │  RIGHT (48px)          │
 * │  (Exchange Info)     │  (Time & Status)     │  (Weather)             │
 * │                      │                      │                        │
 * │  🇳🇿 New Zealand     │    14:23:45          │   18°C                 │
 * │     Exchange (NZX)   │    ● Open            │    ☀️                  │
 * │     Wellington       │                      │                        │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Fixed column widths ensure consistent gaps across all screen sizes
 * - Double height (py-4)
 * - 3-column grid (no visible dividers)
 * - Live ticking clock
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
      className={`grid grid-cols-[1fr_5rem_3rem] items-center gap-4 rounded-lg bg-white/5 px-4 py-4 text-sm shadow-sm ring-1 ring-white/10 ${className}`}
      role="group"
      aria-label={`${name} stock exchange`}
      data-exchange-id={id}
      data-testid="exchange-card"
    >
      {/* LEFT COLUMN: Exchange Info (flexible width) */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <Flag
            countryCode={countryCode}
            decorative={false}
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium leading-tight text-slate-100">{name}</p>
            <p className="truncate text-xs text-slate-400">{city}</p>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: Time & Status (fixed 5rem / 80px) */}
      <div className="flex flex-col items-center gap-1">
        {tz ? (
          <ExchangeClock
            tz={tz}
            className="font-mono text-base font-semibold tabular-nums text-slate-100"
            ariaLabel={`Local time in ${city || name}`}
          />
        ) : (
          <span className="font-mono text-base font-semibold tabular-nums text-slate-400">
            --:--:--
          </span>
        )}
        <MarketStatusIndicator
          tz={tz}
          hoursTemplate={hoursTemplate}
        />
      </div>

      {/* RIGHT COLUMN: Weather (fixed 3rem / 48px) */}
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
