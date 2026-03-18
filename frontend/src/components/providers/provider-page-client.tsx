// src/components/providers/provider-page-client.tsx
// ============================================================================
// PROVIDER PAGE CLIENT — Client wrapper for Pro-aware exchange ordering
// ============================================================================
// Mirrors the HomepageClient pattern: server page fetches data, this client
// component handles exchange ordering + layout. Pro users see exchanges
// anchored to their timezone. Free/anonymous see standard Greenwich ordering.
//
// Authority: docs/authority/exchange-ordering.md
// Existing features preserved: Yes — free users see identical layout.
// ============================================================================

'use client';

import React from 'react';
import type { Provider } from '@/types/providers';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import HomepageGrid from '@/components/layout/homepage-grid';
import ExchangeList from '@/components/ribbon/exchange-list';
import ProviderWorkspace from '@/components/providers/provider-workspace';
import { ProviderPageTracker } from '@/components/providers/provider-page-tracker';
import { useExchangeOrder } from '@/hooks/use-exchange-order';

// ─────────────────────────────────────────────────────────────────────────────
// Provider not found fallback (matches server component version)
// ─────────────────────────────────────────────────────────────────────────────

function ProviderNotFound({ id }: { id: string }) {
  return (
    <section
      aria-label="Provider not found"
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-8 text-center"
    >
      <h2 className="text-xl font-semibold text-slate-50">Provider not found</h2>
      <p className="max-w-md text-sm text-white">
        The provider &ldquo;{id}&rdquo; is not in the current Promagen catalogue. It may have been
        removed or the URL may be incorrect.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-800 cursor-pointer"
      >
        Return to Leaderboard
      </a>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderPageClientProps {
  /** Provider ID from URL param */
  providerId: string;
  /** All providers for Engine Bay / Mission Control */
  providers: Provider[];
  /** Matched provider (or undefined if not found) */
  provider?: Provider;
  /** All exchanges (flat, east→west from server) */
  exchanges: Exchange[];
  /** Weather data */
  weatherIndex: Map<string, ExchangeWeatherData>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProviderPageClient({
  providerId,
  providers,
  provider,
  exchanges,
  weatherIndex,
}: ProviderPageClientProps) {
  // Pro-aware exchange ordering — rotates for Pro users, passthrough for free
  const { left, right } = useExchangeOrder(exchanges);

  const providerName = provider?.name ?? providerId;

  // Left rail: exchanges with live weather
  const leftContent = (
    <ExchangeList
      exchanges={left}
      weatherByExchange={weatherIndex}
      emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
      side="left"
    />
  );

  // Centre: Prompt workspace or not-found
  const centreContent = provider ? (
    <ProviderPageTracker providerId={provider.id}>
      <ProviderWorkspace provider={provider} />
    </ProviderPageTracker>
  ) : (
    <ProviderNotFound id={providerId} />
  );

  // Right rail: exchanges with live weather
  const rightContent = (
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
      heroTextOverride={`This builder is shaped around ${providerName}. Every word was chosen for how this platform reads it. The vocabulary grows overnight — new phrases arrive while you sleep.`}
      leftContent={leftContent}
      centre={centreContent}
      rightContent={rightContent}
      showFinanceRibbon={false}
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={weatherIndex}
      exchanges={exchanges}
      isStudioSubPage
    />
  );
}
