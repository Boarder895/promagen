// src/app/studio/explore/page.tsx
// ============================================================================
// EXPLORE PAGE - Server Component (Dynamic)
// ============================================================================
// Browse style families and find inspiration for prompts.
//
// UPDATED (28 Jan 2026): Full integration with Engine Bay & Mission Control
// - Now fetches providers and live weather like homepage
// - Passes showEngineBay, showMissionControl, weatherIndex to client
// - Uses isStudioSubPage for 4-button Mission Control layout
// - Force dynamic rendering for live weather data
//
// Server responsibilities:
// - Load all providers from catalog
// - Load all exchanges from catalog
// - Load all style families
// - Fetch weather from gateway (with demo fallback)
// - SEO metadata
//
// Client responsibilities (ExploreClient):
// - Filter and sort families
// - Display family cards with DNA Helix + Ethereal Glow
// - Show family details
// - Navigate to builder with suggestions
//
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import ExploreClient from '@/components/prompts/explore/explore-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import { getFamilies } from '@/lib/prompt-intelligence/get-families';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Explore Style Families — Promagen',
  description: 'Discover aesthetic styles and find inspiration for your AI image prompts.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function ExplorePage() {
  // Load data on server (parallel fetches) - same pattern as homepage
  const [providers, allExchanges, weatherIndex, families] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Fetches LIVE data from gateway
    Promise.resolve(getFamilies()),
  ]);

  return (
    <ExploreClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
      families={families}
    />
  );
}
