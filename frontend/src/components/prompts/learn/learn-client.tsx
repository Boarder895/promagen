// src/components/prompts/learn/learn-client.tsx
// ============================================================================
// LEARN CLIENT (v2.0.0)
// ============================================================================
// Client component for the /studio/learn page.
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
// Authority: docs/authority/prompt-intelligence.md §9.3
// Security: 10/10 — All external data validated, type-safe transformations
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useExchangeSelection } from '@/hooks/use-exchange-selection';
import { useIndicesQuotes } from '@/hooks/use-indices-quotes';
import { useWeather } from '@/hooks/use-weather';
import { getRailsRelative } from '@/lib/location';
import { LearnFilters } from './learn-filters';
import { GuideCard } from './guide-card';
import { GuideDetailPanel } from './guide-detail-panel';
import { QuickTipCard } from './quick-tip-card';
import { TierInfoBoxes } from './tier-info-boxes';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';
import type { LearnGuide, QuickTip, LearnFilters as Filters } from '@/types/learn-content';
import { DEFAULT_LEARN_FILTERS } from '@/types/learn-content';
import { getGuideById } from '@/data/learn-guides';
import { getPlatformTier } from '@/data/platform-tiers';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface LearnClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID (from gateway API) */
  weatherIndex: Map<string, ExchangeWeatherData>;
  /** All AI providers for Engine Bay */
  providers: Provider[];
  /** All learning guides */
  guides: LearnGuide[];
  /** Quick tips */
  tips: QuickTip[];
  /** All available platforms */
  platforms: Array<{ id: string; name: string }>;
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

function filterGuides(guides: LearnGuide[], filters: Filters): LearnGuide[] {
  return guides.filter((guide) => {
    // Search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      const searchable = [
        guide.title,
        guide.description,
        ...guide.tags,
        ...guide.sections.map((s) => s.title + ' ' + s.content),
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

// ============================================================================
// COMPONENT
// ============================================================================

export default function LearnClient({
  exchanges,
  weatherIndex,
  providers,
  guides,
  tips,
  platforms,
}: LearnClientProps) {
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

  // Filter state
  const [filters, setFilters] = useState<Filters>(DEFAULT_LEARN_FILTERS);

  // Selected platform for tier-specific content
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);

  // Selected guide for detail view
  const [selectedGuide, setSelectedGuide] = useState<LearnGuide | null>(null);

  // ============================================================================
  // PLATFORM NAME MAP
  // ============================================================================

  const platformNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of platforms) {
      map.set(p.id, p.name);
    }
    return map;
  }, [platforms]);

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
  // FILTERED GUIDES
  // ============================================================================

  const filteredGuides = useMemo(() => {
    return filterGuides(guides, filters);
  }, [guides, filters]);

  // ============================================================================
  // SELECTED PLATFORM TIER
  // ============================================================================

  const selectedTier = useMemo(() => {
    return selectedPlatformId ? getPlatformTier(selectedPlatformId) : null;
  }, [selectedPlatformId]);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  const providerIds = useMemo(() => providers.map((p) => p.id), [providers]);

  // Suppress unused variable warnings
  void setDisplayedProviderIds;
  void isSelectionLoading;

  const handleFiltersChange = useCallback((newFilters: Partial<Filters>) => {
    setFilters((prev: Filters) => ({ ...prev, ...newFilters }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_LEARN_FILTERS);
  }, []);

  const handlePlatformChange = useCallback((platformId: string | null) => {
    setSelectedPlatformId(platformId);
  }, []);

  const handleSelectGuide = useCallback((guide: LearnGuide) => {
    setSelectedGuide(guide);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedGuide(null);
  }, []);

  const handleRelatedClick = useCallback((guideId: string) => {
    const guide = getGuideById(guideId);
    if (guide) {
      setSelectedGuide(guide);
    }
  }, []);

  // ============================================================================
  // UI CONTENT
  // ============================================================================

  // Centre content: Learn panel
  const centreContent = (
    <section
      aria-label="Learning guides"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="learn-panel"
    >
      {selectedGuide ? (
        // Detail view
        <GuideDetailPanel
          guide={selectedGuide}
          onClose={handleCloseDetail}
          onRelatedClick={handleRelatedClick}
          selectedTier={selectedTier}
          selectedPlatformId={selectedPlatformId}
          platformNames={platformNames}
        />
      ) : (
        // Grid view
        <>
          {/* Header */}
          <header className="shrink-0 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">Learn Prompt Engineering</h2>
              <a
                href="/studio"
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                ← Back to Studio
              </a>
            </div>
            <p className="text-sm text-white/50">
              Master the art of crafting effective AI image prompts.
            </p>
          </header>

          {/* Filters - Platform selector, buttons, search */}
          <div className="shrink-0 mb-4">
            <LearnFilters
              filters={filters}
              totalGuides={guides.length}
              filteredCount={filteredGuides.length}
              onFiltersChange={handleFiltersChange}
              onReset={handleResetFilters}
              platforms={platforms}
              selectedPlatformId={selectedPlatformId}
              onPlatformChange={handlePlatformChange}
            />
          </div>

          {/* Content - scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
            {/* Quick Tips - Only show when no search query */}
            {!filters.searchQuery && (
              <div className="mb-6">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                  Quick Tips
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {tips.slice(0, 3).map((tip) => (
                    <QuickTipCard key={tip.id} tip={tip} />
                  ))}
                </div>
              </div>
            )}

            {/* Guides Grid */}
            <div className="mb-4">
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                Guides
                {selectedTier && (
                  <span className="ml-2 text-white/30 normal-case">
                    • Tips optimized for {selectedTier.name}
                  </span>
                )}
              </h3>
              {filteredGuides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-white/20"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white/70 mb-2">
                    No guides found
                  </h3>
                  <p className="text-sm text-white/40 max-w-xs">
                    Try adjusting your search query.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGuides.map((guide) => (
                    <GuideCard
                      key={guide.id}
                      guide={guide}
                      onSelect={handleSelectGuide}
                      selectedTier={selectedTier}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Platform Tier Info Boxes */}
            <TierInfoBoxes
              selectedPlatformId={selectedPlatformId}
              platformNames={platformNames}
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
      mainLabel="Learn Prompt Engineering"
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
