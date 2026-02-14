// src/app/studio/studio-page-client.tsx
// ============================================================================
// STUDIO PAGE CLIENT COMPONENT (v2.0.0)
// ============================================================================
// Client component for the /studio page.
// Now uses HomepageGrid layout identical to homepage, with feature cards
// replacing the AI Providers Leaderboard in the centre column.
//
// UPDATED (26 Jan 2026): Complete refactor to use HomepageGrid
// - Uses same three-column layout as homepage
// - Engine Bay visible (left side)
// - Mission Control visible (right side) with Home button instead of Studio
// - Exchange rails with live data
// - Finance ribbons (FX, Commodities, Crypto)
// - Market Pulse overlay
// - Feature cards in centre column (Library, Explore, Learn, Playground)
//
// Authority: docs/authority/prompt-intelligence.md §9.3
// Security: 10/10 — All external data validated, type-safe transformations
// Existing features preserved: Yes (all homepage features now available)
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useIndicesQuotes } from '@/hooks/use-indices-quotes';
import { useExchangeSelection } from '@/hooks/use-exchange-selection';
import { useWeather } from '@/hooks/use-weather';
import { getRailsRelative } from '@/lib/location';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData, IndexQuoteData } from '@/components/exchanges/types';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface StudioPageClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID (from gateway API) */
  weatherIndex: Map<string, ExchangeWeatherData>;
  /** All AI providers */
  providers: Provider[];
}

// ============================================================================
// STUDIO FEATURE SECTIONS DATA
// ============================================================================

const studioSections = [
  {
    href: '/studio/library',
    title: 'Your Library',
    description: 'Save, organise, and reload your favourite prompts.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    available: true,
  },
  {
    href: '/studio/explore',
    title: 'Explore Styles',
    description: 'Discover style families and find inspiration for your next prompt.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    available: true,
  },
  {
    href: '/studio/learn',
    title: 'Learn Prompting',
    description: 'Master the art of prompt engineering with guides and examples.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    available: true,
  },
  {
    href: '/studio/playground',
    title: 'Playground',
    description: 'Test and experiment with prompts in real-time.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    available: true,
  },
];

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

  // Validate required fields
  const indexName = typeof quote.indexName === 'string' ? quote.indexName : null;
  const price =
    typeof quote.price === 'number' && Number.isFinite(quote.price) ? quote.price : null;
  const change =
    typeof quote.change === 'number' && Number.isFinite(quote.change) ? quote.change : null;
  const percentChange =
    typeof quote.percentChange === 'number' && Number.isFinite(quote.percentChange)
      ? quote.percentChange
      : null;

  // Must have at least name and price
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
// STUDIO FEATURE GRID COMPONENT
// ============================================================================

/**
 * StudioFeatureGrid - The 4 feature cards displayed in the centre column.
 * Styled to match the AI Providers Leaderboard container.
 * 
 * FIX v3.0.0: Using native <a> tags instead of Next.js Link for navigation.
 * Link wrapper approach was failing - possibly due to stacking context issues.
 */
function StudioFeatureGrid(): React.ReactElement {
  return (
    <section
      aria-label="Studio features"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="studio-feature-grid"
    >
      {/* Header - matches leaderboard header style */}
      <header className="mb-4 shrink-0">
        <h2 className="text-lg font-semibold text-white">Studio</h2>
        <p className="mt-1 text-sm text-slate-400">
          Build intelligent prompts with real-time suggestions, save your favourites, 
          and learn the art of prompt engineering.
        </p>
      </header>

      {/* Scrollable content area - matches leaderboard scroll pattern */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {studioSections.map((section) => {
            // Available sections get clickable anchor
            if (section.available) {
              return (
                <a
                  key={section.href}
                  href={section.href}
                  className="group relative block overflow-hidden rounded-2xl p-5 transition-all duration-500 cursor-pointer hover:ring-1 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  data-testid={`studio-card-${section.href.split('/').pop()}`}
                >
                  {/* Glow effect on hover */}
                  <div
                    className="absolute inset-0 transition-opacity duration-500 opacity-0 group-hover:opacity-100 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at 50% 0%, ${section.glow} 0%, transparent 70%)`,
                    }}
                  />

                  {/* Content wrapper - ensures content is above glow */}
                  <div className="relative z-10">
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.gradient} flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110`}
                    >
                      {section.icon}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-white mb-1.5">
                      {section.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-white/50 leading-relaxed">
                      {section.description}
                    </p>

                    {/* Arrow */}
                    <div className="mt-3 text-white/30 group-hover:text-white/60 transition-colors">
                      <span className="text-sm">Explore →</span>
                    </div>
                  </div>
                </a>
              );
            }

            // Unavailable sections get non-clickable div
            return (
              <div
                key={section.href}
                className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 opacity-60 cursor-not-allowed"
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {/* Glow effect - disabled for unavailable */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.gradient} flex items-center justify-center mb-3 opacity-50`}
                  >
                    {section.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-white mb-1.5 flex items-center gap-2">
                    {section.title}
                    <span className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-white/40 uppercase">
                      Coming Soon
                    </span>
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-white/50 leading-relaxed">
                    {section.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * StudioPageClient - Client wrapper using HomepageGrid layout.
 *
 * Handles:
 * 1. User location detection (via usePromagenAuth)
 * 2. Exchange selection based on user tier (via useExchangeSelection)
 * 3. Exchange ordering relative to reference point
 * 4. Reference frame toggle for paid users
 * 5. Index quote data fetching with user's selection (via useIndicesQuotes)
 * 6. Studio feature cards in centre column
 */
export default function StudioPageClient({
  exchanges,
  weatherIndex,
  providers,
}: StudioPageClientProps) {
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

  // Live weather (client) — no demo fallback.
  const {
    weather: liveWeatherById,
    meta: _weatherMeta,
    isLoading: _isWeatherLoading,
    error: _weatherError,
  } = useWeather();

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
  const {
    quotesById,
    movementById,
    status: indicesStatus,
  } = useIndicesQuotes({
    enabled: true,
    exchangeIds: userTier === 'paid' && isCustomSelection ? selectedExchangeIds : undefined,
    userTier,
  });

  // Track displayed provider IDs for market pulse connections
  const [displayedProviderIds, setDisplayedProviderIds] = useState<string[]>([]);

  // ============================================================================
  // EXCHANGE FILTERING
  // ============================================================================

  const selectedExchanges = useMemo(() => {
    return filterToSelected(exchanges, selectedExchangeIds);
  }, [exchanges, selectedExchangeIds]);

  // Debug logging for selection changes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[StudioPageClient] Exchange selection updated:', {
        userTier,
        isCustomSelection,
        selectedCount: selectedExchangeIds.length,
        indicesStatus,
        quotesCount: quotesById.size,
        weatherCount: effectiveWeatherIndex.size,
      });
    }
  }, [
    userTier,
    isCustomSelection,
    selectedExchangeIds,
    indicesStatus,
    quotesById.size,
    effectiveWeatherIndex.size,
  ]);

  // ============================================================================
  // DYNAMIC EXCHANGE ORDERING
  // ============================================================================

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

  // Callback when providers change (for market pulse, though not used here)
  const handleProvidersChange = useCallback((ids: string[]) => {
    setDisplayedProviderIds(ids);
  }, []);

  // Suppress unused variable warnings
  void handleProvidersChange;
  void isSelectionLoading;

  // ============================================================================
  // UI CONTENT
  // ============================================================================

  // Centre content: Studio feature grid (replaces ProvidersTable)
  const centreContent = <StudioFeatureGrid />;

  // Exchange list content (cards only, wrapper handled by HomepageGrid)
  const leftExchanges = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={left}
        weatherByExchange={effectiveWeatherIndex}
        indexByExchange={indexByExchange}
        emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
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
        emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
        side="right"
      />
    </div>
  );

  // ============================================================================
  // Location loading logic - same as homepage
  // ============================================================================
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  return (
    <HomepageGrid
      mainLabel="Promagen Studio"
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
      // NEW: Tell Mission Control this is the Studio page (swap Studio→Home button)
      isStudioPage
    />
  );
}
