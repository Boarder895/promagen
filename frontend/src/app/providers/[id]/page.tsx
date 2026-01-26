// src/app/providers/[id]/page.tsx
//
// Provider prompt builder page.
// When a user clicks a provider row in the Leaderboard, they navigate here
// to craft prompts before launching into the AI provider platform.
//
// Authority: docs/authority/prompt-builder-page.md

import React from 'react';
import type { Metadata } from 'next';

import ExchangeList from '@/components/ribbon/exchange-list';
import HomepageGrid from '@/components/layout/homepage-grid';
import ProviderWorkspace from '@/components/providers/provider-workspace';
import { getProviders } from '@/lib/providers/api';
import { getRailsForHomepage } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
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

  const providers = getProviders();
  const provider: Provider | undefined = providers.find((p) => p.id === id);

  const { left, right } = getRailsForHomepage();

  // Build weather index for exchange cards
  const weatherIndex = new Map<string, ExchangeWeather>();
  for (const entry of DEMO_EXCHANGE_WEATHER) {
    weatherIndex.set(entry.exchange, entry);
  }

  const providerName = provider?.name ?? id;

  // Left rail content: Eastern exchanges (cards only, wrapper handled by HomepageGrid)
  const leftExchanges = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
    />
  );

  // Centre: Prompt workspace (PromptBuilder + LaunchPanel) or not-found state
  const centreContent = provider ? (
    <ProviderWorkspace provider={provider} />
  ) : (
    <ProviderNotFound id={id} />
  );

  // Right rail content: Western exchanges (cards only, wrapper handled by HomepageGrid)
  const rightExchanges = (
    <ExchangeList
      exchanges={right}
      weatherByExchange={weatherIndex}
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
    />
  );

  return (
    <HomepageGrid
      mainLabel={`Prompt builder for ${providerName}`}
      leftContent={leftExchanges}
      centre={centreContent}
      rightContent={rightExchanges}
      showFinanceRibbon
    />
  );
}
