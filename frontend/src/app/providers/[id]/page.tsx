// src/app/providers/[id]/page.tsx
// ============================================================================
// PROVIDER PROMPT BUILDER PAGE (v3.0.0)
// ============================================================================
// Server component that fetches data, passes to ProviderPageClient for
// Pro-aware exchange ordering. Pro users see exchanges anchored to their
// timezone. Free/anonymous see standard Greenwich east→west.
//
// v3.0.0 (18 Mar 2026):
// - Moved exchange rail rendering to ProviderPageClient (client component)
//   so useExchangeOrder hook can rotate exchanges for Pro users.
// - Server still fetches all data (providers, exchanges, weather).
// - Removed server-side getRailsRelative + ExchangeList imports.
//
// v2.0.0: Added Engine Bay, Mission Control, live weather.
// v1.0.0: Initial prompt_builder_open tracking.
//
// Authority: docs/authority/exchange-ordering.md, docs/authority/prompt-builder-page.md
// Existing features preserved: Yes — free users see identical layout.
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

// Force dynamic rendering - provider pages need live weather data
export const dynamic = 'force-dynamic';

import ProviderPageClient from '@/components/providers/provider-page-client';
import { getProviders } from '@/lib/providers/api';
import { getHomepageExchanges } from '@/lib/exchange-order';
import { getWeatherIndex } from '@/lib/weather/fetch-weather';
import type { Provider } from '@/types/providers';

type Params = { id: string };

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
    provider.tagline ?? `Craft prompts for ${provider.name} with live market context on Promagen.`;

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
// Page — Server component fetches data, client handles ordering + layout
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProviderPage({
  params,
}: {
  params: Promise<Params>;
}): Promise<JSX.Element> {
  const { id } = await params;

  // Parallel data fetching for optimal performance
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    Promise.resolve(getProviders()),
    Promise.resolve(getHomepageExchanges()),
    getWeatherIndex(),
  ]);

  const provider: Provider | undefined = providers.find((p) => p.id === id);

  return (
    <ProviderPageClient
      providerId={id}
      providers={providers}
      provider={provider}
      exchanges={allExchanges}
      weatherIndex={weatherIndex}
    />
  );
}
