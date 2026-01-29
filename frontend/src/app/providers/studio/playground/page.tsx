// src/app/studio/playground/page.tsx
// ============================================================================
// PROMPT PLAYGROUND PAGE - Server Component (Dynamic)
// ============================================================================
// Builder-first flow: Start with the prompt builder, select provider from dropdown.
// Same layout as /providers/[id] but with provider selector instead of pre-selected.
//
// UPDATED (28 Jan 2026): Full integration with Engine Bay & Mission Control
// - Now fetches live weather from gateway (same pattern as homepage)
// - Uses HomepageGrid with showEngineBay, showMissionControl
// - Uses isStudioSubPage for 4-button Mission Control layout
// - Force dynamic rendering for live weather data
// - Uses ExchangeWeatherData type (not the old ExchangeWeather)
//
// Server responsibilities:
// - Load all providers from catalog
// - Load all exchanges from catalog
// - Fetch weather from gateway (with demo fallback)
// - SEO metadata
//
// Client responsibilities (PlaygroundWorkspace):
// - Provider selection dropdown
// - Full prompt builder functionality
// - All intelligence features
//
// Authority: docs/authority/prompt-intelligence.md §9
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import ExchangeList from '@/components/ribbon/exchange-list';
import HomepageGrid from '@/components/layout/homepage-grid';
import PlaygroundWorkspace from '@/components/prompts/playground-workspace';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import { getRailsRelative, GREENWICH } from '@/lib/location';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Playground — Promagen',
  description:
    'Build AI image prompts with live market context. Select any provider, see real-time formatting, and compare outputs across platforms.',
  openGraph: {
    title: 'Prompt Playground — Promagen',
    description:
      'Build AI image prompts with live market context. Select any provider, see real-time formatting, and compare outputs across platforms.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prompt Playground — Promagen',
    description:
      'Build AI image prompts with live market context. Select any provider, see real-time formatting, and compare outputs across platforms.',
  },
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function PlaygroundPage() {
  // Load data on server (parallel fetches) - same pattern as homepage
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Fetches LIVE data from gateway
  ]);

  // Order exchanges relative to Greenwich (default for server render)
  // Client-side location detection will re-order if user is authenticated
  const { left, right } = getRailsRelative(allExchanges, GREENWICH);

  // Combine for market pulse
  const allOrderedExchanges = [...left, ...right.slice().reverse()];

  // Provider IDs for market pulse
  const providerIds = providers.map((p) => p.id);

  // Left rail content: Eastern exchanges
  const leftExchanges = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={left}
        weatherByExchange={weatherIndex}
        emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
        side="left"
      />
    </div>
  );

  // Centre: Playground workspace with provider selector
  const centreContent = <PlaygroundWorkspace providers={providers} />;

  // Right rail content: Western exchanges
  const rightExchanges = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={right}
        weatherByExchange={weatherIndex}
        emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
        side="right"
      />
    </div>
  );

  return (
    <HomepageGrid
      mainLabel="Prompt Playground — Select a provider to build prompts"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
      exchanges={allOrderedExchanges}
      displayedProviderIds={providerIds}
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={weatherIndex}
      isStudioSubPage
    />
  );
}
