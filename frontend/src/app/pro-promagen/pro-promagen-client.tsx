// src/app/pro-promagen/pro-promagen-client.tsx
// ============================================================================
// PRO PROMAGEN CLIENT (v3.0.0)
// ============================================================================
// Client component for the /pro-promagen configuration page.
// Uses SAME layout as homepage (HomepageGrid + ExchangeCard + FxRibbon).
//
// v3.0.0 (10 Mar 2026):
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

import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
import {
  PRO_SELECTION_LIMITS,
  type FxPairCatalogEntry,
  type ExchangeCatalogEntry,
  isMultiIndexConfig,
} from '@/lib/pro-promagen/types';
import { catalogToPickerOptions } from '@/lib/pro-promagen/exchange-picker-helpers';
import type { Exchange, Hemisphere } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';
import type { Provider } from '@/types/providers';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';

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
 */
function catalogToExchange(
  entry: ExchangeCatalogEntry,
  _weather: ExchangeWeather | null,
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
    // Already in new format
    marketstack = ms;
  } else {
    // Convert legacy format to new format
    marketstack = {
      defaultBenchmark: ms.benchmark,
      defaultIndexName: ms.indexName,
      availableIndices: [{ benchmark: ms.benchmark, indexName: ms.indexName }],
    };
  }

  return {
    id: entry.id,
    city: entry.city,
    exchange: entry.exchange,
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
          style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1rem)' }}
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
                      fontSize: 'clamp(0.75rem, 0.9vw, 0.95rem)',
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
                    fontSize: 'clamp(0.625rem, 0.75vw, 0.7rem)',
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
                  style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)' }}
                >
                  {promptText}
                </p>

                {/* Active indicator */}
                {isActive && (
                  <span
                    className="inline-flex items-center self-start gap-1 text-emerald-400 font-semibold"
                    style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
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

  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(defaultExchangeIds);
  const [selectedPromptTier, setSelectedPromptTier] = useState<PromptTier>(4);

  // Track initial state for change detection
  const [initialExchanges, setInitialExchanges] = useState<string[]>(defaultExchangeIds);

  // Hydration gate — false until useEffect reads localStorage
  const [hydrated, setHydrated] = useState(false);

  // Read localStorage after mount (client-only, runs once)
  useEffect(() => {
    const storedExch = loadArrayFromStorage(STORAGE_KEYS.EXCHANGE_SELECTION);
    if (storedExch) {
      setSelectedExchanges(storedExch);
      setInitialExchanges(storedExch);
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
  const [formatHovered, setFormatHovered] = useState(false);

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
    const filtered = exchangeCatalog.filter((e) => selectedExchanges.includes(e.id));
    filtered.sort((a, b) => a.longitude - b.longitude);
    return filtered.map((e) => catalogToExchange(e, demoWeatherIndex.get(e.id) ?? null));
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

  // Fetch live index quotes for selected exchanges
  // FIX v2.7.0: Always use GET (exchangeIds: undefined). The /api/indices route
  // blocks POST (405) — paid user selection is derived server-side from Clerk
  // publicMetadata.exchangeSelection.exchangeIds. Passing exchangeIds here would
  // trigger the hook's POST path, which the API rejects.
  const { quotesById, movementById } = useIndicesQuotes({
    enabled: true,
    exchangeIds: undefined,
    userTier: isPaidUser ? 'paid' : 'free',
  });

  // Build indexByExchange map (same helper logic as homepage-client)
  const indexByExchange = useMemo(() => {
    const map = new Map<string, IndexQuoteData>();
    for (const [exchangeId, quote] of quotesById.entries()) {
      if (!quote) continue;
      const indexName = typeof quote.indexName === 'string' ? quote.indexName : null;
      const price =
        typeof quote.price === 'number' && Number.isFinite(quote.price) ? quote.price : null;
      if (!indexName || price === null) continue;

      const movement = movementById.get(exchangeId);
      map.set(exchangeId, {
        indexName,
        price,
        change:
          typeof quote.change === 'number' && Number.isFinite(quote.change) ? quote.change : 0,
        percentChange:
          typeof quote.percentChange === 'number' && Number.isFinite(quote.percentChange)
            ? quote.percentChange
            : 0,
        tick: movement?.tick ?? 'flat',
      });
    }
    return map;
  }, [quotesById, movementById]);

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

      {/* Feature Control Panel — 3×3 grid */}
      <div className="shrink-0">
        <FeatureControlPanel
          isPaidUser={isPaidUser}
          selectedPromptTier={selectedPromptTier}
          onPromptTierChange={handlePromptTierChange}
          selectedExchangeCount={selectedExchanges.length}
          onOpenExchangePicker={handleOpenExchangePicker}
          onFormatHover={setFormatHovered}
        />
      </div>

      {/* Bottom panel — payment area / tier preview on Format hover */}
      <div
        className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden"
        style={{
          marginTop: 'clamp(8px, 0.8vw, 12px)',
        }}
      >
        {formatHovered ? (
          <TierPreviewPanel activeTier={selectedPromptTier} />
        ) : (
          <UpgradeCta isPaidUser={isPaidUser} onSave={handleSave} hasChanges={hasChanges} />
        )}
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
      weatherByExchange={effectiveWeatherMap}
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
      weatherByExchange={effectiveWeatherMap}
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
