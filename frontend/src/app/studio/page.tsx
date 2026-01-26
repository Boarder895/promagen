// src/app/studio/page.tsx
// ============================================================================
// STUDIO PAGE - Server Component (Dynamic)
// ============================================================================
// Hub for all prompt-related features: Library, Explore, Learn, Playground.
// Now uses the same three-column layout as the homepage.
//
// UPDATED (26 Jan 2026): Refactored to use HomepageGrid layout
// - Fetches same data as homepage (providers, exchanges, weather)
// - Uses HomepageGrid with Studio feature cards in centre column
// - Engine Bay + Mission Control visible (Mission Control shows Home button)
// - Exchange rails, ribbons, Market Pulse all functional
//
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import StudioPageClient from './studio-page-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Studio — Promagen',
  description: 'Build, save, and explore AI image prompts with intelligent suggestions.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

/**
 * StudioIndexPage - Server component that loads data and renders client wrapper.
 *
 * The client wrapper (StudioPageClient) handles:
 * - User location detection
 * - Dynamic exchange ordering based on location
 * - Reference frame toggle for paid users
 * - Studio feature cards in centre column
 */
export default async function StudioIndexPage() {
  // Load data on server (parallel fetches) - same as homepage
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Fetches LIVE data from gateway
  ]);

  return (
    <StudioPageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
    />
  );
}
