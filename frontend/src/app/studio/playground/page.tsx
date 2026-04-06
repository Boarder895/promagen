// src/app/studio/playground/page.tsx
// ============================================================================
// PROMPT LAB PAGE - Server Component (Dynamic)
// ============================================================================
// Server fetches data, passes flat exchange array to client wrapper.
// Client (PlaygroundPageClient) handles Pro-aware exchange ordering via
// useExchangeOrder hook + dynamic Listen text.
//
// v2.1.0 (18 Mar 2026): Removed server-side getRailsRelative — client
//   now handles ordering for Pro timezone rotation support.
// v2.0.0: Renamed to Prompt Lab. Delegated to client wrapper.
//
// Authority: docs/authority/exchange-ordering.md, docs/authority/prompt-intelligence.md §9
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import PlaygroundPageClient from './playground-page-client';
import { getProvidersWithPromagenUsers, getIndexRatingsRecord } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Lab — Promagen',
  description:
    'Prompt Lab — build, compare and switch between all 40 AI image platforms in real time.',
  openGraph: {
    title: 'Prompt Lab — Promagen',
    description:
      'Prompt Lab — build, compare and switch between all 40 AI image platforms in real time.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prompt Lab — Promagen',
    description:
      'Prompt Lab — build, compare and switch between all 40 AI image platforms in real time.',
  },
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function PlaygroundPage() {
  // Load data on server (parallel fetches) - same pattern as homepage
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    getProvidersWithPromagenUsers(),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(),
  ]);

  // Index Ratings: server-side prefetch eliminates client waterfall
  const initialRatings = await getIndexRatingsRecord(providers.map((p) => p.id));

  return (
    <PlaygroundPageClient
      providers={providers}
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      initialRatings={initialRatings}
    />
  );
}
