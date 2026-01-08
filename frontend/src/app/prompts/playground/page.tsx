// src/app/prompts/playground/page.tsx
// ============================================================================
// PROMPT PLAYGROUND PAGE - Server Component
// ============================================================================
// Builder-first flow: Start with the prompt builder, select provider from dropdown.
// Same layout as /providers/[id] but with provider selector instead of pre-selected.
//
// Server responsibilities:
// - Load all providers from catalog
// - Load all exchanges from catalog
// - Build weather index
// - SEO metadata
//
// Client responsibilities (PlaygroundWorkspace):
// - Provider selection dropdown
// - Full prompt builder functionality
// - All intelligence features
//
// Authority: docs/authority/prompt-intelligence.md §9
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import ExchangeList from '@/components/ribbon/exchange-list';
import HomepageGrid from '@/components/layout/homepage-grid';
import PlaygroundWorkspace from '@/components/prompts/playground-workspace';
import { getProviders } from '@/lib/providers/api';
import { getRailsForHomepage } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Prompt Playground — Promagen',
  description:
    'Build AI image prompts with live market context. Select any provider, see real-time formatting, and compare outputs across platforms.',
  openGraph: {
    title: 'Prompt Playground — Promagen',
    description:
      'Build AI image prompts with live market context. Select any provider, see real-time formatting, and compare outputs across platforms.',
    type: 'website',
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prompt Playground — Promagen',
    description:
      'Build AI image prompts with live market context. Select any provider, see real-time formatting, and compare outputs across platforms.',
  },
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function PlaygroundPage(): JSX.Element {
  // Load all providers for the dropdown
  const providers = getProviders();

  // Load exchange rails
  const { left, right } = getRailsForHomepage();

  // Build weather index for exchange cards
  const weatherIndex = new Map<string, ExchangeWeather>();
  for (const entry of DEMO_EXCHANGE_WEATHER) {
    weatherIndex.set(entry.exchange, entry);
  }

  // Left rail content: Eastern exchanges
  const leftExchanges = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
    />
  );

  // Centre: Playground workspace with provider selector
  const centreContent = (
    <PlaygroundWorkspace providers={providers} />
  );

  // Right rail content: Western exchanges
  const rightExchanges = (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherIndex}
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
    />
  );

  return (
    <HomepageGrid
      mainLabel="Prompt Playground — Select a provider to build prompts"
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
    />
  );
}
