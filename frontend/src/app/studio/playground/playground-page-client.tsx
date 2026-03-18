// src/app/studio/playground/playground-page-client.tsx
// ============================================================================
// PROMPT LAB CLIENT WRAPPER (v2.0.0)
// ============================================================================
// Client component for /studio/playground (Prompt Lab).
// Same pattern as homepage-client.tsx and library-client.tsx.
//
// v2.0.0 (18 Mar 2026):
// - Uses useExchangeOrder() for Pro-aware exchange rail ordering.
//   Pro users see exchanges anchored to their timezone.
//   Free/anonymous see standard Greenwich east→west.
// - Simplified props: receives flat `exchanges` array instead of pre-split.
//
// v1.0.0: Initial client wrapper with dynamic Listen text.
//
// Authority: docs/authority/exchange-ordering.md, docs/authority/prompt-intelligence.md §9
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback } from 'react';
import ExchangeList from '@/components/ribbon/exchange-list';
import HomepageGrid from '@/components/layout/homepage-grid';
import PlaygroundWorkspace from '@/components/prompts/playground-workspace';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import type { Provider } from '@/types/providers';
import { useExchangeOrder } from '@/hooks/use-exchange-order';

// ============================================================================
// SPEECH TEXT — British female voice (same pattern as homepage/library/pro)
// ============================================================================

/** Listen text when no provider is selected — invitation to explore */
const HERO_TEXT_NO_PROVIDER =
  "Every platform speaks its own language. On the standard builder, you write for one. " +
  "Here, you write for all of them. Pick your subject, your style, your mood " +
  "— then switch platforms and watch the same idea reshape itself. " +
  "Your selections stay. The syntax transforms. That's the Lab.";

/** Listen text when a provider is selected — guidance */
const HERO_TEXT_WITH_PROVIDER =
  "Same selections, different output. Switch platforms freely " +
  "— your choices stay put, the prompt reshapes to match.";

// ============================================================================
// TYPES
// ============================================================================

export interface PlaygroundPageClientProps {
  /** All AI providers */
  providers: Provider[];
  /** All exchanges (flat, east→west from server) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex: Map<string, ExchangeWeatherData>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PlaygroundPageClient({
  providers,
  exchanges,
  weatherIndex,
}: PlaygroundPageClientProps) {
  // Track whether a provider is selected (drives Listen text)
  const [hasProvider, setHasProvider] = useState(false);

  const handleProviderChange = useCallback((selected: boolean) => {
    setHasProvider(selected);
  }, []);

  // Pro-aware exchange ordering — rotates for Pro users, passthrough for free
  const { left, right, ordered } = useExchangeOrder(exchanges);

  // Speech text changes based on provider selection
  const heroText = hasProvider ? HERO_TEXT_WITH_PROVIDER : HERO_TEXT_NO_PROVIDER;

  // Provider IDs for market pulse
  const providerIds = providers.map((p) => p.id);

  // Left rail content: exchanges (Pro-reordered)
  const leftContent = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={left}
        weatherByExchange={weatherIndex}
        emptyMessage="No eastern exchanges selected yet. Choose markets to populate this rail."
        side="left"
      />
    </div>
  );

  // Centre: Playground workspace with provider change callback
  const centreContent = (
    <PlaygroundWorkspace
      providers={providers}
      onProviderChange={handleProviderChange}
    />
  );

  // Right rail content: exchanges (Pro-reordered)
  const rightContent = (
    <div className="space-y-2">
      <ExchangeList
        exchanges={right}
        weatherByExchange={weatherIndex}
        emptyMessage="No western exchanges selected yet. Choose markets to populate this rail."
        side="right"
      />
    </div>
  );

  return (
    <HomepageGrid
      mainLabel="Prompt Lab — Build and compare prompts across all platforms"
      headingText="Promagen — Prompt Lab"
      heroTextOverride={heroText}
      leftContent={leftContent}
      centre={centreContent}
      rightContent={rightContent}
      showFinanceRibbon={false}
      exchanges={ordered}
      displayedProviderIds={providerIds}
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={weatherIndex}
      isStudioSubPage
    />
  );
}
