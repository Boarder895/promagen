// src/app/prompts/learn/page.tsx
// ============================================================================
// LEARN PAGE - Server Component
// ============================================================================
// Education hub for prompt engineering.
//
// Server responsibilities:
// - Load all exchanges from catalog
// - Load all learning guides
// - Build weather index
// - SEO metadata
//
// Client responsibilities (LearnClient):
// - Filter guides by category/difficulty
// - Display guide cards with DNA Helix + Ethereal Glow
// - Show guide details
// - Show quick tips
//
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import LearnClient from '@/components/prompts/learn/learn-client';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import { getLearnGuides, getQuickTips } from '@/data/learn-guides';

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

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function LearnPage() {
  // Load data on server
  const allExchanges = getHomepageExchanges();
  const weatherIndex = buildWeatherIndex(DEMO_EXCHANGE_WEATHER);
  const guides = getLearnGuides();
  const tips = getQuickTips();

  return (
    <LearnClient
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
      guides={guides}
      tips={tips}
    />
  );
}
