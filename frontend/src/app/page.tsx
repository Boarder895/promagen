// src/app/page.tsx
// ============================================================================
// HOMEPAGE - Server Component
// ============================================================================
// Loads data on the server, passes to client component for dynamic ordering.
//
// Server responsibilities:
// - Load providers from data files
// - Load all exchanges from catalog
// - Build weather index
// - SEO metadata
//
// Client responsibilities (HomepageClient):
// - Detect user location
// - Order exchanges relative to location/Greenwich
// - Handle reference frame toggle (paid users)
// - Wire auth state
//
// Authority: docs/authority/paid_tier.md §3.4
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import HomepageClient from '@/components/home/homepage-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Promagen — Calm, data-rich AI providers overview',
  description: 'Live exchange rails and an AI providers leaderboard.',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a simple lookup so ExchangeList can resolve weather quickly.
 */
function buildWeatherIndex(rows: ReadonlyArray<ExchangeWeather>): Map<string, ExchangeWeather> {
  return new Map(rows.map((entry) => [entry.exchange, entry]));
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

/**
 * HomePage - Server component that loads data and renders client wrapper.
 *
 * The client wrapper (HomepageClient) handles:
 * - User location detection
 * - Dynamic exchange ordering based on location
 * - Reference frame toggle for paid users
 */
export default function HomePage() {
  // Load data on server
  const providers = getProviders();
  const allExchanges = getHomepageExchanges();
  const weatherIndex = buildWeatherIndex(DEMO_EXCHANGE_WEATHER);

  return (
    <HomepageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
    />
  );
}
