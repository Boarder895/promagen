// src/app/page.tsx
// ============================================================================
// NEW HOMEPAGE - Server Component (Dynamic)
// ============================================================================
// The prompt-focused homepage replaces the former financial-data-first layout.
// The original layout (exchange rails, FX ribbons, etc.) now lives at /world-context.
//
// This page loads providers + weather for the Prompt of the Moment showcase,
// then delegates to NewHomepageClient for:
// - Prompt of the Moment (4-tier weather prompt, copy, like, "Try in")
// - Scene Starters preview (left rail)
// - Community Pulse feed (right rail)
// - Online users by country
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

// Force dynamic rendering — homepage needs live weather for Prompt of the Moment
export const dynamic = 'force-dynamic';

import NewHomepageClient from '@/components/home/new-homepage-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

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
 * Loads the same server data as before (providers, exchanges, weather) but
 * the client component renders the new layout: Prompt of the Moment showcase
 * in the centre, Scene Starters preview on the left, Community Pulse on the right.
 */
export default async function HomePage() {
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(),
  ]);

  return (
    <NewHomepageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
    />
  );
}
