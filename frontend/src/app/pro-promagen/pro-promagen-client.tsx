// src/app/pro-promagen/pro-promagen-client.tsx
// ============================================================================
// PRO PROMAGEN CLIENT - WITH INDICES SELECTION
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
// UPDATED: Added indices selection for controlling which exchange cards
// display stock index data (e.g., "Nikkei 225: 38,945.72 ▲ +312.45").
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { getRailsRelative } from '@/lib/location';
import { ComparisonTable, UpgradeCta } from '@/components/pro-promagen';
import {
  PRO_SELECTION_LIMITS,
  type FxPairCatalogEntry,
  type ExchangeCatalogEntry,
  type IndicesCatalogEntry,
} from '@/lib/pro-promagen/types';
import type { Exchange, Hemisphere } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

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
  _weather: ExchangeWeather | null
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
}: ProPromagenClientProps) {
  const {
    isAuthenticated,
    userTier,
    locationInfo,
    setReferenceFrame,
  } = usePromagenAuth();

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
      JSON.stringify([...selectedFxPairs].sort()) !==
      JSON.stringify([...initialFx].sort());
    const exchChanged =
      JSON.stringify([...selectedExchanges].sort()) !==
      JSON.stringify([...initialExchanges].sort());
    const indicesChanged =
      JSON.stringify([...selectedIndices].sort()) !==
      JSON.stringify([...initialIndices].sort());
    return fxChanged || exchChanged || indicesChanged;
  }, [selectedFxPairs, selectedExchanges, selectedIndices, initialFx, initialExchanges, initialIndices, hydrated]);

  // ============================================================================
  // DERIVED DATA - Dropdown options with country labels
  // ============================================================================

  // FX options for dropdown with country names as subLabels
  const fxOptions = useMemo(() => {
    return fxCatalog.map((pair) => ({
      id: pair.id,
      label: `${pair.base}/${pair.quote}`,
      subLabel: pair.countryLabel,
    }));
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
    const availableIndices = indicesCatalog.filter((idx) =>
      selectedExchanges.includes(idx.id)
    );

    return availableIndices.map((idx) => ({
      id: idx.id,
      label: idx.indexName,
      subLabel: `${idx.exchangeName} — ${idx.country}`,
      status: idx.status,
    }));
  }, [indicesCatalog, selectedExchanges]);

  // ============================================================================
  // SYNC INDICES WHEN EXCHANGES CHANGE
  // ============================================================================
  // When an exchange is removed, also remove it from indices selection
  // When exchanges change, filter indices to only include valid exchanges

  useEffect(() => {
    if (!hydrated) return;

    // Filter indices to only include exchanges that are still selected
    const validIndices = selectedIndices.filter((id) =>
      selectedExchanges.includes(id) &&
      indicesCatalog.some((idx) => idx.id === id)
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
      .map(id => fxCatalog.find(p => p.id === id))
      .filter((p): p is FxPairCatalogEntry => p !== undefined);
  }, [selectedFxPairs, fxCatalog]);

  // ============================================================================
  // PREVIEW EXCHANGES - Filter catalog by selection for rails
  // ============================================================================

  const previewExchanges = useMemo((): Exchange[] => {
    const filtered = exchangeCatalog.filter((e) =>
      selectedExchanges.includes(e.id)
    );
    filtered.sort((a, b) => a.longitude - b.longitude);
    return filtered.map((e) =>
      catalogToExchange(e, demoWeatherIndex.get(e.id) ?? null)
    );
  }, [exchangeCatalog, selectedExchanges, demoWeatherIndex]);

  // Split into left/right rails based on user location (or Greenwich)
  const { left: leftRail, right: rightRail } = useMemo(() => {
    return getRailsRelative(previewExchanges, locationInfo.coordinates);
  }, [previewExchanges, locationInfo.coordinates]);

  // Combined for HomepageGrid
  const allOrderedExchanges = useMemo(() => {
    return [...leftRail, ...rightRail.slice().reverse()];
  }, [leftRail, rightRail]);

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
    if (ids.length < PRO_SELECTION_LIMITS.EXCHANGE_MIN || ids.length > PRO_SELECTION_LIMITS.EXCHANGE_MAX) {
      return;
    }
    setSelectedExchanges(ids);
    // Auto-save to localStorage on every change
    saveToStorage(STORAGE_KEYS.EXCHANGE_SELECTION, ids);
  }, []);

  const handleIndicesChange = useCallback((ids: string[]) => {
    // Validate count (allows 0 to max)
    if (ids.length < PRO_SELECTION_LIMITS.INDICES_MIN || ids.length > PRO_SELECTION_LIMITS.INDICES_MAX) {
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
  // CENTRE CONTENT - Comparison table with dropdowns
  // ============================================================================

  const centreContent = (
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
          <a
            href="/"
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
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

      {/* Comparison Table with embedded dropdowns */}
      <div className="shrink-0 mb-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        <ComparisonTable
          fxOptions={fxOptions}
          exchangeOptions={exchangeOptions}
          indicesOptions={indicesOptions}
          selectedFxPairs={selectedFxPairs}
          selectedExchanges={selectedExchanges}
          selectedIndices={selectedIndices}
          selectedPromptTier={selectedPromptTier}
          onFxChange={handleFxChange}
          onExchangeChange={handleExchangeChange}
          onIndicesChange={handleIndicesChange}
          onPromptTierChange={handlePromptTierChange}
          isPaidUser={isPaidUser}
        />
      </div>

      {/* Indices Preview Summary */}
      {selectedIndices.length > 0 && (
        <div className="shrink-0 mb-4 px-3 py-2 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20">
          <p className="text-xs text-cyan-400">
            <span className="font-medium">📊 {selectedIndices.length} indices enabled:</span>{' '}
            <span className="text-cyan-400/70">
              {selectedIndices
                .slice(0, 5)
                .map((id) => indicesCatalog.find((idx) => idx.id === id)?.indexName)
                .filter(Boolean)
                .join(', ')}
              {selectedIndices.length > 5 && ` +${selectedIndices.length - 5} more`}
            </span>
          </p>
        </div>
      )}

      {/* CTA Button */}
      <div className="shrink-0 mt-auto pt-4">
        <UpgradeCta
          isPaidUser={isPaidUser}
          onSave={handleSave}
          hasChanges={hasChanges}
        />
      </div>
    </section>
  );

  // ============================================================================
  // EXCHANGE RAILS
  // ============================================================================

  const leftExchanges = (
    <ExchangeList
      exchanges={leftRail}
      weatherByExchange={demoWeatherIndex}
      emptyMessage="No eastern exchanges selected"
    />
  );

  const rightExchanges = (
    <ExchangeList
      exchanges={rightRail}
      weatherByExchange={demoWeatherIndex}
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
      // NEW: Pass demo mode and demo pairs for static ribbon
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
    />
  );
}
