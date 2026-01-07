// src/app/prompts/explore/page.tsx
// ============================================================================
// EXPLORE PAGE - Server Component
// ============================================================================
// Browse style families and find inspiration for prompts.
//
// Server responsibilities:
// - Load all exchanges from catalog
// - Load all style families
// - Build weather index
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

import ExploreClient from '@/components/prompts/explore/explore-client';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import { getFamilies } from '@/lib/prompt-intelligence/get-families';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Explore Style Families — Promagen',
  description: 'Discover aesthetic styles and find inspiration for your AI image prompts.',
};

// ============================================================================
// HELPERS
// ============================================================================

function buildWeatherIndex(rows: ReadonlyArray<ExchangeWeather>): Map<string, ExchangeWeather> {
  return new Map(rows.map((entry) => [entry.exchange, entry]));
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function ExplorePage() {
  // Load data on server
  const allExchanges = getHomepageExchanges();
  const weatherIndex = buildWeatherIndex(DEMO_EXCHANGE_WEATHER);
  const families = getFamilies();

  return (
    <ExploreClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      families={families}
    />
  );
}
