// frontend/src/components/exchanges/exchange-card.tsx
// ============================================================================
// EXCHANGE CARD - WITH RIGHT-SIDE BOX FOR WEATHER + COSMIC EVENTS
// ============================================================================
// Unified exchange card component with:
// - Left section: Exchange info + Clock (top) | Index quote row (bottom)
// - Right section: Full-height box with weather (top) + empty space (future cosmic)
// - Horizontal divider under exchange name row (stops at vertical line)
// - Vertical divider runs full height from top to bottom
//
// UPDATES (20 Jan 2026):
// - Full-height vertical divider creates right-side box
// - Horizontal line under exchange name only (NOT under weather)
// - Weather stays in top of right box
// - Empty space below weather reserved for future cosmic events
// - Both rails: tooltips open LEFT and CAN EXTEND OUTSIDE card boundary
// - Removed overflow-hidden from card to allow tooltip overflow
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
import { WeatherPromptTooltip } from './weather/weather-prompt-tooltip';
import type { ExchangeWeatherDisplay } from '@/lib/weather/weather-types';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// TYPES
// ============================================================================

/** Extended weather data that may include additional fields beyond the base type */
interface ExtendedWeatherData {
  tempC?: number | null;
  tempF?: number | null;
  emoji?: string | null;
  condition?: string | null;
  humidity?: number | null;
  windKmh?: number | null;
  windSpeedKmh?: number | null;
  description?: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_HOVER_COLOR = '#A855F7';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// Consistent emoji size class
const EMOJI_SIZE_CLASS = 'inline-flex items-center justify-center w-5 h-5 text-base leading-none';
const EMOJI_SIZE_CLASS_SM = 'inline-flex items-center justify-center w-4 h-4 text-sm leading-none';

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
// INDEX ROW COMPONENT - WITH DATA (TIGHTER SPACING)
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
    <div className="flex items-center gap-2 px-4 py-2.5" role="group" aria-label={srText}>
      {/* Index name - left aligned */}
      <span className="shrink-0 text-xs font-medium text-slate-300">{indexName}</span>

      {/* Price and change - directly after index name with small gap */}
      <div className="flex items-center gap-2 text-xs">
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
      className="flex items-center gap-2 px-4 py-2.5"
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
// WEATHER SECTION COMPONENT - FOR RIGHT BOX (TOP)
// ============================================================================

interface WeatherSectionProps {
  city: string;
  tz: string;
  weather: ExchangeWeatherDisplay;
  promptTier?: PromptTier;
  isPro?: boolean;
  /** Which rail the card is in - controls tooltip direction */
  railPosition?: 'left' | 'right';
}

const WeatherSection = React.memo(function WeatherSection({
  city,
  tz,
  weather,
  promptTier = 4,
  isPro = false,
  railPosition: _railPosition = 'left',
}: WeatherSectionProps) {
  const { tempC, tempF, emoji, humidity, windKmh } = weather;

  // No weather data
  if (tempC === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 text-slate-500">
        <span className="text-sm">—</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Line 1: Temp + Emoji with tooltip - text-xs for consistency */}
      <div className="flex items-center gap-2 text-xs">
        <span className="tabular-nums text-slate-200">
          {Math.round(tempC)}°C / {Math.round(tempF ?? (tempC * 9) / 5 + 32)}°F
        </span>
        {emoji && (
          <WeatherPromptTooltip
            city={city}
            tz={tz}
            weather={weather}
            tier={promptTier}
            isPro={isPro}
            tooltipPosition="left"
          >
            <span
              className={EMOJI_SIZE_CLASS}
              role="img"
              aria-label={weather.condition ?? 'Weather'}
            >
              {emoji}
            </span>
          </WeatherPromptTooltip>
        )}
      </div>

      {/* Line 2: Wind + Humidity - SAME SIZE as row 1 (text-xs) */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-0.5" title={`Wind: ${windKmh ?? 0} km/h`}>
          <span className={EMOJI_SIZE_CLASS_SM} aria-hidden="true">
            💨
          </span>
          <span className="tabular-nums">{windKmh ?? 0}km/h</span>
        </span>
        <span className="flex items-center gap-0.5" title={`Humidity: ${humidity ?? 0}%`}>
          <span className={EMOJI_SIZE_CLASS_SM} aria-hidden="true">
            💧
          </span>
          <span className="tabular-nums">{humidity ?? 0}%</span>
        </span>
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

// Extended props for weather prompt tier and rail position
interface ExtendedExchangeCardProps extends ExchangeCardProps {
  /** Prompt tier for weather tooltip (1-4). Default: 4 (free) */
  promptTier?: PromptTier;
  /** Whether user is Pro tier */
  isPro?: boolean;
  /** Which rail the card is in - controls tooltip direction */
  railPosition?: 'left' | 'right';
}

export const ExchangeCard = React.memo(function ExchangeCard({
  exchange,
  className = '',
  promptTier = 4,
  isPro = false,
  railPosition = 'left',
}: ExtendedExchangeCardProps) {
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

  // Convert old weather format to new display format
  const extWeather = weather as ExtendedWeatherData | null;
  const weatherDisplay: ExchangeWeatherDisplay = extWeather
    ? {
        tempC: extWeather.tempC ?? null,
        tempF: extWeather.tempC ? (extWeather.tempC * 9) / 5 + 32 : null,
        emoji: extWeather.emoji ?? null,
        condition: extWeather.condition ?? null,
        humidity: extWeather.humidity ?? null,
        windKmh: extWeather.windKmh ?? extWeather.windSpeedKmh ?? null,
        description: extWeather.description ?? extWeather.condition ?? null,
      }
    : {
        tempC: null,
        tempF: null,
        emoji: null,
        condition: null,
        humidity: null,
        windKmh: null,
        description: null,
      };

  return (
    <div
      className={`relative rounded-lg ${className}`}
      style={cardStyle}
      role="group"
      aria-label={`${name} stock exchange`}
      data-exchange-id={id}
      data-rail={railPosition}
      data-testid="exchange-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ethereal glow - top radial */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Ethereal glow - bottom radial */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* ================================================================== */}
      {/* MAIN LAYOUT: Left section + Vertical Divider + Right Box          */}
      {/* ================================================================== */}
      <div className="relative z-10 flex">
        {/* LEFT SECTION: Exchange info (top) + Index row (bottom) */}
        <div className="flex-1 flex flex-col">
          {/* TOP ROW: Exchange Name + Clock */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3">
            {/* Exchange Name + City + Flag */}
            <div className="min-w-0">
              <p className="ribbon-chip-label font-medium leading-tight text-slate-100 truncate">
                {displayName}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="truncate text-xs text-slate-400">{city}</span>
                <Flag countryCode={countryCode} size={24} decorative={false} className="shrink-0" />
              </div>
            </div>

            {/* Clock + Market Status */}
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
          </div>

          {/* HORIZONTAL DIVIDER: Under exchange name row (stops at vertical line) */}
          <div className="border-t border-white/5" aria-hidden="true" />

          {/* BOTTOM ROW: Index Quote */}
          <div className="flex-1 flex items-center">
            {hasIndexData ? (
              <IndexRowWithData quote={indexQuote as IndexQuoteData} />
            ) : hasIndexName ? (
              <IndexRowPlaceholder indexName={indexName} />
            ) : (
              <div className="px-4 py-2.5" />
            )}
          </div>
        </div>

        {/* VERTICAL DIVIDER: Full height from top to bottom */}
        <div className="w-px bg-white/10 self-stretch" aria-hidden="true" />

        {/* RIGHT BOX: Weather (top) + Empty space for cosmic (bottom) */}
        <div className="w-[130px] flex flex-col">
          {/* Weather Section - Top of right box */}
          <div className="flex items-center justify-center px-3 py-3">
            <WeatherSection
              city={city}
              tz={tz}
              weather={weatherDisplay}
              promptTier={promptTier}
              isPro={isPro}
              railPosition={railPosition}
            />
          </div>

          {/* Empty space below weather - reserved for future cosmic events */}
          <div className="flex-1 min-h-[40px]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
});

export default ExchangeCard;
