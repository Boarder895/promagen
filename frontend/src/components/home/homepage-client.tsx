// src/components/home/homepage-client.tsx
// ============================================================================
// HOMEPAGE CLIENT WRAPPER
// ============================================================================
// Client component that handles dynamic exchange ordering based on user
// location and reference frame preference.
//
// Server component (page.tsx) passes all exchanges.
// This component orders them dynamically based on:
// - Anonymous: Greenwich reference (absolute east→west)
// - Free signed-in: User's location (no choice)
// - Paid signed-in: Toggle between user location and Greenwich
//
// FIXED: Location loading no longer blocks UI when auth is loading.
// Anonymous users and failed auth both show "Greenwich Meridian" immediately.
//
// Authority: docs/authority/paid_tier.md §3.4, §5.2
// Authority: docs/authority/clerk-auth.md §14
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import ProvidersTable from '@/components/providers/providers-table';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { getRailsRelative } from '@/lib/location';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface HomepageClientProps {
  /** All exchanges to display (server provides these) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex: Map<string, ExchangeWeather>;
  /** All AI providers */
  providers: Provider[];
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HomepageClient - Client wrapper for dynamic exchange ordering and auth.
 *
 * Handles:
 * 1. User location detection (via usePromagenAuth)
 * 2. Exchange ordering relative to reference point
 * 3. Reference frame toggle for paid users
 * 4. Wiring auth state to providers table for voting
 */
export default function HomepageClient({
  exchanges,
  weatherIndex,
  providers,
}: HomepageClientProps) {
  const {
    isAuthenticated,
    userTier,
    locationInfo,
    setReferenceFrame,
  } = usePromagenAuth();

  // Track displayed provider IDs for market pulse connections
  const [displayedProviderIds, setDisplayedProviderIds] = useState<string[]>([]);

  // ============================================================================
  // DYNAMIC EXCHANGE ORDERING
  // ============================================================================

  // Order exchanges relative to user's location (or Greenwich for anonymous)
  const { left, right } = useMemo(() => {
    return getRailsRelative(exchanges, locationInfo.coordinates);
  }, [exchanges, locationInfo.coordinates]);

  // Combine for market pulse (ordered array)
  const allOrderedExchanges = useMemo(() => {
    // Reconstruct full ordered list from rails
    // Left is already in order, right was reversed, so reverse it back
    return [...left, ...right.slice().reverse()];
  }, [left, right]);

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
  const leftExchanges = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
    />
  );

  const rightExchanges = (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherIndex}
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
    />
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
      isLocationLoading={effectiveLocationLoading}
      cityName={locationInfo.cityName}
    />
  );
}
