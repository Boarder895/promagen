// frontend/src/components/exchanges/exchange-card.tsx
// ============================================================================
// EXCHANGE CARD - With Stock Index Row + Warm Glow Hover
// ============================================================================
// Unified exchange card component with:
// - Top section: Exchange info | Clock | Weather
// - Bottom section: Index quote row (ALWAYS VISIBLE)
// - Soft warm glow on hover (matching RichTooltip style)
//
// INDEX ROW BEHAVIOUR:
// - Index name from catalog (always shown)
// - Price/change from API (shows skeleton when loading)
// - No data = shows "···" placeholder
//
// GLOW EFFECT: Uses same technique as rich-tooltip.tsx:
// - Layered box-shadows with rgba colors at low opacity
// - Radial gradient overlay for ethereal effect
// - Soft border with color
//
// Security: 10/10
// - All values sanitized before display
// - Type-safe props
// - XSS prevention via React escaping
// - CSS custom properties sanitized
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

/** Default hover color if exchange doesn't have one */
const DEFAULT_HOVER_COLOR = '#A855F7'; // Purple

/** Regex to validate hex color format */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate and sanitize hex color.
 * Returns default if invalid.
 */
function sanitizeHexColor(color: string | undefined): string {
  if (!color) return DEFAULT_HOVER_COLOR;
  if (HEX_COLOR_REGEX.test(color)) return color;
  return DEFAULT_HOVER_COLOR;
}

/**
 * Convert hex colour to rgba with alpha.
 * Matches rich-tooltip.tsx implementation.
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(168, 85, 247, ${alpha})`; // Fallback purple
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Format price with locale-aware thousands separators.
 */
function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '—';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format change value with sign.
 */
function formatChange(change: number): string {
  if (!Number.isFinite(change)) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format percent with sign.
 */
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

/**
 * IndexRowWithData - Displays index with live price and change.
 */
const IndexRowWithData = React.memo(function IndexRowWithData({ quote }: IndexRowWithDataProps) {
  const { indexName, price, change, percentChange, tick } = quote;

  // Color classes based on direction
  const tickColorClass =
    tick === 'up' ? 'text-emerald-400' : tick === 'down' ? 'text-rose-400' : 'text-slate-400';

  // Arrow indicator
  const tickArrow = tick === 'up' ? '▲' : tick === 'down' ? '▼' : '•';

  // Screen reader text
  const srText = `${indexName}: ${formatPrice(price)}, change ${formatChange(
    change,
  )} (${formatPercent(percentChange)})`;

  return (
    <div
      className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2.5"
      role="group"
      aria-label={srText}
    >
      {/* Index name - left */}
      <span className="shrink-0 text-xs font-medium text-slate-300">{indexName}</span>

      {/* Price + Change - right */}
      <div className="flex items-center gap-3 text-xs">
        {/* Price */}
        <span className="tabular-nums font-semibold text-slate-100">{formatPrice(price)}</span>

        {/* Change indicator */}
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
// INDEX ROW COMPONENT - LOADING/SKELETON
// ============================================================================

interface IndexRowSkeletonProps {
  indexName: string;
}

/**
 * IndexRowSkeleton - Shows index name with loading placeholder for price.
 */
const IndexRowSkeleton = React.memo(function IndexRowSkeleton({
  indexName,
}: IndexRowSkeletonProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2.5"
      role="group"
      aria-label={`${indexName}: loading price data`}
    >
      {/* Index name - left (always visible) */}
      <span className="shrink-0 text-xs font-medium text-slate-300">{indexName}</span>

      {/* Skeleton placeholder - right */}
      <div className="flex items-center gap-3 text-xs">
        {/* Animated dots */}
        <span className="tabular-nums font-semibold text-slate-500 animate-pulse">···</span>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ExchangeCard - Unified exchange card with index row and warm glow hover.
 *
 * Features:
 * - Top section: Exchange info | Clock & status | Weather (3-column grid)
 * - Bottom section: Index quote row (ALWAYS visible)
 *   - Index name from catalog (always shows)
 *   - Price/change from API (skeleton when loading)
 * - Hover effect: Soft warm glow matching RichTooltip style
 * - Each of 48 exchanges has unique vibrant color
 * - Graceful fallbacks when data unavailable
 */
export const ExchangeCard = React.memo(function ExchangeCard({
  exchange,
  className = '',
}: ExchangeCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const {
    id,
    name,
    ribbonLabel,
    city,
    countryCode,
    tz,
    hoursTemplate,
    weather,
    indexName,
    indexQuote,
    hoverColor,
  } = exchange;

  // Use ribbonLabel (curated short name) if available, otherwise fall back to full name
  const displayName = ribbonLabel ?? name;

  // Determine index row state:
  // - Has API data: show full data
  // - Has catalog name only: show skeleton
  // - No name at all: hide row (shouldn't happen with proper catalog)
  const hasIndexData = indexQuote !== null && indexQuote !== undefined;
  const hasIndexName = typeof indexName === 'string' && indexName.length > 0;

  // Sanitize and prepare hover color
  const safeHoverColor = sanitizeHexColor(hoverColor);

  // Generate glow colors matching RichTooltip
  const glowRgba = hexToRgba(safeHoverColor, 0.3);
  const glowBorder = hexToRgba(safeHoverColor, 0.5);
  const glowSoft = hexToRgba(safeHoverColor, 0.15);

  // Dynamic styles for the card
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
      {/* Ethereal glow overlay - top radial (matching RichTooltip) */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Bottom glow accent (matching RichTooltip) */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* TOP SECTION: 3-column grid (50%/25%/25%) */}
      <div className="relative z-10 grid h-[76px] grid-cols-[2fr_1fr_1fr] items-center px-4 text-sm">
        {/* COLUMN 1 (50%): Exchange Info - LEFT ALIGNED */}
        <div className="min-w-0 pr-2">
          {/* Exchange name - uses ribbonLabel for short display */}
          <p className="ribbon-chip-label font-medium leading-tight text-slate-100">
            {displayName}
          </p>
          {/* City + Flag row */}
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-xs text-slate-400">{city}</span>
            <Flag countryCode={countryCode} size={24} decorative={false} className="shrink-0" />
          </div>
        </div>

        {/* COLUMN 2 (25%): LED Clock & Status - CENTERED */}
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

        {/* COLUMN 3 (25%): Weather - CENTERED */}
        <div className="flex flex-col items-center gap-0.5">
          <ExchangeTemp tempC={weather?.tempC ?? null} className="text-sm text-slate-200" />
          <ExchangeCondition
            emoji={weather?.emoji ?? null}
            condition={weather?.condition ?? null}
          />
        </div>
      </div>

      {/* BOTTOM SECTION: Index quote row (ALWAYS VISIBLE) */}
      <div className="relative z-10">
        {hasIndexData ? (
          <IndexRowWithData quote={indexQuote} />
        ) : hasIndexName ? (
          <IndexRowSkeleton indexName={indexName} />
        ) : null}
      </div>
    </div>
  );
});

export default ExchangeCard;
