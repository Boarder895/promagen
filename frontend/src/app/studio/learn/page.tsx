// src/app/studio/learn/page.tsx
// ============================================================================
// LEARN PAGE - Server Component
// ============================================================================
// Education hub for prompt engineering.
//
// Server responsibilities:
// - Load all exchanges from catalog
// - Load all learning guides
// - Load all AI platforms for dropdown
// - Build weather index
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
// UPDATED: Route moved from /prompts/learn to /studio/learn
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import LearnClient from '@/components/prompts/learn/learn-client';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import { getLearnGuides, getQuickTips } from '@/data/learn-guides';
import providersData from '@/data/providers/providers.json';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Learn Prompt Engineering — Promagen',
  description: 'Master the art of crafting effective AI image prompts with guides, tips, and examples.',
};

// ============================================================================
// HELPERS
// ============================================================================

function buildWeatherIndex(rows: ReadonlyArray<ExchangeWeather>): Map<string, ExchangeWeather> {
  return new Map(rows.map((entry) => [entry.exchange, entry]));
}

/**
 * Build platforms list from providers data
 * Returns array of { id, name } for the dropdown
 */
function getPlatformsForDropdown(): Array<{ id: string; name: string }> {
  return (providersData as Array<{ id: string; name: string }>).map((p) => ({
    id: p.id,
    name: p.name,
  }));
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function LearnPage() {
  // Load data on server
  const allExchanges = getHomepageExchanges();
  const weatherIndex = buildWeatherIndex(DEMO_EXCHANGE_WEATHER);
  const guides = getLearnGuides();
  const tips = getQuickTips();
  const platforms = getPlatformsForDropdown();

  return (
    <LearnClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      guides={guides}
      tips={tips}
      platforms={platforms}
    />
  );
}
