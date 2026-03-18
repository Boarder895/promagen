// src/app/pro-promagen/pro-promagen-client.tsx
// ============================================================================
// PRO PROMAGEN CLIENT (v3.2.0)
// ============================================================================
// Client component for the /pro-promagen configuration page.
// Uses SAME layout as homepage (HomepageGrid + ExchangeCard + FxRibbon).
//
// v3.2.0 (15 Mar 2026):
// - FIX: Countdown shows NEXT city (nextCity/nextCountryCode) — was incorrectly
//   changed to current city in v3.1.0, causing both sections to show same city
// - KEPT: Weather data below "What Promagen Sees" shows CURRENT city (city/countryCode)
//   with conditions · temp °C · local time
// - FIX: Reverted next/image back to <img> — next/image optimization pipeline
//   causes 404 spam for missing provider icons (e.g. dreamstudio.png).
//   <img> + onError handles missing icons silently. eslint-disable comments added.
// - FIX: Centre column layout reverted to natural-height approach.
//   Feature panel: shrink-0 (content dictates height).
//   Preview panel: flex-1 min-h-0 (takes remaining space).
//   Cards always look correct because they size themselves.
//
// v3.1.0 (15 Mar 2026):
// - REMOVED: FX Picker fullscreen mode (FX pairs no longer configurable)
// - REMOVED: FxPicker import, catalogToFxPickerOptions, fxPickerOptions memo
// - REMOVED: onOpenFxPicker / handleCloseFxPicker handlers
// - REMOVED: FX-related props from ComparisonTable call
// - KEPT: FX state for ribbon display (uses SSOT defaults)
// - KEPT: Exchange picker fullscreen mode
// - KEPT: Weather prompt tier selection
// Dropdowns embedded directly in comparison table (not separate panels).
//
// Key differences from homepage:
// - FX ribbon shows DEMO prices from pairs.json (not live API)
// - Exchange cards show real clocks but DEMO weather (placeholder)
// - Centre column shows comparison table instead of providers table
// - Paid users can save selections; free users preview only
//
// UPDATED v2.8.0 (01 Feb 2026):
// - FIX: Hydration error — v2.7.0's lazy useState read localStorage on client
//   while server used defaults → mismatch → React discarded server HTML → flash.
//   Now: useState(defaults) again (SSR-safe), useEffect reads localStorage after
//   mount, exchange rails show skeleton until hydrated. No mismatch, no flash.
// - KEPT: Weather merge — live overlays demo, not replaces.
// - KEPT: Indices GET — always use GET (POST is 405).
//
// UPDATED v2.6.0 (29 Jan 2026):
// - ADDED: Fullscreen FX Picker mode (matches Exchange Picker pattern)
// - When FX picker is triggered, entire centre panel shows ONLY the FX picker
// - NO headers, NO badges, NO table, NO CTA visible - just the picker
// - FX Picker uses regional grouping (Americas, Europe, Asia Pacific, MEA)
// - All existing functionality preserved
//
// UPDATED v2.5.0 (29 Jan 2026):
// - FIX: Removed overflow constraints from picker wrapper
// - Picker component handles its own scrolling internally
// - Wrapper just provides flex container that fills space
//
// UPDATED v2.4.0 (29 Jan 2026):
// - FIX: Fullscreen picker wrapper now lg:overflow-visible (was overflow-hidden)
// - This allows picker to expand fully on large screens without clipping
// - Small screens retain overflow-hidden for proper scroll containment
//
// UPDATED v2.3.0 (29 Jan 2026):
// - ADDED: Fullscreen Exchange Picker mode
// - When picker is triggered, entire centre panel shows ONLY the picker
// - NO headers, NO badges, NO table, NO CTA visible - just the picker
// - Feels like opening a new page within the centre column
// - All existing functionality preserved
//
// UPDATED v2.2.0 (28 Jan 2026):
// - ADDED: Pass exchangeCatalog to ComparisonTable for ExchangePicker integration
// - ExchangePicker needs full catalog with iso2/continent data to group by region
// - All existing functionality preserved
//
// UPDATED v2.1.0 (28 Jan 2026):
// - FIXED: convertToWeatherDataMap now uses weather.tempC (not weather.temp)
// - ExchangeWeather type uses tempC not temp - this was causing TypeScript errors
// - All other functionality preserved
//
// UPDATED v2.0.0: Engine Bay and Mission Control support
// - Added providers prop for Engine Bay icon grid
// - Passes showEngineBay={true} and showMissionControl={true} to HomepageGrid
// - Passes isProPromagenPage={true} to swap Pro button for Home button
// - All existing functionality preserved
//
// Authority: docs/authority/paid_tier.md §5.10, mission-control.md, ignition.md
// Security: 10/10 — No user input handling, type-safe data flow
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useIndicesQuotes } from '@/hooks/use-indices-quotes';
import { useWeather } from '@/hooks/use-weather';
import { getRailsRelative } from '@/lib/location';
import { UpgradeCta } from '@/components/pro-promagen';
import { ExchangePicker } from '@/components/pro-promagen/exchange-picker';
import { FeatureControlPanel } from '@/components/pro-promagen/feature-control-panel';
import { usePromptShowcase } from '@/hooks/use-prompt-showcase';
import { SaveIcon } from '@/components/prompts/library/save-icon';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import {
  PRO_SELECTION_LIMITS,
  type FxPairCatalogEntry,
  type ExchangeCatalogEntry,
  isMultiIndexConfig,
} from '@/lib/pro-promagen/types';
import {
  catalogToPickerOptions,
  simpleIdsToCompoundKeys,
  parseCompoundKey,
} from '@/lib/pro-promagen/exchange-picker-helpers';
import type { Exchange, Hemisphere } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';
import type { Provider } from '@/types/providers';
import type { WeatherCategoryMap, PromptCategory } from '@/types/prompt-builder';
import { getPlatformTierId } from '@/data/platform-tiers';
import { assemblePrompt, selectionsFromMap } from '@/lib/prompt-builder';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';
import { CATEGORY_COLOURS as SHARED_CATEGORY_COLOURS, CATEGORY_LABELS as SHARED_CATEGORY_LABELS, CATEGORY_EMOJIS as SHARED_CATEGORY_EMOJIS, parsePromptIntoSegments as sharedParsePrompt } from '@/lib/prompt-colours';

// ============================================================================
// TYPES
// ============================================================================

export interface ProPromagenClientProps {
  /** Full exchange catalog */
  exchangeCatalog: ExchangeCatalogEntry[];
  /** Full FX pairs catalog */
  fxCatalog: FxPairCatalogEntry[];
  /** Default selected exchanges (SSOT) */
  defaultExchangeIds: string[];
  /** Default selected FX pairs (SSOT) */
  defaultFxPairIds: string[];
  /** Demo weather data for exchanges */
  demoWeatherIndex: Map<string, ExchangeWeather>;
  /** Providers data for Engine Bay (NEW v2.0.0) */
  providers?: Provider[];
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  EXCHANGE_SELECTION: 'promagen:pro:exchange-selection',
  PROMPT_TIER: 'promagen:pro:prompt-tier',
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Load array from localStorage.
 * Returns null if key doesn't exist (distinguishes "never set" from "set to empty").
 * Returns the stored array if valid, otherwise null.
 */
function loadArrayFromStorage(key: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return null; // Key doesn't exist
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable - fail silently
  }
}

/**
 * Convert catalog entry to Exchange type for rails.
 * Handles both legacy and multi-index marketstack formats.
 *
 * v3.0.0: Added overrideId and selectedBenchmark for compound key support.
 * When selectedBenchmark is provided, the marketstack config is narrowed to
 * just that index so the exchange card displays the correct index name.
 */
function catalogToExchange(
  entry: ExchangeCatalogEntry,
  _weather: ExchangeWeather | null,
  overrideId?: string,
  selectedBenchmark?: string,
): Exchange {
  // Convert marketstack to the MarketstackConfig format expected by Exchange
  const ms = entry.marketstack;
  let marketstack: Exchange['marketstack'];

  if (!ms) {
    marketstack = {
      defaultBenchmark: '',
      defaultIndexName: '',
      availableIndices: [],
    };
  } else if (isMultiIndexConfig(ms)) {
    if (selectedBenchmark) {
      // Narrow to selected index
      const selectedIdx = ms.availableIndices.find((i) => i.benchmark === selectedBenchmark);
      marketstack = {
        defaultBenchmark: selectedBenchmark,
        defaultIndexName: selectedIdx?.indexName ?? ms.defaultIndexName,
        availableIndices: selectedIdx ? [selectedIdx] : ms.availableIndices,
      };
    } else {
      marketstack = ms;
    }
  } else {
    // Convert legacy format to new format
    marketstack = {
      defaultBenchmark: ms.benchmark,
      defaultIndexName: ms.indexName,
      availableIndices: [{ benchmark: ms.benchmark, indexName: ms.indexName }],
    };
  }

  return {
    id: overrideId ?? entry.id,
    city: entry.city,
    exchange: entry.exchange,
    name: entry.name,
    country: entry.country,
    iso2: entry.iso2,
    tz: entry.tz,
    longitude: entry.longitude,
    latitude: entry.latitude,
    hemisphere: entry.hemisphere as Hemisphere,
    hoursTemplate: entry.hoursTemplate,
    holidaysRef: entry.holidaysRef,
    marketstack,
    hoverColor: entry.hoverColor ?? '#6366F1',
  };
}

/**
 * Convert ExchangeWeather to ExchangeWeatherData format for Mission Control.
 * Maps the demo weather index to the format expected by HomepageGrid.
 *
 * FIXED v2.1.0: Now uses weather.tempC (not weather.temp)
 * ExchangeWeather type uses tempC not temp
 */
function convertToWeatherDataMap(
  demoIndex: Map<string, ExchangeWeather>,
): Map<string, ExchangeWeatherData> {
  const result = new Map<string, ExchangeWeatherData>();
  demoIndex.forEach((weather, exchangeId) => {
    result.set(exchangeId, {
      // FIXED: Use tempC not temp
      tempC: weather.tempC ?? 20,
      tempF: weather.tempC !== undefined ? Math.round((weather.tempC * 9) / 5 + 32) : undefined,
      emoji: weather.emoji ?? '☀️',
      condition: weather.condition ?? 'Clear',
      // FIXED v3.0.0: Use actual demo values instead of hardcoded 50/10.
      // ExchangeWeather DOES have humidity and windSpeedKmh since v3.0.0.
      humidity: weather.humidity ?? 50,
      windKmh: weather.windSpeedKmh ?? 10,
      description: weather.condition ?? 'Clear skies',
    });
  });
  return result;
}

// ============================================================================
// COMPONENT
// ============================================================================


// ============================================================================
// TIER PREVIEW PANEL — 4 horizontal tooltip clones with live PotM data
// ============================================================================
// Shown when Prompt Format card is hovered. Fills the CTA area.
// Each window is a visual clone of WeatherPromptTooltip.
// Uses live Prompt of the Moment data (rotates every 3 mins).
// Active tier gets enhanced glow. Copy + Save buttons on each.
// Animated amber header matches mission control shimmer.
// ============================================================================

const TIER_DISPLAY: Array<{
  tier: 1 | 2 | 3 | 4;
  label: string;
  color: string;
  dotClass: string;
  bgClass: string;
  ringClass: string;
  promptKey: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  platformId: string;
  platformName: string;
}> = [
  { tier: 1, label: 'CLIP-Based', color: '#60a5fa', dotClass: 'bg-blue-400', bgClass: 'bg-blue-500/15', ringClass: 'ring-blue-500/30', promptKey: 'tier1', platformId: 'leonardo', platformName: 'Leonardo AI' },
  { tier: 2, label: 'Midjourney', color: '#c084fc', dotClass: 'bg-purple-400', bgClass: 'bg-purple-500/15', ringClass: 'ring-purple-500/30', promptKey: 'tier2', platformId: 'midjourney', platformName: 'Midjourney' },
  { tier: 3, label: 'Natural Language', color: '#34d399', dotClass: 'bg-emerald-400', bgClass: 'bg-emerald-500/15', ringClass: 'ring-emerald-500/30', promptKey: 'tier3', platformId: 'openai', platformName: 'OpenAI DALL·E' },
  { tier: 4, label: 'Plain Language', color: '#fb923c', dotClass: 'bg-orange-400', bgClass: 'bg-orange-500/15', ringClass: 'ring-orange-500/30', promptKey: 'tier4', platformId: 'canva', platformName: 'Canva' },
];

const FALLBACK_PROMPTS: Record<string, string> = {
  tier1: '(masterpiece:1.3), (professional photography:1.2), Tower Bridge at golden hour, warm amber light reflecting on Thames, (scattered clouds:1.1), cobblestone texture, sharp focus, 50mm lens',
  tier2: 'Tower Bridge London at golden hour, warm amber light on Thames, scattered clouds, cobblestone foreground --ar 16:9 --v 7 --s 500 --no blur, watermark',
  tier3: 'A professional photograph of Tower Bridge during golden hour with warm amber light reflecting off the Thames. Scattered clouds above, cobblestones lining the foreground.',
  tier4: 'Tower Bridge London, golden hour, warm light, Thames river, cobblestones, professional photography',
};

function hexToRgbaPanel(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(56, 189, 248, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TierWindowCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }, [text]);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      className={`inline-flex items-center justify-center rounded-md cursor-pointer transition-all duration-200 ${
        copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
      }`}
      style={{ width: 'clamp(22px, 1.6vw, 28px)', height: 'clamp(22px, 1.6vw, 28px)' }}
      title={copied ? 'Copied!' : 'Copy prompt'}
      aria-label={copied ? 'Copied to clipboard' : 'Copy prompt to clipboard'}
    >
      {copied ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

function TierPreviewPanel({ activeTier }: { activeTier: number }) {
  const { data: potmData } = usePromptShowcase();

  return (
    <div className="flex flex-col h-full">
      {/* Animated amber header — double gap above and below */}
      <div style={{ padding: 'clamp(12px, 1.2vw, 20px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          Select the tier you require for all prompts
        </p>
      </div>

      {/* 4 tooltip windows — single horizontal row */}
      <div
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}
      >
        {TIER_DISPLAY.map((t) => {
          const isActive = t.tier === activeTier;
          const glowRgba = hexToRgbaPanel(t.color, isActive ? 0.4 : 0.25);
          const glowBorder = hexToRgbaPanel(t.color, isActive ? 0.7 : 0.4);
          const glowSoft = hexToRgbaPanel(t.color, isActive ? 0.2 : 0.1);
          const promptText = potmData?.prompts?.[t.promptKey] ?? FALLBACK_PROMPTS[t.promptKey]!;

          return (
            <div
              key={t.tier}
              className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(15, 23, 42, 0.97)',
                border: `1px solid ${glowBorder}`,
                boxShadow: isActive
                  ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
                  : `0 0 20px 4px ${glowRgba}, inset 0 0 15px 2px ${glowSoft}`,
                padding: 'clamp(10px, 1vw, 16px)',
                transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out',
              }}
            >
              {/* Ethereal glow — top radial (exact tooltip pattern) */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }}
              />
              {/* Bottom glow accent */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }}
              />

              {/* Content — matches WeatherPromptTooltip layout */}
              <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                {/* Header — "Image Prompt" + copy/save */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-semibold text-white"
                    style={{
                      fontSize: 'clamp(0.7rem, 0.8vw, 0.9rem)',
                      textShadow: `0 0 12px ${glowRgba}`,
                    }}
                  >
                    Image Prompt
                  </span>
                  <div className="flex items-center gap-1">
                    <SaveIcon
                      positivePrompt={promptText}
                      platformId={t.platformId}
                      platformName={t.platformName}
                      source="tooltip"
                      tier={t.tier}
                      size="sm"
                    />
                    <TierWindowCopyButton text={promptText} />
                  </div>
                </div>

                {/* Tier badge pill */}
                <span
                  className={`inline-flex items-center self-start rounded-full font-medium ${t.bgClass} ring-1 ${t.ringClass}`}
                  style={{
                    fontSize: 'clamp(0.625rem, 0.65vw, 0.65rem)',
                    padding: 'clamp(1px, 0.15vw, 3px) clamp(6px, 0.6vw, 10px)',
                    gap: 'clamp(4px, 0.4vw, 6px)',
                    color: t.color,
                  }}
                >
                  <span className={`rounded-full ${t.dotClass}`} style={{ width: 'clamp(5px, 0.5vw, 7px)', height: 'clamp(5px, 0.5vw, 7px)' }} />
                  Tier {t.tier}: {t.label}
                </span>

                {/* Prompt text */}
                <p
                  className="text-slate-200 leading-relaxed flex-1 overflow-hidden whitespace-pre-wrap break-words"
                  style={{ fontSize: 'clamp(0.65rem, 0.7vw, 0.8rem)' }}
                >
                  {promptText}
                </p>

                {/* Active indicator */}
                {isActive && (
                  <span
                    className="inline-flex items-center self-start gap-1 text-emerald-400 font-semibold"
                    style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SCENES PREVIEW PANEL — 5 free world windows + 18 pro world emojis
// ============================================================================
// Shown when Scenes card is hovered. Same glass/glow pattern as TierPreviewPanel.
// Human Factor: Endowment Effect — you already own 5 worlds, imagine 18 more.
// ============================================================================

const FREE_WORLD_WINDOWS: Array<{
  emoji: string;
  label: string;
  color: string;
  scenes: Array<{ emoji: string; name: string }>;
}> = [
  {
    emoji: '👤', label: 'Portraits & People', color: '#f59e0b',
    scenes: [
      { emoji: '🎭', name: 'Dramatic Portrait' },
      { emoji: '⚔️', name: 'Fantasy Hero' },
      { emoji: '📸', name: 'Street Photographer' },
    ],
  },
  {
    emoji: '🌍', label: 'Landscapes & Worlds', color: '#22c55e',
    scenes: [
      { emoji: '🌳', name: 'Enchanted Forest' },
      { emoji: '🏜️', name: 'Desert Ruins' },
      { emoji: '🧜', name: 'Underwater Kingdom' },
    ],
  },
  {
    emoji: '🌫️', label: 'Mood & Atmosphere', color: '#60a5fa',
    scenes: [
      { emoji: '🕵️', name: 'Film Noir' },
      { emoji: '💭', name: 'Dreamscape' },
      { emoji: '💛', name: 'Golden Romance' },
    ],
  },
  {
    emoji: '🎨', label: 'Style-Forward', color: '#f472b6',
    scenes: [
      { emoji: '⚡', name: 'Anime Action' },
      { emoji: '🐲', name: 'Concept Art Creature' },
      { emoji: '✨', name: 'Art Deco Poster' },
    ],
  },
  {
    emoji: '🔥', label: 'Trending / Seasonal', color: '#fb923c',
    scenes: [
      { emoji: '🌱', name: 'Solarpunk Utopia' },
      { emoji: '📚', name: 'Dark Academia' },
      { emoji: '🌸', name: 'Cottagecore Morning' },
    ],
  },
];

const PRO_WORLD_EMOJIS = ['🎬', '⚔️', '🚀', '🏛️', '🏙️', '🌋', '🏗️', '🎭', '🦇', '🎪', '🪔', '🔮', '🍷', '🐉', '⛏️', '⛈️', '🍂', '🔬'];

function ScenesPreviewPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Animated amber header */}
      <div style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          200 one-click scenes across 23 worlds
        </p>
      </div>

      {/* 5 free world windows — horizontal row */}
      <div
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}
      >
        {FREE_WORLD_WINDOWS.map((w) => {
          const glowRgba = hexToRgbaPanel(w.color, 0.3);
          const glowBorder = hexToRgbaPanel(w.color, 0.5);
          const glowSoft = hexToRgbaPanel(w.color, 0.15);

          return (
            <div
              key={w.label}
              className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(15, 23, 42, 0.97)',
                border: `1px solid ${glowBorder}`,
                boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
                padding: 'clamp(8px, 0.8vw, 14px)',
                transition: 'box-shadow 200ms ease-out',
              }}
            >
              {/* Ethereal glow — top radial */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }}
              />
              {/* Bottom glow accent */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                {/* World emoji + label */}
                <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                  <span style={{ fontSize: 'clamp(0.95rem, 1.2vw, 1.45rem)' }}>{w.emoji}</span>
                  <span
                    className="font-semibold text-white truncate"
                    style={{
                      fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)',
                      textShadow: `0 0 12px ${glowRgba}`,
                    }}
                  >
                    {w.label}
                  </span>
                </div>

                {/* Scene count badge */}
                <span
                  className="inline-flex items-center self-start rounded-full font-medium ring-1"
                  style={{
                    fontSize: 'clamp(0.625rem, 0.6vw, 0.65rem)',
                    padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
                    background: hexToRgbaPanel(w.color, 0.15),
                    borderColor: hexToRgbaPanel(w.color, 0.3),
                    color: w.color,
                  }}
                >
                  5 scenes
                </span>

                {/* 3 scene entries */}
                <div className="flex flex-col flex-1" style={{ gap: 'clamp(2px, 0.25vw, 4px)' }}>
                  {w.scenes.map((s) => (
                    <div key={s.name} className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                      <span style={{ fontSize: 'clamp(0.65rem, 0.7vw, 0.85rem)' }}>{s.emoji}</span>
                      <span
                        className="text-slate-300 truncate"
                        style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}
                      >
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* "Included" badge */}
                <span
                  className="inline-flex items-center self-start text-emerald-400 font-semibold"
                  style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)', gap: 'clamp(2px, 0.2vw, 4px)' }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Free
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pro worlds row — 18 emojis + label */}
      <div
        className="flex items-center justify-center flex-wrap"
        style={{ gap: 'clamp(4px, 0.4vw, 6px)', paddingTop: 'clamp(8px, 0.8vw, 12px)' }}
      >
        {PRO_WORLD_EMOJIS.map((e, i) => (
          <span
            key={i}
            style={{ fontSize: 'clamp(0.75rem, 0.8vw, 0.95rem)' }}
            title="Pro world"
          >
            {e}
          </span>
        ))}
        <span
          className="text-amber-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', marginLeft: 'clamp(4px, 0.4vw, 6px)' }}
        >
          +18 worlds with Pro
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SAVED PREVIEW PANEL — user's actual saved prompts at risk
// ============================================================================
// Shown when Saved card is hovered. Shows up to 5 most recent saved prompts
// in tooltip-glass windows with platform brand colours.
// Human Factor: Endowment Effect — these are YOUR prompts shown back to you.
// Human Factor: Loss Aversion — "Browser only" on every window.
// ============================================================================

const SAVED_DEFAULT_COLOR = '#a78bfa';

const SAVED_PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED',
  openai: '#10B981',
  'google-imagen': '#4285F4',
  leonardo: '#EC4899',
  flux: '#F97316',
  stability: '#8B5CF6',
  'adobe-firefly': '#FF6B35',
  ideogram: '#06B6D4',
  playground: '#3B82F6',
  'microsoft-designer': '#0078D4',
  novelai: '#A855F7',
  canva: '#00C4CC',
  nightcafe: '#D946EF',
  picsart: '#FF3366',
  craiyon: '#FBBF24',
  bluewillow: '#3B82F6',
  dreamstudio: '#A855F7',
  runway: '#EF4444',
  freepik: '#0EA5E9',
  artbreeder: '#10B981',
  deepai: '#6366F1',
};

function SavedPreviewPanel() {
  const { allPrompts } = useSavedPrompts();
  const recentPrompts = allPrompts.slice(0, 5);
  const hasPrompts = recentPrompts.length > 0;
  const emptySlots = 5 - recentPrompts.length;

  return (
    <div className="flex flex-col h-full">
      {/* Animated amber header — personalised with real count */}
      <div style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          {hasPrompts
            ? `${allPrompts.length} prompt${allPrompts.length === 1 ? '' : 's'} saved — browser only`
            : 'Start saving prompts — build your library'}
        </p>
      </div>

      {/* 5 prompt windows — horizontal row */}
      <div
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}
      >
        {/* Filled windows — real saved prompts */}
        {recentPrompts.map((prompt) => {
          const platformColor = SAVED_PLATFORM_COLORS[prompt.platformId] ?? SAVED_DEFAULT_COLOR;
          const glowRgba = hexToRgbaPanel(platformColor, 0.3);
          const glowBorder = hexToRgbaPanel(platformColor, 0.5);
          const glowSoft = hexToRgbaPanel(platformColor, 0.15);

          return (
            <div
              key={prompt.id}
              className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(15, 23, 42, 0.97)',
                border: `1px solid ${glowBorder}`,
                boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
                padding: 'clamp(8px, 0.8vw, 14px)',
                transition: 'box-shadow 200ms ease-out',
              }}
            >
              {/* Ethereal glow — top radial */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }}
              />
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                {/* Platform name + icon */}
                <div className="flex items-center justify-between">
                  <span
                    className="font-semibold truncate"
                    style={{
                      color: platformColor,
                      fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)',
                      textShadow: `0 0 12px ${glowRgba}`,
                    }}
                  >
                    {prompt.platformName}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/icons/providers/${prompt.platformId}.png`}
                    alt=""
                    className="rounded shrink-0"
                    style={{
                      width: 'clamp(18px, 1.6vw, 24px)',
                      height: 'clamp(18px, 1.6vw, 24px)',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>

                {/* Tier badge */}
                {prompt.tier && (
                  <span
                    className="inline-flex items-center self-start rounded-full font-medium ring-1"
                    style={{
                      fontSize: 'clamp(0.625rem, 0.6vw, 0.65rem)',
                      padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
                      background: hexToRgbaPanel(platformColor, 0.15),
                      borderColor: hexToRgbaPanel(platformColor, 0.3),
                      color: platformColor,
                    }}
                  >
                    Tier {prompt.tier}
                  </span>
                )}

                {/* Prompt text — fills available space */}
                <p
                  className="text-slate-200 leading-relaxed flex-1 overflow-hidden whitespace-pre-wrap break-words"
                  style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
                >
                  {prompt.positivePrompt}
                </p>

                {/* Browser only warning */}
                <span
                  className="inline-flex items-center self-start text-amber-400 font-semibold"
                  style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)', gap: 'clamp(2px, 0.2vw, 4px)' }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Browser only
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty slots — dashed outlines showing capacity */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="relative flex-1 rounded-xl flex flex-col items-center justify-center"
            style={{
              border: '1px dashed rgba(167, 139, 250, 0.5)',
              padding: 'clamp(8px, 0.8vw, 14px)',
              background: 'rgba(15, 23, 42, 0.4)',
            }}
          >
            <span style={{ fontSize: 'clamp(1.15rem, 1.4vw, 1.75rem)', color: 'rgba(167, 139, 250, 0.5)' }}>💾</span>
            <span
              className="text-slate-400 text-center"
              style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)', marginTop: 'clamp(4px, 0.4vw, 6px)' }}
            >
              Empty slot
            </span>
          </div>
        ))}
      </div>

      {/* Bottom contrast line */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 'clamp(8px, 0.8vw, 12px)' }}
      >
        <span
          className="text-amber-400"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          {hasPrompts ? 'Clear cache = all gone' : 'Copy a prompt from any flag tooltip → it appears here'}
        </span>
        <span
          className="text-emerald-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          Pro: Synced forever
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// PROMPT LAB PREVIEW PANEL v3 — Full Intelligence Pipeline
// ============================================================================
// Window 1: "What Promagen Sees" — dynamic categoryMap data, all 12 categories
// Windows 2-5: REAL assemblePrompt() per rotating provider (not PotM text)
// Countdown: 3-state matching homepage, as heading in Window 1
// Colour-coded prompts via parsePromptUnified pattern
//
// Authority: docs/authority/code-standard.md, docs/authority/homepage.md §4
// Existing features preserved: Yes
// ============================================================================

// ── Category colours — imported from @/lib/prompt-colours (SSOT) ────────────

const CATEGORY_COLOURS = SHARED_CATEGORY_COLOURS;
const CATEGORY_EMOJIS: Record<string, string> = SHARED_CATEGORY_EMOJIS;

// Pro page uses custom display labels for some categories
const CATEGORY_LABELS: Record<string, string> = {
  ...SHARED_CATEGORY_LABELS,
  environment: 'Venue',
  materials: 'Surface',
  fidelity: 'Quality',
};

// ── Term index + prompt parser — delegates to @/lib/prompt-colours ──────────
// labBuildTermIndex and labParsePrompt preserved as thin wrappers for
// compatibility with the WeatherCategoryMap-based path used on this page.

function labBuildTermIndex(categoryMap: WeatherCategoryMap): Map<string, PromptCategory> {
  const index = new Map<string, PromptCategory>();
  for (const [cat, terms] of Object.entries(categoryMap.selections ?? {})) {
    if (!terms) continue;
    for (const term of terms) {
      const key = term.toLowerCase().trim();
      if (key) index.set(key, cat as PromptCategory);
    }
  }
  for (const [cat, phrase] of Object.entries(categoryMap.customValues ?? {})) {
    if (!phrase) continue;
    const key = phrase.toLowerCase().trim();
    if (key) index.set(key, cat as PromptCategory);
  }
  return index;
}

// Re-use shared parser as local alias for existing call sites

interface LabSegment { text: string; category: string; weight: number }

function labParsePrompt(promptText: string, termIndex: Map<string, PromptCategory>): LabSegment[] {
  return sharedParsePrompt(promptText, termIndex) as LabSegment[];
}

// ── Tier metadata ─────────────────────────────────────────────────────────

const LAB_TIER_META: Array<{
  tier: 1 | 2 | 3 | 4;
  label: string;
  color: string;
  dotClass: string;
  bgClass: string;
  ringClass: string;
  promptKey: 'tier1' | 'tier2' | 'tier3' | 'tier4';
}> = [
  { tier: 1, label: 'CLIP-Based', color: '#60a5fa', dotClass: 'bg-blue-400', bgClass: 'bg-blue-500/15', ringClass: 'ring-blue-500/30', promptKey: 'tier1' },
  { tier: 2, label: 'Midjourney', color: '#c084fc', dotClass: 'bg-purple-400', bgClass: 'bg-purple-500/15', ringClass: 'ring-purple-500/30', promptKey: 'tier2' },
  { tier: 3, label: 'Natural Language', color: '#34d399', dotClass: 'bg-emerald-400', bgClass: 'bg-emerald-500/15', ringClass: 'ring-emerald-500/30', promptKey: 'tier3' },
  { tier: 4, label: 'Plain Language', color: '#fb923c', dotClass: 'bg-orange-400', bgClass: 'bg-orange-500/15', ringClass: 'ring-orange-500/30', promptKey: 'tier4' },
];


// ── Hooks ─────────────────────────────────────────────────────────────────

function useLabCountdown(): { totalSec: number; timeStr: string } {
  const [totalSec, setTotalSec] = React.useState(180);
  React.useEffect(() => {
    const R = 3 * 60 * 1000;
    function tick() {
      const now = Date.now();
      setTotalSec(Math.floor(Math.max(0, (Math.floor(now / R) + 1) * R - now) / 1000));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return { totalSec, timeStr: `${m}:${String(s).padStart(2, '0')}` };
}

/**
 * Provider rotation with exact timing, progress bar (0→1), and seconds left.
 * The interval triggers provider changes at EXACTLY intervalMs.
 * Progress updates every 200ms for smooth bar fill.
 */
function useProviderRotation(
  providers: Array<{ id: string; name: string }>,
  intervalMs: number,
): { provider: { id: string; name: string } | null; progress: number; secsLeft: number } {
  const [index, setIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [secsLeft, setSecsLeft] = React.useState(Math.ceil(intervalMs / 1000));
  const startRef = React.useRef(Date.now());

  React.useEffect(() => {
    if (providers.length === 0) return;
    startRef.current = Date.now();
    setProgress(0);
    setSecsLeft(Math.ceil(intervalMs / 1000));

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= intervalMs) {
        startRef.current = Date.now();
        setIndex((prev) => (prev + 1) % providers.length);
        setProgress(0);
        setSecsLeft(Math.ceil(intervalMs / 1000));
      } else {
        setProgress(elapsed / intervalMs);
        setSecsLeft(Math.max(0, Math.ceil((intervalMs - elapsed) / 1000)));
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [providers.length, intervalMs]);

  return { provider: providers[index] ?? null, progress, secsLeft };
}

// ── Exact rotation intervals ──────────────────────────────────────────────
const ROTATION_T1_MS = 20_000;  // 20 seconds
const ROTATION_T2_MS = 42_500;  // 42.5 seconds
const ROTATION_T3_MS = 20_000;  // 20 seconds
const ROTATION_T4_MS = 20_000;  // 20 seconds

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

function PromptLabPreviewPanel({ providers }: { providers: Provider[] }) {
  const { data: potmData } = usePromptShowcase();
  const { totalSec, timeStr } = useLabCountdown();

  const categoryMap = potmData?.tierSelections?.tier1?.categoryMap;

  // Top providers per tier by image quality rank
  const tierProviders = React.useMemo(() => {
    const result: Record<number, Array<{ id: string; name: string }>> = { 1: [], 2: [], 3: [], 4: [] };
    for (const p of providers) {
      const tierId = getPlatformTierId(p.id);
      if (tierId && result[tierId]) result[tierId].push({ id: p.id, name: p.name });
    }
    for (const tid of [1, 2, 3, 4]) {
      const arr = result[tid] ?? [];
      arr.sort((a, b) => {
        const ap = providers.find((pp) => pp.id === a.id);
        const bp = providers.find((pp) => pp.id === b.id);
        return (ap?.imageQualityRank ?? 999) - (bp?.imageQualityRank ?? 999);
      });
      if (tid !== 2) result[tid] = arr.slice(0, 5);
    }
    return result;
  }, [providers]);

  // Independent rotation per tier with exact intervals
  const t1 = useProviderRotation(tierProviders[1] ?? [], ROTATION_T1_MS);
  const t2 = useProviderRotation(tierProviders[2] ?? [], ROTATION_T2_MS);
  const t3 = useProviderRotation(tierProviders[3] ?? [], ROTATION_T3_MS);
  const t4 = useProviderRotation(tierProviders[4] ?? [], ROTATION_T4_MS);
  const tierStates = [t1, t2, t3, t4];

  // Soonest provider change across all tiers
  const minSecsLeft = Math.min(t1.secsLeft, t2.secsLeft, t3.secsLeft, t4.secsLeft);

  // REAL per-provider prompts via assemblePrompt()
  const providerPrompts = React.useMemo(() => {
    if (!categoryMap) return ['', '', '', ''];
    const sel = selectionsFromMap(categoryMap);
    return tierStates.map((ts) => {
      if (!ts.provider) return '';
      try {
        return assemblePrompt(ts.provider.id, sel, categoryMap.weightOverrides).positive;
      } catch { return ''; }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryMap, t1.provider?.id, t2.provider?.id, t3.provider?.id, t4.provider?.id]);

  // Dynamic category rows — only show categories that have data
  const categoryRows = React.useMemo(() => {
    if (!categoryMap) return [];
    const rows: Array<{ cat: string; emoji: string; label: string; color: string; selection: string; custom: string }> = [];
    const allCats = ['subject', 'environment', 'lighting', 'atmosphere', 'style', 'colour', 'camera', 'composition', 'materials', 'action', 'fidelity', 'negative'];
    for (const cat of allCats) {
      const sel = categoryMap.selections?.[cat as PromptCategory];
      const custom = categoryMap.customValues?.[cat as PromptCategory];
      const neg = cat === 'negative' ? categoryMap.negative : undefined;
      if (!(sel && sel.length > 0) && !(custom && custom.trim()) && !(neg && neg.length > 0)) continue;
      rows.push({
        cat,
        emoji: CATEGORY_EMOJIS[cat] ?? '\u2022',
        label: CATEGORY_LABELS[cat] ?? cat,
        color: CATEGORY_COLOURS[cat] ?? '#94A3B8',
        selection: sel?.join(', ') ?? '',
        custom: cat === 'negative' ? (neg?.join(', ') ?? '') : (custom?.trim() ?? ''),
      });
    }
    return rows;
  }, [categoryMap]);

  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lab-fade { 0% { opacity: 0.4; } 100% { opacity: 1; } }
        .lab-fade-in { animation: lab-fade 0.5s ease-out forwards; }
      ` }} />

      {/* ── Centered amber pulsing header ─────────────────────────────── */}
      <div style={{ padding: 'clamp(8px, 0.8vw, 14px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          One workspace — all 42 platforms — instant switching
        </p>
      </div>

      {/* ── 5 windows ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0" style={{ gap: 'clamp(4px, 0.4vw, 7px)' }}>

        {/* ── Window 1: What Promagen Sees ────────────────────────────── */}
        <div
          className="relative rounded-xl overflow-hidden flex flex-col"
          style={{
            flex: '0 0 24%',
            background: 'rgba(15, 23, 42, 0.97)',
            border: '1px solid rgba(251, 113, 133, 0.4)',
            boxShadow: '0 0 30px 6px rgba(251, 113, 133, 0.15), inset 0 0 20px 2px rgba(251, 113, 133, 0.08)',
            padding: 'clamp(8px, 0.8vw, 12px)',
          }}
        >
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(251, 113, 133, 0.2) 0%, transparent 70%)' }} />
          <div className="relative z-10 flex flex-col h-full overflow-hidden" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>

            {/* Countdown — shows NEXT city arriving, matching homepage pattern:
                Normal:   [flag] NextCity arriving in M:SS
                Imminent: [flag] NextCity in M:SS
                Now:      [flag] Now                        */}
            {potmData && (
              <div className="inline-flex items-center shrink-0" style={{ gap: 'clamp(6px, 0.5vw, 10px)', marginBottom: 'clamp(2px, 0.2vw, 4px)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/flags/${(potmData.nextCountryCode ?? '').toLowerCase()}.svg`}
                  alt=""
                  className="rounded-sm object-cover shrink-0"
                  style={{ width: 'clamp(18px, 1.5vw, 24px)', height: 'clamp(14px, 1.1vw, 18px)' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {totalSec <= 3 ? (
                  <span className="tabular-nums font-semibold text-amber-300" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)', filter: 'brightness(1.3)' }}>Now</span>
                ) : totalSec <= 29 ? (
                  <>
                    <span className="text-white font-medium" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)' }}>{potmData.nextCity}</span>
                    <span className="tabular-nums text-amber-400" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)', filter: 'brightness(1.15)' }}>in {timeStr}</span>
                  </>
                ) : (
                  <>
                    <span className="text-white font-medium" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)' }}>{potmData.nextCity}</span>
                    <span className="tabular-nums text-slate-400" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)' }}>arriving in {timeStr}</span>
                  </>
                )}
              </div>
            )}

            {/* "What Promagen Sees" — centered, pink with glow, halved gap */}
            <span
              className="font-semibold text-center shrink-0"
              style={{
                fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)',
                color: '#fb7185',
                textShadow: '0 0 12px rgba(251, 113, 133, 0.4)',
                margin: 'clamp(3px, 0.3vw, 5px) 0',
              }}
            >
              What Promagen Sees
            </span>

            {/* Current city weather data — flag + city name, then conditions · temp · time */}
            {potmData && (
              <div
                className="flex flex-col items-center shrink-0"
                style={{ margin: 'clamp(3px, 0.3vw, 5px) 0', gap: 'clamp(2px, 0.2vw, 4px)' }}
              >
                <div className="inline-flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/flags/${(potmData.countryCode ?? '').toLowerCase()}.svg`}
                    alt=""
                    className="rounded-sm object-cover shrink-0"
                    style={{ width: 'clamp(16px, 1.3vw, 20px)', height: 'clamp(12px, 1vw, 15px)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-white font-semibold" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)' }}>
                    {potmData.city}
                  </span>
                </div>
                <span className="text-slate-400 text-center" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.73rem)' }}>
                  {potmData.conditions}
                  {potmData.weather?.tempC != null && (
                    <> · {Math.round(potmData.weather.tempC)}°C</>
                  )}
                  {potmData.localTime && (
                    <> · {potmData.localTime}</>
                  )}
                </span>
              </div>
            )}

            {/* Dynamic category rows — only categories with data shown */}
            {categoryRows.map((row) => (
              <div key={row.cat} className="flex flex-col" style={{ gap: 'clamp(2px, 0.2vw, 4px)' }}>
                <div className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                  <span style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}>{row.emoji}</span>
                  <span className="text-slate-300" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>{row.label}</span>
                  <span className="text-slate-400" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>{'\u2192'}</span>
                  <span className="font-medium truncate" style={{ color: row.color, fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>{row.selection}</span>
                </div>
                {row.custom && (
                  <span className="text-slate-300 leading-tight" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', paddingLeft: 'clamp(15.0px, 1.3vw, 21.0px)' }}>
                    {row.custom.length > 100 ? row.custom.slice(0, 98) + '\u2026' : row.custom}
                  </span>
                )}
              </div>
            ))}

            {/* Amber animated "Next provider in Xs" — footer of window 1 */}
            <div className="mt-auto shrink-0" style={{ paddingTop: 'clamp(4px, 0.4vw, 6px)' }}>
              <p
                className="italic text-amber-400/80 animate-pulse text-center font-semibold"
                style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}
              >
                Next provider in {minSecsLeft}s
              </p>
            </div>
          </div>
        </div>

        {/* ── Windows 2-5: Per-Provider Assembled Prompts ────────────── */}
        {LAB_TIER_META.map((t, idx) => {
          const { provider, progress } = tierStates[idx]!;
          const glowRgba = hexToRgbaPanel(t.color, 0.3);
          const glowBorder = hexToRgbaPanel(t.color, 0.5);
          const glowSoft = hexToRgbaPanel(t.color, 0.15);
          const promptText = providerPrompts[idx] ?? '';
          const tierCategoryMap = potmData?.tierSelections?.[t.promptKey]?.categoryMap;

          return (
            <div
              key={`${t.tier}-${provider?.id}`}
              className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(15, 23, 42, 0.97)',
                border: `1px solid ${glowBorder}`,
                boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
                padding: 'clamp(8px, 0.8vw, 12px)',
                paddingBottom: 'clamp(10px, 1vw, 14px)',
                transition: 'box-shadow 200ms ease-out',
              }}
            >
              <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }} />
              <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }} />

              <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                {/* Provider name + icon (crossfades on rotation) */}
                <div className="flex items-center justify-between lab-fade-in" key={provider?.id ?? t.tier}>
                  <span className="font-semibold truncate" style={{ color: t.color, fontSize: 'clamp(0.65rem, 0.7vw, 0.8rem)', textShadow: `0 0 12px ${glowRgba}` }}>
                    {provider?.name ?? t.label}
                  </span>
                  {provider && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/icons/providers/${provider.id}.png`}
                        alt=""
                        className="rounded shrink-0"
                        style={{ width: 'clamp(16px, 1.4vw, 22px)', height: 'clamp(16px, 1.4vw, 22px)' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </>
                  )}
                </div>

                {/* Tier badge — double gap above and below */}
                <span
                  className={`inline-flex items-center self-start rounded-full font-medium ${t.bgClass} ring-1 ${t.ringClass}`}
                  style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.6vw, 10px)', gap: 'clamp(3px, 0.3vw, 5px)', color: t.color, margin: 'clamp(3px, 0.3vw, 5px) 0' }}
                >
                  <span className={`rounded-full ${t.dotClass}`} style={{ width: 'clamp(4px, 0.4vw, 6px)', height: 'clamp(4px, 0.4vw, 6px)' }} />
                  Tier {t.tier}: {t.label}
                </span>

                {/* Colour-coded prompt — REAL assemblePrompt() output */}
                {promptText ? (
                  <div className="flex-1 overflow-hidden">
                    <p className="font-mono leading-relaxed" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.8rem)' }}>
                      {(() => {
                        if (!tierCategoryMap) return <span className="text-slate-200">{promptText}</span>;
                        const termIndex = labBuildTermIndex(tierCategoryMap);
                        if (termIndex.size === 0) return <span className="text-slate-200">{promptText}</span>;
                        const segments = labParsePrompt(promptText.replace(/([a-z])([A-Z])/g, '$1 $2'), termIndex);
                        return segments.map((seg, i) => {
                          const clr = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                          return (
                            <span key={i} style={{ color: clr, textShadow: seg.weight >= 1.05 ? `0 0 10px ${clr}50` : undefined }}>
                              {seg.text}
                            </span>
                          );
                        });
                      })()}
                    </p>
                  </div>
                ) : (
                  <span className="text-slate-400" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>Loading...</span>
                )}
              </div>

              {/* Progress bar — 2px at absolute bottom, fills in tier colour */}
              <div
                className="absolute bottom-0 left-0 right-0 overflow-hidden"
                style={{ height: '2px', background: 'rgba(255,255,255,0.06)' }}
              >
                <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: t.color, transition: 'width 200ms linear' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 42 provider icons row ────────────────────────────────────── */}
      <div className="flex items-center justify-center flex-wrap" style={{ gap: 'clamp(2px, 0.25vw, 4px)', paddingTop: 'clamp(6px, 0.6vw, 10px)' }}>
        {providers.slice(0, 42).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`/icons/providers/${p.id}.png`}
            alt=""
            className="rounded"
            style={{ width: 'clamp(14px, 1.2vw, 18px)', height: 'clamp(14px, 1.2vw, 18px)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ))}
        <span className="font-semibold" style={{ color: '#fb7185', fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', marginLeft: 'clamp(4px, 0.4vw, 6px)' }}>
          42 platforms — switch instantly
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// EXCHANGES PREVIEW PANEL — 5 windows: CTA + 4 regional mini-cards
// ============================================================================
// Shown when Exchanges card is hovered. Same glass/glow pattern as others.
// Window 1: Amber CTA — "Choose the exchanges that power your prompts" + button
// Windows 2-5: Americas, Europe, Africa & Middle East, Asia Pacific
// Each shows popular exchange mini-cards matching the real rail card style.
// Only renders full cards that fit — no partial/clipped cards.
//
// Human Factor: Curiosity Gap — user sees real exchange cards and wants control.
// Human Factor: Loss Aversion — "16 fixed" vs "your choice" creates desire.
// ============================================================================

const EXCHANGE_REGIONS: Array<{
  label: string;
  emoji: string;
  color: string;
  iso2Codes: string[];
}> = [
  {
    label: 'Americas',
    emoji: '🗽',
    color: '#38bdf8',
    iso2Codes: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'PE'],
  },
  {
    label: 'Europe',
    emoji: '🏰',
    color: '#6366f1',
    iso2Codes: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT', 'IE', 'PT', 'GR', 'RU'],
  },
  {
    label: 'Africa & M. East',
    emoji: '🌍',
    color: '#10b981',
    iso2Codes: ['ZA', 'EG', 'NG', 'KE', 'AE', 'SA', 'IL', 'QA', 'KW', 'MA', 'TR'],
  },
  {
    label: 'Asia Pacific',
    emoji: '🌏',
    color: '#fb7185',
    iso2Codes: ['JP', 'CN', 'HK', 'SG', 'KR', 'TW', 'IN', 'TH', 'MY', 'ID', 'AU', 'NZ', 'PH'],
  },
];

function ExchangesPreviewPanel({
  exchangeCatalog,
  onOpenPicker,
}: {
  exchangeCatalog: ExchangeCatalogEntry[];
  onOpenPicker: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cardMeasureRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [measuredCardHeight, setMeasuredCardHeight] = useState(0);

  // Measure container height via ResizeObserver (same as Engine Bay)
  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0;
      setContainerHeight(h);
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  // Measure actual first card height after render (not guessing)
  useEffect(() => {
    if (!cardMeasureRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const h = entries[0]?.borderBoxSize?.[0]?.blockSize ?? entries[0]?.contentRect?.height ?? 0;
      if (h > 0) setMeasuredCardHeight(h);
    });
    obs.observe(cardMeasureRef.current);
    return () => obs.disconnect();
  }, []);

  // Calculate visible cards — Engine Bay pattern: Math.floor(available / (item + gap))
  // Gap is clamp(12px, 1.2vw, 18px) — compute from viewport width
  const computedGap = typeof window !== 'undefined'
    ? Math.min(18, Math.max(12, window.innerWidth * 0.012))
    : 14;
  const HEADING_SPACE = 32;
  const availableForCards = Math.max(0, containerHeight - HEADING_SPACE - 8);
  const effectiveCardHeight = measuredCardHeight > 0 ? measuredCardHeight : 40;
  const maxVisibleCards = Math.max(1, Math.floor(
    (availableForCards + computedGap) / (effectiveCardHeight + computedGap),
  ));

  // Group exchanges by region — ONE per country (dedup by iso2), exclude city-vibe
  // Sort order follows iso2Codes array order (Americas: US, CA, MX first)
  const regionExchanges = useMemo(() => {
    const realExchanges = exchangeCatalog.filter((e) => !e.id.startsWith('city-vibe-'));
    return EXCHANGE_REGIONS.map((region) => {
      const seen = new Set<string>();
      const deduped: ExchangeCatalogEntry[] = [];
      for (const e of realExchanges) {
        const iso = (e.iso2 ?? '').toUpperCase();
        if (region.iso2Codes.includes(iso) && !seen.has(iso)) {
          seen.add(iso);
          deduped.push(e);
        }
      }
      // Sort by position in iso2Codes array — controls display order
      deduped.sort((a, b) => {
        const aIdx = region.iso2Codes.indexOf((a.iso2 ?? '').toUpperCase());
        const bIdx = region.iso2Codes.indexOf((b.iso2 ?? '').toUpperCase());
        return aIdx - bIdx;
      });
      return deduped.slice(0, maxVisibleCards);
    });
  }, [exchangeCatalog, maxVisibleCards]);

  const ctaColor = '#22d3ee';
  const ctaGlowRgba = hexToRgbaPanel(ctaColor, 0.3);
  const ctaGlowBorder = hexToRgbaPanel(ctaColor, 0.5);
  const ctaGlowSoft = hexToRgbaPanel(ctaColor, 0.15);

  return (
    <div className="flex flex-col h-full">
      {/* Animated amber header */}
      <div style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}>
        <p
          className="italic text-amber-400 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          Choose the exchanges that power your prompts
        </p>
      </div>

      {/* 5 windows: CTA + 4 regions */}
      <div
        ref={panelRef}
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}
      >
        {/* Window 1: CTA — Click to configure */}
        <div
          className="relative flex-1 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer"
          style={{
            background: 'rgba(15, 23, 42, 0.97)',
            border: `1px solid ${ctaGlowBorder}`,
            boxShadow: `0 0 30px 6px ${ctaGlowRgba}, 0 0 60px 12px ${ctaGlowSoft}, inset 0 0 20px 2px ${ctaGlowRgba}`,
            padding: 'clamp(10px, 1vw, 16px)',
            transition: 'box-shadow 200ms ease-out',
          }}
          onClick={onOpenPicker}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPicker(); } }}
          aria-label="Open exchange selection"
        >
          {/* Ethereal glow — top radial */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${ctaGlowRgba} 0%, transparent 70%)` }}
          />
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${ctaGlowSoft} 0%, transparent 60%)` }}
          />

          <div className="relative z-10 flex flex-col items-center" style={{ gap: 'clamp(10px, 1vw, 18px)' }}>
            {/* Globe icon */}
            <span style={{ fontSize: 'clamp(1.5rem, 2vw, 2.5rem)' }}>📊</span>

            {/* Instruction text */}
            <p
              className="text-white font-semibold text-center"
              style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
            >
              Configure Your Exchanges
            </p>
            <p
              className="text-slate-300 text-center leading-relaxed"
              style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
            >
              Select 6–16 exchanges to shape every prompt
            </p>

            {/* CTA button — matches exchange glow colour */}
            <div
              className="inline-flex items-center rounded-full ring-1 font-medium"
              style={{
                padding: 'clamp(5px, 0.5vw, 8px) clamp(14px, 1.4vw, 22px)',
                fontSize: 'clamp(0.65rem, 0.7vw, 0.8rem)',
                background: hexToRgbaPanel(ctaColor, 0.2),
                borderColor: hexToRgbaPanel(ctaColor, 0.5),
                color: ctaColor,
                gap: 'clamp(4px, 0.4vw, 6px)',
              }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Click to Select
            </div>
          </div>
        </div>

        {/* Windows 2-5: Regional exchange cards */}
        {EXCHANGE_REGIONS.map((region, idx) => {
          const glowRgba = hexToRgbaPanel(region.color, 0.3);
          const glowBorder = hexToRgbaPanel(region.color, 0.5);
          const glowSoft = hexToRgbaPanel(region.color, 0.15);
          const exchanges = regionExchanges[idx] ?? [];
          const isFirstRegion = idx === 0;

          return (
            <div
              key={region.label}
              className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(15, 23, 42, 0.97)',
                border: `1px solid ${glowBorder}`,
                boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
                padding: 'clamp(8px, 0.8vw, 14px)',
                transition: 'box-shadow 200ms ease-out',
              }}
            >
              {/* Ethereal glow — top radial */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }}
              />
              <div
                className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
                {/* Region heading */}
                <div className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                  <span style={{ fontSize: 'clamp(0.85rem, 1vw, 1.2rem)' }}>{region.emoji}</span>
                  <span
                    className="font-semibold text-white truncate"
                    style={{
                      fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)',
                      textShadow: `0 0 12px ${glowRgba}`,
                    }}
                  >
                    {region.label}
                  </span>
                  <span
                    className="ml-auto font-bold tabular-nums shrink-0"
                    style={{ color: region.color, fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
                  >
                    {exchanges.length}
                  </span>
                </div>

                {/* Mini exchange cards — matching real rail card style */}
                <div className="flex flex-col flex-1 overflow-hidden" style={{ gap: 'clamp(12px, 1.2vw, 18px)' }}>
                  {exchanges.map((ex, exIdx) => {
                    const exColor = ex.hoverColor ?? '#A855F7';
                    const exGlow = hexToRgbaPanel(exColor, 0.25);
                    const exBorder = hexToRgbaPanel(exColor, 0.4);
                    // Same logic as real exchange card: extract defaultIndexName properly
                    // Uses isMultiIndexConfig type guard for type-safe access
                    const ms = ex.marketstack;
                    const indexName = ms
                      ? (isMultiIndexConfig(ms) ? ms.defaultIndexName : ms.indexName)
                      : '';
                    // Attach measurement ref to very first card (first region, first card)
                    const measureRef = isFirstRegion && exIdx === 0 ? cardMeasureRef : undefined;

                    return (
                      <div
                        key={ex.id}
                        ref={measureRef}
                        className="relative rounded-lg overflow-hidden shrink-0"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${exBorder}`,
                          boxShadow: `0 0 12px 2px ${exGlow}, inset 0 0 8px 1px ${hexToRgbaPanel(exColor, 0.1)}`,
                          padding: 'clamp(5px, 0.5vw, 8px) clamp(8px, 0.8vw, 12px)',
                        }}
                      >
                        {/* Ethereal glow - top radial (same as real exchange card) */}
                        <span
                          className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
                          style={{
                            background: `radial-gradient(ellipse at 50% 0%, ${exGlow} 0%, transparent 70%)`,
                          }}
                          aria-hidden="true"
                        />
                        <div className="relative z-10 flex items-center" style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}>
                          {/* Flag */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/flags/${(ex.iso2 ?? '').toLowerCase()}.svg`}
                            alt=""
                            className="rounded-sm shrink-0"
                            style={{
                              width: 'clamp(16px, 1.4vw, 22px)',
                              height: 'clamp(11px, 1vw, 15px)',
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {/* Exchange name */}
                          <span
                            className="font-medium text-slate-100 truncate"
                            style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
                          >
                            {ex.name ?? ex.exchange ?? ex.id}
                          </span>
                          {/* City — right aligned */}
                          <span
                            className="text-slate-300 truncate ml-auto shrink-0"
                            style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}
                          >
                            {ex.city}
                          </span>
                        </div>
                        {/* Index name row — only shown when data exists (same as real rails) */}
                        {indexName && (
                          <div className="relative z-10" style={{ marginTop: 'clamp(2px, 0.2vw, 3px)' }}>
                            <span
                              className="text-slate-400"
                              style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}
                            >
                              {indexName}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom row — exchange count + Pro benefit */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 'clamp(8px, 0.8vw, 12px)' }}
      >
        <span
          className="text-amber-400"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          {exchangeCatalog.filter((e) => !e.id.startsWith('city-vibe-')).length} exchanges across 7 continents
        </span>
        <span
          className="text-emerald-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          Pro: Your selection, everywhere
        </span>
      </div>
    </div>
  );
}

// MAIN COMPONENT
// ============================================================================

export default function ProPromagenClient({
  exchangeCatalog,
  fxCatalog: _fxCatalog,
  defaultExchangeIds,
  defaultFxPairIds: _defaultFxPairIds,
  demoWeatherIndex,
  providers = [],
}: ProPromagenClientProps) {
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame, clerkPromptTier } = usePromagenAuth();

  const isPaidUser = userTier === 'paid';

  // ============================================================================
  // STATE - Selection (v2.8.0: SSR-safe init + hydration gate)
  // ============================================================================
  // Strategy: Initialize with SSOT defaults (matches server render → no hydration
  // error). Then useEffect reads localStorage after mount and sets hydrated=true.
  // Exchange rails show a skeleton pulse until hydrated, so the user never sees
  // wrong content flash — they see skeleton → correct content.
  // ============================================================================

  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(() =>
    simpleIdsToCompoundKeys(defaultExchangeIds, exchangeCatalog),
  );
  const [selectedPromptTier, setSelectedPromptTier] = useState<PromptTier>(4);

  // Track initial state for change detection
  const [initialExchanges, setInitialExchanges] = useState<string[]>(() =>
    simpleIdsToCompoundKeys(defaultExchangeIds, exchangeCatalog),
  );

  // Hydration gate — false until useEffect reads localStorage
  const [hydrated, setHydrated] = useState(false);

  // Read localStorage after mount (client-only, runs once)
  useEffect(() => {
    const storedExch = loadArrayFromStorage(STORAGE_KEYS.EXCHANGE_SELECTION);
    if (storedExch) {
      // Convert any legacy simple IDs to compound keys
      const compound = simpleIdsToCompoundKeys(storedExch, exchangeCatalog);
      setSelectedExchanges(compound);
      setInitialExchanges(compound);
    }

    // Tier: localStorage first (warm cache), Clerk may override below
    try {
      const storedTier = localStorage.getItem(STORAGE_KEYS.PROMPT_TIER);
      if (storedTier !== null) {
        const parsed = JSON.parse(storedTier) as number;
        if ([1, 2, 3, 4].includes(parsed)) setSelectedPromptTier(parsed as PromptTier);
      }
    } catch {
      /* ignore */
    }

    setHydrated(true);
    // exchangeCatalog is a stable server-component prop — never changes after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clerk metadata is the source of truth — override localStorage when it arrives.
  // Clerk hydrates async, so clerkPromptTier may be null on first render then
  // populate on subsequent renders. This effect catches that.
  useEffect(() => {
    if (clerkPromptTier !== null && [1, 2, 3, 4].includes(clerkPromptTier)) {
      setSelectedPromptTier(clerkPromptTier as PromptTier);
    }
  }, [clerkPromptTier]);

  // ============================================================================
  // STATE - Fullscreen Pickers (v2.3.0 Exchange, v2.6.0 FX)
  // ============================================================================
  // When true, entire centre panel shows ONLY the respective Picker
  // No headers, no badges, no comparison table, no CTA - just the picker
  // ============================================================================
  const [isExchangePickerFullscreen, setIsExchangePickerFullscreen] = useState(false);

  // ============================================================================
  // HOVER BRIDGE — unified panel visibility with 2s linger delay
  // ============================================================================
  // Pattern: Card hover opens panel → card leave starts 2s timer → if cursor
  // enters preview panel before timer expires, cancel timer and keep open →
  // panel closes only when cursor leaves preview panel. Mutual exclusion:
  // hovering a new card immediately switches to that panel.
  // ============================================================================
  type PreviewPanel = 'format' | 'scenes' | 'saved' | 'lab' | 'exchanges';
  const [activePanel, setActivePanel] = useState<PreviewPanel | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout>>();
  const inPreviewRef = useRef(false);

  const handleCardHover = useCallback((panel: PreviewPanel, hovering: boolean) => {
    clearTimeout(lingerRef.current);
    if (hovering) {
      inPreviewRef.current = false;
      setActivePanel(panel);
    } else {
      lingerRef.current = setTimeout(() => {
        if (!inPreviewRef.current) {
          setActivePanel(null);
        }
      }, 2000);
    }
  }, []);

  const handlePreviewEnter = useCallback(() => {
    clearTimeout(lingerRef.current);
    inPreviewRef.current = true;
  }, []);

  const handlePreviewLeave = useCallback(() => {
    inPreviewRef.current = false;
    setActivePanel(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(lingerRef.current), []);

  // Wrapper callbacks matching FeatureControlPanel prop signatures
  const setFormatHovered = useCallback((h: boolean) => handleCardHover('format', h), [handleCardHover]);
  const setScenesHovered = useCallback((h: boolean) => handleCardHover('scenes', h), [handleCardHover]);
  const setSavedHovered = useCallback((h: boolean) => handleCardHover('saved', h), [handleCardHover]);
  const setLabHovered = useCallback((h: boolean) => handleCardHover('lab', h), [handleCardHover]);
  const setExchangesHovered = useCallback((h: boolean) => handleCardHover('exchanges', h), [handleCardHover]);

  // Detect changes from initial state (FX no longer tracked — fixed pairs)
  const hasChanges = useMemo(() => {
    if (!hydrated) return false;
    const exchChanged =
      JSON.stringify([...selectedExchanges].sort()) !==
      JSON.stringify([...initialExchanges].sort());
    return exchChanged;
  }, [selectedExchanges, initialExchanges, hydrated]);

  // ============================================================================
  // DERIVED DATA - Dropdown options with country labels
  // ============================================================================

  // Exchange picker options - converted from catalog (v2.3.0)
  const exchangePickerOptions = useMemo(() => {
    return catalogToPickerOptions(exchangeCatalog);
  }, [exchangeCatalog]);

  // ============================================================================
  // PREVIEW EXCHANGES - Filter catalog by selection for rails
  // ============================================================================

  const previewExchanges = useMemo((): Exchange[] => {
    const exchanges: Exchange[] = [];
    for (const compoundKey of selectedExchanges) {
      const { exchangeId, benchmark } = parseCompoundKey(compoundKey);
      const entry = exchangeCatalog.find((e) => e.id === exchangeId);
      if (!entry || entry.id.startsWith('city-vibe-')) continue;
      exchanges.push(
        catalogToExchange(entry, demoWeatherIndex.get(exchangeId) ?? null, compoundKey, benchmark),
      );
    }
    exchanges.sort((a, b) => a.longitude - b.longitude);
    return exchanges;
  }, [exchangeCatalog, selectedExchanges, demoWeatherIndex]);

  // Split into left/right rails based on user location (or Greenwich)
  const { left: leftRail, right: rightRail } = useMemo(() => {
    return getRailsRelative(previewExchanges, locationInfo.coordinates);
  }, [previewExchanges, locationInfo.coordinates]);

  // Combined for HomepageGrid
  const allOrderedExchanges = useMemo(() => {
    return [...leftRail, ...rightRail.slice().reverse()];
  }, [leftRail, rightRail]);

  // Convert demo weather index to the format expected by Mission Control
  const weatherDataMap = useMemo(() => {
    return convertToWeatherDataMap(demoWeatherIndex);
  }, [demoWeatherIndex]);

  // ============================================================================
  // LIVE DATA — Index quotes + Weather (same pattern as homepage)
  // ============================================================================

  // Server derives tier + selection from Clerk session cookie.
  const { quotesById, movementById } = useIndicesQuotes({ enabled: true });

  // Build indexByExchange map — bidirectional key support (v3.0.0)
  // Gateway may return simple IDs (pre-deploy) or compound IDs (post-deploy).
  // Pro page cards use compound IDs. We alias both directions so lookups always work.
  const indexByExchange = useMemo(() => {
    const map = new Map<string, IndexQuoteData>();

    for (const [quoteId, quote] of quotesById.entries()) {
      if (!quote) continue;
      const indexName = typeof quote.indexName === 'string' ? quote.indexName : null;
      const price =
        typeof quote.price === 'number' && Number.isFinite(quote.price) ? quote.price : null;
      if (!indexName || price === null) continue;

      const movement = movementById.get(quoteId);
      const data: IndexQuoteData = {
        indexName,
        price,
        change:
          typeof quote.change === 'number' && Number.isFinite(quote.change) ? quote.change : 0,
        percentChange:
          typeof quote.percentChange === 'number' && Number.isFinite(quote.percentChange)
            ? quote.percentChange
            : 0,
        tick: movement?.tick ?? 'flat',
      };

      // Set for the exact quote ID (could be simple or compound)
      map.set(quoteId, data);

      // Also set plain exchangeId from compound keys (homepage-style fallback)
      const sepIdx = quoteId.indexOf('::');
      if (sepIdx !== -1) {
        const plainId = quoteId.substring(0, sepIdx);
        if (!map.has(plainId)) {
          map.set(plainId, data);
        }
      }
    }

    // Reverse alias: for each selected compound key, if there's data under
    // the plain exchangeId but not the compound key, copy it across.
    // ONLY for single-index exchanges (one compound key per exchangeId).
    // For multi-index exchanges (e.g. cse-colombo::aspi + cse-colombo::cse_general),
    // a missing compound key means Marketstack doesn't carry that index —
    // show null (renders as —) rather than copying the wrong index's data.
    const compoundKeysPerExchange = new Map<string, number>();
    for (const compoundKey of selectedExchanges) {
      const { exchangeId } = parseCompoundKey(compoundKey);
      compoundKeysPerExchange.set(exchangeId, (compoundKeysPerExchange.get(exchangeId) ?? 0) + 1);
    }

    for (const compoundKey of selectedExchanges) {
      if (map.has(compoundKey)) continue; // Already has compound-keyed data
      const { exchangeId } = parseCompoundKey(compoundKey);
      // Only alias for single-index exchanges — multi-index missing = genuinely no data
      if ((compoundKeysPerExchange.get(exchangeId) ?? 0) > 1) continue;
      const data = map.get(exchangeId);
      if (data) {
        map.set(compoundKey, data);
      }
    }

    return map;
  }, [quotesById, movementById, selectedExchanges]);

  // Fetch live weather (same hook as homepage)
  const { weather: liveWeatherById } = useWeather();

  // Convert live weather to ExchangeWeatherData map
  const liveWeatherMap = useMemo(() => {
    const map = new Map<string, ExchangeWeatherData>();
    for (const [id, w] of Object.entries(liveWeatherById)) {
      map.set(id, {
        tempC: w.temperatureC,
        tempF: w.temperatureF,
        emoji: w.emoji,
        condition: w.conditions,
        humidity: w.humidity,
        windKmh: w.windSpeedKmh,
        description: w.description,
        sunriseUtc: w.sunriseUtc ?? undefined,
        sunsetUtc: w.sunsetUtc ?? undefined,
        timezoneOffset: w.timezoneOffset ?? undefined,
        isDayTime: w.isDayTime ?? undefined,
      });
    }
    return map;
  }, [liveWeatherById]);

  // FIX v2.7.0: Merge live weather OVER demo weather (not replace).
  // Previously: liveWeatherMap.size > 0 ? liveWeatherMap : weatherDataMap
  // That discarded demo weather the moment ANY live weather arrived.
  // If live weather covered 10 of 16 exchanges, the other 6 lost their data.
  // Now: start with demo as base, overlay live on top. Live always wins per-exchange.
  const effectiveWeatherMap = useMemo(() => {
    if (liveWeatherMap.size === 0) return weatherDataMap;
    const merged = new Map(weatherDataMap);
    for (const [id, data] of liveWeatherMap.entries()) {
      merged.set(id, data);
    }
    return merged;
  }, [liveWeatherMap, weatherDataMap]);

  // ============================================================================
  // COMPOUND KEY ALIASING (v3.0.0)
  // ============================================================================
  // Exchange cards now have id=compoundKey (e.g. "cse-colombo::cse_all_share")
  // but weather/index data arrives keyed by simple exchangeId ("cse-colombo").
  // Alias compound keys → same data so ExchangeCard lookups work.
  // ============================================================================

  const aliasedWeatherMap = useMemo(() => {
    const map = new Map(effectiveWeatherMap);
    for (const compoundKey of selectedExchanges) {
      const { exchangeId } = parseCompoundKey(compoundKey);
      if (compoundKey !== exchangeId) {
        const data = effectiveWeatherMap.get(exchangeId);
        if (data) map.set(compoundKey, data);
      }
    }
    return map;
  }, [effectiveWeatherMap, selectedExchanges]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleExchangeChange = useCallback((ids: string[]) => {
    // Validate count (allows 0 to max)
    if (
      ids.length < PRO_SELECTION_LIMITS.EXCHANGE_MIN ||
      ids.length > PRO_SELECTION_LIMITS.EXCHANGE_MAX
    ) {
      return;
    }
    setSelectedExchanges(ids);
    // Auto-save to localStorage on every change
    saveToStorage(STORAGE_KEYS.EXCHANGE_SELECTION, ids);
  }, []);

  const handlePromptTierChange = useCallback((tier: PromptTier) => {
    setSelectedPromptTier(tier);
    // Save to localStorage (warm cache for immediate reads)
    saveToStorage(STORAGE_KEYS.PROMPT_TIER, tier);
    // Persist to Clerk publicMetadata (survives cache clear / device switch)
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ promptTier: tier }),
    }).catch((err) => {
      console.error('[pro-promagen] Failed to sync promptTier to Clerk:', err);
    });
  }, []);

  const handleSave = useCallback(async () => {
    // Save is already done on each change, but this confirms to user
    saveToStorage(STORAGE_KEYS.EXCHANGE_SELECTION, selectedExchanges);

    // Update initial state to reflect saved state
    setInitialExchanges(selectedExchanges);

    // Prompt tier synced to Clerk in handlePromptTierChange (v2.1.0)
    // Exchange selection remains localStorage-only (demo/preview data)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, [selectedExchanges]);

  // ============================================================================
  // FULLSCREEN EXCHANGE PICKER HANDLERS (v2.3.0)
  // ============================================================================

  const handleOpenExchangePicker = useCallback(() => {
    setIsExchangePickerFullscreen(true);
  }, []);

  const handleCloseExchangePicker = useCallback(() => {
    setIsExchangePickerFullscreen(false);
  }, []);

  // ============================================================================
  // CENTRE CONTENT - Conditional rendering based on fullscreen picker state
  // ============================================================================
  // v3.0.0: FX picker fullscreen mode removed (FX pairs no longer configurable)
  // v2.3.0: When picker is fullscreen, show ONLY the picker
  // Otherwise show normal comparison table with headers, badges, CTA
  // ============================================================================

  const centreContent = isExchangePickerFullscreen ? (
    // ========================================================================
    // FULLSCREEN EXCHANGE PICKER MODE (v2.3.0)
    // Entire centre panel dedicated to exchange selection
    // ========================================================================
    <section
      aria-label="Select Stock Exchanges"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      data-testid="exchange-picker-fullscreen"
    >
      {/* Picker fills the available space - child handles its own scrolling */}
      <div className="min-h-0 flex-1">
        <ExchangePicker
          exchanges={exchangePickerOptions}
          selected={selectedExchanges}
          onChange={handleExchangeChange}
          min={PRO_SELECTION_LIMITS.EXCHANGE_MIN}
          max={PRO_SELECTION_LIMITS.EXCHANGE_MAX}
          disabled={false}
        />
      </div>

      {/* Done Button - Canonical purple gradient per code-standard.md §6.1 */}
      <div className="shrink-0 border-t border-white/10 bg-slate-900/50 p-4">
        <button
          type="button"
          onClick={handleCloseExchangePicker}
          className="
            w-full inline-flex items-center justify-center gap-2 rounded-full
            border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20
            px-6 py-3 text-sm font-medium text-purple-100 shadow-sm
            transition-all duration-200
            hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
            focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
          "
        >
          {/* Checkmark icon */}
          <svg
            className="w-4 h-4 text-purple-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Done — Save Selection</span>
        </button>
      </div>
    </section>
  ) : (
    // ========================================================================
    // NORMAL MODE — Feature Control Panel (3×3 grid)
    // ========================================================================
    <section
      aria-label="Pro Promagen Configuration"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      style={{ padding: 'clamp(10px, 1vw, 16px)' }}
      data-testid="pro-promagen-panel"
    >
      {/* Header — compact */}
      <header className="shrink-0" style={{ marginBottom: 'clamp(6px, 0.7vw, 12px)' }}>
        <div className="flex items-center justify-between">
          <h2
            className="font-semibold text-white flex items-center"
            style={{ fontSize: 'clamp(0.8rem, 1vw, 1.1rem)', gap: 'clamp(4px, 0.4vw, 8px)' }}
          >
            <span className="text-amber-400">★</span>
            Pro Promagen
          </h2>
          <span
            className={`inline-flex items-center rounded-full ring-1 ${
              isPaidUser
                ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 ring-amber-500/30'
            }`}
            style={{
              fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
              padding: 'clamp(2px, 0.2vw, 4px) clamp(6px, 0.6vw, 10px)',
              gap: 'clamp(3px, 0.3vw, 6px)',
            }}
          >
            <span
              className="rounded-full bg-current"
              style={{ width: 'clamp(4px, 0.4vw, 6px)', height: 'clamp(4px, 0.4vw, 6px)' }}
            />
            {isPaidUser ? 'Your engine. Your rules.' : 'Preview — try before you buy'}
          </span>
        </div>
      </header>

      {/* Feature Control Panel — 3×3 grid (1/4 of available height, min 6 cards) */}
      <div className="overflow-hidden" style={{ flex: '1 1 0%', minHeight: 'clamp(140px, 16vw, 270px)' }}>
        <FeatureControlPanel
          isPaidUser={isPaidUser}
          selectedPromptTier={selectedPromptTier}
          onPromptTierChange={handlePromptTierChange}
          selectedExchangeCount={selectedExchanges.length}
          onOpenExchangePicker={handleOpenExchangePicker}
          onFormatHover={setFormatHovered}
          onScenesHover={setScenesHovered}
          onSavedHover={setSavedHovered}
          onLabHover={setLabHovered}
          onExchangesHover={setExchangesHovered}
        />
      </div>

      {/* Bottom panel — preview windows (3/4 of available height) */}
      {/* Hover bridge: onMouseEnter cancels linger timeout, onMouseLeave closes */}
      <div
        className="min-h-0 flex flex-col rounded-xl overflow-hidden"
        style={{
          flex: '3 1 0%',
          marginTop: 'clamp(8px, 0.8vw, 12px)',
        }}
        onMouseEnter={activePanel ? handlePreviewEnter : undefined}
        onMouseLeave={activePanel ? handlePreviewLeave : undefined}
      >
        {/* All preview panels rendered always — toggled via CSS display.
            This avoids the mount-on-hover spike (PromptLabPreviewPanel starts
            5 timers + assemblePrompt + 42 icons on mount). With CSS toggle,
            hover just flips display — zero React work, instant paint. */}
        <div style={{ display: activePanel === 'format' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TierPreviewPanel activeTier={selectedPromptTier} />
        </div>
        <div style={{ display: activePanel === 'scenes' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ScenesPreviewPanel />
        </div>
        <div style={{ display: activePanel === 'saved' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <SavedPreviewPanel />
        </div>
        <div style={{ display: activePanel === 'lab' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <PromptLabPreviewPanel providers={providers} />
        </div>
        <div style={{ display: activePanel === 'exchanges' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ExchangesPreviewPanel exchangeCatalog={exchangeCatalog} onOpenPicker={handleOpenExchangePicker} />
        </div>
        <div style={{ display: activePanel === null ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <UpgradeCta isPaidUser={isPaidUser} onSave={handleSave} hasChanges={hasChanges} />
        </div>
      </div>
    </section>
  );

  // ============================================================================
  // EXCHANGE RAILS
  // ============================================================================

  // ============================================================================
  // EXCHANGE RAILS (gated on hydration to prevent flash)
  // ============================================================================
  // Before hydration: show skeleton pulse (matches server render = no mismatch)
  // After hydration: show actual exchange cards with correct localStorage selection
  // ============================================================================

  const railSkeleton = (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[140px] rounded-lg bg-white/5 animate-pulse ring-1 ring-white/10"
        />
      ))}
    </div>
  );

  const leftExchanges = hydrated ? (
    <ExchangeList
      exchanges={leftRail}
      weatherByExchange={aliasedWeatherMap}
      indexByExchange={indexByExchange}
      emptyMessage="No eastern exchanges selected"
      side="left"
    />
  ) : (
    railSkeleton
  );

  const rightExchanges = hydrated ? (
    <ExchangeList
      exchanges={rightRail}
      weatherByExchange={aliasedWeatherMap}
      indexByExchange={indexByExchange}
      emptyMessage="No western exchanges selected"
      side="right"
    />
  ) : (
    railSkeleton
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  return (
    <HomepageGrid
      mainLabel="Pro Promagen Configuration"
      headingText="Pro Promagen — Unlock the Full Engine"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon={false}
      exchanges={allOrderedExchanges}
      displayedProviderIds={[]}
      isPaidUser={isPaidUser}
      isAuthenticated={isAuthenticated}
      referenceFrame={locationInfo.referenceFrame}
      onReferenceFrameChange={setReferenceFrame}
      isLocationLoading={effectiveLocationLoading}
      cityName={locationInfo.cityName}
      // NEW v2.0.0: Engine Bay and Mission Control support
      providers={providers}
      showEngineBay={true}
      showMissionControl={true}
      weatherIndex={effectiveWeatherMap}
      isProPromagenPage={true}
    />
  );
}
