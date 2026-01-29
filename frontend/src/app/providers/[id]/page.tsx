// src/app/providers/[id]/page.tsx
// ============================================================================
// PROVIDER PROMPT BUILDER PAGE (v2.0.0)
// ============================================================================
// When a user clicks a provider row in the Leaderboard, they navigate here
// to craft prompts before launching into the AI provider platform.
//
// v2.0.0 CHANGES:
// - Added Engine Bay and Mission Control panels (same as homepage)
// - Switched from DEMO_EXCHANGE_WEATHER to live getWeatherIndex()
// - Added force-dynamic for fresh weather data on each request
// - Added isStudioSubPage=true for 4-button Mission Control layout
// - Passes providers, weatherIndex, showEngineBay, showMissionControl to HomepageGrid
// - Exchange rails now have live weather data
//
// v1.0.0:
// - Added prompt_builder_open tracking via ProviderPageTracker
//
// Authority: docs/authority/prompt-builder-page.md, docs/authority/index-rating.md
// Security: 10/10 — Type-safe, server-side data fetching
// Existing features preserved: Yes
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - provider pages need live weather data
export const dynamic = 'force-dynamic';

import ExchangeList from '@/components/ribbon/exchange-list';
import HomepageGrid from '@/components/layout/homepage-grid';
import ProviderWorkspace from '@/components/providers/provider-workspace';
import { ProviderPageTracker } from '@/components/providers/provider-page-tracker';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import { getRailsRelative, GREENWICH } from '@/lib/location';
import type { Provider } from '@/types/providers';

type Params = { id: string };

// ─────────────────────────────────────────────────────────────────────────────
// Provider not found fallback
// ─────────────────────────────────────────────────────────────────────────────

function ProviderNotFound({ id }: { id: string }) {
  return (
    <section
      aria-label="Provider not found"
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-8 text-center"
    >
      <h2 className="text-xl font-semibold text-slate-50">Provider not found</h2>
      <p className="max-w-md text-sm text-slate-400">
        The provider &ldquo;{id}&rdquo; is not in the current Promagen catalogue.
        It may have been removed or the URL may be incorrect.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-800"
      >
        Return to Leaderboard
      </a>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic per-provider metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const providers = getProviders();
  const provider = providers.find((p) => p.id === id);

  if (!provider) {
    return {
      title: 'Provider not found • Promagen',
      description: 'The requested AI provider is not in the current Promagen catalogue.',
      robots: { index: false, follow: false },
    };
  }

  const url = `https://promagen.app/providers/${provider.id}`;
  const title = `${provider.name} prompt builder • Promagen`;
  const description =
    provider.tagline ??
    `Craft prompts for ${provider.name} with live market context on Promagen.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Promagen',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProviderPage({ params }: { params: Promise<Params> }): Promise<JSX.Element> {
  const { id } = await params;

  // Parallel data fetching for optimal performance
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(), // Live weather from gateway
  ]);

  const provider: Provider | undefined = providers.find((p) => p.id === id);

  // Order exchanges relative to Greenwich (server-side, no user location)
  const { left, right } = getRailsRelative(allExchanges, GREENWICH);

  const providerName = provider?.name ?? id;

  // Left rail content: Eastern exchanges with live weather
  const leftExchanges = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
      side="left"
    />
  );

  // Centre: Prompt workspace (PromptBuilder + LaunchPanel) or not-found state
  // Wrapped in ProviderPageTracker for prompt_builder_open event tracking
  const centreContent = provider ? (
    <ProviderPageTracker providerId={provider.id}>
      <ProviderWorkspace provider={provider} />
    </ProviderPageTracker>
  ) : (
    <ProviderNotFound id={id} />
  );

  // Right rail content: Western exchanges with live weather
  const rightExchanges = (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherIndex}
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
      side="right"
    />
  );

  return (
    <HomepageGrid
      mainLabel={`Prompt builder for ${providerName}`}
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
      // ========================================================================
      // ENGINE BAY + MISSION CONTROL — Same as homepage
      // ========================================================================
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={weatherIndex}
      exchanges={allExchanges}
      // 4-button layout: Home | Studio | Pro | Sign in
      isStudioSubPage
    />
  );
}
