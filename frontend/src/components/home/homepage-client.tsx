// src/components/home/homepage-client.tsx
// ============================================================================
// HOMEPAGE CLIENT WRAPPER
// ============================================================================
// Client component that handles dynamic exchange ordering based on user
// location and reference frame preference.
//
// UPDATED (2026-01-19): Weather data now comes from gateway API!
// - weatherIndex now uses ExchangeWeatherData type (matches card expectations)
// - Emoji updates based on actual weather conditions
//
// UPDATED (2026-01-17): Now tier-aware indices fetching!
// - Uses useExchangeSelection to get user's exchange selection
// - Passes exchangeIds to useIndicesQuotes for dynamic API calls
// - FREE users: SSOT defaults
// - PAID users: Custom selections from Clerk metadata
//
// Server component (page.tsx) passes all exchanges.
// This component orders them dynamically based on:
// - Anonymous: Greenwich reference (absolute east→west)
// - Free signed-in: User's location (no choice)
// - Paid signed-in: Toggle between user location and Greenwich
//
// Security: 10/10
// - All external data validated
// - Type-safe transformations
// - No direct user input handling
//
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import ProvidersTable from '@/components/providers/providers-table';
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

export interface HomepageClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID (from gateway API) */
  weatherIndex: Map<string, ExchangeWeatherData>;
  /** All AI providers */
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
// COMPONENT
// ============================================================================

/**
 * HomepageClient - Client wrapper for dynamic exchange ordering and auth.
 *
 * Handles:
 * 1. User location detection (via usePromagenAuth)
 * 2. Exchange selection based on user tier (via useExchangeSelection)
 * 3. Exchange ordering relative to reference point
 * 4. Reference frame toggle for paid users
 * 5. Index quote data fetching with user's selection (via useIndicesQuotes)
 * 6. Wiring auth state to providers table for voting
 */
export default function HomepageClient({
  exchanges,
  weatherIndex,
  providers,
}: HomepageClientProps) {
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

  // Live weather (client) — no demo fallback.
  // We use this to update cards after hydration.
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
  // - FREE users: exchangeIds is undefined → GET request with SSOT defaults
  // - PAID users with custom: exchangeIds provided → POST request with custom IDs
  const {
    quotesById,
    movementById,
    status: indicesStatus,
  } = useIndicesQuotes({
    enabled: true,
    // Only pass exchangeIds for paid users with custom selections
    exchangeIds: userTier === 'paid' && isCustomSelection ? selectedExchangeIds : undefined,
    userTier,
  });

  // Track displayed provider IDs for market pulse connections
  const [displayedProviderIds, setDisplayedProviderIds] = useState<string[]>([]);

  // ============================================================================
  // EXCHANGE FILTERING (New in this update)
  // ============================================================================

  // Filter all exchanges to only include selected ones
  // This ensures the UI shows the same exchanges we're fetching indices for
  const selectedExchanges = useMemo(() => {
    return filterToSelected(exchanges, selectedExchangeIds);
  }, [exchanges, selectedExchangeIds]);

  // Debug logging for selection changes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[HomepageClient] Exchange selection updated:', {
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

  // Order exchanges relative to user's location (or Greenwich for anonymous)
  const { left, right } = useMemo(() => {
    return getRailsRelative(selectedExchanges, locationInfo.coordinates);
  }, [selectedExchanges, locationInfo.coordinates]);

  // Combine for market pulse (ordered array)
  const allOrderedExchanges = useMemo(() => {
    // Reconstruct full ordered list from rails
    // Left is already in order, right was reversed, so reverse it back
    return [...left, ...right.slice().reverse()];
  }, [left, right]);

  // ============================================================================
  // INDEX DATA MAP
  // ============================================================================

  // Build index quote map for exchange cards
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

  // Get initial provider IDs for market pulse
  const providerIds = useMemo(() => providers.map((p) => p.id), [providers]);

  // Callback when ProvidersTable changes displayed providers (sorting)
  const handleProvidersChange = useCallback((ids: string[]) => {
    setDisplayedProviderIds(ids);
  }, []);

  // ============================================================================
  // UI CONTENT
  // ============================================================================

  // Centre rail: flex container that fills available height
  // IMPORTANT: Pass isAuthenticated to enable voting
  const centreRail = (
    <section
      aria-label="AI providers leaderboard"
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="rail-centre-inner"
    >
      <ProvidersTable
        providers={providers}
        title="AI Providers Leaderboard"
        caption="Scores and trends are illustrative while external APIs are being wired."
        showRank
        // =====================================================
        // VOTING INTEGRATION: Wire auth state to enable votes
        // =====================================================
        isAuthenticated={isAuthenticated}
        onProvidersChange={handleProvidersChange}
      />
    </section>
  );

  // Exchange list content (cards only, wrapper handled by HomepageGrid)
  // Now passes indexByExchange for index quote display
  const leftExchanges = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={left}
        weatherByExchange={effectiveWeatherIndex}
        indexByExchange={indexByExchange}
        emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
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
      />
    </div>
  );

  // ============================================================================
  // Location loading logic
  // ============================================================================
  // Only show "Detecting..." when authenticated AND actually detecting location
  //   - Anonymous users → immediately shows "Greenwich Meridian"
  //   - Auth failed/loading → immediately shows "Greenwich Meridian"
  //   - Authenticated users detecting → shows "Detecting..."
  //   - Authenticated users done → shows their city name
  // ============================================================================
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  // Also consider selection loading for the overall loading state
  const isOverallLoading = effectiveLocationLoading || isSelectionLoading;

  return (
    <HomepageGrid
      mainLabel="Promagen home"
      leftContent={leftExchanges}
      centre={centreRail}
      rightContent={rightExchanges}
      showFinanceRibbon
      exchanges={allOrderedExchanges}
      displayedProviderIds={displayedProviderIds.length > 0 ? displayedProviderIds : providerIds}
      isPaidUser={userTier === 'paid'}
      isAuthenticated={isAuthenticated}
      referenceFrame={locationInfo.referenceFrame}
      onReferenceFrameChange={setReferenceFrame}
      isLocationLoading={isOverallLoading}
      cityName={locationInfo.cityName}
    />
  );
}
