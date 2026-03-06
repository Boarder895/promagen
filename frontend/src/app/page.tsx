// src/app/page.tsx
// ============================================================================
// NEW HOMEPAGE - Server Component (ISR)
// ============================================================================
// The prompt-focused homepage replaces the former financial-data-first layout.
// The original layout (exchange rails, FX ribbons, etc.) now lives at /world-context.
//
// Performance strategy:
// - ISR with 60s revalidation (not force-dynamic)
// - Providers + exchanges are sync JSON reads (instant)
// - Weather fetch is non-blocking with 2s timeout + empty fallback
//   (client-side useWeather() refreshes after hydration anyway)
// - Prompt of the Moment is client-fetched with module-level prefetch
//   (fires at JS parse time, before React hydrates)
//
// Authority: docs/authority/homepage.md
//
// Existing features preserved: Yes
// - Leaderboard table stays on new homepage
// - Engine Bay stays
// - Mission Control stays (+ World Context button)
// - All other pages untouched
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// ISR: serve from cache, revalidate in background every 60 seconds.
export const revalidate = 60;

import NewHomepageClient from '@/components/home/new-homepage-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
  description:
    'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and intelligent weather-driven prompts.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

/**
 * HomePage — Server component for the new prompt-focused homepage.
 *
 * Weather is fetched with a tight 2s timeout — if the gateway is slow,
 * the page renders immediately with an empty weather map. The client-side
 * useWeather() hook fills it in after hydration (~1-2s later). This means
 * weather tooltips may flash from empty to populated, but the page loads
 * instantly instead of waiting 5+ seconds for the gateway.
 */
export default async function HomePage() {
  // Providers + exchanges are synchronous JSON reads — instant
  const providers = getProviders();
  const allExchanges = getHomepageExchanges();

  // Weather: non-blocking with 2s timeout. Empty map fallback.
  // Client-side useWeather() refreshes after hydration anyway.
  let weatherIndex: Map<string, ExchangeWeatherData>;
  try {
    weatherIndex = await Promise.race([
      getWeatherIndex(),
      new Promise<Map<string, ExchangeWeatherData>>((resolve) =>
        setTimeout(() => resolve(new Map()), 2000),
      ),
    ]);
  } catch {
    weatherIndex = new Map();
  }

  return (
    <NewHomepageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
    />
  );
}
