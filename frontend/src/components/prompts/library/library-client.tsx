// src/components/prompts/library/library-client.tsx
// ============================================================================
// LIBRARY CLIENT (v2.0.0)
// ============================================================================
// Client component for the /studio/library page.
// Uses HomepageGrid layout with exchange rails, Engine Bay, and Mission Control.
//
// UPDATED v2.0.0 (28 Jan 2026): Full Engine Bay & Mission Control integration
// - Added providers prop for Engine Bay icon grid
// - Passes showEngineBay={true} and showMissionControl={true} to HomepageGrid
// - Passes isStudioSubPage={true} for 4-button Mission Control layout
// - Uses live weather from gateway (ExchangeWeatherData type)
// - Added useWeather hook for client-side weather updates
// - All existing functionality preserved
//
// Authority: docs/authority/prompt-intelligence.md §9.2
// Security: 10/10 — All external data validated, type-safe transformations
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useExchangeSelection } from '@/hooks/use-exchange-selection';
import { useIndicesQuotes } from '@/hooks/use-indices-quotes';
import { useWeather } from '@/hooks/use-weather';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import { getRailsRelative } from '@/lib/location';
import { LibraryFilters } from './library-filters';
import { PromptLibraryGrid } from './prompt-library-grid';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';
import type { SavedPrompt } from '@/types/saved-prompt';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface LibraryClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID (from gateway API) */
  weatherIndex: Map<string, ExchangeWeatherData>;
  /** All AI providers for Engine Bay */
  providers: Provider[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Filter exchanges to only include selected ones.
 * Maintains the original order from the selectedIds array.
 */
function filterToSelected(
  allExchanges: ReadonlyArray<Exchange>,
  selectedIds: string[],
): Exchange[] {
  if (!selectedIds.length) return [...allExchanges];

  const byId = new Map(allExchanges.map((e) => [e.id, e]));
  const result: Exchange[] = [];

  for (const id of selectedIds) {
    const exchange = byId.get(id);
    if (exchange) {
      result.push(exchange);
    }
  }

  return result;
}

/**
 * Convert IndexQuote from hook to IndexQuoteData for card display.
 * Validates all values before returning.
 */
function toIndexQuoteData(
  quote:
    | {
        indexName?: string | null;
        price?: number | null;
        change?: number | null;
        percentChange?: number | null;
      }
    | null
    | undefined,
  movement:
    | {
        tick?: 'up' | 'down' | 'flat';
      }
    | null
    | undefined,
): IndexQuoteData | null {
  if (!quote) return null;

  const indexName = typeof quote.indexName === 'string' ? quote.indexName : null;
  const price =
    typeof quote.price === 'number' && Number.isFinite(quote.price) ? quote.price : null;
  const change =
    typeof quote.change === 'number' && Number.isFinite(quote.change) ? quote.change : null;
  const percentChange =
    typeof quote.percentChange === 'number' && Number.isFinite(quote.percentChange)
      ? quote.percentChange
      : null;

  if (!indexName || price === null) return null;

  return {
    indexName,
    price,
    change: change ?? 0,
    percentChange: percentChange ?? 0,
    tick: movement?.tick ?? 'flat',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LibraryClient({
  exchanges,
  weatherIndex,
  providers,
}: LibraryClientProps) {
  const router = useRouter();
  const {
    isAuthenticated,
    userTier,
    locationInfo,
    setReferenceFrame,
  } = usePromagenAuth();

  // Live weather (client) — updates after hydration
  const { weather: liveWeatherById } = useWeather();

  const liveWeatherIndex = useMemo(() => {
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
      });
    }
    return map;
  }, [liveWeatherById]);

  const effectiveWeatherIndex = liveWeatherIndex.size ? liveWeatherIndex : weatherIndex;

  // Get user's exchange selection (tier-aware)
  const {
    exchangeIds: selectedExchangeIds,
    isCustomSelection,
    isLoading: isSelectionLoading,
  } = useExchangeSelection();

  // Fetch index quotes with user's selection
  const { quotesById, movementById } = useIndicesQuotes({
    enabled: true,
    exchangeIds: userTier === 'paid' && isCustomSelection ? selectedExchangeIds : undefined,
    userTier,
  });

  // Track displayed provider IDs for market pulse
  const [displayedProviderIds, setDisplayedProviderIds] = useState<string[]>([]);

  // Saved prompts hook
  const {
    filteredPrompts,
    filters,
    stats,
    isLoading,
    deletePrompt,
    setFilters,
    resetFilters,
    exportPrompts,
    importPrompts,
  } = useSavedPrompts();

  // Toast state for feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ============================================================================
  // EXCHANGE FILTERING & ORDERING
  // ============================================================================

  const selectedExchanges = useMemo(() => {
    return filterToSelected(exchanges, selectedExchangeIds);
  }, [exchanges, selectedExchangeIds]);

  const { left, right } = useMemo(() => {
    return getRailsRelative(selectedExchanges, locationInfo.coordinates);
  }, [selectedExchanges, locationInfo.coordinates]);

  const allOrderedExchanges = useMemo(() => {
    return [...left, ...right.slice().reverse()];
  }, [left, right]);

  // ============================================================================
  // INDEX DATA MAP
  // ============================================================================

  const indexByExchange = useMemo(() => {
    const map = new Map<string, IndexQuoteData>();

    for (const [exchangeId, quote] of quotesById.entries()) {
      const movement = movementById.get(exchangeId);
      const data = toIndexQuoteData(quote, movement);
      if (data) {
        map.set(exchangeId, data);
      }
    }

    return map;
  }, [quotesById, movementById]);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  const providerIds = useMemo(() => providers.map((p) => p.id), [providers]);

  // Suppress unused variable warnings
  void setDisplayedProviderIds;
  void isSelectionLoading;

  // Load prompt into builder
  const handleLoad = useCallback(
    (prompt: SavedPrompt) => {
      sessionStorage.setItem('promagen_load_prompt', JSON.stringify(prompt));
      router.push(`/providers/${prompt.platformId}/prompt-builder`);
    },
    [router]
  );

  // Delete prompt
  const handleDelete = useCallback(
    (id: string) => {
      const success = deletePrompt(id);
      if (success) {
        setToast({ message: 'Prompt deleted', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      }
    },
    [deletePrompt]
  );

  // Export prompts
  const handleExport = useCallback(() => {
    const json = exportPrompts();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promagen-prompts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Prompts exported', type: 'success' });
    setTimeout(() => setToast(null), 2000);
  }, [exportPrompts]);

  // Import prompts
  const handleImport = useCallback(
    (json: string) => {
      const result = importPrompts(json);
      if (result.imported > 0) {
        setToast({
          message: `Imported ${result.imported} prompt${result.imported === 1 ? '' : 's'}`,
          type: 'success',
        });
      } else if (result.errors > 0) {
        setToast({ message: 'Failed to import prompts', type: 'error' });
      }
      setTimeout(() => setToast(null), 3000);
    },
    [importPrompts]
  );

  // ============================================================================
  // UI CONTENT
  // ============================================================================

  // Centre content: Library panel
  const centreContent = (
    <section
      aria-label="Prompt library"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="library-panel"
    >
      {/* Header */}
      <header className="shrink-0 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">Your Saved Prompts</h2>
          <a
            href="/studio"
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            ← Back to Studio
          </a>
        </div>
        <p className="text-sm text-white/50">
          Save, organise, and reload your favourite prompts
        </p>
      </header>

      {/* Filters */}
      <div className="shrink-0 mb-4">
        <LibraryFilters
          filters={filters}
          stats={stats}
          onFiltersChange={setFilters}
          onReset={resetFilters}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>

      {/* Grid - scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <PromptLibraryGrid
          prompts={filteredPrompts}
          isLoading={isLoading}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm z-50 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );

  // Exchange lists with live weather and index data
  const leftExchanges = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={left}
        weatherByExchange={effectiveWeatherIndex}
        indexByExchange={indexByExchange}
        emptyMessage="No eastern exchanges selected yet."
        side="left"
      />
    </div>
  );

  const rightExchanges = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={right}
        weatherByExchange={effectiveWeatherIndex}
        indexByExchange={indexByExchange}
        emptyMessage="No western exchanges selected yet."
        side="right"
      />
    </div>
  );

  // Location loading
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  return (
    <HomepageGrid
      mainLabel="Prompt Library"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
      exchanges={allOrderedExchanges}
      displayedProviderIds={displayedProviderIds.length > 0 ? displayedProviderIds : providerIds}
      isPaidUser={userTier === 'paid'}
      isAuthenticated={isAuthenticated}
      referenceFrame={locationInfo.referenceFrame}
      onReferenceFrameChange={setReferenceFrame}
      isLocationLoading={effectiveLocationLoading}
      cityName={locationInfo.cityName}
      countryCode={locationInfo.countryCode}
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={effectiveWeatherIndex}
      isStudioSubPage
    />
  );
}
