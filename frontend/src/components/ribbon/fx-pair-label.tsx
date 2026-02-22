// src/components/ribbon/fx-pair-label.tsx
// ============================================================================
// FX PAIR LABEL — Currency pair with flags and optional city-vibes tooltips
// ============================================================================
// Renders "EUR 🇪🇺 / USD 🇺🇸" with optional WeatherPromptTooltip on each flag.
//
// When tooltipData is provided for a side (base/quote), that flag is wrapped
// in a WeatherPromptTooltip showing a city-vibes image prompt for the
// currency's financial city. When omitted, the flag renders plain (no tooltip).
//
// UPDATES (20 Feb 2026):
// - ADDED: Optional per-flag tooltip data (FxFlagTooltipData)
// - ADDED: WeatherPromptTooltip wrapping when data is available
// - Tooltip opens BELOW the ribbon (verticalPosition='below')
// - Tooltip opens LEFT (tooltipPosition='right') since ribbon is centered
//
// Existing features preserved: Yes
// ============================================================================

'use client';

import * as React from 'react';

import Flag from '@/components/ui/flag';
import { WeatherPromptTooltip } from '@/components/exchanges/weather/weather-prompt-tooltip';
import type { ExchangeWeatherDisplay } from '@/lib/weather/weather-types';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// TYPES
// ============================================================================

/** Data required to show a city-vibes tooltip on a single flag */
export interface FxFlagTooltipData {
  /** City name for prompt generation (e.g. "New York", "London") */
  city: string;
  /** IANA timezone (e.g. "America/New_York") */
  tz: string;
  /** Weather data from the exchange's weatherIndex entry */
  weather: ExchangeWeatherDisplay;
  /** Latitude for solar/lighting engine */
  latitude: number;
  /** Longitude for solar/lighting engine */
  longitude: number;
  /** Current prompt tier (1-4) */
  tier: PromptTier;
  /** Whether user is Pro (controls PRO badge in tooltip) */
  isPro: boolean;
}

export interface FxPairLabelProps {
  base: string;
  baseCountryCode?: string | null;
  quote: string;
  quoteCountryCode?: string | null;
  separator?: string;
  className?: string;
  /** Optional tooltip data for the BASE currency flag */
  baseTooltip?: FxFlagTooltipData | null;
  /** Optional tooltip data for the QUOTE currency flag */
  quoteTooltip?: FxFlagTooltipData | null;
}

// ============================================================================
// FLAG WRAPPER — conditionally wraps in tooltip
// ============================================================================

interface FlagWithOptionalTooltipProps {
  countryCode?: string | null;
  tooltipData?: FxFlagTooltipData | null;
}

function FlagWithOptionalTooltip({ countryCode, tooltipData }: FlagWithOptionalTooltipProps) {
  const flagEl = (
    <span
      className="inline-flex shrink-0 items-center overflow-hidden"
      style={{ width: 'clamp(12px, 1.2vw, 20px)', height: 'clamp(12px, 1.2vw, 20px)' }}
    >
      <Flag countryCode={countryCode} size={20} />
    </span>
  );

  if (!tooltipData) return flagEl;

  return (
    <WeatherPromptTooltip
      city={tooltipData.city}
      tz={tooltipData.tz}
      weather={tooltipData.weather}
      tier={tooltipData.tier}
      isPro={tooltipData.isPro}
      tooltipPosition="right"
      verticalPosition="below"
      latitude={tooltipData.latitude}
      longitude={tooltipData.longitude}
    >
      {/* title="" suppresses native browser tooltip on the flag image */}
      <span title="">{flagEl}</span>
    </WeatherPromptTooltip>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FxPairLabel({
  base,
  baseCountryCode,
  quote,
  quoteCountryCode,
  separator = '/',
  className,
  baseTooltip,
  quoteTooltip,
}: FxPairLabelProps) {
  return (
    <span className={className ?? 'inline-flex items-center'} style={{ gap: 'clamp(3px, 0.4vw, 8px)' }}>
      {/* Base currency */}
      <span className="inline-flex items-center" style={{ gap: 'clamp(2px, 0.3vw, 8px)' }}>
        <span>{base.trim().toUpperCase()}</span>
        <FlagWithOptionalTooltip countryCode={baseCountryCode} tooltipData={baseTooltip} />
      </span>

      {/* Separator */}
      <span aria-hidden="true" className="text-slate-500">
        {separator}
      </span>

      {/* Quote currency */}
      <span className="inline-flex items-center" style={{ gap: 'clamp(2px, 0.3vw, 8px)' }}>
        <span>{quote.trim().toUpperCase()}</span>
        <FlagWithOptionalTooltip countryCode={quoteCountryCode} tooltipData={quoteTooltip} />
      </span>
    </span>
  );
}

export default FxPairLabel;
