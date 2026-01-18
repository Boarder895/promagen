// src/components/prompts/learn/learn-client.tsx
// ============================================================================
// LEARN CLIENT
// ============================================================================
// Client component for the /studio/learn page.
// Features:
// - AI Platform dropdown (42 platforms, 123rf last)
// - "Explore Styles" button → /studio/explore
// - "Build with [Platform]" button (conditional) → /providers/[id]
// - 12 guides (1:1 with Prompt Builder categories)
// - 4 tier info boxes (all shown if no platform, 1 shown if platform selected)
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { getRailsRelative } from '@/lib/location';
import { LearnFilters } from './learn-filters';
import { GuideCard } from './guide-card';
import { GuideDetailPanel } from './guide-detail-panel';
import { QuickTipCard } from './quick-tip-card';
import { TierInfoBoxes } from './tier-info-boxes';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { LearnGuide, QuickTip, LearnFilters as Filters } from '@/types/learn-content';
import { DEFAULT_LEARN_FILTERS } from '@/types/learn-content';
import { getGuideById } from '@/data/learn-guides';
import { getPlatformTier } from '@/data/platform-tiers';

// ============================================================================
// TYPES
// ============================================================================

export interface LearnClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex: Map<string, ExchangeWeather>;
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
  // EXCHANGE ORDERING
  // ============================================================================

  const { left, right } = useMemo(() => {
    return getRailsRelative(exchanges, locationInfo.coordinates);
  }, [exchanges, locationInfo.coordinates]);

  const allOrderedExchanges = useMemo(() => {
    return [...left, ...right.slice().reverse()];
  }, [left, right]);

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
  // HANDLERS
  // ============================================================================

  const handleFiltersChange = useCallback((newFilters: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
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
      mainLabel="Learn Prompt Engineering"
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
