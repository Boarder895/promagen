// src/app/providers/[id]/page.tsx

import React from 'react';
import type { Metadata } from 'next';

import ExchangeRail from '@/components/ribbon/exchange-rail';
import HomepageGrid from '@/components/layout/homepage-grid';
import ProviderDetail from '@/components/providers/provider-detail';
import { getProviders } from '@/lib/providers/api';
import { getRailsForHomepage } from '@/lib/exchange-order';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import type { Provider } from '@/types/provider';

type Params = { id: string };

// ───────────────────────────────────────────────────────────────────────────────
// Dynamic per-provider metadata
// ───────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const providers = getProviders();
  const provider = providers.find((p) => p.id === params.id);

  if (!provider) {
    return {
      title: 'Provider not found • Promagen',
      description: 'The requested AI provider is not in the current Promagen catalogue.',
      robots: { index: false, follow: false },
    };
  }

  const url = `https://promagen.example/providers/${provider.id}`;
  const title = `${provider.name} • Promagen AI provider`;
  const description = `Detail view, score, trend, and tags for ${provider.name} on Promagen.`;

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

// ───────────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────────

export default function ProviderDetailPage({ params }: { params: Params }): JSX.Element {
  const { id } = params;

  const providers = getProviders();
  const provider: Provider | undefined = providers.find((p) => p.id === id);

  const { left, right } = getRailsForHomepage();

  const weatherIndex = new Map<string, ExchangeWeather>();
  for (const entry of DEMO_EXCHANGE_WEATHER) {
    weatherIndex.set(entry.exchange, entry);
  }

  const providerName = provider?.name ?? id;

  const leftRail = (
    <ExchangeRail
      exchanges={left}
      weatherByExchange={weatherIndex}
      ariaLabel="Eastern exchanges"
      testId="rail-east"
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
    />
  );

  const centreRail = (
    <section aria-label={`Details for ${providerName}`}>
      <ProviderDetail provider={provider ?? null} id={id} />
    </section>
  );

  const rightRail = (
    <ExchangeRail
      exchanges={right}
      weatherByExchange={weatherIndex}
      ariaLabel="Western exchanges"
      testId="rail-west"
      emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
    />
  );

  return (
    <HomepageGrid
      mainLabel={`Provider details for ${providerName}`}
      left={leftRail}
      centre={centreRail}
      right={rightRail}
    />
  );
}
