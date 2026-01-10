// src/app/pro-promagen/pro-promagen-client.tsx
// ============================================================================
// PRO PROMAGEN CLIENT - SIMPLIFIED VERSION
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
// FIXES APPLIED:
// - State initialization no longer depends on isPaidUser (was causing reset bug)
// - Uses DemoFinanceRibbon instead of live API ribbon
// - Empty array [] is properly persisted and restored
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
} from '@/lib/pro-promagen/types';
import type { Exchange, Hemisphere } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';

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
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  FX_SELECTION: 'promagen:pro:fx-selection',
  EXCHANGE_SELECTION: 'promagen:pro:exchange-selection',
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
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProPromagenClient({
  exchangeCatalog,
  fxCatalog,
  defaultExchangeIds,
  defaultFxPairIds,
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
  
  // Track if we've loaded from storage (to detect changes)
  const [initialFx, setInitialFx] = useState<string[]>(defaultFxPairIds);
  const [initialExchanges, setInitialExchanges] = useState<string[]>(defaultExchangeIds);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage after hydration (client-side only)
  useEffect(() => {
    if (hydrated) return;
    
    const storedFx = loadArrayFromStorage(STORAGE_KEYS.FX_SELECTION);
    const storedExchanges = loadArrayFromStorage(STORAGE_KEYS.EXCHANGE_SELECTION);
    
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
    return fxChanged || exchChanged;
  }, [selectedFxPairs, selectedExchanges, initialFx, initialExchanges, hydrated]);

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

  const handleSave = useCallback(async () => {
    // Save is already done on each change, but this confirms to user
    saveToStorage(STORAGE_KEYS.FX_SELECTION, selectedFxPairs);
    saveToStorage(STORAGE_KEYS.EXCHANGE_SELECTION, selectedExchanges);
    
    // Update initial state to reflect saved state
    setInitialFx(selectedFxPairs);
    setInitialExchanges(selectedExchanges);

    // TODO: Sync to Clerk metadata (debounced)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, [selectedFxPairs, selectedExchanges]);

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
          selectedFxPairs={selectedFxPairs}
          selectedExchanges={selectedExchanges}
          onFxChange={handleFxChange}
          onExchangeChange={handleExchangeChange}
          isPaidUser={isPaidUser}
        />
      </div>

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
