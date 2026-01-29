// src/app/studio/library/page.tsx
// ============================================================================
// PROMPT LIBRARY PAGE - Server Component (Dynamic)
// ============================================================================
// Your saved prompts. Save, organise, and reload favourites.
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
// - Fetch weather from gateway (with demo fallback)
// - SEO metadata
//
// Client responsibilities (LibraryClient):
// - Manage saved prompts (localStorage)
// - Filter and sort prompts
// - Load prompts into builder
// - Import/export functionality
//
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import LibraryClient from '@/components/prompts/library/library-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Library — Promagen',
  description: 'Your saved prompts. Save, organise, and reload your favourite AI image prompts.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function LibraryPage() {
  // Load data on server (parallel fetches) - same pattern as homepage
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Fetches LIVE data from gateway
  ]);

  return (
    <LibraryClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
    />
  );
}
