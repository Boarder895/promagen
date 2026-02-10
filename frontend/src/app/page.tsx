// src/app/page.tsx
// ============================================================================
// HOMEPAGE - Server Component (Dynamic)
// ============================================================================
// Loads data on the server, passes to client component for dynamic ordering.
//
// UPDATED (2026-01-19): Now fetches LIVE weather from gateway!
// - Uses getWeatherIndex() which calls gateway /weather endpoint
// - Returns empty data if gateway unavailable
// - Emoji now reflects actual weather conditions ☀️🌧❄️
//
// UPDATED (2026-01-22): Made dynamic to avoid stale weather at build time
// - Homepage now renders at request time, not build time
// - Weather data is always fresh (not baked in during build)
// - Build no longer depends on gateway availability
//
// Server responsibilities:
// - Load providers from data files
// - Load all exchanges from catalog
// - Fetch weather from gateway (with demo fallback)
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

// Force dynamic rendering - homepage needs live weather data
export const dynamic = 'force-dynamic';

import HomepageClient from '@/components/home/homepage-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
  description:
    'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and live financial market data.',
};

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
export default async function HomePage() {
  // Load data on server (parallel fetches)
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Now fetches LIVE data from gateway!
  ]);

  return (
    <HomepageClient exchanges={allExchanges} weatherIndex={weatherIndex} providers={providers} />
  );
}
