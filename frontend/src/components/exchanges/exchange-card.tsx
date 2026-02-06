// frontend/src/components/exchanges/exchange-card.tsx
// ============================================================================
// EXCHANGE CARD - CSS VARIABLE SNAP-FIT
// ============================================================================
// Unified exchange card component with:
// - CSS variable --exchange-font: one base size, all text uses relative em
// - ResizeObserver on card root sets --exchange-font from card width
// - Left section: Exchange info + Clock (top) | Index quote row (bottom)
// - Right section: Weather box
//
// SNAP-FIT APPROACH (matches commodity-mover-card pattern):
// - One CSS variable (--exchange-font) on the card root
// - All child text uses em-relative sizes off that base
// - Everything scales proportionally together
// - ResizeObserver recalculates on any container resize
//
// UPDATES (5 Feb 2026 - SNAP-FIT v2):
// - REPLACED: Per-element FitText → card-level CSS variable snap-fit
// - All text now scales proportionally via --exchange-font
// - City name (previously fixed text-base) now scales with everything else
//
// UPDATES (26 Jan 2026 - FIX #2):
// - FIXED: Flag wrapped with title="" to suppress native browser tooltip
// - FIXED: cursor-pointer on flag (not cursor-help)
//
// Existing features preserved: Yes
// ============================================================================
'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExchangeCardProps, IndexQuoteData } from './types';
import Flag from '@/components/ui/flag';
import { LedClock } from './time/led-clock';
import { MarketStatusIndicator } from './time/market-status';
import { WeatherPromptTooltip } from './weather/weather-prompt-tooltip';
import type { ExchangeWeatherDisplay } from '@/lib/weather/weather-types';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// SNAP-FIT FONT CONSTANTS
// ============================================================================
// How it works:
// 1. ResizeObserver watches card container width
// 2. Computes base font: cardWidth × FONT_SCALE, clamped to [MIN, MAX]
// 3. Sets fontSize on the card root element
// 4. All child text uses em-relative sizes (e.g. 1.15em, 0.85em)
// 5. Everything scales proportionally in lockstep
// ============================================================================
const MIN_EXCHANGE_FONT = 12; // Floor - readable on small screens
const MAX_EXCHANGE_FONT = 20; // Ceiling - comfortable on large screens
const FONT_SCALE = 0.042; // Linear scale factor: width × 0.042
// ~285px → 12px, ~380px → 16px, ~476px → 20px

// ============================================================================
// TYPES
// ============================================================================

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

/**
 * Returns wind emoji based on wind speed (Beaufort scale inspired)
 * 🍃 Calm (0-5 km/h) - leaves barely move
 * 🌬️ Light breeze (6-19 km/h) - gentle wind
 * 💨 Moderate wind (20-39 km/h) - noticeable wind
 * 🌪️ Strong wind (40-61 km/h) - strong gusts
 * 🌀 Gale/Storm (62+ km/h) - dangerous winds
 */
function getWindEmoji(windKmh: number | null | undefined): string {
  const speed = windKmh ?? 0;
  if (speed <= 5) return '🍃'; // Calm
  if (speed <= 19) return '🌬️'; // Light breeze
  if (speed <= 39) return '💨'; // Moderate wind
  if (speed <= 61) return '🌪️'; // Strong wind
  return '🌀'; // Gale/Storm
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
    <div className="w-full px-4 py-2.5" role="group" aria-label={srText}>
      {/* All index data on ONE line - snaps with card */}
      <span
        className="block font-medium text-slate-300 whitespace-nowrap"
        style={{ fontSize: '0.70em' }}
      >
        <span>{indexName}: </span>
        <span className="ml-1 font-semibold text-slate-100">{formatPrice(price)}</span>
        <span className={tickColorClass}>
          <span
            className={`ml-1.5 ${tick !== 'flat' ? 'tick-arrow' : ''}`}
            style={{ fontSize: '0.8em' }}
          >
            {tickArrow}
          </span>{' '}
          {formatChange(change)} ({formatPercent(percentChange)})
        </span>
      </span>
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
    <div className="w-full px-4 py-2.5" role="group" aria-label={`${indexName}: market closed`}>
      {/* Index name + status on ONE line - snaps with card */}
      <span
        className="block font-medium text-slate-300 whitespace-nowrap"
        style={{ fontSize: '0.9em' }}
      >
        <span>{indexName}: </span>
        <span className="text-slate-500 italic" style={{ fontSize: '0.85em' }}>
          Market closed
        </span>
      </span>
    </div>
  );
});

// ============================================================================
// WEATHER SECTION COMPONENT
// ============================================================================

interface WeatherSectionProps {
  city: string;
  tz: string;
  weather: ExchangeWeatherDisplay;
  promptTier?: PromptTier;
  isPro?: boolean;
  railPosition?: 'left' | 'right';
}

const WeatherSection = React.memo(function WeatherSection({
  city: _city,
  tz: _tz,
  weather,
  promptTier: _promptTier = 4,
  isPro: _isPro = false,
  railPosition: _railPosition = 'left',
}: WeatherSectionProps) {
  const { tempC, tempF, emoji, humidity, windKmh } = weather;

  if (tempC === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 text-slate-500 w-full">
        <span style={{ fontSize: '0.85em' }}>—</span>
      </div>
    );
  }

  // Get dynamic wind emoji based on speed
  const windEmoji = getWindEmoji(windKmh);

  return (
    <div className="flex flex-col gap-2 w-full px-1">
      {/* Row 1: Temperature + Weather emoji - centered */}
      <div className="text-center whitespace-nowrap">
        <span className="tabular-nums text-slate-200" style={{ fontSize: '0.85em' }}>
          {Math.round(tempC)}°C / {Math.round(tempF ?? (tempC * 9) / 5 + 32)}°F{' '}
          <span style={{ fontSize: '1.3em' }}>{emoji || ''}</span>
        </span>
      </div>

      {/* Row 2: Wind - full width */}
      <div className="flex items-center justify-between text-slate-400 whitespace-nowrap">
        <span className="tabular-nums" style={{ fontSize: '0.8em' }}>
          {windEmoji} {windKmh ?? 0} km/h
        </span>
      </div>

      {/* Row 3: Humidity - full width */}
      <div className="flex items-center justify-between text-slate-400 whitespace-nowrap">
        <span className="tabular-nums" style={{ fontSize: '0.8em' }}>
          💧 {humidity ?? 0}%
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

interface ExtendedExchangeCardProps extends ExchangeCardProps {
  promptTier?: PromptTier;
  isPro?: boolean;
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [exchangeFont, setExchangeFont] = useState(16);

  // --------------------------------------------------------------------------
  // SNAP-FIT: Compute base font from card width via ResizeObserver
  // --------------------------------------------------------------------------
  const computeFont = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const px = Math.round(Math.min(MAX_EXCHANGE_FONT, Math.max(MIN_EXCHANGE_FONT, w * FONT_SCALE)));
    setExchangeFont((prev) => (prev === px ? prev : px));
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    // Initial calculation
    computeFont();

    // Re-calculate on resize
    const ro = new ResizeObserver(() => computeFont());
    ro.observe(el);

    return () => ro.disconnect();
  }, [computeFont]);

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
    fontSize: `${exchangeFont}px`,
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${isHovered ? glowBorder : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: isHovered
      ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'all 200ms ease-out',
  };

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
      ref={cardRef}
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
      {/* MAIN LAYOUT                                                        */}
      {/* ================================================================== */}
      <div className="relative z-10 flex">
        {/* LEFT SECTION */}
        <div className="flex-[3] flex flex-col min-w-0">
          {/* TOP ROW: Exchange Name + Clock */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3">
            {/* Exchange Name + City + Flag */}
            <div className="min-w-0">
              {/* Exchange name - snaps with card */}
              <span
                className="block font-medium leading-tight text-slate-100 whitespace-nowrap"
                style={{ fontSize: '0.80em' }}
              >
                {displayName}
              </span>

              <div className="mt-1 flex items-center gap-2">
                {/* City name - snaps with card (was fixed text-base) */}
                <span className="text-slate-400 whitespace-nowrap" style={{ fontSize: '0.75em' }}>
                  {city}
                </span>
                <WeatherPromptTooltip
                  city={city}
                  tz={tz}
                  weather={weatherDisplay}
                  tier={promptTier}
                  isPro={isPro}
                  tooltipPosition={railPosition}
                >
                  {/* 
                    Flag wrapper: title="" suppresses native browser tooltip
                    This prevents "United States flag" / "Canada flag" text from showing
                  */}
                  <span title="">
                    <Flag
                      countryCode={countryCode}
                      size={28}
                      decorative={false}
                      className="shrink-0 cursor-pointer"
                    />
                  </span>
                </WeatherPromptTooltip>
              </div>
            </div>

            {/* Clock + Market Status */}
            <div className="flex flex-col items-center gap-1.5">
              {tz ? (
                <LedClock tz={tz} showSeconds={false} ariaLabel={`Local time in ${city || name}`} />
              ) : (
                <div className="inline-flex items-center justify-center rounded bg-slate-900/80 px-2 py-1.5 ring-1 ring-slate-700/50">
                  <span className="font-mono text-slate-500" style={{ fontSize: '0.9em' }}>
                    --:--
                  </span>
                </div>
              )}
              <MarketStatusIndicator tz={tz} hoursTemplate={hoursTemplate} />
            </div>
          </div>

          {/* HORIZONTAL DIVIDER */}
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

        {/* VERTICAL DIVIDER */}
        <div className="w-px bg-white/10 self-stretch" aria-hidden="true" />

        {/* RIGHT BOX: Weather */}
        <div className="flex-1 flex flex-col min-w-[100px] max-w-[140px]">
          <div className="flex-1 flex items-start justify-center px-1 py-3">
            <WeatherSection
              city={city}
              tz={tz}
              weather={weatherDisplay}
              promptTier={promptTier}
              isPro={isPro}
              railPosition={railPosition}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default ExchangeCard;
