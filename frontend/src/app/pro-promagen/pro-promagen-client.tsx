// src/app/pro-promagen/pro-promagen-client.tsx
// ============================================================================
// PRO PROMAGEN CLIENT - WITH ENGINE BAY & MISSION CONTROL (v2.6.0)
// ============================================================================
// Client component for the /pro-promagen configuration page.
// Uses SAME layout as homepage (HomepageGrid + ExchangeCard + FxRibbon).
// Dropdowns embedded directly in comparison table (not separate panels).
//
// Key differences from homepage:
// - FX ribbon shows DEMO prices from pairs.json (not live API)
// - Exchange cards show real clocks but DEMO weather (placeholder)
// - Centre column shows comparison table instead of providers table
// - Paid users can save selections; free users preview only
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
import { getRailsRelative } from '@/lib/location';
import { ComparisonTable, UpgradeCta } from '@/components/pro-promagen';
import { ExchangePicker } from '@/components/pro-promagen/exchange-picker';
import FxPicker from '@/components/fx/fx-picker';
import {
  PRO_SELECTION_LIMITS,
  type FxPairCatalogEntry,
  type ExchangeCatalogEntry,
  type IndicesCatalogEntry,
} from '@/lib/pro-promagen/types';
import { catalogToPickerOptions } from '@/lib/pro-promagen/exchange-picker-helpers';
import type { FxPairOption } from '@/lib/fx/fx-picker-helpers';
import type { Exchange, Hemisphere } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';
import type { Provider } from '@/types/providers';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ProPromagenClientProps {
  /** Full exchange catalog */
  exchangeCatalog: ExchangeCatalogEntry[];
  /** Full FX pairs catalog */
  fxCatalog: FxPairCatalogEntry[];
  /** Indices catalog (exchanges with marketstack benchmarks) */
  indicesCatalog: IndicesCatalogEntry[];
  /** Default selected exchanges (SSOT) */
  defaultExchangeIds: string[];
  /** Default selected FX pairs (SSOT) */
  defaultFxPairIds: string[];
  /** Default selected indices (same as exchanges by default) */
  defaultIndicesIds: string[];
  /** Demo weather data for exchanges */
  demoWeatherIndex: Map<string, ExchangeWeather>;
  /** Providers data for Engine Bay (NEW v2.0.0) */
  providers?: Provider[];
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  FX_SELECTION: 'promagen:pro:fx-selection',
  EXCHANGE_SELECTION: 'promagen:pro:exchange-selection',
  INDICES_SELECTION: 'promagen:pro:indices-selection',
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
 */
function catalogToExchange(
  entry: ExchangeCatalogEntry,
  _weather: ExchangeWeather | null,
): Exchange {
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
    marketstack: entry.marketstack ?? { benchmark: '', indexName: '' },
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
      // ExchangeWeather doesn't have humidity/windKmh/description, so use defaults
      humidity: 50,
      windKmh: 10,
      description: weather.condition ?? 'Clear skies',
    });
  });
  return result;
}

/**
 * Convert FxPairCatalogEntry to FxPairOption for the FxPicker component.
 * NEW v2.6.0: Maps catalog format to picker format.
 */
function catalogToFxPickerOptions(catalog: FxPairCatalogEntry[]): FxPairOption[] {
  return catalog.map((pair) => ({
    id: pair.id,
    base: pair.base,
    quote: pair.quote,
    label: pair.label ?? `${pair.base}/${pair.quote}`,
    baseCountryCode: pair.baseCountryCode ?? '',
    quoteCountryCode: pair.quoteCountryCode ?? '',
    countryLabel: pair.countryLabel,
    category: pair.category,
    rank: pair.rank,
  }));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProPromagenClient({
  exchangeCatalog,
  fxCatalog,
  indicesCatalog,
  defaultExchangeIds,
  defaultFxPairIds,
  defaultIndicesIds,
  demoWeatherIndex,
  providers = [],
}: ProPromagenClientProps) {
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

  const isPaidUser = userTier === 'paid';

  // ============================================================================
  // STATE - Selection (Fixed initialization)
  // ============================================================================

  // Initialize with defaults first (SSR-safe)
  const [selectedFxPairs, setSelectedFxPairs] = useState<string[]>(defaultFxPairIds);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(defaultExchangeIds);
  const [selectedIndices, setSelectedIndices] = useState<string[]>(defaultIndicesIds);
  const [selectedPromptTier, setSelectedPromptTier] = useState<PromptTier>(4);

  // Track if we've loaded from storage (to detect changes)
  const [initialFx, setInitialFx] = useState<string[]>(defaultFxPairIds);
  const [initialExchanges, setInitialExchanges] = useState<string[]>(defaultExchangeIds);
  const [initialIndices, setInitialIndices] = useState<string[]>(defaultIndicesIds);
  const [hydrated, setHydrated] = useState(false);

  // ============================================================================
  // STATE - Fullscreen Pickers (v2.3.0 Exchange, v2.6.0 FX)
  // ============================================================================
  // When true, entire centre panel shows ONLY the respective Picker
  // No headers, no badges, no comparison table, no CTA - just the picker
  // ============================================================================
  const [isExchangePickerFullscreen, setIsExchangePickerFullscreen] = useState(false);
  const [isFxPickerFullscreen, setIsFxPickerFullscreen] = useState(false);

  // Load from localStorage after hydration (client-side only)
  useEffect(() => {
    if (hydrated) return;

    const storedFx = loadArrayFromStorage(STORAGE_KEYS.FX_SELECTION);
    const storedExchanges = loadArrayFromStorage(STORAGE_KEYS.EXCHANGE_SELECTION);
    const storedIndices = loadArrayFromStorage(STORAGE_KEYS.INDICES_SELECTION);

    // Load prompt tier (single value, not array)
    try {
      const storedTier = localStorage.getItem(STORAGE_KEYS.PROMPT_TIER);
      if (storedTier !== null) {
        const parsed = JSON.parse(storedTier) as number;
        if ([1, 2, 3, 4].includes(parsed)) {
          setSelectedPromptTier(parsed as PromptTier);
        }
      }
    } catch {
      // Ignore parse errors
    }

    // If storage has values (including empty array), use them
    // Otherwise keep defaults
    if (storedFx !== null) {
      setSelectedFxPairs(storedFx);
      setInitialFx(storedFx);
    }
    if (storedExchanges !== null) {
      setSelectedExchanges(storedExchanges);
      setInitialExchanges(storedExchanges);
    }
    if (storedIndices !== null) {
      setSelectedIndices(storedIndices);
      setInitialIndices(storedIndices);
    }

    setHydrated(true);
  }, [hydrated]);

  // Detect changes from initial state
  const hasChanges = useMemo(() => {
    if (!hydrated) return false;
    const fxChanged =
      JSON.stringify([...selectedFxPairs].sort()) !== JSON.stringify([...initialFx].sort());
    const exchChanged =
      JSON.stringify([...selectedExchanges].sort()) !==
      JSON.stringify([...initialExchanges].sort());
    const indicesChanged =
      JSON.stringify([...selectedIndices].sort()) !== JSON.stringify([...initialIndices].sort());
    return fxChanged || exchChanged || indicesChanged;
  }, [
    selectedFxPairs,
    selectedExchanges,
    selectedIndices,
    initialFx,
    initialExchanges,
    initialIndices,
    hydrated,
  ]);

  // ============================================================================
  // DERIVED DATA - Dropdown options with country labels
  // ============================================================================

  // FX options for dropdown with country names as subLabels (legacy format)
  const fxOptions = useMemo(() => {
    return fxCatalog.map((pair) => ({
      id: pair.id,
      label: `${pair.base}/${pair.quote}`,
      subLabel: pair.countryLabel,
    }));
  }, [fxCatalog]);

  // FX picker options - converted from catalog (v2.6.0)
  const fxPickerOptions = useMemo(() => {
    return catalogToFxPickerOptions(fxCatalog);
  }, [fxCatalog]);

  // Exchange options for dropdown with country as subLabel
  const exchangeOptions = useMemo(() => {
    return exchangeCatalog.map((exch) => ({
      id: exch.id,
      label: `${exch.exchange} (${exch.city})`,
      subLabel: exch.country,
    }));
  }, [exchangeCatalog]);

  // Indices options for dropdown with exchange name as subLabel
  // Only show indices for currently selected exchanges
  const indicesOptions = useMemo(() => {
    // Filter to only exchanges that are currently selected AND have marketstack data
    const availableIndices = indicesCatalog.filter((idx) => selectedExchanges.includes(idx.id));

    return availableIndices.map((idx) => ({
      id: idx.id,
      label: idx.indexName,
      subLabel: `${idx.exchangeName} — ${idx.country}`,
      status: idx.status,
    }));
  }, [indicesCatalog, selectedExchanges]);

  // Exchange picker options - converted from catalog (v2.3.0)
  const exchangePickerOptions = useMemo(() => {
    return catalogToPickerOptions(exchangeCatalog);
  }, [exchangeCatalog]);

  // ============================================================================
  // SYNC INDICES WHEN EXCHANGES CHANGE
  // ============================================================================
  // When an exchange is removed, also remove it from indices selection
  // When exchanges change, filter indices to only include valid exchanges

  useEffect(() => {
    if (!hydrated) return;

    // Filter indices to only include exchanges that are still selected
    const validIndices = selectedIndices.filter(
      (id) => selectedExchanges.includes(id) && indicesCatalog.some((idx) => idx.id === id),
    );

    // Only update if there's a change
    if (validIndices.length !== selectedIndices.length) {
      setSelectedIndices(validIndices);
      saveToStorage(STORAGE_KEYS.INDICES_SELECTION, validIndices);
    }
  }, [selectedExchanges, indicesCatalog, hydrated, selectedIndices]);

  // ============================================================================
  // DEMO FX DATA - Filter catalog to selected pairs for ribbon
  // ============================================================================

  const demoFxPairs = useMemo(() => {
    // Get selected pairs from catalog in selection order
    return selectedFxPairs
      .map((id) => fxCatalog.find((p) => p.id === id))
      .filter((p): p is FxPairCatalogEntry => p !== undefined);
  }, [selectedFxPairs, fxCatalog]);

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
  // HANDLERS
  // ============================================================================

  const handleFxChange = useCallback((ids: string[]) => {
    // Validate count (allows 0 to max)
    if (ids.length < PRO_SELECTION_LIMITS.FX_MIN || ids.length > PRO_SELECTION_LIMITS.FX_MAX) {
      return;
    }
    setSelectedFxPairs(ids);
    // Auto-save to localStorage on every change
    saveToStorage(STORAGE_KEYS.FX_SELECTION, ids);
  }, []);

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

  const handleIndicesChange = useCallback((ids: string[]) => {
    // Validate count (allows 0 to max)
    if (
      ids.length < PRO_SELECTION_LIMITS.INDICES_MIN ||
      ids.length > PRO_SELECTION_LIMITS.INDICES_MAX
    ) {
      return;
    }
    setSelectedIndices(ids);
    // Auto-save to localStorage on every change
    saveToStorage(STORAGE_KEYS.INDICES_SELECTION, ids);
  }, []);

  const handlePromptTierChange = useCallback((tier: PromptTier) => {
    setSelectedPromptTier(tier);
    // Auto-save to localStorage on every change
    saveToStorage(STORAGE_KEYS.PROMPT_TIER, tier);
  }, []);

  const handleSave = useCallback(async () => {
    // Save is already done on each change, but this confirms to user
    saveToStorage(STORAGE_KEYS.FX_SELECTION, selectedFxPairs);
    saveToStorage(STORAGE_KEYS.EXCHANGE_SELECTION, selectedExchanges);
    saveToStorage(STORAGE_KEYS.INDICES_SELECTION, selectedIndices);

    // Update initial state to reflect saved state
    setInitialFx(selectedFxPairs);
    setInitialExchanges(selectedExchanges);
    setInitialIndices(selectedIndices);

    // TODO: Sync to Clerk metadata (debounced)
    // TODO: POST to /api/indices with { exchangeIds: selectedIndices, tier: 'paid' }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, [selectedFxPairs, selectedExchanges, selectedIndices]);

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
  // FULLSCREEN FX PICKER HANDLERS (v2.6.0)
  // ============================================================================

  const handleOpenFxPicker = useCallback(() => {
    setIsFxPickerFullscreen(true);
  }, []);

  const handleCloseFxPicker = useCallback(() => {
    setIsFxPickerFullscreen(false);
  }, []);

  // ============================================================================
  // CENTRE CONTENT - Conditional rendering based on fullscreen picker state
  // ============================================================================
  // v2.6.0: Support for both Exchange and FX picker fullscreen modes
  // v2.3.0: When picker is fullscreen, show ONLY the picker
  // Otherwise show normal comparison table with headers, badges, CTA
  // ============================================================================

  const centreContent = isFxPickerFullscreen ? (
    // ========================================================================
    // FULLSCREEN FX PICKER MODE (v2.6.0)
    // Entire centre panel dedicated to FX pair selection
    // ========================================================================
    <section
      aria-label="Select FX Pairs"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      data-testid="fx-picker-fullscreen"
    >
      {/* Picker fills the available space - child handles its own scrolling */}
      <div className="min-h-0 flex-1">
        <FxPicker
          pairs={fxPickerOptions}
          selected={selectedFxPairs}
          onChange={handleFxChange}
          min={PRO_SELECTION_LIMITS.FX_MIN}
          max={PRO_SELECTION_LIMITS.FX_MAX}
          disabled={false}
        />
      </div>

      {/* Done Button - Canonical sky-emerald gradient for FX */}
      <div className="shrink-0 border-t border-white/10 bg-slate-900/50 p-4">
        <button
          type="button"
          onClick={handleCloseFxPicker}
          className="
            w-full inline-flex items-center justify-center gap-2 rounded-full
            border border-sky-500/70 bg-gradient-to-r from-sky-600/20 to-emerald-600/20
            px-6 py-3 text-sm font-medium text-sky-100 shadow-sm
            transition-all duration-200
            hover:from-sky-600/30 hover:to-emerald-600/30 hover:border-sky-400
            focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
          "
        >
          {/* Checkmark icon */}
          <svg
            className="w-4 h-4 text-sky-100"
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
  ) : isExchangePickerFullscreen ? (
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
    // NORMAL MODE - Comparison table with headers, badges, CTA
    // ========================================================================
    <section
      aria-label="Pro Promagen Configuration"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="pro-promagen-panel"
    >
      {/* Header */}
      <header className="shrink-0 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-amber-400">★</span>
            Pro Promagen
          </h2>
          <a href="/" className="text-xs text-white/40 hover:text-white/60 transition-colors">
            ← Back to Home
          </a>
        </div>
        <p className="text-sm text-white/50">
          {isPaidUser
            ? 'Configure your personalized market view'
            : 'Preview Pro features — try before you buy'}
        </p>
      </header>

      {/* Mode Badge */}
      <div className="shrink-0 mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full ring-1 ${
            isPaidUser
              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 ring-amber-500/30'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {isPaidUser ? 'Configuration Mode' : 'Preview Mode'}
        </span>
      </div>

      {/* Comparison Table - Scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <ComparisonTable
          selectedFxPairs={selectedFxPairs}
          selectedExchanges={selectedExchanges}
          selectedIndices={selectedIndices}
          selectedPromptTier={selectedPromptTier}
          onFxChange={handleFxChange}
          onExchangeChange={handleExchangeChange}
          onIndicesChange={handleIndicesChange}
          onPromptTierChange={handlePromptTierChange}
          fxOptions={fxOptions}
          exchangeOptions={exchangeOptions}
          indicesOptions={indicesOptions}
          isPaidUser={isPaidUser}
          // NEW v2.2.0: Pass full exchange catalog for ExchangePicker
          exchangeCatalog={exchangeCatalog}
          // NEW v2.3.0: Callback to trigger fullscreen exchange picker mode
          onOpenExchangePicker={handleOpenExchangePicker}
          // NEW v2.6.0: Callback to trigger fullscreen FX picker mode
          onOpenFxPicker={handleOpenFxPicker}
        />
      </div>

      {/* Save/Upgrade CTA */}
      <div className="shrink-0 mt-auto pt-4">
        <UpgradeCta isPaidUser={isPaidUser} onSave={handleSave} hasChanges={hasChanges} />
      </div>
    </section>
  );

  // ============================================================================
  // EXCHANGE RAILS
  // ============================================================================

  const leftExchanges = (
    <ExchangeList
      exchanges={leftRail}
      weatherByExchange={weatherDataMap}
      emptyMessage="No eastern exchanges selected"
    />
  );

  const rightExchanges = (
    <ExchangeList
      exchanges={rightRail}
      weatherByExchange={weatherDataMap}
      emptyMessage="No western exchanges selected"
    />
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;
  const showFxRibbon = selectedFxPairs.length > 0;

  return (
    <HomepageGrid
      mainLabel="Pro Promagen Configuration"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon={showFxRibbon}
      // Pass demo mode and demo pairs for static ribbon
      demoMode={true}
      demoPairs={demoFxPairs}
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
      weatherIndex={weatherDataMap}
      isProPromagenPage={true}
    />
  );
}
