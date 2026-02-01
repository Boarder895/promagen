// src/app/pro-promagen/page.tsx
// ============================================================================
// PRO PROMAGEN PAGE - Server Component (v2.0.0)
// ============================================================================
// Feature showcase and configuration page for Pro Promagen.
// Dual-purpose: Preview mode (free users) + Configuration mode (paid users).
//
// UPDATED v2.0.0: Added Engine Bay and Mission Control support
// - Now fetches providers data for Engine Bay icon grid
// - Passes providers to client for HomepageGrid integration
// - Mission Control shows Home button instead of Pro button
// - All existing functionality preserved
//
// Server responsibilities:
// - Load exchange catalog
// - Load FX pairs catalog (UNIFIED fx-pairs.json)
// - Build indices catalog from exchanges with marketstack data
// - Load SSOT defaults
// - Build demo weather index
// - Load providers data (NEW v2.0.0)
// - SEO metadata
//
// Client responsibilities (ProPromagenClient):
// - Display comparison table with embedded dropdowns (FX, Exchanges, Indices)
// - Show FX ribbon with demo prices
// - Show exchange rails with real clocks, demo weather
// - Show Engine Bay (left panel) and Mission Control (right panel) (NEW v2.0.0)
// - Save preferences (paid users)
//
// Authority: docs/authority/paid_tier.md §5.10
// Security: 10/10 — No user input handling, server-side data loading only
// Existing features preserved: Yes
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import ProPromagenClient from './pro-promagen-client';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelected from '@/data/exchanges/exchanges.selected.json';
import fxPairsCatalog from '@/data/fx/fx-pairs.json';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import { getProviders } from '@/lib/providers/api';
import {
  type FxPairCatalogEntry,
  type ExchangeCatalogEntry,
} from '@/lib/pro-promagen/types';

// ============================================================================
// METADATA (SEO)
// ============================================================================

export const metadata: Metadata = {
  title: 'Pro Promagen — Customize Your Market View',
  description:
    'Unlock personalized FX pairs, exchange selection, stock indices display, unlimited prompts, and more with Pro Promagen.',
  openGraph: {
    title: 'Pro Promagen — Customize Your Market View',
    description: 'Unlock personalized FX pairs, exchange selection, stock indices, and more.',
    type: 'website',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a lookup map for demo weather data.
 * Used by ExchangeList to resolve weather for each exchange card.
 */
function buildDemoWeatherIndex(rows: ReadonlyArray<ExchangeWeather>): Map<string, ExchangeWeather> {
  return new Map(rows.map((entry) => [entry.exchange, entry]));
}

/**
 * Extract default FX pair IDs from unified catalog.
 * Filters pairs where isDefaultFree === true.
 */
function getDefaultFxPairIds(
  pairs: ReadonlyArray<{ id: string; isDefaultFree?: boolean }>,
): string[] {
  return pairs.filter((p) => p.isDefaultFree === true).map((p) => p.id);
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function ProPromagenPage() {
  // Cast catalog data to expected types
  const exchangeCatalog = exchangesCatalog as unknown as ExchangeCatalogEntry[];
  const fxCatalog = fxPairsCatalog as unknown as FxPairCatalogEntry[];

  // Extract default IDs from SSOT
  // exchanges.selected.json has shape: { ids: string[] }
  const defaultExchangeIds = (exchangesSelected as { ids: string[] }).ids;

  // FX defaults come from the unified catalog (isDefaultFree === true)
  const defaultFxPairIds = getDefaultFxPairIds(fxCatalog);

  // Build demo weather index for exchange cards
  // Shows placeholder weather data (no API cost)
  const demoWeatherIndex = buildDemoWeatherIndex(DEMO_EXCHANGE_WEATHER);

  // Load providers data for Engine Bay (NEW v2.0.0)
  const providers = getProviders();

  return (
    <ProPromagenClient
      exchangeCatalog={exchangeCatalog}
      fxCatalog={fxCatalog}
      defaultExchangeIds={defaultExchangeIds}
      defaultFxPairIds={defaultFxPairIds}
      demoWeatherIndex={demoWeatherIndex}
      providers={providers}
    />
  );
}
