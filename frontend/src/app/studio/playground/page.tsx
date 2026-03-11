// src/app/studio/playground/page.tsx
// ============================================================================
// PROMPT LAB PAGE - Server Component (Dynamic)
// ============================================================================
// Builder-first flow: Start with the prompt builder, select provider from dropdown.
// Same layout as /providers/[id] but with provider selector instead of pre-selected.
//
// v2.0.0 (Mar 2026): Renamed to Prompt Lab. Delegated to client wrapper
// (playground-page-client.tsx) so Listen button text can change dynamically
// when user selects a provider. Same pattern as homepage → homepage-client.
//
// Server responsibilities:
// - Load all providers from catalog
// - Load all exchanges from catalog
// - Fetch weather from gateway (with demo fallback)
// - SEO metadata
//
// Client responsibilities (PlaygroundPageClient → PlaygroundWorkspace):
// - Provider selection dropdown + state tracking
// - Dynamic Listen button text (no provider vs provider selected)
// - Full prompt builder functionality
// - All intelligence features
//
// Authority: docs/authority/prompt-intelligence.md §9
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import PlaygroundPageClient from './playground-page-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import { getRailsRelative, GREENWICH } from '@/lib/location';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Lab — Promagen',
  description:
    'Prompt Lab — build, compare and switch between all 42 AI image platforms in real time.',
  openGraph: {
    title: 'Prompt Lab — Promagen',
    description:
      'Prompt Lab — build, compare and switch between all 42 AI image platforms in real time.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prompt Lab — Promagen',
    description:
      'Prompt Lab — build, compare and switch between all 42 AI image platforms in real time.',
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
  const { left, right } = getRailsRelative(allExchanges, GREENWICH);

  // Combine for market pulse
  const allOrderedExchanges = [...left, ...right.slice().reverse()];

  return (
    <PlaygroundPageClient
      providers={providers}
      leftExchanges={left}
      rightExchanges={right}
      allOrderedExchanges={allOrderedExchanges}
      weatherIndex={weatherIndex}
    />
  );
}
