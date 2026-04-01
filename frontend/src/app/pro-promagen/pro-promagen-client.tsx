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
import { useGlobalPromptTier } from '@/hooks/use-global-prompt-tier';
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
import { optimizePromptGoldStandard } from '@/lib/prompt-optimizer';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';
import { CATEGORY_COLOURS as SHARED_CATEGORY_COLOURS, CATEGORY_LABELS as SHARED_CATEGORY_LABELS, CATEGORY_EMOJIS as SHARED_CATEGORY_EMOJIS, parsePromptIntoSegments as sharedParsePrompt } from '@/lib/prompt-colours';
import allProvidersData from '@/data/providers/providers.json';

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
// SHARED AUTO-SCROLL — 17-second cycle: hold top → scroll down → hold bottom → scroll up
// ============================================================================
// Authority: best-working-practice.md § Auto-scroll animation pattern
// Spec: 0.3s hold top → 8s down → 0.3s hold bottom → 8s up → repeat
// Bug fix: observe BOTH container + content, skip measurements when hidden
//   (display:none panels report 0 dims → scrollDist = 0 → animation dead).
//   Periodic 2s re-measure catches content changes ResizeObserver misses.
// ============================================================================

const PRO_AUTO_SCROLL_CSS = `
  @keyframes proAutoScroll {
    0%, 1.8% { transform: translateY(0); }
    48.8% { transform: translateY(var(--scroll-dist, 0px)); }
    50.6% { transform: translateY(var(--scroll-dist, 0px)); }
    97.6% { transform: translateY(0); }
    100% { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pro-auto-scroll { animation: none !important; }
  }
`;

function useAutoScroll(): {
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  scrollDist: number;
} {
  const containerRef = React.useRef<HTMLDivElement>(null!);
  const contentRef = React.useRef<HTMLDivElement>(null!);
  const [scrollDist, setScrollDist] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      // Skip when parent is display:none (all dims are 0)
      if (container.clientHeight < 10) return;
      const overflow = content.scrollHeight - container.clientHeight;
      const next = Math.max(0, overflow);
      setScrollDist((prev) => (next === prev ? prev : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(content);
    // Periodic re-measure catches content changes ResizeObserver misses
    const tid = setInterval(measure, 2000);
    return () => { ro.disconnect(); clearInterval(tid); };
  }, []);

  return { containerRef, contentRef, scrollDist };
}


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
        copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white hover:bg-white/10 hover:text-white'
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

// ── TierWindow: Faithful copy of TooltipContent from weather-prompt-tooltip.tsx
// Structure, classes, spacing all copied from the real tooltip.
// Uses BlurredTierRow-style rows for "Other formats" (free users)
// and ProTierSelector-style rows for paid users.
function TierWindow({
  t,
  isActive,
  isPaidUser,
  onTierChange,
  promptText,
  allPrompts,
  tierCategoryMap,
}: {
  t: typeof TIER_DISPLAY[number];
  isActive: boolean;
  isPaidUser: boolean;
  onTierChange?: (tier: 1 | 2 | 3 | 4) => void;
  promptText: string;
  /** All 4 tier prompts so other-tier rows can show preview text */
  allPrompts: Record<string, string>;
  /** Category map for colour coding prompt text — same as Prompt Lab */
  tierCategoryMap?: WeatherCategoryMap;
}) {
  const { containerRef, contentRef, scrollDist } = useAutoScroll();

  // Glow — identical to TooltipContent using tempColor
  const glowRgba = hexToRgbaPanel(t.color, isActive ? 0.35 : 0.2);
  const glowBorder = hexToRgbaPanel(t.color, isActive ? 0.6 : 0.35);
  const glowSoft = hexToRgbaPanel(t.color, isActive ? 0.15 : 0.08);
  const shadow = isActive
    ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
    : `0 0 20px 4px ${glowRgba}, inset 0 0 15px 2px ${glowSoft}`;

  // Other 3 tiers
  const otherTiers = TIER_DISPLAY.filter((other) => other.tier !== t.tier);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTierChange ? () => onTierChange(t.tier) : undefined}
      onKeyDown={onTierChange ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTierChange(t.tier); }
      } : undefined}
      className="relative flex-1 rounded-xl overflow-hidden flex flex-col cursor-pointer"
      style={{
        // TooltipContent: rounded-xl px-6 py-4, rgba(15,23,42,0.97)
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: shadow,
        padding: 'clamp(10px, 1vw, 16px) clamp(14px, 1.4vw, 24px)',
        transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out',
      }}
    >
      {/* Ethereal glow — top radial (TooltipContent identical) */}
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }} />
      {/* Bottom glow accent (TooltipContent identical) */}
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>

        {/* Row 1: "Image Prompt" + PRO badge + Save + Copy */}
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 'clamp(1px, 0.1vw, 4px)' }}>
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-white"
              style={{
                fontSize: 'clamp(0.75rem, 0.85vw, 1rem)',
                textShadow: `0 0 12px ${glowRgba}`,
              }}
            >
              Image Prompt
            </span>
            {isPaidUser && (
              <span
                className="font-medium rounded bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                style={{
                  fontSize: 'clamp(0.55rem, 0.6vw, 0.75rem)',
                  padding: 'clamp(1px, 0.15vw, 4px) clamp(4px, 0.4vw, 8px)',
                }}
              >
                PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SaveIcon positivePrompt={promptText} platformId={t.platformId} platformName={t.platformName} source="tooltip" tier={t.tier} size="sm" />
            <TierWindowCopyButton text={promptText} />
          </div>
        </div>

        {/* Row 3: Tier badge pill — TierBadge component copy */}
        <div style={{ marginTop: 'clamp(-4px, -0.3vw, -2px)' }}>
          <span
            className={`inline-flex items-center gap-1.5 font-medium rounded-full ${t.bgClass} ring-1 ${t.ringClass}`}
            style={{
              fontSize: 'clamp(0.6rem, 0.7vw, 0.75rem)',
              padding: 'clamp(1px, 0.15vw, 2px) clamp(5px, 0.5vw, 8px)',
              color: t.color,
            }}
          >
            <span className={`rounded-full ${t.dotClass}`} style={{ width: 'clamp(5px, 0.4vw, 6px)', height: 'clamp(5px, 0.4vw, 6px)' }} />
            Tier {t.tier}: {t.label}
          </span>
        </div>

        {/* Prompt text — auto-scroll, colour-coded by category (same as Prompt Lab) */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            className="pro-auto-scroll"
            style={{ '--scroll-dist': `-${scrollDist}px`, animation: scrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none' } as React.CSSProperties}
          >
            <p className="font-mono leading-relaxed" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.875rem)' }}>
              {(() => {
                if (!tierCategoryMap) return <span className="text-white">{promptText}</span>;
                const termIndex = labBuildTermIndex(tierCategoryMap);
                if (termIndex.size === 0) return <span className="text-white">{promptText}</span>;
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
        </div>

        {/* Row 5: Other formats — full rows matching real tooltip BlurredTierRow */}
        <div className="flex flex-col gap-1 pt-2 border-t border-white/[0.06]">
          <span
            className="text-slate-400 font-medium"
            style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.7rem)', marginBottom: 'clamp(1px, 0.1vw, 2px)' }}
          >
            Other formats available
          </span>
          {otherTiers.map((other) => {
            const otherPrompt = allPrompts[other.promptKey] ?? '';
            return (
              <button
                key={other.tier}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTierChange?.(other.tier);
                }}
                className={`flex items-center gap-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/[0.06] ${other.bgClass.replace('/15', '/5')}`}
                style={{ padding: 'clamp(3px, 0.3vw, 6px) clamp(6px, 0.6vw, 10px)' }}
              >
                {/* Colour dot */}
                <span className={`rounded-full ${other.dotClass} shrink-0`} style={{ width: 'clamp(5px, 0.4vw, 6px)', height: 'clamp(5px, 0.4vw, 6px)', opacity: 0.5 }} />
                {/* Tier label */}
                <span
                  className="font-semibold shrink-0"
                  style={{ color: other.color, opacity: 0.6, fontSize: 'clamp(0.55rem, 0.6vw, 0.7rem)' }}
                >
                  T{other.tier}
                </span>
                {/* Preview text — unblurred, visible to all */}
                <span
                  className="flex-1 text-slate-400 truncate select-none"
                  style={{
                    fontSize: 'clamp(0.55rem, 0.6vw, 0.7rem)',
                  }}
                >
                  {otherPrompt.slice(0, 80)}
                </span>
              </button>
            );
          })}

          {/* "Unlock all formats" CTA — free users only, <a> like real tooltip */}
          {!isPaidUser && (
            <a
              href="/pro-promagen"
              className="flex items-center justify-center gap-1.5 rounded-lg
                bg-gradient-to-r from-amber-600/20 to-orange-600/20
                ring-1 ring-amber-500/25
                text-amber-400 font-medium cursor-pointer
                hover:from-amber-600/30 hover:to-orange-600/30
                transition-all duration-200 no-underline"
              style={{
                fontSize: 'clamp(0.55rem, 0.65vw, 0.75rem)',
                padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
                marginTop: 'clamp(2px, 0.2vw, 6px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg style={{ width: 'clamp(10px, 0.8vw, 12px)', height: 'clamp(10px, 0.8vw, 12px)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Unlock all formats
            </a>
          )}
        </div>

        {/* Active indicator — gold crown */}
        {isActive && (
          <div className="flex items-center self-start" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
            <span style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}>👑</span>
            <span className="font-medium text-amber-400" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.7rem)' }}>Active tier</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TierPreviewPanel({
  activeTier,
  isPaidUser = false,
  onTierChange,
}: {
  activeTier: number;
  isPaidUser?: boolean;
  onTierChange?: (tier: 1 | 2 | 3 | 4) => void;
}) {
  const { data: potmData } = usePromptShowcase();

  return (
    <div className="flex flex-col h-full">
      {/* Header — centred amber text, same as other preview panels */}
      <div
        className="flex items-center justify-center"
        style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}
      >
        <p
          className="italic text-amber-400/80 animate-pulse font-semibold text-center"
          style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.9rem)' }}
        >
          Pick a format — every prompt on Promagen follows your choice
        </p>
      </div>

      {/* 4 tier windows — single horizontal row */}
      <div
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}
      >
        {TIER_DISPLAY.map((t) => {
          const isActive = t.tier === activeTier;
          const promptText = potmData?.prompts?.[t.promptKey] ?? FALLBACK_PROMPTS[t.promptKey]!;
          // Build allPrompts so each window can show blurred previews of other tiers
          const allPrompts: Record<string, string> = {};
          for (const td of TIER_DISPLAY) {
            allPrompts[td.promptKey] = potmData?.prompts?.[td.promptKey] ?? FALLBACK_PROMPTS[td.promptKey]!;
          }

          return (
            <TierWindow
              key={t.tier}
              t={t}
              isActive={isActive}
              isPaidUser={isPaidUser}
              onTierChange={onTierChange}
              promptText={promptText}
              allPrompts={allPrompts}
              tierCategoryMap={potmData?.tierSelections?.[t.promptKey]?.categoryMap}
            />
          );
        })}
      </div>

      {/* "Unlock all formats" now lives inside each TierWindow */}
    </div>
  );
}

// ============================================================================
// SCENES PREVIEW PANEL — Pro world showcase with auto-scroll + rotation
// ============================================================================
// Shown when Scenes card is hovered. Shows 4 rotating Pro worlds with real
// scene names from scene-starters.json. Each column auto-scrolls.
// Human Factor: Curiosity Gap — show the locked door, not the open one.
//   Users see Pro worlds they CAN'T access (Cinematic, Fantasy, Horror, Sci-Fi...)
//   not free worlds they already have. Specific names ("Dragon's Lair",
//   "Blade Runner Rain") trigger mental imaging of the output.
// Bottom row: compact anchor reminding them they already have 5 free worlds.
// ============================================================================

const PRO_WORLD_SHOWCASE: Array<{
  emoji: string;
  label: string;
  color: string;
  count: number;
  scenes: Array<{ emoji: string; name: string }>;
}> = [
  {
    emoji: '🎬', label: 'Cinematic', color: '#f472b6', count: 12,
    scenes: [
      { emoji: '🎬', name: 'Blade Runner Rain' }, { emoji: '🎨', name: 'Wes Anderson Palette' },
      { emoji: '🔷', name: 'Kubrick Symmetry' }, { emoji: '🌸', name: 'Ghibli Dreamscape' },
      { emoji: '🔫', name: 'Tarantino Standoff' }, { emoji: '✨', name: 'Spielberg Wonder' },
      { emoji: '🌀', name: 'Lynch Surreal' }, { emoji: '⚔️', name: 'Kurosawa Duel' },
      { emoji: '🏙️', name: 'Nolan Inception' }, { emoji: '🌊', name: 'Tarkovsky Solitude' },
      { emoji: '🏜️', name: 'Villeneuve Vast' }, { emoji: '🏭', name: 'Scott Industrial' },
    ],
  },
  {
    emoji: '⚔️', label: 'Fantasy & Mythology', color: '#c084fc', count: 12,
    scenes: [
      { emoji: '🐉', name: "Dragon's Lair" }, { emoji: '🧝', name: 'Elven Court' },
      { emoji: '💀', name: 'Necromancer Tower' }, { emoji: '⚡', name: 'Norse Ragnarök' },
      { emoji: '👹', name: 'Japanese Yōkai' }, { emoji: '🏛️', name: 'Greek Pantheon' },
      { emoji: '🍄', name: 'Fairy Ring' }, { emoji: '⚒️', name: 'Dwarven Forge' },
      { emoji: '📖', name: "Merlin's Study" }, { emoji: '🦑', name: 'Kraken Depths' },
      { emoji: '🔥', name: 'Phoenix Rebirth' }, { emoji: '🌑', name: 'Shadow Realm' },
    ],
  },
  {
    emoji: '🦇', label: 'Dark & Horror', color: '#ef4444', count: 8,
    scenes: [
      { emoji: '🦑', name: 'Lovecraftian Deep' }, { emoji: '🏚️', name: 'Haunted Manor' },
      { emoji: '🧛', name: 'Gothic Vampire' }, { emoji: '😱', name: 'Psychological Dread' },
      { emoji: '🎭', name: 'Plague Doctor' }, { emoji: '🌑', name: 'Cursed Forest' },
      { emoji: '🕯️', name: 'Eldritch Ritual' }, { emoji: '🏥', name: 'Abandoned Asylum' },
    ],
  },
  {
    emoji: '🚀', label: 'Sci-Fi & Future', color: '#22d3ee', count: 12,
    scenes: [
      { emoji: '🛸', name: 'Space Station Life' }, { emoji: '👽', name: 'Alien Marketplace' },
      { emoji: '🤖', name: 'Mech Battle' }, { emoji: '🌿', name: 'Solarpunk City' },
      { emoji: '☢️', name: 'Post-Apocalyptic' }, { emoji: '🧠', name: 'AI Consciousness' },
      { emoji: '🚀', name: 'Colony Ship' }, { emoji: '⚛️', name: 'Quantum Lab' },
      { emoji: '🔧', name: 'Cybernetic Surgery' }, { emoji: '🌅', name: 'Terraform Dawn' },
      { emoji: '☀️', name: 'Dyson Sphere' }, { emoji: '💫', name: 'Digital Afterlife' },
    ],
  },
  {
    emoji: '🏛️', label: 'Historical Eras', color: '#fbbf24', count: 12,
    scenes: [
      { emoji: '🏛️', name: 'Ancient Egypt' }, { emoji: '⚔️', name: 'Roman Arena' },
      { emoji: '🪓', name: 'Viking Raid' }, { emoji: '🎨', name: 'Renaissance Workshop' },
      { emoji: '🎩', name: 'Victorian London' }, { emoji: '🎷', name: '1920s Jazz' },
      { emoji: '🗡️', name: 'Samurai Duel' }, { emoji: '🏰', name: 'Medieval Siege' },
      { emoji: '👑', name: 'Byzantine Court' }, { emoji: '🌞', name: 'Aztec Temple' },
      { emoji: '🐪', name: 'Silk Road' }, { emoji: '🏭', name: 'Industrial Revolution' },
    ],
  },
  {
    emoji: '🏙️', label: 'Urban & Street', color: '#60a5fa', count: 12,
    scenes: [
      { emoji: '🏙️', name: 'Tokyo Neon' }, { emoji: '🚗', name: 'Havana Vintage' },
      { emoji: '🌧️', name: 'Mumbai Monsoon' }, { emoji: '🌃', name: 'NY Rooftop' },
      { emoji: '🧺', name: 'Marrakech Souk' }, { emoji: '🌫️', name: 'London Fog' },
      { emoji: '☂️', name: 'Paris Rain' }, { emoji: '🌆', name: 'Shanghai Skyline' },
      { emoji: '💃', name: 'Rio Carnival' }, { emoji: '🕌', name: 'Istanbul Bazaar' },
      { emoji: '🍜', name: 'Bangkok Night Market' }, { emoji: '🎵', name: 'Berlin Underground' },
    ],
  },
  {
    emoji: '🎪', label: 'Whimsical & Surreal', color: '#a78bfa', count: 10,
    scenes: [
      { emoji: '🕰️', name: 'Dalí Dreamscape' }, { emoji: '🔍', name: 'Tiny World Macro' },
      { emoji: '🏗️', name: 'Impossible Architecture' }, { emoji: '☁️', name: 'Cloud Kingdom' },
      { emoji: '⏱️', name: 'Time Frozen' }, { emoji: '🖼️', name: 'Living Painting' },
      { emoji: '🪖', name: 'Toy Soldier War' }, { emoji: '🍄', name: 'Mushroom Forest' },
      { emoji: '🙃', name: 'Upside Down City' }, { emoji: '✂️', name: 'Paper Cut World' },
    ],
  },
  {
    emoji: '🌋', label: 'Nature & Elements', color: '#34d399', count: 10,
    scenes: [
      { emoji: '🌋', name: 'Volcanic Eruption' }, { emoji: '🌌', name: 'Aurora Borealis' },
      { emoji: '💎', name: 'Bioluminescent Bay' }, { emoji: '⛈️', name: 'Supercell Storm' },
      { emoji: '🌸', name: 'Cherry Blossom' }, { emoji: '🌊', name: 'Monsoon Deluge' },
      { emoji: '🐠', name: 'Coral Reef' }, { emoji: '🧊', name: 'Frozen Waterfall' },
      { emoji: '🏜️', name: 'Desert Mirage' }, { emoji: '🌲', name: 'Ancient Redwoods' },
    ],
  },
];

/** Rotation: show 4 worlds at a time, cycle every 20s through groups */
const SCENE_GROUP_SIZE = 4;
const SCENE_ROTATION_MS = 20_000;

// ── SceneWorldWindow: Single Pro world column with auto-scroll ────────────
function SceneWorldWindow({
  world,
}: {
  world: typeof PRO_WORLD_SHOWCASE[number];
}) {
  const { containerRef, contentRef, scrollDist } = useAutoScroll();
  const glowRgba = hexToRgbaPanel(world.color, 0.3);
  const glowBorder = hexToRgbaPanel(world.color, 0.5);
  const glowSoft = hexToRgbaPanel(world.color, 0.15);

  return (
    <div
      className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
        padding: 'clamp(8px, 0.8vw, 14px)',
        transition: 'box-shadow 200ms ease-out',
      }}
    >
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }} />
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }} />

      <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
        {/* World heading — fixed */}
        <div className="flex items-center shrink-0" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
          <span style={{ fontSize: 'clamp(0.95rem, 1.2vw, 1.45rem)' }}>{world.emoji}</span>
          <span
            className="font-semibold text-white truncate"
            style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)', textShadow: `0 0 12px ${glowRgba}` }}
          >
            {world.label}
          </span>
        </div>

        {/* Scene count badge — fixed */}
        <span
          className="inline-flex items-center self-start rounded-full font-medium ring-1 shrink-0"
          style={{
            fontSize: 'clamp(0.625rem, 0.6vw, 0.65rem)',
            padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
            background: hexToRgbaPanel(world.color, 0.15),
            borderColor: hexToRgbaPanel(world.color, 0.3),
            color: world.color,
          }}
        >
          {world.count} scenes
        </span>

        {/* Auto-scrolling scene list */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            className="pro-auto-scroll"
            style={{
              '--scroll-dist': `-${scrollDist}px`,
              animation: scrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(2px, 0.25vw, 4px)',
            } as React.CSSProperties}
          >
            {world.scenes.map((s) => (
              <div key={s.name} className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                <span style={{ fontSize: 'clamp(0.65rem, 0.7vw, 0.85rem)' }}>{s.emoji}</span>
                <span className="text-white truncate" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro badge */}
        <span
          className="inline-flex items-center self-start font-semibold shrink-0"
          style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)', gap: 'clamp(2px, 0.2vw, 4px)', color: world.color }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Pro
        </span>
      </div>
    </div>
  );
}

function ScenesPreviewPanel() {
  // Rotate through groups of 4 Pro worlds every 20s
  const [groupIdx, setGroupIdx] = React.useState(0);
  const totalGroups = Math.ceil(PRO_WORLD_SHOWCASE.length / SCENE_GROUP_SIZE);

  React.useEffect(() => {
    const id = setInterval(() => {
      setGroupIdx((prev) => (prev + 1) % totalGroups);
    }, SCENE_ROTATION_MS);
    return () => clearInterval(id);
  }, [totalGroups]);

  const visibleWorlds = React.useMemo(() => {
    const start = groupIdx * SCENE_GROUP_SIZE;
    return PRO_WORLD_SHOWCASE.slice(start, start + SCENE_GROUP_SIZE);
  }, [groupIdx]);

  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: PRO_AUTO_SCROLL_CSS }} />

      {/* Animated amber header */}
      <div style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          200 one-click scenes across 23 worlds
        </p>
      </div>

      {/* 4 Pro world windows — horizontal row, rotates */}
      <div
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}
      >
        {visibleWorlds.map((w) => (
          <SceneWorldWindow key={w.label} world={w} />
        ))}
      </div>

      {/* Bottom row — free anchor + Pro count */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 'clamp(8px, 0.8vw, 12px)' }}
      >
        <span
          className="inline-flex items-center text-emerald-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', gap: 'clamp(3px, 0.3vw, 5px)' }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          5 free worlds · 25 scenes included
        </span>
        <span
          className="text-amber-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          +18 Pro worlds · 175 scenes
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
  picsart: '#FF3366',
  craiyon: '#FBBF24',
  bluewillow: '#3B82F6',
  dreamstudio: '#A855F7',
  runway: '#EF4444',
  artbreeder: '#10B981',
  deepai: '#6366F1',
};

// ── SavedPromptWindow: Single saved prompt with auto-scroll ──────────────
function SavedPromptWindow({
  prompt,
}: {
  prompt: { id: string; positivePrompt: string; platformId: string; platformName: string; tier?: number };
}) {
  const { containerRef, contentRef, scrollDist } = useAutoScroll();
  const platformColor = SAVED_PLATFORM_COLORS[prompt.platformId] ?? SAVED_DEFAULT_COLOR;
  const glowRgba = hexToRgbaPanel(platformColor, 0.3);
  const glowBorder = hexToRgbaPanel(platformColor, 0.5);
  const glowSoft = hexToRgbaPanel(platformColor, 0.15);

  return (
    <div
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

        {/* Prompt text — auto-scroll + colour-coded (same as Prompt Lab) */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            className="pro-auto-scroll"
            style={{ '--scroll-dist': `-${scrollDist}px`, animation: scrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none' } as React.CSSProperties}
          >
            <p className="leading-relaxed text-white whitespace-pre-wrap break-words" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
              {prompt.positivePrompt}
            </p>
          </div>
        </div>

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
}

function SavedPreviewPanel() {
  const { allPrompts } = useSavedPrompts();
  const recentPrompts = allPrompts.slice(0, 5);
  const hasPrompts = recentPrompts.length > 0;
  const emptySlots = 5 - recentPrompts.length;

  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: PRO_AUTO_SCROLL_CSS }} />

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
        {/* Filled windows — real saved prompts with auto-scroll + colour coding */}
        {recentPrompts.map((prompt) => (
            <SavedPromptWindow
              key={prompt.id}
              prompt={prompt}
            />
        ))}

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
              className="text-purple-400 text-center"
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

// ── LabTierWindow: Per-tier prompt window with auto-scroll ────────────────
function LabTierWindow({
  tier: t,
  provider,
  progress,
  promptText,
  tierCategoryMap,
}: {
  tier: typeof LAB_TIER_META[number];
  provider: { id: string; name: string } | null;
  progress: number;
  promptText: string;
  tierCategoryMap?: WeatherCategoryMap;
}) {
  const { containerRef, contentRef, scrollDist } = useAutoScroll();
  const glowRgba = hexToRgbaPanel(t.color, 0.3);
  const glowBorder = hexToRgbaPanel(t.color, 0.5);
  const glowSoft = hexToRgbaPanel(t.color, 0.15);

  return (
    <div
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
        {/* Provider name + icon */}
        <div className="flex items-center justify-between lab-fade-in shrink-0" key={provider?.id ?? t.tier}>
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

        {/* Tier badge */}
        <span
          className={`inline-flex items-center self-start rounded-full font-medium shrink-0 ${t.bgClass} ring-1 ${t.ringClass}`}
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.6vw, 10px)', gap: 'clamp(3px, 0.3vw, 5px)', color: t.color, margin: 'clamp(3px, 0.3vw, 5px) 0' }}
        >
          <span className={`rounded-full ${t.dotClass}`} style={{ width: 'clamp(4px, 0.4vw, 6px)', height: 'clamp(4px, 0.4vw, 6px)' }} />
          Tier {t.tier}: {t.label}
        </span>

        {/* Auto-scrolling colour-coded prompt */}
        {promptText ? (
          <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
            <div
              ref={contentRef}
              className="pro-auto-scroll"
              style={{ '--scroll-dist': `-${scrollDist}px`, animation: scrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none' } as React.CSSProperties}
            >
              <p className="font-mono leading-relaxed" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.8rem)' }}>
                {(() => {
                  if (!tierCategoryMap) return <span className="text-white">{promptText}</span>;
                  const termIndex = labBuildTermIndex(tierCategoryMap);
                  if (termIndex.size === 0) return <span className="text-white">{promptText}</span>;
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
          </div>
        ) : (
          <span className="text-white" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>Loading...</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: '2px', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: t.color, transition: 'width 200ms linear' }} />
      </div>
    </div>
  );
}

function PromptLabPreviewPanel({ providers }: { providers: Provider[] }) {
  const { data: potmData } = usePromptShowcase();
  const { totalSec, timeStr } = useLabCountdown();
  const { containerRef: w1ContainerRef, contentRef: w1ContentRef, scrollDist: w1ScrollDist } = useAutoScroll();

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
          One workspace — all 40 platforms — instant switching
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
          <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>

            {/* Countdown — fixed at top */}
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
                    <span className="tabular-nums text-amber-400" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)' }}>arriving in {timeStr}</span>
                  </>
                )}
              </div>
            )}

            {/* "What Promagen Sees" — fixed */}
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

            {/* Auto-scrolling middle section */}
            <div ref={w1ContainerRef} className="flex-1 min-h-0 overflow-hidden">
              <div
                ref={w1ContentRef}
                className="pro-auto-scroll"
                style={{ '--scroll-dist': `-${w1ScrollDist}px`, animation: w1ScrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none' } as React.CSSProperties}
              >
                {/* Current city weather data */}
                {potmData && (
                  <div
                    className="flex flex-col items-center"
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
                    <span className="text-white text-center" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.73rem)' }}>
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

                {/* Dynamic category rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 0.3vw, 5px)' }}>
                  {categoryRows.map((row) => (
                    <div key={row.cat} className="flex flex-col" style={{ gap: 'clamp(2px, 0.2vw, 4px)' }}>
                      <div className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                        <span style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}>{row.emoji}</span>
                        <span style={{ color: row.color, fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>{row.label}</span>
                        <span className="text-white" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>{'\u2192'}</span>
                        <span className="font-medium truncate" style={{ color: row.color, fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>{row.selection}</span>
                      </div>
                      {row.custom && (
                        <span className="text-white leading-tight" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', paddingLeft: 'clamp(15.0px, 1.3vw, 21.0px)' }}>
                          {row.custom.length > 100 ? row.custom.slice(0, 98) + '\u2026' : row.custom}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Amber animated footer — fixed at bottom */}
            <div className="shrink-0" style={{ paddingTop: 'clamp(4px, 0.4vw, 6px)' }}>
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
        {LAB_TIER_META.map((t, idx) => (
          <LabTierWindow
            key={`${t.tier}-${tierStates[idx]?.provider?.id}`}
            tier={t}
            provider={tierStates[idx]?.provider ?? null}
            progress={tierStates[idx]?.progress ?? 0}
            promptText={providerPrompts[idx] ?? ''}
            tierCategoryMap={potmData?.tierSelections?.[t.promptKey]?.categoryMap}
          />
        ))}
      </div>

      {/* ── 40 provider icons row ────────────────────────────────────── */}
      <div className="flex items-center justify-center flex-wrap" style={{ gap: 'clamp(2px, 0.25vw, 4px)', paddingTop: 'clamp(6px, 0.6vw, 10px)' }}>
        {providers.slice(0, 40).map((p) => (
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
          40 platforms — switch instantly
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// DAILY PROMPTS PREVIEW PANEL — 40-provider rotating showcase (v7.0.0)
// ============================================================================
// Rotates through ALL 40 AI providers using live PotM category data.
// Each rotation: assemblePrompt() + optimizePromptGoldStandard() called live.
//
// Visual sell: Assembled prompt = WHITE text (free tier look).
//              Optimized prompt = COLOUR-CODED text (Pro tier look).
//              Compression annotation between boxes shows real intelligence.
//
// Dynamic timing:
//   Content fits without overflow → 4s interval, crossfade between providers
//   Content overflows → one-way scroll to bottom → swap next at top → repeat
//
// Human factors:
// - Von Restorff Effect: colour-coded text jumps out against white text
// - Curiosity Gap: "I want MY prompts colour-coded"
// - Social proof through variety: 40 platforms = serious engineering
// - Click-to-navigate: "try it yourself"
// ============================================================================

/** Tier label map for annotation line */
const DAILY_ENCODER_LABELS: Record<number, string> = {
  1: 'CLIP',
  2: 'Midjourney',
  3: 'Natural Language',
  4: 'Plain Language',
};

/** Tier colour map for annotation badge */
const DAILY_ENCODER_COLOURS: Record<number, string> = {
  1: '#60a5fa',
  2: '#c084fc',
  3: '#34d399',
  4: '#fb923c',
};

/** One-way scroll CSS + progress bar fill */
const DAILY_SCROLL_CSS = `
  @keyframes dailyScrollDown {
    0% { transform: translateY(0); }
    100% { transform: translateY(var(--scroll-dist)); }
  }
  @keyframes dailyProgressFill {
    from { width: 0%; }
    to { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .daily-scroll-content { animation: none !important; }
  }
`;

function DailyPromptsPreviewPanel() {
  const { data: potmData } = usePromptShowcase();
  const categoryMap = potmData?.tierSelections?.tier1?.categoryMap;

  // ── Provider rotation state ──
  const [providerIndex, setProviderIndex] = React.useState(0);
  const [fading, setFading] = React.useState(false);
  const currentProvider = allProvidersData[providerIndex] ?? allProvidersData[0];

  // ── Scroll measurement ──
  const containerRef = React.useRef<HTMLDivElement>(null!);
  const contentRef = React.useRef<HTMLDivElement>(null!);
  const [scrollDist, setScrollDist] = React.useState(0);
  const [scrolling, setScrolling] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  // Timers
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  // ── Compression flash — brightness pulse on provider swap ──
  const [flashActive, setFlashActive] = React.useState(false);

  // ── Progress bar total cycle time (seconds) ──
  const [cycleDuration, setCycleDuration] = React.useState(4);

  // ── Track container visibility via ResizeObserver + periodic fallback ──
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const check = () => {
      const isVis = container.clientHeight >= 10;
      setVisible((prev) => (prev !== isVis ? isVis : prev));
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    // Periodic fallback — catches display:none → display:flex transitions
    // that ResizeObserver sometimes misses
    const tid = setInterval(check, 500);
    return () => { ro.disconnect(); clearInterval(tid); };
  }, []);

  // ── Advance to next provider with crossfade + flash ──
  const advanceProvider = React.useCallback(() => {
    setFading(true);
    advanceTimerRef.current = setTimeout(() => {
      setProviderIndex((prev) => (prev + 1) % allProvidersData.length);
      setScrolling(false);
      setFading(false);
      // Trigger compression flash
      setFlashActive(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashActive(false), 500);
    }, 300);
  }, []);

  // ── When visible + providerIndex changes: measure overflow & start timer ──
  React.useEffect(() => {
    // Clear any pending timers
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setScrolling(false);

    if (!visible) return; // Panel is hidden — do nothing until visible

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Give DOM a frame to render new content
    const measureId = requestAnimationFrame(() => {
      const overflow = content.scrollHeight - container.clientHeight;
      const dist = Math.max(0, overflow);
      setScrollDist(dist);

      if (dist === 0) {
        // No overflow — 4 second static display then advance
        setCycleDuration(4);
        holdTimerRef.current = setTimeout(advanceProvider, 4000);
      } else {
        // Overflow — 0.5s hold + scroll + 0.5s hold then advance
        const dur = Math.max(2, Math.min(8, dist / 40));
        setCycleDuration(0.5 + dur + 0.5);
        holdTimerRef.current = setTimeout(() => {
          setScrolling(true);
        }, 500);
      }
    });

    return () => {
      cancelAnimationFrame(measureId);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [providerIndex, visible, advanceProvider]);

  // ── Handle scroll animation end → hold at bottom → advance ──
  const handleScrollEnd = React.useCallback(() => {
    holdTimerRef.current = setTimeout(advanceProvider, 500);
  }, [advanceProvider]);

  // ── Scroll duration: ~40px/s, min 2s, max 8s ──
  const scrollDuration = React.useMemo(
    () => Math.max(2, Math.min(8, scrollDist / 40)),
    [scrollDist],
  );

  // ── Build category rows from PotM data ──
  const categoryRows = React.useMemo(() => {
    if (!categoryMap) return [];
    const rows: Array<{ cat: string; emoji: string; label: string; color: string; terms: string[] }> = [];
    const allCats = ['subject', 'action', 'style', 'environment', 'composition', 'camera', 'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative'];
    for (const cat of allCats) {
      const sel = categoryMap.selections?.[cat as PromptCategory] ?? [];
      const custom = cat === 'negative'
        ? (categoryMap.negative ?? [])
        : (categoryMap.customValues?.[cat as PromptCategory]?.trim() ? [categoryMap.customValues[cat as PromptCategory]!] : []);
      const allTerms = [...sel, ...custom].filter(Boolean);
      rows.push({
        cat,
        emoji: CATEGORY_EMOJIS[cat] ?? '\u2022',
        label: CATEGORY_LABELS[cat] ?? cat,
        color: CATEGORY_COLOURS[cat] ?? '#94A3B8',
        terms: allTerms,
      });
    }
    return rows;
  }, [categoryMap]);

  // ── Assemble prompt for CURRENT rotating provider ──
  const assembledText = React.useMemo(() => {
    if (!categoryMap || !currentProvider) return '';
    try {
      const sel = selectionsFromMap(categoryMap);
      return assemblePrompt(currentProvider.id, sel, categoryMap.weightOverrides).positive;
    } catch { return ''; }
  }, [categoryMap, currentProvider]);

  // ── Optimize prompt for CURRENT rotating provider ──
  const optimizeResult = React.useMemo(() => {
    if (!assembledText || !categoryMap || !currentProvider) return null;
    try {
      const sel = selectionsFromMap(categoryMap);
      return optimizePromptGoldStandard({
        promptText: assembledText,
        selections: sel,
        platformId: currentProvider.id,
      });
    } catch { return null; }
  }, [assembledText, categoryMap, currentProvider]);

  const optimizedText = optimizeResult?.optimized ?? assembledText;

  // ── Parse optimized text for colour coding (Pro look) ──
  const optimizedColourSegments = React.useMemo(() => {
    if (!optimizedText || !categoryMap) return null;
    const termIndex = new Map<string, PromptCategory>();
    for (const [cat, terms] of Object.entries(categoryMap.selections)) {
      if (!terms) continue;
      for (const term of terms) {
        const key = term.toLowerCase().trim();
        if (key) termIndex.set(key, cat as PromptCategory);
      }
    }
    if (termIndex.size === 0) return null;
    return sharedParsePrompt(optimizedText, termIndex);
  }, [optimizedText, categoryMap]);

  // ── Tier info for annotation ──
  const tierId = getPlatformTierId(currentProvider?.id ?? '');
  const encoderLabel = DAILY_ENCODER_LABELS[tierId ?? 4] ?? 'Plain Language';
  const encoderColour = DAILY_ENCODER_COLOURS[tierId ?? 4] ?? '#fb923c';

  // ── Compression annotation text ──
  const compressionText = React.useMemo(() => {
    if (!optimizeResult) return null;
    if (optimizeResult.wasTrimmed) {
      return `${optimizeResult.originalLength} → ${optimizeResult.optimizedLength} chars`;
    }
    return `${optimizeResult.originalLength} chars · Within range`;
  }, [optimizeResult]);

  // Navigate to builder on click
  const handleClick = React.useCallback(() => {
    if (!currentProvider) return;
    try {
      if (potmData?.tierSelections?.tier1) {
        sessionStorage.setItem('promagen:preloaded-payload', JSON.stringify(potmData.tierSelections.tier1));
      }
    } catch { /* ignore */ }
    window.location.href = `/providers/${currentProvider.id}`;
  }, [currentProvider, potmData]);

  return (
    <div
      className="flex flex-col h-full cursor-pointer"
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      role="button"
      tabIndex={0}
    >
      <style dangerouslySetInnerHTML={{ __html: DAILY_SCROLL_CSS }} />

      {/* Animated amber header */}
      <div style={{ padding: 'clamp(8px, 0.8vw, 14px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          Unlimited colour-coded prompts — this is what Pro looks like
        </p>
      </div>

      {/* Content area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden rounded-xl"
        style={{
          background: 'rgba(15, 23, 42, 0.97)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 0 30px 6px rgba(245,158,11,0.15), 0 0 60px 12px rgba(245,158,11,0.06), inset 0 0 20px 2px rgba(245,158,11,0.1)',
        }}
      >
        {/* Ethereal glow overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.08), transparent 70%)', pointerEvents: 'none' }} />
        </div>

        <div
          ref={contentRef}
          className="daily-scroll-content"
          style={{
            '--scroll-dist': `-${scrollDist}px`,
            padding: 'clamp(10px, 1vw, 16px)',
            opacity: fading ? 0 : 1,
            transition: 'opacity 300ms ease-in-out',
            animation: scrolling && scrollDist > 0
              ? `dailyScrollDown ${scrollDuration}s ease-in-out forwards`
              : 'none',
          } as React.CSSProperties}
          onAnimationEnd={handleScrollEnd}
        >
          {/* Provider name badge + Open button + tier pill + counter */}
          {currentProvider && (
            <div className="flex items-center gap-2 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icons/providers/${currentProvider.id}.png`}
                alt=""
                style={{ width: 'clamp(16px, 1.2vw, 20px)', height: 'clamp(16px, 1.2vw, 20px)' }}
                className="rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="font-semibold text-white" style={{ fontSize: 'clamp(0.7rem, 0.75vw, 0.85rem)' }}>
                {currentProvider.name}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full border border-rose-500/70 font-medium shadow-sm transition-all bg-gradient-to-r from-rose-600/20 to-pink-600/20 hover:from-rose-600/30 hover:to-pink-600/30 hover:border-rose-400"
                style={{ fontSize: 'clamp(0.55rem, 0.55vw, 0.7rem)', color: '#fb7185', padding: 'clamp(2px, 0.2vw, 4px) clamp(6px, 0.6vw, 12px)' }}
              >
                → Open Prompt Builder
              </span>
            </div>
          )}
          {/* Tier encoder + counter row */}
          {currentProvider && (
            <div className="flex items-center gap-2 mb-2" style={{ marginTop: '-0.25rem' }}>
              <span
                className="inline-flex items-center gap-1 rounded-full font-medium"
                style={{
                  fontSize: 'clamp(0.5rem, 0.5vw, 0.6rem)',
                  padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.5vw, 10px)',
                  background: `${encoderColour}20`,
                  border: `1px solid ${encoderColour}50`,
                  color: encoderColour,
                }}
              >
                {encoderLabel}
              </span>
              <span
                className="ml-auto font-medium tabular-nums"
                style={{ fontSize: 'clamp(0.5rem, 0.45vw, 0.6rem)', color: '#fbbf24' }}
              >
                {providerIndex + 1}/{allProvidersData.length}
              </span>
            </div>
          )}

          {/* Miniaturised category grid — 2 columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'clamp(3px, 0.3vw, 5px)',
              marginBottom: 'clamp(8px, 0.8vw, 12px)',
            }}
          >
            {categoryRows.map((row) => (
              <div
                key={row.cat}
                className="rounded-md overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: 'clamp(3px, 0.3vw, 5px) clamp(5px, 0.5vw, 8px)',
                }}
              >
                {/* Category label — colour-coded */}
                <div className="flex items-center gap-1 mb-0.5">
                  <span style={{ fontSize: 'clamp(0.55rem, 0.5vw, 0.65rem)' }}>{row.emoji}</span>
                  <span
                    className="font-semibold truncate"
                    style={{ color: row.color, fontSize: 'clamp(0.55rem, 0.55vw, 0.65rem)' }}
                  >
                    {row.label}
                  </span>
                </div>
                {/* Selected terms as mini chips */}
                {row.terms.length > 0 ? (
                  <div className="flex flex-wrap gap-0.5">
                    {row.terms.slice(0, 3).map((term, i) => (
                      <span
                        key={i}
                        className="rounded truncate"
                        style={{
                          fontSize: 'clamp(0.5rem, 0.45vw, 0.6rem)',
                          padding: '1px 4px',
                          background: `${row.color}15`,
                          border: `1px solid ${row.color}30`,
                          color: row.color,
                          maxWidth: '90px',
                        }}
                      >
                        {term}
                      </span>
                    ))}
                    {row.terms.length > 3 && (
                      <span style={{ fontSize: 'clamp(0.45rem, 0.4vw, 0.55rem)', color: '#fbbf24' }}>
                        +{row.terms.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 'clamp(0.45rem, 0.4vw, 0.55rem)', color: 'rgba(255,255,255,0.7)' }}>—</span>
                )}
              </div>
            ))}
          </div>

          {/* Assembled prompt box — WHITE text (Free tier look) */}
          <div style={{ marginBottom: 'clamp(4px, 0.4vw, 6px)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-white" style={{ fontSize: 'clamp(0.6rem, 0.6vw, 0.7rem)' }}>
                Assembled prompt
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-1 py-0.5 font-medium text-white/70"
                style={{ fontSize: 'clamp(0.45rem, 0.45vw, 0.55rem)' }}
              >
                Standard
              </span>
              <span className="ml-auto text-white/50" style={{ fontSize: 'clamp(0.5rem, 0.45vw, 0.6rem)' }}>
                {assembledText.length} chars
              </span>
            </div>
            <div
              className="rounded-lg"
              style={{
                border: '1px solid rgba(100,116,139,0.4)',
                background: 'rgba(2,6,23,0.6)',
                padding: 'clamp(6px, 0.6vw, 10px)',
              }}
            >
              <p style={{ fontSize: 'clamp(0.5rem, 0.5vw, 0.6rem)', lineHeight: 1.5, wordBreak: 'break-word', color: '#e2e8f0' }}>
                {assembledText || <span style={{ color: 'rgba(255,255,255,0.3)' }}>Waiting for data…</span>}
              </p>
            </div>
          </div>

          {/* ⚡ Compression annotation — flashes bright on provider swap */}
          {compressionText && (
            <div
              className="flex items-center justify-center gap-2"
              style={{
                padding: 'clamp(3px, 0.3vw, 5px) 0',
                filter: flashActive ? 'brightness(1.8)' : 'brightness(1)',
                transition: 'filter 400ms ease-out',
              }}
            >
              <span style={{ fontSize: 'clamp(0.55rem, 0.55vw, 0.65rem)', color: '#fbbf24' }}>⚡</span>
              <span
                className="font-medium"
                style={{
                  fontSize: 'clamp(0.5rem, 0.5vw, 0.6rem)',
                  color: optimizeResult?.wasTrimmed ? '#34d399' : '#fbbf24',
                }}
              >
                {compressionText}
              </span>
              <span
                className="rounded-full font-medium"
                style={{
                  fontSize: 'clamp(0.45rem, 0.45vw, 0.55rem)',
                  padding: '1px 6px',
                  background: `${encoderColour}15`,
                  border: `1px solid ${encoderColour}30`,
                  color: encoderColour,
                }}
              >
                {encoderLabel}
              </span>
            </div>
          )}

          {/* Optimized prompt box — COLOUR-CODED text (Pro tier look) */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-emerald-300" style={{ fontSize: 'clamp(0.6rem, 0.6vw, 0.7rem)' }}>
                Optimized prompt
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 font-medium text-emerald-400"
                style={{ fontSize: 'clamp(0.45rem, 0.45vw, 0.55rem)' }}
              >
                ⚡ Pro
              </span>
              {optimizeResult && (
                <span className="ml-auto text-emerald-400" style={{ fontSize: 'clamp(0.5rem, 0.45vw, 0.6rem)' }}>
                  {optimizeResult.optimizedLength} chars
                </span>
              )}
            </div>
            <div
              className="rounded-lg"
              style={{
                border: '1px solid rgba(52,211,153,0.3)',
                background: 'rgba(6,78,59,0.15)',
                padding: 'clamp(6px, 0.6vw, 10px)',
              }}
            >
              <p style={{ fontSize: 'clamp(0.5rem, 0.5vw, 0.6rem)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {optimizedColourSegments
                  ? optimizedColourSegments.map((seg, i) => {
                      const c = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                      return <span key={i} style={{ color: c }}>{seg.text}</span>;
                    })
                  : <span style={{ color: '#a7f3d0' }}>{optimizedText}</span>
                }
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Progress bar — fills left-to-right, resets on provider swap ── */}
      {/* OUTSIDE containerRef — cannot affect scroll measurement */}
      <div
        style={{
          flex: 'none',
          height: 'clamp(2px, 0.2vw, 3px)',
          marginTop: 'clamp(2px, 0.2vw, 3px)',
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          key={providerIndex}
          style={{
            height: '100%',
            width: '0%',
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            borderRadius: 'inherit',
            animation: visible ? `dailyProgressFill ${cycleDuration}s linear forwards` : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// FRAME PREVIEW PANEL — 5 reference city windows with real exchange cards
// ============================================================================
// Shows the value of Pro reference frame toggle. Each window is a different
// city as the anchor point, showing the first 5 exchanges in that city's
// rotated order. Exchange cards match the REAL exchange card style exactly
// (flag + name + city + index name + hoverColor glow).
//
// Human Factor: Pattern Recognition — the same exchanges in different orders
//   anchored to different cities. The user mentally substitutes their own city.
// Human Factor: Peak-End Rule — the reference city badge is the peak visual.
// Human Factor: Curiosity Gap — "what would MY city look like at the top?"
// ============================================================================

const FRAME_CITIES: Array<{
  flag: string;
  iso: string;
  city: string;
  color: string;
  exchanges: Array<{
    iso: string;
    name: string;
    city: string;
    index: string;
    color: string;
  }>;
}> = [
  {
    flag: '🇯🇵', iso: 'jp', city: 'Tokyo', color: '#fb7185',
    exchanges: [
      { iso: 'jp', name: 'TSE', city: 'Tokyo', index: 'Nikkei 225', color: '#E11D48' },
      { iso: 'hk', name: 'HKEX', city: 'Hong Kong', index: 'Hang Seng', color: '#DC2626' },
      { iso: 'th', name: 'SET', city: 'Bangkok', index: 'SET 50', color: '#7C3AED' },
      { iso: 'in', name: 'NSE', city: 'Mumbai', index: 'NIFTY 50', color: '#2563EB' },
      { iso: 'ae', name: 'DFM', city: 'Dubai', index: 'DFM General', color: '#059669' },
      { iso: 'gb', name: 'LSE', city: 'London', index: 'FTSE 100', color: '#6366F1' },
    ],
  },
  {
    flag: '🇺🇸', iso: 'us', city: 'New York', color: '#60a5fa',
    exchanges: [
      { iso: 'us', name: 'NYSE', city: 'New York', index: 'S&P 500', color: '#2563EB' },
      { iso: 'br', name: 'B3', city: 'São Paulo', index: 'BOVESPA', color: '#059669' },
      { iso: 'nz', name: 'NZX', city: 'Wellington', index: 'NZX 50', color: '#0D9488' },
      { iso: 'au', name: 'ASX', city: 'Sydney', index: 'ASX 200', color: '#2563EB' },
      { iso: 'jp', name: 'TSE', city: 'Tokyo', index: 'Nikkei 225', color: '#E11D48' },
      { iso: 'hk', name: 'HKEX', city: 'Hong Kong', index: 'Hang Seng', color: '#DC2626' },
    ],
  },
  {
    flag: '🇦🇺', iso: 'au', city: 'Sydney', color: '#22d3ee',
    exchanges: [
      { iso: 'au', name: 'ASX', city: 'Sydney', index: 'ASX 200', color: '#2563EB' },
      { iso: 'jp', name: 'TSE', city: 'Tokyo', index: 'Nikkei 225', color: '#E11D48' },
      { iso: 'hk', name: 'HKEX', city: 'Hong Kong', index: 'Hang Seng', color: '#DC2626' },
      { iso: 'in', name: 'NSE', city: 'Mumbai', index: 'NIFTY 50', color: '#2563EB' },
      { iso: 'gb', name: 'LSE', city: 'London', index: 'FTSE 100', color: '#6366F1' },
      { iso: 'us', name: 'NYSE', city: 'New York', index: 'S&P 500', color: '#2563EB' },
    ],
  },
  {
    flag: '🇮🇳', iso: 'in', city: 'Mumbai', color: '#fbbf24',
    exchanges: [
      { iso: 'in', name: 'NSE', city: 'Mumbai', index: 'NIFTY 50', color: '#2563EB' },
      { iso: 'ae', name: 'DFM', city: 'Dubai', index: 'DFM General', color: '#059669' },
      { iso: 'tr', name: 'BIST', city: 'Istanbul', index: 'BIST 100', color: '#DC2626' },
      { iso: 'za', name: 'JSE', city: 'Johannesburg', index: 'JSE All Share', color: '#D97706' },
      { iso: 'gb', name: 'LSE', city: 'London', index: 'FTSE 100', color: '#6366F1' },
      { iso: 'us', name: 'NYSE', city: 'New York', index: 'S&P 500', color: '#2563EB' },
    ],
  },
  {
    flag: '🇬🇧', iso: 'gb', city: 'London', color: '#34d399',
    exchanges: [
      { iso: 'gb', name: 'LSE', city: 'London', index: 'FTSE 100', color: '#6366F1' },
      { iso: 'br', name: 'B3', city: 'São Paulo', index: 'BOVESPA', color: '#059669' },
      { iso: 'us', name: 'NYSE', city: 'New York', index: 'S&P 500', color: '#2563EB' },
      { iso: 'ca', name: 'TSX', city: 'Toronto', index: 'S&P/TSX', color: '#DC2626' },
      { iso: 'nz', name: 'NZX', city: 'Wellington', index: 'NZX 50', color: '#0D9488' },
      { iso: 'au', name: 'ASX', city: 'Sydney', index: 'ASX 200', color: '#2563EB' },
    ],
  },
];

// ── FrameCityWindow: Single reference city with exchange cards ─────────────
function FrameCityWindow({
  data,
}: {
  data: typeof FRAME_CITIES[number];
}) {
  const { containerRef, contentRef, scrollDist } = useAutoScroll();
  const glowRgba = hexToRgbaPanel(data.color, 0.3);
  const glowBorder = hexToRgbaPanel(data.color, 0.5);
  const glowSoft = hexToRgbaPanel(data.color, 0.15);

  return (
    <div
      className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
        padding: 'clamp(8px, 0.8vw, 14px)',
        transition: 'box-shadow 200ms ease-out',
      }}
    >
      {/* Ethereal glow overlays */}
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }} />
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }} />

      <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {/* ── Hero: Reference city bubble ──────────────────────────── */}
        <div
          className="flex flex-col items-center shrink-0 rounded-lg"
          style={{
            background: hexToRgbaPanel(data.color, 0.12),
            border: `1px solid ${hexToRgbaPanel(data.color, 0.35)}`,
            boxShadow: `0 0 16px 3px ${hexToRgbaPanel(data.color, 0.2)}, inset 0 0 10px 1px ${hexToRgbaPanel(data.color, 0.08)}`,
            padding: 'clamp(6px, 0.6vw, 10px) clamp(8px, 0.8vw, 12px)',
            gap: 'clamp(2px, 0.2vw, 4px)',
          }}
        >
          {/* Flag — hero size */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/flags/${data.iso}.svg`}
            alt=""
            className="rounded-sm shrink-0"
            style={{ width: 'clamp(24px, 2.2vw, 36px)', height: 'clamp(16px, 1.5vw, 24px)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* City name */}
          <span
            className="font-bold text-center"
            style={{
              color: data.color,
              fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
              textShadow: `0 0 14px ${glowRgba}`,
            }}
          >
            {data.city}
          </span>
          {/* Reference badge */}
          <span
            className="font-medium text-white"
            style={{ fontSize: 'clamp(0.5rem, 0.5vw, 0.6rem)' }}
          >
            Reference Point
          </span>
        </div>

        {/* ── Exchange cards — IDENTICAL to ExchangeRegionWindow cards ──── */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            className="pro-auto-scroll"
            style={{
              '--scroll-dist': `-${scrollDist}px`,
              animation: scrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(8px, 0.8vw, 12px)',
            } as React.CSSProperties}
          >
            {data.exchanges.map((ex) => {
              const exGlow = hexToRgbaPanel(ex.color, 0.25);
              const exBorder = hexToRgbaPanel(ex.color, 0.4);

              return (
                <div
                  key={ex.iso + ex.name}
                  className="relative rounded-lg overflow-hidden shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${exBorder}`,
                    boxShadow: `0 0 12px 2px ${exGlow}, inset 0 0 8px 1px ${hexToRgbaPanel(ex.color, 0.1)}`,
                    padding: 'clamp(5px, 0.5vw, 8px) clamp(8px, 0.8vw, 12px)',
                  }}
                >
                  {/* Ethereal glow — top radial (same as real exchange card) */}
                  <span
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${exGlow} 0%, transparent 70%)` }}
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex items-center" style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}>
                    {/* Flag */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/flags/${ex.iso}.svg`}
                      alt=""
                      className="rounded-sm shrink-0"
                      style={{ width: 'clamp(16px, 1.4vw, 22px)', height: 'clamp(11px, 1vw, 15px)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Exchange name */}
                    <span className="font-medium text-white truncate" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
                      {ex.name}
                    </span>
                    {/* City */}
                    <span className="text-white truncate ml-auto shrink-0" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
                      {ex.city}
                    </span>
                  </div>
                  {/* Index name row */}
                  <div className="relative z-10" style={{ marginTop: 'clamp(2px, 0.2vw, 3px)' }}>
                    <span className="text-cyan-400" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
                      {ex.index}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function FramePreviewPanel() {
  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: PRO_AUTO_SCROLL_CSS }} />

      {/* Animated amber header */}
      <div style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          Choose the reference that shapes your prompts
        </p>
      </div>

      {/* 5 reference city windows */}
      <div
        className="flex flex-1 min-h-0"
        style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}
      >
        {FRAME_CITIES.map((c) => (
          <FrameCityWindow key={c.city} data={c} />
        ))}
      </div>

      {/* Bottom row */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 'clamp(8px, 0.8vw, 12px)' }}
      >
        <span
          className="text-emerald-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          ✓ Same exchanges, different perspective
        </span>
        <span
          className="text-amber-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          Pro: Your city leads
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// IMAGE GENERATION PREVIEW PANEL — Prompt → Image showcase (BYOAPI teaser)
// ============================================================================
// Shown when Image Gen card is hovered. Fills the CTA area.
// Real AI-generated images from local assets with blur-to-sharp 10s reveal.
// Prompt text colour-coded by category using CATEGORY_COLOURS SSOT.
// Font matches PromptLabPreviewPanel: font-mono, clamp(0.625rem, 0.65vw, 0.8rem).
//
// Human Factor: Anticipatory Dopamine — blur-to-sharp simulates AI generation
//   happening in real time. 10s resolve + 3s hold = the suspense-payoff loop.
// Human Factor: Curiosity Gap — "Coming to Pro" creates desire for what's next
// ============================================================================

const IMAGEGEN_CSS = `
  @keyframes imagegenReveal {
    0% { filter: blur(18px) brightness(0.3) saturate(0.1); }
    10% { filter: blur(12px) brightness(0.4) saturate(0.3); }
    30% { filter: blur(6px) brightness(0.6) saturate(0.6); }
    55% { filter: blur(1px) brightness(0.9) saturate(0.95); }
    65%, 85% { filter: blur(0) brightness(1) saturate(1); }
    100% { filter: blur(18px) brightness(0.3) saturate(0.1); }
  }
  @keyframes imagegenProgressBar {
    0% { width: 0%; }
    65% { width: 100%; }
    66%, 100% { width: 0%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .imagegen-reveal { animation: none !important; filter: none !important; }
    .imagegen-progress { display: none !important; }
  }
`;

// Category colours from SSOT (prompt-colours.ts)
const IG_C = {
  subject: '#FCD34D',
  action: '#A3E635',
  style: '#C084FC',
  environment: '#38BDF8',
  composition: '#34D399',
  camera: '#FB923C',
  lighting: '#FBBF24',
  colour: '#F472B6',
  atmosphere: '#22D3EE',
  materials: '#2DD4BF',
  fidelity: '#93C5FD',
  structural: '#94A3B8',
};

// ── 5 platforms, real prompts segmented by category colour ────────────────
const IMAGEGEN_SHOWCASE: Array<{
  scene: string;
  platform: string;
  platformId: string;
  imagePath: string;
  accentColor: string;
  segments: Array<{ text: string; color: string }>;
}> = [
  {
    scene: 'Cyberpunk Street',
    platform: 'Leonardo AI',
    platformId: 'leonardo',
    imagePath: '/images/pro/imagegen-leonardo.jpg',
    accentColor: '#EC4899',
    segments: [
      { text: '(', color: IG_C.structural },
      { text: 'neon cyberpunk street', color: IG_C.environment },
      { text: ':1.3)', color: IG_C.structural },
      { text: ', ', color: IG_C.structural },
      { text: 'rain-soaked asphalt', color: IG_C.atmosphere },
      { text: ', ', color: IG_C.structural },
      { text: '(', color: IG_C.structural },
      { text: 'electric pink and blue neon signs', color: IG_C.lighting },
      { text: ':1.2)', color: IG_C.structural },
      { text: ', ', color: IG_C.structural },
      { text: 'dense steam rising from vents', color: IG_C.atmosphere },
      { text: ', ', color: IG_C.structural },
      { text: 'cinematic', color: IG_C.style },
      { text: ' ', color: IG_C.structural },
      { text: 'shallow depth of field', color: IG_C.camera },
      { text: ', ', color: IG_C.structural },
      { text: 'reflective puddles', color: IG_C.materials },
      { text: ', ', color: IG_C.structural },
      { text: '8K ultra-detailed', color: IG_C.fidelity },
    ],
  },
  {
    scene: 'Desert Sunset',
    platform: 'Flux Pro',
    platformId: 'flux',
    imagePath: '/images/pro/imagegen-flux.jpg',
    accentColor: '#F59E0B',
    segments: [
      { text: 'vast golden desert at sunset', color: IG_C.environment },
      { text: ', ', color: IG_C.structural },
      { text: 'lone figure silhouetted on a sand dune ridge', color: IG_C.subject },
      { text: ', ', color: IG_C.structural },
      { text: 'dramatic orange and magenta sky', color: IG_C.colour },
      { text: ', ', color: IG_C.structural },
      { text: 'long shadows stretching across rippled sand', color: IG_C.lighting },
      { text: ', ', color: IG_C.structural },
      { text: 'cinematic wide-angle', color: IG_C.camera },
      { text: ', ', color: IG_C.structural },
      { text: 'hyperrealistic detail', color: IG_C.style },
    ],
  },
  {
    scene: 'Aurora Borealis',
    platform: 'DALL·E 3',
    platformId: 'openai',
    imagePath: '/images/pro/imagegen-openai.png',
    accentColor: '#10B981',
    segments: [
      { text: 'A dramatic aurora borealis', color: IG_C.subject },
      { text: ' ', color: IG_C.structural },
      { text: 'lighting up the night sky', color: IG_C.lighting },
      { text: ' ', color: IG_C.structural },
      { text: 'above a still glacial lake in Iceland', color: IG_C.environment },
      { text: '. ', color: IG_C.structural },
      { text: 'Vivid curtains of emerald green and deep violet', color: IG_C.colour },
      { text: ' ', color: IG_C.structural },
      { text: 'reflect perfectly in the mirror-calm water', color: IG_C.atmosphere },
      { text: '. ', color: IG_C.structural },
      { text: 'Snow-capped mountains frame the scene.', color: IG_C.composition },
    ],
  },
  {
    scene: 'Zen Garden',
    platform: 'Ideogram',
    platformId: 'ideogram',
    imagePath: '/images/pro/imagegen-ideogram.png',
    accentColor: '#06B6D4',
    segments: [
      { text: 'A Japanese zen garden', color: IG_C.environment },
      { text: ' ', color: IG_C.structural },
      { text: 'at twilight', color: IG_C.lighting },
      { text: ' ', color: IG_C.structural },
      { text: 'with glowing paper lanterns floating above a koi pond', color: IG_C.subject },
      { text: '. ', color: IG_C.structural },
      { text: 'Deep crimson maple leaves', color: IG_C.colour },
      { text: ' ', color: IG_C.structural },
      { text: 'scattered across moss-covered stepping stones', color: IG_C.materials },
      { text: '. ', color: IG_C.structural },
      { text: 'Warm golden lantern light', color: IG_C.lighting },
      { text: ' ', color: IG_C.structural },
      { text: 'contrasts against a cool indigo sky', color: IG_C.atmosphere },
      { text: '. ', color: IG_C.structural },
      { text: 'Mist rising from the still water.', color: IG_C.atmosphere },
    ],
  },
  {
    scene: 'Coral Reef',
    platform: 'Imagine',
    platformId: 'imagine-meta',
    imagePath: '/images/pro/imagegen-imagine-meta.png',
    accentColor: '#F97316',
    segments: [
      { text: 'An underwater coral reef scene', color: IG_C.environment },
      { text: ' ', color: IG_C.structural },
      { text: 'with bright tropical fish swimming', color: IG_C.subject },
      { text: ' ', color: IG_C.structural },
      { text: 'through shafts of sunlight', color: IG_C.lighting },
      { text: '. ', color: IG_C.structural },
      { text: 'Vivid orange and yellow coral formations', color: IG_C.colour },
      { text: ' ', color: IG_C.structural },
      { text: 'glow against deep ocean blue', color: IG_C.atmosphere },
      { text: '. ', color: IG_C.structural },
      { text: 'A sea turtle glides', color: IG_C.action },
      { text: ' ', color: IG_C.structural },
      { text: 'through crystal clear turquoise water', color: IG_C.materials },
      { text: ' ', color: IG_C.structural },
      { text: 'with light rays streaming down from the surface.', color: IG_C.lighting },
    ],
  },
];

function ImageGenPreviewPanel() {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [fadeState, setFadeState] = React.useState<'visible' | 'fading-out' | 'fading-in'>('visible');

  // Rotate through all 5 cards every 15s — synced to blur-to-sharp cycle
  // 300ms crossfade: fade-out → swap → fade-in
  React.useEffect(() => {
    const id = setInterval(() => {
      setFadeState('fading-out');
      setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % IMAGEGEN_SHOWCASE.length);
        setFadeState('fading-in');
        setTimeout(() => setFadeState('visible'), 300);
      }, 300);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const item = IMAGEGEN_SHOWCASE[activeIdx]!;

  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: IMAGEGEN_CSS }} />

      {/* Animated amber header — matches all other preview panels */}
      <div style={{ padding: 'clamp(10px, 1vw, 16px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          From prompt to image — all inside Promagen
        </p>
      </div>

      {/* Single full-height card with crossfade */}
      <div
        className="flex-1 min-h-0 overflow-hidden rounded-xl flex flex-col"
        style={{
          background: 'rgba(15, 23, 42, 0.97)',
          border: '1px solid rgba(232, 121, 249, 0.3)',
          boxShadow: '0 0 30px 6px rgba(232,121,249,0.15), 0 0 60px 12px rgba(232,121,249,0.06), inset 0 0 20px 2px rgba(232,121,249,0.1)',
          padding: 'clamp(10px, 1vw, 16px)',
          gap: 'clamp(8px, 0.8vw, 12px)',
        }}
      >
        {/* Ethereal glow overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,121,249,0.08), transparent 70%)', pointerEvents: 'none' }} />
        </div>

        {/* ── Flow header — fixed ── */}
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{
            padding: 'clamp(8px, 0.8vw, 12px)',
            background: 'rgba(232, 121, 249, 0.06)',
            border: '1px solid rgba(232, 121, 249, 0.15)',
            gap: 'clamp(8px, 0.8vw, 12px)',
          }}
        >
          <span className="font-semibold text-white" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
            Your Prompt
          </span>
          <span style={{ color: '#e879f9', fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}>→</span>
          <span className="font-semibold" style={{ color: '#e879f9', fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
            Your API Key
          </span>
          <span style={{ color: '#e879f9', fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}>→</span>
          <span className="font-semibold text-white" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
            Your Image
          </span>
          <span
            className="ml-auto inline-flex items-center rounded-md font-semibold"
            style={{
              fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)',
              padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.5vw, 8px)',
              background: 'rgba(232, 121, 249, 0.15)',
              border: '1px solid rgba(232, 121, 249, 0.4)',
              color: '#e879f9',
            }}
          >
            Coming to Pro
          </span>
        </div>

        {/* ── Single showcase card — full remaining space ── */}
        <div
          className="relative rounded-lg overflow-hidden flex-1 min-h-0"
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${item.accentColor}30`,
            opacity: fadeState === 'fading-out' ? 0 : 1,
            transition: 'opacity 300ms ease-in-out',
          }}
        >
          {/* Top glow */}
          <span
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${item.accentColor}15 0%, transparent 70%)` }}
            aria-hidden="true"
          />

          {/* ── Left: Platform + colour-coded prompt ── */}
          <div
            className="relative z-10 flex flex-col"
            style={{
              flex: '1 1 0%',
              padding: 'clamp(12px, 1.2vw, 20px)',
              gap: 'clamp(6px, 0.6vw, 10px)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Platform + scene header */}
            <div className="flex items-center shrink-0" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icons/providers/${item.platformId}.png`}
                alt=""
                style={{ width: 'clamp(18px, 1.5vw, 24px)', height: 'clamp(18px, 1.5vw, 24px)' }}
                className="rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="font-semibold text-white" style={{ fontSize: 'clamp(0.75rem, 0.8vw, 0.95rem)' }}>
                {item.platform}
              </span>
              <span className="text-white font-medium" style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)', marginLeft: 'auto' }}>
                {item.scene}
              </span>
            </div>

            {/* Colour-coded prompt text — full space, matching Prompt Lab font */}
            <div className="flex-1 overflow-hidden">
              <p className="font-mono leading-relaxed" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.8rem)' }}>
                {item.segments.map((seg, si) => (
                  <span key={si} style={{ color: seg.color }}>{seg.text}</span>
                ))}
              </p>
            </div>

            {/* Generate button */}
            <div className="flex items-center shrink-0" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <span
                className="inline-flex items-center rounded-md font-semibold"
                style={{
                  fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)',
                  padding: 'clamp(3px, 0.3vw, 5px) clamp(8px, 0.7vw, 12px)',
                  background: `${item.accentColor}20`,
                  border: `1px solid ${item.accentColor}40`,
                  color: item.accentColor,
                  gap: 'clamp(4px, 0.4vw, 6px)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 'clamp(12px, 1vw, 16px)', height: 'clamp(12px, 1vw, 16px)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate
              </span>
              <span style={{ color: '#e879f9', fontSize: 'clamp(0.8rem, 0.85vw, 1rem)' }}>→</span>

              {/* Rotation indicator — dots showing which card is active */}
              <div className="flex items-center ml-auto" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                {IMAGEGEN_SHOWCASE.map((_, i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 'clamp(5px, 0.4vw, 7px)',
                      height: 'clamp(5px, 0.4vw, 7px)',
                      background: i === activeIdx ? '#e879f9' : 'rgba(255,255,255,0.2)',
                      transition: 'background 300ms ease',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Real AI-generated image with blur-to-sharp ── */}
          <div className="relative" style={{ flex: '1 1 0%', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={activeIdx}
              src={item.imagePath}
              alt=""
              className="imagegen-reveal"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                animation: 'imagegenReveal 15s ease-in-out infinite',
              }}
              loading="lazy"
            />

            {/* Progress bar */}
            <div
              key={`prog-${activeIdx}`}
              className="imagegen-progress absolute"
              style={{
                bottom: 0,
                left: 0,
                height: 'clamp(3px, 0.25vw, 4px)',
                background: 'linear-gradient(90deg, rgba(232,121,249,0.8), rgba(168,85,247,0.8))',
                animation: 'imagegenProgressBar 15s ease-in-out infinite',
                borderRadius: '0 2px 0 0',
              }}
            />

            {/* Platform watermark */}
            <div
              className="absolute flex items-center"
              style={{
                bottom: 'clamp(6px, 0.6vw, 10px)',
                right: 'clamp(6px, 0.6vw, 10px)',
                padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.5vw, 8px)',
                background: 'rgba(0,0,0,0.6)',
                borderRadius: '4px',
                gap: 'clamp(4px, 0.4vw, 6px)',
                zIndex: 2,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icons/providers/${item.platformId}.png`}
                alt=""
                style={{ width: 'clamp(12px, 1vw, 16px)', height: 'clamp(12px, 1vw, 16px)' }}
                className="rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-white font-medium" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
                {item.platform}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 'clamp(8px, 0.8vw, 12px)' }}
      >
        <span
          className="inline-flex items-center text-emerald-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)', gap: 'clamp(3px, 0.3vw, 5px)' }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Your key · Your images · Your privacy
        </span>
        <span
          className="text-amber-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          Coming to Pro Promagen
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// PROMPT INTELLIGENCE PREVIEW PANEL — The Universal Translator
// ============================================================================
// Shown when Prompt Intelligence card is hovered. Fills the CTA area.
// Shows how a plain HUMAN SENTENCE gets intelligently converted into
// platform-native prompt formats across 3 different encoder architectures.
//
// Typewriter animation types the human sentence character by character.
// Once complete, 3 platform cards fade in showing colour-coded conversions.
// 5 scenarios rotate every 12s with 300ms crossfade.
// Nav dots clickable — clicking pauses auto-rotation for 20s.
//
// Human Factor: Curiosity Gap — "how did it know that?"
// Human Factor: Authority Signal — encoder knowledge = trust
// Human Factor: Loss Aversion — free users see monochrome; Pro gets this
//
// Code Standard Compliance:
// - All clamp() sizing (§6.0), min 10px text (§6.0.1)
// - No grey text on /pro-promagen (best-working-practice.md)
// - No opacity dimming (§6.0.3), cursor-pointer on clickables (§6.0.4)
// - Animations co-located in <style> block
// - Category colours from SSOT (IG_C / prompt-colours.ts)
// ============================================================================

const INTELLIGENCE_CSS = `
  @keyframes intelligenceFade {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes typewriterCursor {
    0%, 100% { border-color: rgba(251, 146, 60, 0.9); }
    50% { border-color: transparent; }
  }
  .intelligence-fade-in { animation: intelligenceFade 300ms ease-out forwards; }
  .typewriter-cursor {
    border-right: 2px solid rgba(251, 146, 60, 0.9);
    animation: typewriterCursor 700ms step-end infinite;
  }
  @keyframes tickerScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .intelligence-ticker {
    display: flex;
    animation: tickerScroll 30s linear infinite;
    will-change: transform;
  }
  .intelligence-ticker:hover { animation-play-state: paused; }
`;

// Reuse category colours from SSOT (same as IG_C defined above)
const PI_C = IG_C;

// Encoder info for badges
const ENCODER_BADGES: Record<string, { plain: string; tech: string; tokens: string }> = {
  'stability':     { plain: 'Keywords · weighted',   tech: 'CLIP encoder',   tokens: '75 tokens' },
  'leonardo':      { plain: 'Keywords · weighted',   tech: 'CLIP encoder',   tokens: '75 tokens' },
  'midjourney':    { plain: 'Brief · with params',   tech: 'MJ encoder',     tokens: '~30 words' },
  'flux':          { plain: 'Natural language',       tech: 'T5-XXL encoder', tokens: '512 tokens' },
  'google-imagen': { plain: 'Natural language',       tech: 'T5-XXL encoder', tokens: '512 tokens' },
  'openai':        { plain: 'Prose · auto-rewritten', tech: 'GPT-4 rewrite',  tokens: '~800 chars' },
  'kling':         { plain: 'Semantic language',      tech: 'ChatGLM3-6B',   tokens: '256 tokens' },
  'recraft':       { plain: 'Structured sentences',   tech: 'Proprietary',    tokens: '4,000 chars' },
  'ideogram':      { plain: 'Natural language',       tech: 'Proprietary',    tokens: '~500 chars' },
  'canva':         { plain: 'Minimal phrases',        tech: 'Proprietary',    tokens: '~200 chars' },
};

// ── All 40 active platform IDs for the scrolling ticker ribbon ────────────
const ALL_PLATFORM_IDS = [
  'midjourney', 'openai', 'stability', 'flux', 'leonardo', 'adobe-firefly',
  'ideogram', 'recraft', 'kling', 'luma-ai',
  'google-imagen', 'imagine-meta', 'runway', 'novelai', 'playground',
  'microsoft-designer', 'bing', 'canva', 'picsart', 'dreamstudio',
  'artbreeder', 'craiyon', 'deepai', 'clipdrop', 'fotor',
  'hotpot', 'jasper-art', 'lexica', 'photoleap',
  'pixlr', 'simplified', 'visme', 'vistacreate', '123rf', 'myedit',
  'picwish', 'dreamlike', 'artguru', 'artistly', 'bluewillow',
];

// ── 5 Showcase Scenarios — The Universal Translator ──────────────────────
// Each scenario: one human sentence, 3 platform conversions with colour segments.
// Trios chosen to maximise encoder architecture contrast.

interface IntelligenceScenario {
  name: string;
  humanSentence: string;
  platforms: Array<{
    id: string;
    name: string;
    segments: Array<{ text: string; color: string }>;
  }>;
}

const INTELLIGENCE_SCENARIOS: IntelligenceScenario[] = [
  // Scenario 1: Dragon over Castle — CLIP (Stability) vs MJ vs T5 (Flux)
  {
    name: 'Dragon & Castle',
    humanSentence: 'Huge dragon flying over a medieval castle at night with fire lighting up the stone walls, smoke everywhere, dramatic and epic',
    platforms: [
      {
        id: 'stability',
        name: 'Stability',
        segments: [
          { text: '(', color: PI_C.structural },
          { text: 'huge dragon', color: PI_C.subject },
          { text: ':1.3)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'flying', color: PI_C.action },
          { text: ', ', color: PI_C.structural },
          { text: 'medieval castle', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'night', color: PI_C.lighting },
          { text: ':1.2)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'fire', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'stone walls', color: PI_C.materials },
          { text: ', ', color: PI_C.structural },
          { text: 'smoke', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'dramatic', color: PI_C.style },
          { text: ', ', color: PI_C.structural },
          { text: 'epic', color: PI_C.style },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: '8K detailed', color: PI_C.fidelity },
          { text: ':1.1)', color: PI_C.structural },
        ],
      },
      {
        id: 'midjourney',
        name: 'Midjourney',
        segments: [
          { text: 'huge dragon', color: PI_C.subject },
          { text: ' ', color: PI_C.structural },
          { text: 'flying', color: PI_C.action },
          { text: ' over ', color: PI_C.structural },
          { text: 'medieval castle', color: PI_C.environment },
          { text: ' ', color: PI_C.structural },
          { text: 'night', color: PI_C.lighting },
          { text: ' ', color: PI_C.structural },
          { text: 'fire', color: PI_C.lighting },
          { text: ' ', color: PI_C.structural },
          { text: 'stone walls', color: PI_C.materials },
          { text: ' ', color: PI_C.structural },
          { text: 'smoke', color: PI_C.atmosphere },
          { text: ' ', color: PI_C.structural },
          { text: 'dramatic epic', color: PI_C.style },
          { text: ' ', color: PI_C.structural },
          { text: '--ar 16:9 --s 600 --q 2', color: PI_C.fidelity },
        ],
      },
      {
        id: 'flux',
        name: 'Flux',
        segments: [
          { text: 'A ', color: PI_C.structural },
          { text: 'huge dragon', color: PI_C.subject },
          { text: ' ', color: PI_C.structural },
          { text: 'flying', color: PI_C.action },
          { text: ' over a ', color: PI_C.structural },
          { text: 'medieval castle', color: PI_C.environment },
          { text: ' at ', color: PI_C.structural },
          { text: 'night', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'fire lighting up the stone walls', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'smoke billowing everywhere', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'dramatic and epic', color: PI_C.style },
          { text: ' cinematic composition', color: PI_C.structural },
        ],
      },
    ],
  },
  // Scenario 2: Piano on Fire — CLIP (Leonardo) vs GPT-4 (DALL·E 3) vs Proprietary (Recraft)
  {
    name: 'Burning Piano',
    humanSentence: 'A piano on fire in the middle of an empty ballroom, dark and moody, marble floors reflecting the flames, shot from the doorway',
    platforms: [
      {
        id: 'leonardo',
        name: 'Leonardo',
        segments: [
          { text: '(', color: PI_C.structural },
          { text: 'piano on fire', color: PI_C.subject },
          { text: ':1.3)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'empty ballroom', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'dark moody', color: PI_C.atmosphere },
          { text: ':1.2)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'marble floors', color: PI_C.materials },
          { text: ', ', color: PI_C.structural },
          { text: 'reflecting flames', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'doorway composition', color: PI_C.composition },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'masterpiece', color: PI_C.fidelity },
          { text: ':1.1)', color: PI_C.structural },
        ],
      },
      {
        id: 'openai',
        name: 'DALL·E 3',
        segments: [
          { text: 'A grand ', color: PI_C.structural },
          { text: 'piano engulfed in flames', color: PI_C.subject },
          { text: ' at the centre of a vast ', color: PI_C.structural },
          { text: 'empty ballroom', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: 'dark and moody', color: PI_C.atmosphere },
          { text: ' atmosphere, polished ', color: PI_C.structural },
          { text: 'marble floors', color: PI_C.materials },
          { text: ' reflecting the warm ', color: PI_C.structural },
          { text: 'flickering firelight', color: PI_C.lighting },
          { text: ', framed from the perspective of ', color: PI_C.structural },
          { text: 'the doorway', color: PI_C.composition },
        ],
      },
      {
        id: 'recraft',
        name: 'Recraft V3',
        segments: [
          { text: 'A ', color: PI_C.structural },
          { text: 'piano on fire', color: PI_C.subject },
          { text: '. ', color: PI_C.structural },
          { text: 'Empty ballroom', color: PI_C.environment },
          { text: ' setting. ', color: PI_C.structural },
          { text: 'Dark, moody', color: PI_C.atmosphere },
          { text: ' atmosphere with ', color: PI_C.structural },
          { text: 'marble floors', color: PI_C.materials },
          { text: ' ', color: PI_C.structural },
          { text: 'reflecting the flames', color: PI_C.lighting },
          { text: '. ', color: PI_C.structural },
          { text: 'Doorway perspective', color: PI_C.composition },
          { text: '.', color: PI_C.structural },
        ],
      },
    ],
  },
  // Scenario 3: Telephone Box — CLIP (Stability) vs ChatGLM3 (Kling) vs T5 (Flux)
  {
    name: 'Desert Phone Box',
    humanSentence: 'An old telephone box in the middle of a desert with light pouring out of it and stars everywhere, sand blowing across the ground, mysterious and lonely',
    platforms: [
      {
        id: 'stability',
        name: 'Stability',
        segments: [
          { text: '(', color: PI_C.structural },
          { text: 'old telephone box', color: PI_C.subject },
          { text: ':1.3)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'desert', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'light pouring out', color: PI_C.lighting },
          { text: ':1.2)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'stars', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: 'sand blowing', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'mysterious', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'lonely', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: '(8K detailed:1.1)', color: PI_C.fidelity },
        ],
      },
      {
        id: 'kling',
        name: 'Kling AI',
        segments: [
          { text: 'old telephone box', color: PI_C.subject },
          { text: ' in ', color: PI_C.structural },
          { text: 'desert', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: 'light pouring out', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'stars everywhere', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: 'sand blowing across ground', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'mysterious and lonely', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'masterpiece, best quality', color: PI_C.fidelity },
        ],
      },
      {
        id: 'flux',
        name: 'Flux',
        segments: [
          { text: 'An ', color: PI_C.structural },
          { text: 'old telephone box', color: PI_C.subject },
          { text: ' standing alone in the middle of a vast ', color: PI_C.structural },
          { text: 'desert', color: PI_C.environment },
          { text: ' with warm ', color: PI_C.structural },
          { text: 'light pouring out of it', color: PI_C.lighting },
          { text: ', a sky full of ', color: PI_C.structural },
          { text: 'stars', color: PI_C.environment },
          { text: ' above, ', color: PI_C.structural },
          { text: 'sand blowing gently across the ground', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'mysterious and lonely', color: PI_C.atmosphere },
          { text: ' atmosphere', color: PI_C.structural },
        ],
      },
    ],
  },
  // Scenario 4: Dandelion Girl — CLIP (Stability) vs Proprietary (Ideogram) vs Plain (Canva)
  {
    name: 'Dandelion Field',
    humanSentence: 'Little girl blowing dandelion seeds in a golden field at sunset, soft and dreamy, warm light catching the seeds as they float away',
    platforms: [
      {
        id: 'stability',
        name: 'Stability',
        segments: [
          { text: '(', color: PI_C.structural },
          { text: 'little girl', color: PI_C.subject },
          { text: ':1.3)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'blowing dandelion seeds', color: PI_C.action },
          { text: ', ', color: PI_C.structural },
          { text: 'golden field', color: PI_C.environment },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'sunset', color: PI_C.lighting },
          { text: ':1.2)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'soft', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'dreamy', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'warm light', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'floating seeds', color: PI_C.materials },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: '8K detailed', color: PI_C.fidelity },
          { text: ':1.1)', color: PI_C.structural },
        ],
      },
      {
        id: 'ideogram',
        name: 'Ideogram',
        segments: [
          { text: 'A ', color: PI_C.structural },
          { text: 'little girl', color: PI_C.subject },
          { text: ' ', color: PI_C.structural },
          { text: 'blowing dandelion seeds', color: PI_C.action },
          { text: ' in a ', color: PI_C.structural },
          { text: 'golden field', color: PI_C.environment },
          { text: ' at ', color: PI_C.structural },
          { text: 'sunset', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'soft and dreamy', color: PI_C.atmosphere },
          { text: ' mood, ', color: PI_C.structural },
          { text: 'warm light', color: PI_C.lighting },
          { text: ' catching the seeds as they float away', color: PI_C.structural },
        ],
      },
      {
        id: 'canva',
        name: 'Canva',
        segments: [
          { text: 'little girl', color: PI_C.subject },
          { text: ' ', color: PI_C.structural },
          { text: 'dandelion seeds', color: PI_C.action },
          { text: ' ', color: PI_C.structural },
          { text: 'golden field', color: PI_C.environment },
          { text: ' ', color: PI_C.structural },
          { text: 'sunset', color: PI_C.lighting },
          { text: ' ', color: PI_C.structural },
          { text: 'soft dreamy', color: PI_C.atmosphere },
        ],
      },
    ],
  },
  // Scenario 5: Robot in Cyberpunk — CLIP (Leonardo) vs MJ vs GPT-4 (DALL·E 3)
  {
    name: 'Lonely Robot',
    humanSentence: 'Robot sitting alone on a bench reading a newspaper in a rainy cyberpunk city at night, neon signs reflecting in the puddles, cinematic and melancholy',
    platforms: [
      {
        id: 'leonardo',
        name: 'Leonardo AI',
        segments: [
          { text: '(', color: PI_C.structural },
          { text: 'robot', color: PI_C.subject },
          { text: ':1.3)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'sitting on bench', color: PI_C.action },
          { text: ', ', color: PI_C.structural },
          { text: 'reading newspaper', color: PI_C.action },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'cyberpunk city', color: PI_C.environment },
          { text: ':1.2)', color: PI_C.structural },
          { text: ', ', color: PI_C.structural },
          { text: 'rainy', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: 'night', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'neon signs', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'puddles', color: PI_C.materials },
          { text: ', ', color: PI_C.structural },
          { text: 'cinematic', color: PI_C.style },
          { text: ', ', color: PI_C.structural },
          { text: 'melancholy', color: PI_C.atmosphere },
          { text: ', ', color: PI_C.structural },
          { text: '(', color: PI_C.structural },
          { text: 'masterpiece', color: PI_C.fidelity },
          { text: ':1.1)', color: PI_C.structural },
        ],
      },
      {
        id: 'midjourney',
        name: 'Midjourney',
        segments: [
          { text: 'robot', color: PI_C.subject },
          { text: ' ', color: PI_C.structural },
          { text: 'sitting on bench reading newspaper', color: PI_C.action },
          { text: ' ', color: PI_C.structural },
          { text: 'rainy cyberpunk city', color: PI_C.environment },
          { text: ' ', color: PI_C.structural },
          { text: 'night', color: PI_C.lighting },
          { text: ' ', color: PI_C.structural },
          { text: 'neon reflections', color: PI_C.lighting },
          { text: ' ', color: PI_C.structural },
          { text: 'puddles', color: PI_C.materials },
          { text: ' ', color: PI_C.structural },
          { text: 'cinematic', color: PI_C.style },
          { text: ' ', color: PI_C.structural },
          { text: 'melancholy', color: PI_C.atmosphere },
          { text: ' ', color: PI_C.structural },
          { text: '--ar 16:9 --s 500 --q 2', color: PI_C.fidelity },
        ],
      },
      {
        id: 'openai',
        name: 'DALL·E 3',
        segments: [
          { text: 'A lone ', color: PI_C.structural },
          { text: 'robot', color: PI_C.subject },
          { text: ' ', color: PI_C.structural },
          { text: 'sitting on a park bench reading a newspaper', color: PI_C.action },
          { text: ' in a ', color: PI_C.structural },
          { text: 'rainy cyberpunk city', color: PI_C.environment },
          { text: ' at ', color: PI_C.structural },
          { text: 'night', color: PI_C.lighting },
          { text: ', ', color: PI_C.structural },
          { text: 'neon signs', color: PI_C.lighting },
          { text: ' casting colourful reflections in the ', color: PI_C.structural },
          { text: 'puddles', color: PI_C.materials },
          { text: ', ', color: PI_C.structural },
          { text: 'cinematic', color: PI_C.style },
          { text: ' and ', color: PI_C.structural },
          { text: 'melancholy', color: PI_C.atmosphere },
          { text: ' atmosphere', color: PI_C.structural },
        ],
      },
    ],
  },
];

function IntelligencePreviewPanel() {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [fadeState, setFadeState] = React.useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const [typedCount, setTypedCount] = React.useState(0);
  const [platformsVisible, setPlatformsVisible] = React.useState(false);
  const pauseRef = React.useRef(false);
  const pauseTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const typeTimerRef = React.useRef<ReturnType<typeof setInterval>>();
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const scenario = INTELLIGENCE_SCENARIOS[activeIdx]!;
  const cardColor = '#fb923c'; // Orange — matches Prompt Intelligence card

  // Start typing when scenario changes or on mount
  const startTyping = React.useCallback((idx: number) => {
    clearInterval(typeTimerRef.current);
    clearTimeout(holdTimerRef.current);
    setTypedCount(0);
    setPlatformsVisible(false);
    setFadeState('visible');
    const sentence = INTELLIGENCE_SCENARIOS[idx]!.humanSentence;
    let count = 0;
    typeTimerRef.current = setInterval(() => {
      count++;
      setTypedCount(count);
      if (count >= sentence.length) {
        clearInterval(typeTimerRef.current);
        // Pause 400ms then show platforms
        setTimeout(() => setPlatformsVisible(true), 400);
      }
    }, 25);
  }, []);

  // Auto-rotate every 12s after platforms are shown
  React.useEffect(() => {
    if (!platformsVisible) return;
    holdTimerRef.current = setTimeout(() => {
      if (pauseRef.current) return;
      setFadeState('fading-out');
      setTimeout(() => {
        const nextIdx = (activeIdx + 1) % INTELLIGENCE_SCENARIOS.length;
        setActiveIdx(nextIdx);
        startTyping(nextIdx);
      }, 300);
    }, 8000);
    return () => clearTimeout(holdTimerRef.current);
  }, [platformsVisible, activeIdx, startTyping]);

  // Initial typing on mount
  React.useEffect(() => {
    startTyping(0);
    return () => {
      clearInterval(typeTimerRef.current);
      clearTimeout(holdTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click nav dot — switch immediately, pause auto-rotation for 20s
  const handleDotClick = React.useCallback((idx: number) => {
    if (idx === activeIdx) return;
    pauseRef.current = true;
    clearTimeout(pauseTimerRef.current);
    clearTimeout(holdTimerRef.current);
    clearInterval(typeTimerRef.current);
    setFadeState('fading-out');
    setTimeout(() => {
      setActiveIdx(idx);
      startTyping(idx);
    }, 300);
    pauseTimerRef.current = setTimeout(() => { pauseRef.current = false; }, 20000);
  }, [activeIdx, startTyping]);

  React.useEffect(() => () => clearTimeout(pauseTimerRef.current), []);

  const pGlow = hexToRgbaPanel(cardColor, 0.25);
  const pBorder = hexToRgbaPanel(cardColor, 0.4);
  const pSoft = hexToRgbaPanel(cardColor, 0.12);

  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: INTELLIGENCE_CSS }} />

      {/* Animated amber header — matches all other preview panels */}
      <div style={{ padding: 'clamp(8px, 0.8vw, 14px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)' }}
        >
          Type it once — translated for 40 platforms
        </p>
      </div>

      {/* Main content area — single glass card taking all space */}
      <div
        className="relative flex-1 min-h-0 rounded-xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(15, 23, 42, 0.97)',
          border: `1px solid ${pBorder}`,
          boxShadow: `0 0 30px 6px ${pGlow}, 0 0 60px 12px ${pSoft}, inset 0 0 20px 2px ${pGlow}`,
          padding: 'clamp(10px, 1vw, 16px)',
          gap: 'clamp(6px, 0.6vw, 10px)',
        }}
      >
        {/* Top glow */}
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${pGlow} 0%, transparent 70%)` }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>

          {/* ── Typewriter sentence — the human input ── */}
          <div
            className="shrink-0 rounded-lg"
            style={{
              padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)', marginBottom: 'clamp(4px, 0.3vw, 6px)' }}>
              <span className="text-white font-semibold" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
                ✏️ You type:
              </span>
              <span className="font-medium" style={{ color: cardColor, fontSize: 'clamp(0.625rem, 0.55vw, 0.65rem)' }}>
                Human Sentence Conversion
              </span>
            </div>
            <p
              className="font-mono leading-relaxed"
              style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.8rem)', minHeight: 'clamp(28px, 2.5vw, 40px)' }}
            >
              <span className="text-white">
                {scenario.humanSentence.slice(0, typedCount)}
              </span>
              {typedCount < scenario.humanSentence.length && (
                <span className="typewriter-cursor">&nbsp;</span>
              )}
            </p>
          </div>

          {/* ── Conversion arrow strip ── */}
          <div
            className="flex items-center justify-center shrink-0"
            style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}
          >
            <span style={{ color: cardColor, fontSize: 'clamp(0.7rem, 0.75vw, 0.9rem)' }}>↓</span>
            <span className="font-semibold" style={{ color: cardColor, fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
              Understood · Categorised · Adapted
            </span>
            <span style={{ color: cardColor, fontSize: 'clamp(0.7rem, 0.75vw, 0.9rem)' }}>↓</span>
          </div>

          {/* ── 3 platform cards — colour-coded outputs ── */}
          <div
            className="flex flex-1 min-h-0"
            style={{
              gap: 'clamp(5px, 0.5vw, 8px)',
              opacity: platformsVisible ? (fadeState === 'fading-out' ? 0 : 1) : 0,
              transition: 'opacity 300ms ease-in-out',
            }}
          >
            {scenario.platforms.map((platform) => {
              const badge = ENCODER_BADGES[platform.id];
              const plGlow = hexToRgbaPanel(cardColor, 0.15);
              const plBorder = hexToRgbaPanel(cardColor, 0.25);

              return (
                <div
                  key={platform.id}
                  className="relative flex-1 rounded-lg overflow-hidden flex flex-col"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${plBorder}`,
                    boxShadow: `inset 0 0 10px 1px ${plGlow}`,
                    padding: 'clamp(6px, 0.6vw, 10px)',
                  }}
                >
                  {/* Top glow */}
                  <span
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${plGlow} 0%, transparent 70%)` }}
                    aria-hidden="true"
                  />

                  <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
                    {/* Platform header — icon + name */}
                    <div className="flex items-center shrink-0" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/icons/providers/${platform.id}.png`}
                        alt=""
                        className="rounded"
                        style={{ width: 'clamp(14px, 1.2vw, 20px)', height: 'clamp(14px, 1.2vw, 20px)' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="font-semibold text-white truncate" style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)' }}>
                        {platform.name}
                      </span>
                    </div>

                    {/* Encoder badge */}
                    {badge && (
                      <div
                        className="flex flex-col shrink-0 rounded-md"
                        style={{
                          padding: 'clamp(2px, 0.2vw, 4px) clamp(5px, 0.4vw, 7px)',
                          background: `${cardColor}10`,
                          border: `1px solid ${cardColor}20`,
                        }}
                      >
                        <span className="text-white font-medium" style={{ fontSize: 'clamp(0.625rem, 0.5vw, 0.65rem)' }}>
                          {badge.plain} · {badge.tokens}
                        </span>
                        <span style={{ color: cardColor, fontSize: 'clamp(0.625rem, 0.45vw, 0.6rem)' }}>
                          {badge.tech}
                        </span>
                      </div>
                    )}

                    {/* Colour-coded converted prompt — main content */}
                    <div className="flex-1 overflow-hidden">
                      <p className="font-mono leading-relaxed" style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}>
                        {platform.segments.map((seg, si) => (
                          <span key={si} style={{ color: seg.color }}>{seg.text}</span>
                        ))}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrolling ticker ribbon — all 40 platform icons ── */}
      <div
        className="shrink-0 overflow-hidden rounded-lg"
        style={{
          marginTop: 'clamp(6px, 0.6vw, 10px)',
          padding: 'clamp(4px, 0.4vw, 7px) 0',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(251, 146, 60, 0.12)',
          maskImage: 'linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)',
        }}
      >
        <div className="intelligence-ticker" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
          {/* Double the icons for seamless infinite scroll */}
          {[...ALL_PLATFORM_IDS, ...ALL_PLATFORM_IDS].map((id, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${id}-${i}`}
              src={`/icons/providers/${id}.png`}
              alt=""
              className="rounded shrink-0"
              style={{
                width: 'clamp(16px, 1.3vw, 22px)',
                height: 'clamp(16px, 1.3vw, 22px)',
                opacity: 0.7,
                transition: 'opacity 200ms ease',
              }}
              onMouseEnter={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.target as HTMLImageElement).style.opacity = '0.7'; }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
        </div>
      </div>

      {/* Bottom row — nav dots + footer */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 'clamp(6px, 0.6vw, 10px)' }}
      >
        {/* Clickable nav dots */}
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
          {INTELLIGENCE_SCENARIOS.map((s, i) => (
            <span
              key={i}
              role="button"
              tabIndex={0}
              className="rounded-full cursor-pointer"
              title={s.name}
              onClick={() => handleDotClick(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDotClick(i); } }}
              style={{
                width: 'clamp(6px, 0.5vw, 8px)',
                height: 'clamp(6px, 0.5vw, 8px)',
                background: i === activeIdx ? '#fb923c' : 'rgba(255,255,255,0.25)',
                transition: 'background 300ms ease',
              }}
            />
          ))}
        </div>

        <span
          className="text-amber-400 font-semibold"
          style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
        >
          1 sentence → 40 platforms · 4 encoders · 17 algorithms
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

// ── ExchangeRegionWindow: Single region column with auto-scroll ───────────
function ExchangeRegionWindow({
  region,
  exchanges,
  isFirstRegion,
  cardMeasureRef,
}: {
  region: typeof EXCHANGE_REGIONS[number];
  exchanges: ExchangeCatalogEntry[];
  isFirstRegion: boolean;
  cardMeasureRef: React.RefObject<HTMLDivElement>;
}) {
  const { containerRef, contentRef, scrollDist } = useAutoScroll();
  const glowRgba = hexToRgbaPanel(region.color, 0.3);
  const glowBorder = hexToRgbaPanel(region.color, 0.5);
  const glowSoft = hexToRgbaPanel(region.color, 0.15);

  return (
    <div
      className="relative flex-1 rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`,
        padding: 'clamp(8px, 0.8vw, 14px)',
        transition: 'box-shadow 200ms ease-out',
      }}
    >
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }} />
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)` }} />

      <div className="relative z-10 flex flex-col h-full" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {/* Region heading — fixed */}
        <div className="flex items-center shrink-0" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
          <span style={{ fontSize: 'clamp(0.85rem, 1vw, 1.2rem)' }}>{region.emoji}</span>
          <span className="font-semibold text-white truncate" style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.8rem)', textShadow: `0 0 12px ${glowRgba}` }}>
            {region.label}
          </span>
          <span className="ml-auto font-bold tabular-nums shrink-0" style={{ color: region.color, fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
            {exchanges.length}
          </span>
        </div>

        {/* Auto-scrolling exchange cards */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={contentRef}
            className="pro-auto-scroll"
            style={{ '--scroll-dist': `-${scrollDist}px`, animation: scrollDist > 0 ? 'proAutoScroll 17s ease-in-out infinite' : 'none', display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.2vw, 18px)' } as React.CSSProperties}
          >
            {exchanges.map((ex, exIdx) => {
              const exColor = ex.hoverColor ?? '#A855F7';
              const exGlow = hexToRgbaPanel(exColor, 0.25);
              const exBorder = hexToRgbaPanel(exColor, 0.4);
              const ms = ex.marketstack;
              const indexName = ms
                ? (isMultiIndexConfig(ms) ? ms.defaultIndexName : ms.indexName)
                : '';
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
                  <span
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${exGlow} 0%, transparent 70%)` }}
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex items-center" style={{ gap: 'clamp(5px, 0.5vw, 8px)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/flags/${(ex.iso2 ?? '').toLowerCase()}.svg`}
                      alt=""
                      className="rounded-sm shrink-0"
                      style={{ width: 'clamp(16px, 1.4vw, 22px)', height: 'clamp(11px, 1vw, 15px)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="font-medium text-white truncate" style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}>
                      {ex.name ?? ex.exchange ?? ex.id}
                    </span>
                    <span className="text-white truncate ml-auto shrink-0" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
                      {ex.city}
                    </span>
                  </div>
                  {indexName && (
                    <div className="relative z-10" style={{ marginTop: 'clamp(2px, 0.2vw, 3px)' }}>
                      <span className="text-cyan-400" style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}>
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
    </div>
  );
}

function ExchangesPreviewPanel({
  exchangeCatalog,
  onOpenPicker,
}: {
  exchangeCatalog: ExchangeCatalogEntry[];
  onOpenPicker: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null!);
  const cardMeasureRef = useRef<HTMLDivElement>(null!);
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
  const _maxVisibleCards = Math.max(1, Math.floor(
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
      return deduped;
    });
  }, [exchangeCatalog]);

  const ctaColor = '#22d3ee';
  const ctaGlowRgba = hexToRgbaPanel(ctaColor, 0.3);
  const ctaGlowBorder = hexToRgbaPanel(ctaColor, 0.5);
  const ctaGlowSoft = hexToRgbaPanel(ctaColor, 0.15);

  return (
    <div className="flex flex-col h-full">
      <style dangerouslySetInnerHTML={{ __html: PRO_AUTO_SCROLL_CSS }} />
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
              className="text-white text-center leading-relaxed"
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
        {EXCHANGE_REGIONS.map((region, idx) => (
          <ExchangeRegionWindow
            key={region.label}
            region={region}
            exchanges={regionExchanges[idx] ?? []}
            isFirstRegion={idx === 0}
            cardMeasureRef={cardMeasureRef}
          />
        ))}
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
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

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
  // Tier selection now uses the shared hook — single source of truth across
  // Pro page, exchange tooltips, and all other surfaces. No local state needed.
  const { tier: selectedPromptTier, saveTier: hookSaveTier } = useGlobalPromptTier('pro-page');

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

    setHydrated(true);
    // exchangeCatalog is a stable server-component prop — never changes after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clerk metadata tier sync handled by useGlobalPromptTier hook internally.

  // ============================================================================
  // STATE - Fullscreen Pickers (v2.3.0 Exchange, v2.6.0 FX)
  // ============================================================================
  // When true, entire centre panel shows ONLY the respective Picker
  // No headers, no badges, no comparison table, no CTA - just the picker
  // ============================================================================
  const [isExchangePickerFullscreen, setIsExchangePickerFullscreen] = useState(false);

  // ============================================================================
  // HOVER BRIDGE + DEBOUNCED INTENT DETECTION
  // ============================================================================
  // Problem: Cards sit above the preview panel. Moving cursor from a card
  // down to its preview crosses other cards, triggering unwanted panel switches.
  //
  // Solution: When a panel is already active and cursor enters a DIFFERENT card,
  // don't switch immediately. Instead, start a 150ms debounce. If the cursor
  // leaves that card within 150ms (just passing through), cancel the switch.
  // If it stays for 150ms, it's an intentional selection — switch panels.
  //
  // When NO panel is active, first hover switches immediately (no debounce).
  // When cursor enters the SAME card that's already active, do nothing.
  // ============================================================================
  type PreviewPanel = 'daily' | 'format' | 'scenes' | 'saved' | 'lab' | 'exchanges' | 'frame' | 'imagegen' | 'intelligence';
  const [activePanel, setActivePanel] = useState<PreviewPanel | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout>>();
  const switchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inPreviewRef = useRef(false);
  const activePanelRef = useRef<PreviewPanel | null>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null!);
  /** 2-second cooldown after dropdown selection to prevent accidental panel switch */
  const dropdownCooldownRef = useRef(false);
  const dropdownCooldownTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleDropdownSelect = useCallback(() => {
    dropdownCooldownRef.current = true;
    clearTimeout(dropdownCooldownTimerRef.current);
    dropdownCooldownTimerRef.current = setTimeout(() => {
      dropdownCooldownRef.current = false;
    }, 2000);
  }, []);

  // Keep activePanelRef in sync
  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  // Ref to the feature grid container (used by div below)
  const featureGridRef = useRef<HTMLDivElement>(null!);

  // ── Touch reset cooldown — blocks handleCardHover for 500ms after reset ──
  // Without this, the touchstart event propagates to the feature card
  // underneath, immediately opening a new panel.
  const touchResetCooldownRef = useRef(false);
  const touchResetCooldownTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Mobile preview lifecycle (WAAPI + forced reflow + double-rAF) ──────
  // Targets ALL scrollable element types:
  //   .pro-auto-scroll  — TierWindows, SceneWorldWindows, ExchangeRegionWindows, SavedWindows, LabWindows
  //   .daily-scroll-content — DailyPromptsPreviewPanel (different animation: one-way scroll)
  //   .imagegen-reveal — ImageGenPreviewPanel blur-to-sharp
  //   .imagegen-progress — ImageGenPreviewPanel progress bar
  //
  // MutationObserver re-runs WAAPI when DOM children change (scene rotation).
  // Desktop: skipped (window.innerWidth >= 768).
  useEffect(() => {
    if (!activePanel) return;
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;

    const runningAnimations: Animation[] = [];
    let raf1: number;
    let raf2: number;
    let mutationObs: MutationObserver | null = null;

    // Step 1: Scroll preview into view
    const scrollTimer = setTimeout(() => {
      previewPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 200);

    // ── Animate all scrollable elements inside the preview wrapper ──
    function animateAllElements() {
      // Cancel previous animations
      runningAnimations.forEach((a) => { try { a.cancel(); } catch {} });
      runningAnimations.length = 0;

      const wrapper = previewPanelRef.current;
      if (!wrapper) return;

      // Force synchronous reflow
      void wrapper.offsetHeight;

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {

          // ── 1. pro-auto-scroll elements (Tier, Scenes, Exchanges, Saved, Lab) ──
          wrapper.querySelectorAll<HTMLElement>('.pro-auto-scroll').forEach((el) => {
            const container = el.parentElement;
            if (!container) return;
            void container.offsetHeight;
            const overflow = el.scrollHeight - container.clientHeight;
            if (overflow <= 1) return;
            try {
              const a = el.animate(
                [
                  { transform: 'translateY(0)' },
                  { transform: 'translateY(0)', offset: 0.018 },
                  { transform: `translateY(-${overflow}px)`, offset: 0.488 },
                  { transform: `translateY(-${overflow}px)`, offset: 0.506 },
                  { transform: 'translateY(0)', offset: 0.976 },
                  { transform: 'translateY(0)' },
                ],
                { duration: 17000, iterations: Infinity, easing: 'ease-in-out' }
              );
              runningAnimations.push(a);
            } catch {}
          });

          // ── 2. daily-scroll-content (one-way scroll down, then advance) ──
          wrapper.querySelectorAll<HTMLElement>('.daily-scroll-content').forEach((el) => {
            const container = el.parentElement;
            if (!container) return;
            void container.offsetHeight;
            const overflow = el.scrollHeight - container.clientHeight;
            if (overflow <= 1) return;
            try {
              const dur = Math.max(2000, Math.min(8000, overflow * 25));
              const a = el.animate(
                [
                  { transform: 'translateY(0)' },
                  { transform: `translateY(-${overflow}px)` },
                ],
                { duration: dur, iterations: Infinity, easing: 'ease-in-out' }
              );
              runningAnimations.push(a);
            } catch {}
          });

          // ── 3. imagegen-reveal (blur-to-sharp) ──
          wrapper.querySelectorAll<HTMLElement>('.imagegen-reveal').forEach((el) => {
            try {
              const a = el.animate(
                [
                  { filter: 'blur(18px) brightness(0.3) saturate(0.1)', offset: 0 },
                  { filter: 'blur(12px) brightness(0.4) saturate(0.3)', offset: 0.1 },
                  { filter: 'blur(6px) brightness(0.6) saturate(0.6)', offset: 0.3 },
                  { filter: 'blur(1px) brightness(0.9) saturate(0.95)', offset: 0.55 },
                  { filter: 'blur(0) brightness(1) saturate(1)', offset: 0.65 },
                  { filter: 'blur(0) brightness(1) saturate(1)', offset: 0.85 },
                  { filter: 'blur(18px) brightness(0.3) saturate(0.1)', offset: 1 },
                ],
                { duration: 15000, iterations: Infinity, easing: 'ease-in-out' }
              );
              runningAnimations.push(a);
            } catch {}
          });

          // ── 4. imagegen-progress (progress bar width) ──
          wrapper.querySelectorAll<HTMLElement>('.imagegen-progress').forEach((el) => {
            try {
              const a = el.animate(
                [
                  { width: '0%', offset: 0 },
                  { width: '100%', offset: 0.65 },
                  { width: '0%', offset: 0.66 },
                  { width: '0%', offset: 1 },
                ],
                { duration: 15000, iterations: Infinity, easing: 'ease-in-out' }
              );
              runningAnimations.push(a);
            } catch {}
          });
        });
      });
    }

    // Run immediately after a brief settle
    const animTimer = setTimeout(animateAllElements, 50);

    // MutationObserver: re-run when DOM changes (scene rotation, provider swap)
    if (previewPanelRef.current) {
      mutationObs = new MutationObserver(() => {
        // Debounce — scene rotation triggers multiple mutations
        setTimeout(animateAllElements, 100);
      });
      mutationObs.observe(previewPanelRef.current, {
        childList: true,
        subtree: true,
      });
    }

    // Touch-to-reset — 1.5s delay avoids catching initial tap lift
    const handleTouchReset = () => {
      runningAnimations.forEach((a) => { try { a.cancel(); } catch {} });
      runningAnimations.length = 0;

      // Activate cooldown so handleCardHover ignores the next 500ms
      touchResetCooldownRef.current = true;
      clearTimeout(touchResetCooldownTimerRef.current);
      touchResetCooldownTimerRef.current = setTimeout(() => {
        touchResetCooldownRef.current = false;
      }, 500);

      setActivePanel(null);
      inPreviewRef.current = false;
      clearTimeout(lingerRef.current);
      clearTimeout(switchDebounceRef.current);

      setTimeout(() => {
        featureGridRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 50);
    };

    const touchTimer = setTimeout(() => {
      document.addEventListener('touchstart', handleTouchReset, { once: true, passive: true });
    }, 1500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(animTimer);
      clearTimeout(touchTimer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      mutationObs?.disconnect();
      document.removeEventListener('touchstart', handleTouchReset);
      runningAnimations.forEach((a) => { try { a.cancel(); } catch {} });
    };
  }, [activePanel]);

  const handleCardHover = useCallback((panel: PreviewPanel, hovering: boolean) => {
    clearTimeout(lingerRef.current);

    if (hovering) {
      // During dropdown cooldown, block switching to a different panel
      if (dropdownCooldownRef.current && activePanelRef.current && activePanelRef.current !== panel) {
        return;
      }

      // During touch reset cooldown, block ALL panel activations.
      // Without this, the touchstart from closing a panel propagates to
      // the feature card underneath and immediately reopens a panel.
      if (touchResetCooldownRef.current) {
        return;
      }

      // Same card — no action needed
      if (activePanelRef.current === panel) {
        clearTimeout(switchDebounceRef.current);
        return;
      }

      // No active panel — switch immediately (first hover, no debounce)
      if (!activePanelRef.current) {
        inPreviewRef.current = false;
        setActivePanel(panel);
        return;
      }

      // Different card while panel is active — debounce to filter pass-throughs
      // 150ms: fast enough to feel instant for deliberate hovers,
      // long enough to filter diagonal cursor movement toward preview
      clearTimeout(switchDebounceRef.current);
      switchDebounceRef.current = setTimeout(() => {
        inPreviewRef.current = false;
        setActivePanel(panel);
      }, 150);
    } else {
      // Cursor left a card — cancel any pending switch debounce for THIS card
      clearTimeout(switchDebounceRef.current);

      // Start linger timeout (2s) — if cursor doesn't enter preview, close panel
      lingerRef.current = setTimeout(() => {
        if (!inPreviewRef.current) {
          setActivePanel(null);
        }
      }, 2000);
    }
  }, []);

  const handlePreviewEnter = useCallback(() => {
    clearTimeout(lingerRef.current);
    clearTimeout(switchDebounceRef.current);
    inPreviewRef.current = true;
  }, []);

  const handlePreviewLeave = useCallback(() => {
    inPreviewRef.current = false;
    setActivePanel(null);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(lingerRef.current);
    clearTimeout(switchDebounceRef.current);
  }, []);

  // Wrapper callbacks matching FeatureControlPanel prop signatures
  const setDailyHovered = useCallback((h: boolean) => handleCardHover('daily', h), [handleCardHover]);
  const setFormatHovered = useCallback((h: boolean) => handleCardHover('format', h), [handleCardHover]);
  const setScenesHovered = useCallback((h: boolean) => handleCardHover('scenes', h), [handleCardHover]);
  const setSavedHovered = useCallback((h: boolean) => handleCardHover('saved', h), [handleCardHover]);
  const setLabHovered = useCallback((h: boolean) => handleCardHover('lab', h), [handleCardHover]);
  const setExchangesHovered = useCallback((h: boolean) => handleCardHover('exchanges', h), [handleCardHover]);
  const setFrameHovered = useCallback((h: boolean) => handleCardHover('frame', h), [handleCardHover]);
  const setImageGenHovered = useCallback((h: boolean) => handleCardHover('imagegen', h), [handleCardHover]);
  const setIntelligenceHovered = useCallback((h: boolean) => handleCardHover('intelligence', h), [handleCardHover]);

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
    // Delegates to shared hook — handles local state, localStorage,
    // Clerk persistence, AND same-tab sync (dispatches StorageEvent)
    hookSaveTier(tier);
  }, [hookSaveTier]);

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
      className="flex flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10 md:h-full md:min-h-0"
      style={{ padding: 'clamp(10px, 1vw, 16px)' }}
      data-testid="pro-promagen-panel"
    >
      {/* Mobile overrides: FCP flows naturally, preview gets fixed viewport height
          with overflow:hidden — SAME pattern as desktop. Inner panel divs keep
          height:100%, so useAutoScroll + CSS proAutoScroll animation works
          identically to desktop (translateY within fixed-height container). */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          [data-testid="pro-promagen-panel"] .pro-fcp-wrapper {
            flex: none !important;
            overflow: visible !important;
            min-height: auto !important;
          }
          [data-testid="pro-promagen-panel"] .pro-preview-wrapper {
            flex: none !important;
            height: 65svh !important;
            min-height: 200px !important;
            overflow: hidden !important;
            position: relative !important;
          }
          /* iOS Safari fix: keep ALL panels in render tree (never display:none).
             display:none → 0 dimensions → WAAPI measures fail.
             opacity:0 + position:absolute → valid dimensions → WAAPI works. */
          [data-testid="pro-promagen-panel"] .pro-preview-wrapper > [data-panel] {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            position: absolute !important;
            inset: 0 !important;
            opacity: 0;
            pointer-events: none;
          }
          [data-testid="pro-promagen-panel"] .pro-preview-wrapper > [data-panel][data-active] {
            opacity: 1;
            pointer-events: auto;
            position: relative !important;
          }
        }
      ` }} />
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

      {/* Feature Control Panel — 3×3 grid on desktop, 2-col on mobile */}
      <div ref={featureGridRef} className="overflow-hidden pro-fcp-wrapper" style={{ flex: '1 1 0%', minHeight: 'clamp(140px, 16vw, 270px)' }}>
        <FeatureControlPanel
          isPaidUser={isPaidUser}
          selectedPromptTier={selectedPromptTier}
          onPromptTierChange={handlePromptTierChange}
          selectedExchangeCount={selectedExchanges.length}
          onOpenExchangePicker={handleOpenExchangePicker}
          onDailyHover={setDailyHovered}
          onFormatHover={setFormatHovered}
          onScenesHover={setScenesHovered}
          onSavedHover={setSavedHovered}
          onLabHover={setLabHovered}
          onExchangesHover={setExchangesHovered}
          onFrameHover={setFrameHovered}
          onImageGenHover={setImageGenHovered}
          onIntelligenceHover={setIntelligenceHovered}
          onDropdownSelect={handleDropdownSelect}
        />
      </div>

      {/* Bottom panel — preview windows (3/4 of available height) */}
      {/* Hover bridge: onMouseEnter cancels linger timeout, onMouseLeave closes */}
      <div
        ref={previewPanelRef}
        className="min-h-0 flex flex-col rounded-xl overflow-hidden pro-preview-wrapper"
        style={{
          flex: '3 1 0%',
          marginTop: 'clamp(8px, 0.8vw, 12px)',
        }}
        onMouseEnter={activePanel ? handlePreviewEnter : undefined}
        onMouseLeave={activePanel ? handlePreviewLeave : undefined}
      >
        {/* All preview panels rendered always — toggled via CSS display.
            This avoids the mount-on-hover spike (PromptLabPreviewPanel starts
            5 timers + assemblePrompt + 45 icons on mount). With CSS toggle,
            hover just flips display — zero React work, instant paint.
            Mobile: CSS overrides display:none → opacity:0 via data-panel +
            data-active attributes. WAAPI handles auto-scroll animations. */}
        <div data-panel="daily" data-active={activePanel === 'daily' ? '' : undefined} style={{ display: activePanel === 'daily' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <DailyPromptsPreviewPanel />
        </div>
        <div data-panel="format" data-active={activePanel === 'format' ? '' : undefined} style={{ display: activePanel === 'format' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TierPreviewPanel activeTier={selectedPromptTier} isPaidUser={isPaidUser} onTierChange={handlePromptTierChange} />
        </div>
        <div data-panel="scenes" data-active={activePanel === 'scenes' ? '' : undefined} style={{ display: activePanel === 'scenes' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ScenesPreviewPanel />
        </div>
        <div data-panel="saved" data-active={activePanel === 'saved' ? '' : undefined} style={{ display: activePanel === 'saved' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <SavedPreviewPanel />
        </div>
        <div data-panel="lab" data-active={activePanel === 'lab' ? '' : undefined} style={{ display: activePanel === 'lab' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <PromptLabPreviewPanel providers={providers} />
        </div>
        <div data-panel="exchanges" data-active={activePanel === 'exchanges' ? '' : undefined} style={{ display: activePanel === 'exchanges' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ExchangesPreviewPanel exchangeCatalog={exchangeCatalog} onOpenPicker={handleOpenExchangePicker} />
        </div>
        <div data-panel="frame" data-active={activePanel === 'frame' ? '' : undefined} style={{ display: activePanel === 'frame' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <FramePreviewPanel />
        </div>
        <div data-panel="imagegen" data-active={activePanel === 'imagegen' ? '' : undefined} style={{ display: activePanel === 'imagegen' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ImageGenPreviewPanel />
        </div>
        <div data-panel="intelligence" data-active={activePanel === 'intelligence' ? '' : undefined} style={{ display: activePanel === 'intelligence' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <IntelligencePreviewPanel />
        </div>
        <div data-panel="cta" data-active={activePanel === null ? '' : undefined} data-upgrade-cta style={{ display: activePanel === null ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
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
