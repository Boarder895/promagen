// src/app/studio/library/page.tsx
// ============================================================================
// PROMPT LIBRARY PAGE - Server Component
// ============================================================================
// Your saved prompts. Save, organise, and reload favourites.
//
// Server responsibilities:
// - Load all exchanges from catalog
// - Build weather index
// - SEO metadata
//
// Client responsibilities (LibraryClient):
// - Manage saved prompts (localStorage)
// - Filter and sort prompts
// - Load prompts into builder
// - Import/export functionality
//
// Authority: docs/authority/prompt-intelligence.md §9.2
// UPDATED: Route moved from /prompts/library to /studio/library
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import LibraryClient from '@/components/prompts/library/library-client';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Library — Promagen',
  description: 'Your saved prompts. Save, organise, and reload your favourite AI image prompts.',
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

export default function LibraryPage() {
  // Load data on server
  const allExchanges = getHomepageExchanges();
  const weatherIndex = buildWeatherIndex(DEMO_EXCHANGE_WEATHER);

  return (
    <LibraryClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
    />
  );
}
