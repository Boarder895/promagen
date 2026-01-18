// src/components/prompts/explore/explore-client.tsx
// ============================================================================
// EXPLORE CLIENT
// ============================================================================
// Client component for the /studio/explore page.
// Uses HomepageGrid layout with exchange rails.
// Authority: docs/authority/prompt-intelligence.md §9.2
// UPDATED: Back link now points to /studio (was /prompts).
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { getRailsRelative } from '@/lib/location';
import { ExploreFilters } from './explore-filters';
import { FamilyGrid } from './family-grid';
import { FamilyDetailPanel } from './family-detail-panel';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { StyleFamily, ExploreFilters as Filters } from '@/types/style-family';
import { DEFAULT_EXPLORE_FILTERS } from '@/types/style-family';

// ============================================================================
// TYPES
// ============================================================================

export interface ExploreClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex: Map<string, ExchangeWeather>;
  /** All style families */
  families: StyleFamily[];
}

// ============================================================================
// HELPERS
// ============================================================================

function filterFamilies(
  families: StyleFamily[],
  filters: Filters
): StyleFamily[] {
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
  sortDirection: Filters['sortDirection']
): StyleFamily[] {
  const moodOrder: Record<'calm' | 'intense' | 'neutral', number> = { 
    calm: 0, 
    neutral: 1, 
    intense: 2 
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
  families,
}: ExploreClientProps) {
  const router = useRouter();
  const {
    isAuthenticated,
    userTier,
    locationInfo,
    setReferenceFrame,
  } = usePromagenAuth();

  // Filter state
  const [filters, setFilters] = useState<Filters>(DEFAULT_EXPLORE_FILTERS);

  // Selected family for detail view
  const [selectedFamily, setSelectedFamily] = useState<StyleFamily | null>(null);

  // ============================================================================
  // EXCHANGE ORDERING
  // ============================================================================

  const { left, right } = useMemo(() => {
    return getRailsRelative(exchanges, locationInfo.coordinates);
  }, [exchanges, locationInfo.coordinates]);

  const allOrderedExchanges = useMemo(() => {
    return [...left, ...right.slice().reverse()];
  }, [left, right]);

  // ============================================================================
  // FILTERED FAMILIES
  // ============================================================================

  const filteredFamilies = useMemo(() => {
    const filtered = filterFamilies(families, filters);
    return sortFamilies(filtered, filters.sortBy, filters.sortDirection);
  }, [families, filters]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

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
      // Store selected terms in sessionStorage for the builder to pick up
      sessionStorage.setItem('promagen_explore_terms', JSON.stringify(terms));
      router.push('/providers');
    },
    [router]
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

  // Exchange lists
  const leftExchanges = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet."
    />
  );

  const rightExchanges = (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherIndex}
      emptyMessage="No western exchanges selected yet."
    />
  );

  // Location loading
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  return (
    <HomepageGrid
      mainLabel="Explore Style Families"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
      exchanges={allOrderedExchanges}
      displayedProviderIds={[]}
      isPaidUser={userTier === 'paid'}
      isAuthenticated={isAuthenticated}
      referenceFrame={locationInfo.referenceFrame}
      onReferenceFrameChange={setReferenceFrame}
      isLocationLoading={effectiveLocationLoading}
      cityName={locationInfo.cityName}
    />
  );
}
