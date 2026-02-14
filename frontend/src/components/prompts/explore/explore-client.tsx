// src/components/prompts/explore/explore-client.tsx
// ============================================================================
// EXPLORE CLIENT (v2.0.0)
// ============================================================================
// Client component for the /studio/explore page.
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
import { getRailsRelative } from '@/lib/location';
import { ExploreFilters } from './explore-filters';
import { FamilyGrid } from './family-grid';
import { FamilyDetailPanel } from './family-detail-panel';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';
import type { StyleFamily, ExploreFilters as Filters } from '@/types/style-family';
import { DEFAULT_EXPLORE_FILTERS } from '@/types/style-family';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface ExploreClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID (from gateway API) */
  weatherIndex: Map<string, ExchangeWeatherData>;
  /** All AI providers for Engine Bay */
  providers: Provider[];
  /** All style families */
  families: StyleFamily[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Filter exchanges to only include selected ones.
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

function filterFamilies(families: StyleFamily[], filters: Filters): StyleFamily[] {
  return families.filter((family) => {
    // Mood filter
    if (filters.mood !== 'all' && family.mood !== filters.mood) {
      return false;
    }

    // Search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      const searchable = [
        family.id,
        family.displayName,
        family.description,
        ...family.members,
        ...family.suggestedColours,
        ...family.suggestedLighting,
        ...family.suggestedAtmosphere,
      ]
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

function sortFamilies(
  families: StyleFamily[],
  sortBy: Filters['sortBy'],
  sortDirection: Filters['sortDirection'],
): StyleFamily[] {
  const moodOrder: Record<'calm' | 'intense' | 'neutral', number> = {
    calm: 0,
    neutral: 1,
    intense: 2,
  };

  return [...families].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.displayName.localeCompare(b.displayName);
        break;
      case 'members':
        comparison = a.members.length - b.members.length;
        break;
      case 'mood':
        comparison = (moodOrder[a.mood] ?? 1) - (moodOrder[b.mood] ?? 1);
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ExploreClient({
  exchanges,
  weatherIndex,
  providers,
  families,
}: ExploreClientProps) {
  const router = useRouter();
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

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
        sunriseUtc: w.sunriseUtc ?? undefined,
        sunsetUtc: w.sunsetUtc ?? undefined,
        timezoneOffset: w.timezoneOffset ?? undefined,
        isDayTime: w.isDayTime ?? undefined,
      });
    }
    return map;
  }, [liveWeatherById]);

  // Merge live weather ON TOP of SSR weather (which includes demo fallback).
  // Old logic: replace all if ANY live data exists → loses demo fills for
  // exchanges not in current batch. New: overlay live onto SSR base.
  const effectiveWeatherIndex = useMemo(() => {
    if (liveWeatherIndex.size === 0) return weatherIndex;
    const merged = new Map(weatherIndex); // start with SSR (includes demo fills)
    for (const [id, data] of liveWeatherIndex) {
      merged.set(id, data); // live overrides where available
    }
    return merged;
  }, [liveWeatherIndex, weatherIndex]);

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

  // Filter state
  const [filters, setFilters] = useState<Filters>(DEFAULT_EXPLORE_FILTERS);

  // Selected family for detail view
  const [selectedFamily, setSelectedFamily] = useState<StyleFamily | null>(null);

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
  // FILTERED FAMILIES
  // ============================================================================

  const filteredFamilies = useMemo(() => {
    const filtered = filterFamilies(families, filters);
    return sortFamilies(filtered, filters.sortBy, filters.sortDirection);
  }, [families, filters]);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  const providerIds = useMemo(() => providers.map((p) => p.id), [providers]);

  // Suppress unused variable warnings
  void setDisplayedProviderIds;
  void isSelectionLoading;

  const handleFiltersChange = useCallback((newFilters: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_EXPLORE_FILTERS);
  }, []);

  const handleSelectFamily = useCallback((family: StyleFamily) => {
    setSelectedFamily(family);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedFamily(null);
  }, []);

  const handleUseInBuilder = useCallback(
    (terms: string[]) => {
      sessionStorage.setItem('promagen_explore_terms', JSON.stringify(terms));
      router.push('/providers');
    },
    [router],
  );

  // ============================================================================
  // UI CONTENT
  // ============================================================================

  // Centre content: Explore panel with grid or detail view
  const centreContent = (
    <section
      aria-label="Style families explorer"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="explore-panel"
    >
      {selectedFamily ? (
        // Detail view
        <FamilyDetailPanel
          family={selectedFamily}
          onClose={handleCloseDetail}
          onUseInBuilder={handleUseInBuilder}
        />
      ) : (
        // Grid view
        <>
          {/* Header */}
          <header className="shrink-0 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">Explore Style Families</h2>
              <a
                href="/studio"
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                ← Back to Studio
              </a>
            </div>
            <p className="text-sm text-white/50">
              Discover aesthetic styles and find inspiration for your prompts
            </p>
          </header>

          {/* Filters */}
          <div className="shrink-0 mb-4">
            <ExploreFilters
              filters={filters}
              totalFamilies={families.length}
              filteredCount={filteredFamilies.length}
              onFiltersChange={handleFiltersChange}
              onReset={handleResetFilters}
            />
          </div>

          {/* Grid - scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
            <FamilyGrid
              families={filteredFamilies}
              isLoading={false}
              onSelect={handleSelectFamily}
            />
          </div>
        </>
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
      mainLabel="Explore Style Families"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon={false}
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
