// src/app/studio/learn/page.tsx
// ============================================================================
// LEARN PAGE - Server Component (Dynamic)
// ============================================================================
// Education hub for prompt engineering.
//
// UPDATED (28 Jan 2026): Full integration with Engine Bay & Mission Control
// - Now fetches providers and live weather like homepage
// - Passes showEngineBay, showMissionControl, weatherIndex to client
// - Uses isStudioSubPage for 4-button Mission Control layout
// - Force dynamic rendering for live weather data
//
// Server responsibilities:
// - Load all providers from catalog
// - Load all exchanges from catalog
// - Load all learning guides
// - Load all AI platforms for dropdown
// - Fetch weather from gateway (with demo fallback)
// - SEO metadata
//
// Client responsibilities (LearnClient):
// - Platform selector (Combobox, 42 platforms, 123rf last)
// - "Explore Styles" button → /studio/explore
// - "Build with [Platform]" button → /providers/[id]
// - 12 guides (1:1 with Prompt Builder categories)
// - 4 tier info boxes
// - Search/filter guides
//
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - page needs live weather data
export const dynamic = 'force-dynamic';

import LearnClient from '@/components/prompts/learn/learn-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import { getLearnGuides, getQuickTips } from '@/data/learn-guides';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Learn Prompt Engineering — Promagen',
  description: 'Master the art of crafting effective AI image prompts with guides, tips, and examples.',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function LearnPage() {
  // Load data on server (parallel fetches) - same pattern as homepage
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Fetches LIVE data from gateway
  ]);

  // Load guides and tips (sync functions)
  const guides = getLearnGuides();
  const tips = getQuickTips();

  // Build platforms list for dropdown
  const platforms = providers.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <LearnClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      providers={providers}
      guides={guides}
      tips={tips}
      platforms={platforms}
    />
  );
}
