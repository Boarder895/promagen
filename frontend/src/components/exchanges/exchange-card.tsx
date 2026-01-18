// frontend/src/components/exchanges/exchange-card.tsx
// ============================================================================
// EXCHANGE CARD - With Stock Index Row + Warm Glow Hover
// ============================================================================
// Unified exchange card component with:
// - Top section: Exchange info | Clock | Weather
// - Bottom section: Index quote row (ALWAYS VISIBLE)
//
// INDEX ROW BEHAVIOUR:
// - Index name from catalog (always shown)
// - Price/change from API (shows placeholder when no quote is present)
//
// Existing features preserved: Yes
// ============================================================================
'use client';

import * as React from 'react';
import { useState } from 'react';
import type { ExchangeCardProps, IndexQuoteData } from './types';
import Flag from '@/components/ui/flag';
import { LedClock } from './time/led-clock';
import { MarketStatusIndicator } from './time/market-status';
import { ExchangeTemp } from './weather/exchange-temp';
import { ExchangeCondition } from './weather/exchange-condition';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_HOVER_COLOR = '#A855F7';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ============================================================================
// HELPERS
// ============================================================================

function sanitizeHexColor(color: string | undefined): string {
  if (!color) return DEFAULT_HOVER_COLOR;
  if (HEX_COLOR_REGEX.test(color)) return color;
  return DEFAULT_HOVER_COLOR;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(168, 85, 247, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '—';
  return price.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(change: number): string {
  if (!Number.isFinite(change)) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '—';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

// ============================================================================
// INDEX ROW COMPONENT - WITH DATA
// ============================================================================

interface IndexRowWithDataProps {
  quote: IndexQuoteData;
}

const IndexRowWithData = React.memo(function IndexRowWithData({ quote }: IndexRowWithDataProps) {
  const { indexName, price, change, percentChange, tick } = quote;

  const tickColorClass =
    tick === 'up' ? 'text-emerald-400' : tick === 'down' ? 'text-rose-400' : 'text-slate-400';

  const tickArrow = tick === 'up' ? '▲' : tick === 'down' ? '▼' : '•';

  const srText = `${indexName}: ${formatPrice(price)}, change ${formatChange(change)} (${formatPercent(
    percentChange,
  )})`;

  return (
    <div
      className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2.5"
      role="group"
      aria-label={srText}
    >
      <span className="shrink-0 text-xs font-medium text-slate-300">{indexName}</span>

      <div className="flex items-center gap-3 text-xs">
        <span className="tabular-nums font-semibold text-slate-100">{formatPrice(price)}</span>

        <span className={`flex items-center gap-1 tabular-nums ${tickColorClass}`}>
          <span className="text-[10px]" aria-hidden="true">
            {tickArrow}
          </span>
          <span>
            {formatChange(change)} ({formatPercent(percentChange)})
          </span>
        </span>
      </div>
    </div>
  );
});

// ============================================================================
// INDEX ROW COMPONENT - PLACEHOLDER
// ============================================================================

interface IndexRowPlaceholderProps {
  indexName: string;
}

const IndexRowPlaceholder = React.memo(function IndexRowPlaceholder({
  indexName,
}: IndexRowPlaceholderProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2.5"
      role="group"
      aria-label={`${indexName}: awaiting price data`}
    >
      <span className="shrink-0 text-xs font-medium text-slate-300">{indexName}</span>

      <div className="flex items-center gap-3 text-xs">
        <span className="tabular-nums font-semibold text-slate-500 animate-pulse">···</span>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type LegacyExchangeShape = {
  exchange?: string;
  iso2?: string;
  marketstack?: { indexName?: string } | null;
};

export const ExchangeCard = React.memo(function ExchangeCard({
  exchange,
  className = '',
}: ExchangeCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Support both the unified card shape and the SSOT catalogue shape.
  const ex = exchange as typeof exchange & LegacyExchangeShape;

  const id = ex.id;
  const ribbonLabel = ex.ribbonLabel;
  const city = ex.city;
  const tz = ex.tz;
  const hoursTemplate = ex.hoursTemplate;
  const weather = ex.weather ?? null;
  const indexQuote = ex.indexQuote;
  const hoverColor = ex.hoverColor;

  const name = ex.name ?? ex.exchange ?? ex.city ?? ex.id;
  const countryCode = ex.countryCode ?? ex.iso2 ?? '';
  const indexName = ex.indexName ?? ex.marketstack?.indexName ?? '';

  const displayName = ribbonLabel ?? name;

  const hasIndexData = indexQuote !== null && indexQuote !== undefined;
  const hasIndexName = typeof indexName === 'string' && indexName.length > 0;

  const safeHoverColor = sanitizeHexColor(hoverColor);
  const glowRgba = hexToRgba(safeHoverColor, 0.3);
  const glowBorder = hexToRgba(safeHoverColor, 0.5);
  const glowSoft = hexToRgba(safeHoverColor, 0.15);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${isHovered ? glowBorder : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: isHovered
      ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'all 200ms ease-out',
  };

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg ${className}`}
      style={cardStyle}
      role="group"
      aria-label={`${name} stock exchange`}
      data-exchange-id={id}
      data-testid="exchange-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 grid h-[76px] grid-cols-[2fr_1fr_1fr] items-center px-4 text-sm">
        <div className="min-w-0 pr-2">
          <p className="ribbon-chip-label font-medium leading-tight text-slate-100">
            {displayName}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-xs text-slate-400">{city}</span>
            <Flag countryCode={countryCode} size={24} decorative={false} className="shrink-0" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {tz ? (
            <LedClock tz={tz} showSeconds={false} ariaLabel={`Local time in ${city || name}`} />
          ) : (
            <div className="inline-flex items-center justify-center rounded bg-slate-900/80 px-2 py-1.5 ring-1 ring-slate-700/50">
              <span className="font-mono text-sm text-slate-500">--:--</span>
            </div>
          )}
          <MarketStatusIndicator tz={tz} hoursTemplate={hoursTemplate} />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ExchangeTemp tempC={weather?.tempC ?? null} className="text-sm text-slate-200" />
          <ExchangeCondition
            emoji={weather?.emoji ?? null}
            condition={weather?.condition ?? null}
          />
        </div>
      </div>

      <div className="relative z-10">
        {hasIndexData ? (
          <IndexRowWithData quote={indexQuote as IndexQuoteData} />
        ) : hasIndexName ? (
          <IndexRowPlaceholder indexName={indexName} />
        ) : null}
      </div>
    </div>
  );
});

export default ExchangeCard;
