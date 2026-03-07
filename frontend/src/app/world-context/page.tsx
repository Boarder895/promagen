// src/app/world-context/page.tsx
// ============================================================================
// WORLD CONTEXT PAGE - Server Component (Dynamic)
// ============================================================================
// This page is the ORIGINAL homepage layout, relocated to /world-context.
// It preserves the full financial-data experience: FX ribbon, exchange rails,
// weather tooltips, commodities, and the AI providers leaderboard.
//
// Authority: docs/authority/homepage.md §10
//
// IMPORTANT: This file reuses the existing HomepageClient component
// (src/components/home/homepage-client.tsx) WITHOUT modification.
// The original component renders exchange rails, finance ribbons, and
// the full three-column financial layout.
//
// Existing features preserved: Yes
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - needs live weather data
export const dynamic = 'force-dynamic';

import HomepageClient from '@/components/home/homepage-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'World Context — Live Markets, Weather Prompts & Commodity Inspiration | Promagen',
  description:
    'Explore 16 stock exchanges with live indices, weather-driven AI prompts, FX rates, and commodity prices. Real context for real-world image generation.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

/**
 * WorldContextPage - Server component that loads data and renders the
 * original homepage layout at /world-context.
 *
 * This is an exact replica of the former homepage server component.
 * The client wrapper (HomepageClient) handles:
 * - User location detection
 * - Dynamic exchange ordering based on location
 * - Reference frame toggle for paid users
 * - Live weather merging
 * - Index quote fetching
 */
export default async function WorldContextPage() {
  // Load data on server (parallel fetches) — identical to former homepage
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(),
  ]);

  return (
    <HomepageClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
      headingText={"World Context — Live Markets, Weather Prompts &\nCommodity Inspiration"}
    />
  );
}
