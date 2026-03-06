// src/components/home/mission-control.tsx
// ============================================================================
// MISSION CONTROL - Smart Automated Prompts Panel (v5.0.0)
// ============================================================================
// Right-side panel with weather-driven prompt preview.
//
// v5.0.0 CHANGES:
// - ADDED: World Context button on ALL pages (links to /world-context)
// - Grid expanded from 2→3 columns (default) and 3→4 (studio sub-pages)
// - Homepage: Studio | World Context | Pro (3 buttons)
// - Studio page: Home | World Context | Pro (3 buttons)
// - Pro Promagen: Studio | World Context | Home (3 buttons)
// - Studio sub-pages: Home | World Context | Studio | Pro (4 buttons)
// - Provider pages: Home | World Context | Studio | Pro (4 buttons)
// - Authority: docs/authority/homepage.md §9.1, buttons.md
//
// v4.0.0 CHANGES:
// - REMOVED: Sign-in button from Mission Control (now in homepage-grid Hero Window)
// - REMOVED: All Clerk auth imports, hooks, and state logic
// - REMOVED: isAuthenticated prop (no longer needed)
// - REMOVED: userIconPath, actionButtonLoading (sign-in only)
// - Former grid: 2 columns (default) and 3 (studio sub-pages)
// - Homepage: Studio | Pro (2 buttons)
// - Studio page: Home | Pro (2 buttons)
// - Pro Promagen: Studio | Home (2 buttons)
// - Studio sub-pages: Home | Studio | Pro (3 buttons)
//
// v3.5.1 CHANGES:
// - ADDED: isStudioSubPage prop for 4-button layout on Studio sub-pages
// - When isStudioSubPage=true, shows Home | Studio | Pro (3 buttons)
// - Grid changes from grid-cols-3 to grid-cols-4
// - Studio button links to /studio (the hub page)
// - Added separate renderHomeButton, renderStudioButton, renderProButton functions
// - All other functionality unchanged
//
// v3.4.0 CHANGES:
// - ADDED: isProPromagenPage prop to swap Pro button for Home button
// - When isProPromagenPage=true, shows Home button instead of Pro button
// - Added renderSecondButton function for Pro/Home toggle
//
// v3.3.0 CHANGES:
// - ADDED: isStudioPage prop to swap Studio button for Home button
// - When isStudioPage=true, shows Home button instead of Studio button
// - All other functionality unchanged
//
// v3.2.14 CHANGES:
// - ADDED: FitText component for responsive font sizing (min/max)
// - ADDED: font-semibold to "London Real Time Text Prompt" label
// - FIXED: exchanges prop now accepts readonly Exchange[] (type compatibility)
//
// v3.2.13 CHANGES:
// - FIXED: weatherData extraction - removed erroneous .current accessor
// - FIXED: tooltipPosition="right" (opens LEFT on right-side panel)
// - FIXED: Type conversion from ExchangeWeatherData to ExchangeWeatherDisplay
// - Flag tooltip now shows same prompt as LSE London exchange card
// - Label changed: "London" → "London Real Time Text Prompt"
// - Removed question mark cursor (cursor-help → cursor-pointer)
//
// v3.2.11 CHANGES:
// - Added mounted state to prevent SSR hydration issues
// - Added timeout fallback (3s) for hydration safety
// - Proper loading state with visible "Loading..." text
//
// Authority: buttons.md, mission-control.md
// Security: 10/10 — No user input handling, type-safe data flow
// Existing features preserved: Yes (sign-in lives in homepage-grid Hero Window)
// ============================================================================

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  generateWeatherPrompt,
  getDefaultTier,
  type PromptTier,
} from '@/lib/weather/weather-prompt-generator';
import { toFullWeather, type ExchangeWeatherDisplay } from '@/lib/weather/weather-types';
import { WeatherPromptTooltip } from '@/components/exchanges/weather/weather-prompt-tooltip';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

// ============================================================================
// FIT TEXT COMPONENT - Auto-scales text to fit container width
// ============================================================================
// How it works:
// 1. Renders text at max font size in a hidden measurement span
// 2. Compares text width to container width
// 3. Scales font-size down until text fits (or hits minimum)
// 4. Re-measures on container resize via ResizeObserver
// ============================================================================

interface FitTextProps {
  children: React.ReactNode;
  /** Minimum font size in pixels */
  min?: number;
  /** Maximum font size in pixels */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

const FitText = React.memo(function FitText({
  children,
  min = 10,
  max = 24,
  className = '',
}: FitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(max);

  const calculateFit = useCallback(() => {
    if (!containerRef.current || !textRef.current) return;

    const container = containerRef.current;
    const text = textRef.current;

    // Get available width (container width minus any padding)
    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;

    // Binary search for optimal font size
    let low = min;
    let high = max;
    let bestFit = min;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      text.style.fontSize = `${mid}px`;

      // Check if text fits
      if (text.scrollWidth <= containerWidth) {
        bestFit = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    setFontSize(bestFit);
  }, [min, max]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initial calculation
    calculateFit();

    // Re-calculate on resize
    const resizeObserver = new ResizeObserver(() => {
      calculateFit();
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [calculateFit, children]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <span
        ref={textRef}
        className={className}
        style={{
          fontSize: `${fontSize}px`,
          display: 'block',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </div>
  );
});

// ============================================================================
// TYPES
// ============================================================================

export interface MissionControlProps {
  providers?: unknown[];
  exchanges?: readonly Exchange[];
  weatherIndex?: Map<string, ExchangeWeatherData>;
  nearestExchangeId?: string;
  /** When true, shows Home button instead of Studio button (for /studio page) */
  isStudioPage?: boolean;
  /** When true, shows Home button instead of Pro button (for /pro-promagen page) */
  isProPromagenPage?: boolean;
  /** When true, shows 3 buttons: Home | Studio | Pro (for /studio/* sub-pages) */
  isStudioSubPage?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function getLocalHour(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    return isNaN(hour) ? 12 : hour;
  } catch {
    return 12;
  }
}

// ============================================================================
// BUTTON STYLES
// ============================================================================

const actionButtonBase =
  'inline-flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border text-center font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';

const actionButtonActive =
  'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer';

// Home icon path
const homeIconPath =
  'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25';

// Studio/Wand icon path
const studioIconPath =
  'M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59';

// Pro/Star icon path
const proIconPath =
  'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z';

// World Context / Globe icon path (Heroicons globe-americas)
const worldContextIconPath =
  'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418';

// ============================================================================
// COMPONENT
// ============================================================================

export default function MissionControl({
  exchanges = [],
  weatherIndex,
  nearestExchangeId,
  isStudioPage = false,
  isProPromagenPage = false,
  isStudioSubPage = false,
}: MissionControlProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const contentZoneRef = useRef<HTMLDivElement>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // WEATHER & PROMPT LOGIC — Uses same data source as LSE London exchange card
  // ══════════════════════════════════════════════════════════════════════════

  const previewExchange = useMemo(() => {
    if (exchanges.length === 0) return null;

    if (nearestExchangeId) {
      const nearest = exchanges.find((e) => e.id === nearestExchangeId);
      if (nearest && weatherIndex?.has(nearest.id)) return nearest;
    }

    // Priority: Find LSE London exchange (same as ribbon card)
    const londonIds = ['lse-london', 'lse', 'london'];
    for (const id of londonIds) {
      const london = exchanges.find((e) => e.id === id);
      if (london && weatherIndex?.has(london.id)) return london;
    }

    const londonByCity = exchanges.find(
      (e) => e.city?.toLowerCase() === 'london' && weatherIndex?.has(e.id),
    );
    if (londonByCity) return londonByCity;

    const anyWithWeather = exchanges.find((e) => weatherIndex?.has(e.id));
    if (anyWithWeather) return anyWithWeather;

    return exchanges[0] ?? null;
  }, [exchanges, nearestExchangeId, weatherIndex]);

  const weatherData: ExchangeWeatherDisplay | null = useMemo(() => {
    if (!previewExchange || !weatherIndex) return null;
    const data = weatherIndex.get(previewExchange.id);
    if (!data) return null;

    // Convert ExchangeWeatherData to ExchangeWeatherDisplay
    // (ExchangeWeatherData has optional fields, ExchangeWeatherDisplay requires them with | null)
    return {
      tempC: data.tempC,
      tempF: data.tempF ?? null,
      emoji: data.emoji,
      condition: data.condition ?? null,
      humidity: data.humidity ?? null,
      windKmh: data.windKmh ?? null,
      description: data.description ?? null,
      sunriseUtc: data.sunriseUtc ?? null,
      sunsetUtc: data.sunsetUtc ?? null,
      timezoneOffset: data.timezoneOffset ?? null,
      isDayTime: data.isDayTime ?? null,
      cloudCover: data.cloudCover ?? null,
      visibility: data.visibility ?? null,
      pressure: data.pressure ?? null,
      rainMm1h: data.rainMm1h ?? null,
      snowMm1h: data.snowMm1h ?? null,
      windDegrees: data.windDegrees ?? null,
      windGustKmh: data.windGustKmh ?? null,
      weatherId: data.weatherId ?? null,
    };
  }, [previewExchange, weatherIndex]);

  const promptText = useMemo(() => {
    if (!weatherData || weatherData.tempC === null) return null;
    if (!previewExchange) return null;

    const tier: PromptTier = getDefaultTier();
    const localHour = getLocalHour(previewExchange.tz ?? 'Europe/London');
    const fullWeather = toFullWeather(weatherData);
    if (!fullWeather) return null;

    // v8.0.0 Chat 5: generateWeatherPrompt returns WeatherPromptResult; extract .text.
    return generateWeatherPrompt({
      city: previewExchange.city ?? 'London',
      weather: fullWeather,
      localHour,
      tier,
      latitude: previewExchange.latitude,
      longitude: previewExchange.longitude,
    }).text;
  }, [weatherData, previewExchange]);

  const handleCopy = useCallback(async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }, [promptText]);

  const cityName = previewExchange?.city ?? 'London';
  // Use iso2 as primary source (countryCode is a deprecated alias)
  const countryCode = previewExchange?.iso2 ?? previewExchange?.countryCode ?? 'GB';
  const timezone = previewExchange?.tz ?? 'Europe/London';
  const hasWeatherData = weatherData !== null && weatherData.tempC !== null;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER HOME BUTTON — Always links to /
  // ══════════════════════════════════════════════════════════════════════════
  const renderHomeButton = () => (
    <a
      href="/"
      className={`${actionButtonBase} ${actionButtonActive}`}
      aria-label="Go to Homepage"
      style={{
        padding: 'clamp(0.4rem, 0.5vh, 0.7rem) clamp(0.4rem, 0.5vw, 0.7rem)',
        gap: 'clamp(0.2rem, 0.3vw, 0.4rem)',
        height: 'clamp(40px, 5vh, 60px)',
      }}
    >
      <svg
        className="text-purple-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          width: 'clamp(14px, 1vw, 18px)',
          height: 'clamp(14px, 1vw, 18px)',
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={homeIconPath} />
      </svg>
      <span className="text-purple-100" style={{ fontSize: 'clamp(0.75rem, 0.9vw, 0.875rem)' }}>
        Home
      </span>
    </a>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER STUDIO BUTTON — Always links to /studio
  // ══════════════════════════════════════════════════════════════════════════
  const renderStudioButton = () => (
    <a
      href="/studio"
      className={`${actionButtonBase} ${actionButtonActive}`}
      aria-label="Open Prompt Studio"
      style={{
        padding: 'clamp(0.4rem, 0.5vh, 0.7rem) clamp(0.4rem, 0.5vw, 0.7rem)',
        gap: 'clamp(0.2rem, 0.3vw, 0.4rem)',
        height: 'clamp(40px, 5vh, 60px)',
      }}
    >
      <svg
        className="text-purple-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          width: 'clamp(14px, 1vw, 18px)',
          height: 'clamp(14px, 1vw, 18px)',
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={studioIconPath} />
      </svg>
      <span className="text-purple-100" style={{ fontSize: 'clamp(0.75rem, 0.9vw, 0.875rem)' }}>
        Studio
      </span>
    </a>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER PRO BUTTON — Always links to /pro-promagen
  // ══════════════════════════════════════════════════════════════════════════
  const renderProButton = () => (
    <a
      href="/pro-promagen"
      className={`${actionButtonBase} ${actionButtonActive}`}
      aria-label="View Pro Promagen features"
      style={{
        padding: 'clamp(0.4rem, 0.5vh, 0.7rem) clamp(0.4rem, 0.5vw, 0.7rem)',
        gap: 'clamp(0.2rem, 0.3vw, 0.4rem)',
        height: 'clamp(40px, 5vh, 60px)',
      }}
    >
      <svg
        className="text-purple-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          width: 'clamp(14px, 1vw, 18px)',
          height: 'clamp(14px, 1vw, 18px)',
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={proIconPath} />
      </svg>
      <span className="text-purple-100" style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.875rem)' }}>
        Pro
      </span>
    </a>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER WORLD CONTEXT BUTTON — Always links to /world-context
  // Authority: docs/authority/homepage.md §9.1, buttons.md §1.2
  // CRITICAL: Explicit text-purple-100 on child <svg> and <span> per buttons.md §1
  // ══════════════════════════════════════════════════════════════════════════
  const renderWorldContextButton = () => (
    <a
      href="/world-context"
      className={`${actionButtonBase} ${actionButtonActive}`}
      aria-label="Open World Context"
      style={{
        padding: 'clamp(0.4rem, 0.5vh, 0.7rem) clamp(0.4rem, 0.5vw, 0.7rem)',
        gap: 'clamp(0.2rem, 0.3vw, 0.4rem)',
        height: 'clamp(40px, 5vh, 60px)',
      }}
    >
      <svg
        className="text-purple-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          width: 'clamp(14px, 1vw, 18px)',
          height: 'clamp(14px, 1vw, 18px)',
        }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d={worldContextIconPath}
        />
      </svg>
      <span className="text-purple-100" style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.8rem)' }}>
        World Context
      </span>
    </a>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER FIRST BUTTON — Home or Studio depending on isStudioPage
  // ══════════════════════════════════════════════════════════════════════════
  const renderFirstButton = () => {
    if (isStudioPage) {
      // On Studio page: show Home button
      return renderHomeButton();
    }

    // On Homepage or Pro Promagen page (default): show Studio button
    return renderStudioButton();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER SECOND BUTTON — Home or Pro depending on isProPromagenPage
  // ══════════════════════════════════════════════════════════════════════════
  const renderSecondButton = () => {
    if (isProPromagenPage) {
      // On Pro Promagen page: show Home button
      return renderHomeButton();
    }

    // On Homepage or Studio page (default): show Pro button
    return renderProButton();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DETERMINE GRID LAYOUT
  // - isStudioSubPage: 4 columns (Home | World Context | Studio | Pro)
  // - Default: 3 columns (First | World Context | Second)
  // v5.0.0: +1 column for World Context button on all pages
  // ══════════════════════════════════════════════════════════════════════════
  const gridCols = isStudioSubPage ? 'grid-cols-4' : 'grid-cols-3';

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="relative w-full rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      style={{ padding: 'clamp(10px, 1vw, 16px)' }}
      data-testid="mission-control"
    >
      {/* Header */}
      <div
        className="flex flex-col items-center"
        style={{ marginBottom: 'clamp(8px, 1vw, 16px)', gap: 'clamp(4px, 0.5vw, 8px)' }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.5vw, 8px)' }}>
          <div
            className="animate-pulse rounded-full"
            style={{
              backgroundColor: '#10B981',
              width: 'clamp(8px, 0.4vw, 14px)',
              height: 'clamp(8px, 0.4vw, 14px)',
            }}
            aria-hidden="true"
          />
          <span
            className="font-mono uppercase tracking-wider text-slate-400"
            style={{ fontSize: 'clamp(0.5rem, 0.7vw, 1rem)' }}
          >
            MISSION CONTROL
          </span>
        </div>
        <h2
          className="text-center font-semibold leading-tight"
          style={{ fontSize: 'clamp(0.7rem, 1vw, 1.30rem)' }}
        >
          <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            Smart Dynamic Automated Prompts
          </span>
        </h2>
      </div>

      {/* CONTENT ZONE — Height locked to 84px (matches Engine Bay icon grid height) */}
      <div
        ref={contentZoneRef}
        className="flex flex-col overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50"
        style={{
          height: 'clamp(12px, 3.5vw, 64px)',
          marginBottom: 'clamp(8px, 1vw, 16px)',
          padding: 'clamp(2px, 0.3vw, 5px)',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 'clamp(2px, 0.3vw, 4px)', gap: 'clamp(4px, 0.5vw, 8px)' }}
        >
          <div
            className="flex min-w-0 flex-1 items-center"
            style={{ gap: 'clamp(4px, 0.5vw, 8px)' }}
          >
            {/* Flag with WeatherPromptTooltip — Opens LEFT, same data as LSE card */}
            {hasWeatherData && weatherData ? (
              <WeatherPromptTooltip
                city={cityName}
                tz={timezone}
                weather={weatherData}
                tooltipPosition="right"
                verticalPosition="below"
                latitude={previewExchange?.latitude}
                longitude={previewExchange?.longitude}
              >
                {/* Flag image — cursor-pointer (no question mark), no title attribute */}
                <div
                  className="relative shrink-0 cursor-pointer overflow-hidden rounded-sm"
                  style={{
                    width: 'clamp(18px, 1.5vw, 24px)',
                    height: 'clamp(14px, 1.1vw, 18px)',
                  }}
                >
                  <Image
                    src={`/flags/${countryCode.toLowerCase()}.svg`}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
              </WeatherPromptTooltip>
            ) : (
              <div
                className="relative shrink-0 overflow-hidden rounded-sm"
                style={{
                  width: 'clamp(18px, 1.5vw, 24px)',
                  height: 'clamp(14px, 1.1vw, 18px)',
                }}
              >
                <Image
                  src={`/flags/${countryCode.toLowerCase()}.svg`}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
            )}
            {/* 
              Label: "London Real Time Text Prompt" 
              - FitText: responsive sizing (min 11px, max 16px)
              - font-semibold: bold like Engine Bay "Launch Platform Builder"
            */}
            <FitText min={9} max={16} className="font-semibold text-slate-400">
              {cityName} Real Time Text Prompt
            </FitText>
          </div>

          {promptText && (
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex shrink-0 items-center justify-center rounded-md transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
              style={{
                width: 'clamp(20px, 1.5vw, 24px)',
                height: 'clamp(20px, 1.5vw, 24px)',
              }}
              title={copied ? 'Copied!' : 'Copy prompt'}
              aria-label={copied ? 'Copied to clipboard' : 'Copy prompt'}
            >
              {copied ? (
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  style={{
                    width: 'clamp(12px, 0.9vw, 14px)',
                    height: 'clamp(12px, 0.9vw, 14px)',
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{
                    width: 'clamp(12px, 0.9vw, 14px)',
                    height: 'clamp(12px, 0.9vw, 14px)',
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* 
          Instruction text (static) - actual prompt is NOT displayed
          - Responsive sizing: text-[10px] / sm:text-xs / xl:text-sm
          - Copy button still copies the actual prompt behind the scenes
        */}
        <div className="flex-1 overflow-hidden min-h-0">
          <p
            className="italic text-amber-400/80 animate-pulse truncate"
            style={{ fontSize: 'clamp(0.1rem, 0.75vw, 1rem)' }}
          >
            Hover over a countries flag for an image prompt.
          </p>
        </div>
      </div>

      {/* ACTION ZONE — Grid layout (3 or 4 columns — World Context always present)
           v5.0.0: World Context button added on all pages
           Authority: docs/authority/homepage.md §9.1 */}
      <div className={`grid ${gridCols}`} style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
        {isStudioSubPage ? (
          // 4-button layout for Studio sub-pages / Provider pages:
          // Home | World Context | Studio | Pro
          <>
            {renderHomeButton()}
            {renderWorldContextButton()}
            {renderStudioButton()}
            {renderProButton()}
          </>
        ) : (
          // 3-button layout (default): First | World Context | Second
          // Homepage:      Studio | World Context | Pro
          // Studio:        Home   | World Context | Pro
          // Pro Promagen:  Studio | World Context | Home
          <>
            {renderFirstButton()}
            {renderWorldContextButton()}
            {renderSecondButton()}
          </>
        )}
      </div>
    </div>
  );
}
