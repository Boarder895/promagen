// src/app/pro-promagen/page.tsx
// ============================================================================
// PRO PROMAGEN PAGE - Server Component
// ============================================================================
// Feature showcase and configuration page for Pro Promagen.
// Dual-purpose: Preview mode (free users) + Configuration mode (paid users).
//
// Server responsibilities:
// - Load exchange catalog
// - Load FX pairs catalog (UNIFIED fx-pairs.json)
// - Build indices catalog from exchanges with marketstack data
// - Load SSOT defaults
// - Build demo weather index
// - SEO metadata
//
// Client responsibilities (ProPromagenClient):
// - Display comparison table with embedded dropdowns (FX, Exchanges, Indices)
// - Show FX ribbon with demo prices
// - Show exchange rails with real clocks, demo weather
// - Save preferences (paid users)
//
// UPDATED: Added indices catalog for stock index selection.
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

import React from 'react';
import type { Metadata } from 'next';

import ProPromagenClient from './pro-promagen-client';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelected from '@/data/exchanges/exchanges.selected.json';
import fxPairsCatalog from '@/data/fx/fx-pairs.json';
import { DEMO_EXCHANGE_WEATHER, type ExchangeWeather } from '@/lib/weather/exchange-weather';
import {
  type FxPairCatalogEntry,
  type ExchangeCatalogEntry,
  buildIndicesCatalog,
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
    description:
      'Unlock personalized FX pairs, exchange selection, stock indices, and more.',
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
function buildDemoWeatherIndex(
  rows: ReadonlyArray<ExchangeWeather>
): Map<string, ExchangeWeather> {
  return new Map(rows.map((entry) => [entry.exchange, entry]));
}

/**
 * Extract default FX pair IDs from unified catalog.
 * Filters pairs where isDefaultFree === true.
 */
function getDefaultFxPairIds(
  pairs: ReadonlyArray<{ id: string; isDefaultFree?: boolean }>
): string[] {
  return pairs
    .filter((p) => p.isDefaultFree === true)
    .map((p) => p.id);
}

/**
 * Get default indices IDs - all selected exchanges that have marketstack data.
 * By default, all exchanges show their index.
 */
function getDefaultIndicesIds(
  selectedExchangeIds: string[],
  exchangeCatalog: ExchangeCatalogEntry[]
): string[] {
  return selectedExchangeIds.filter((id) => {
    const exchange = exchangeCatalog.find((e) => e.id === id);
    return exchange?.marketstack?.benchmark && exchange?.marketstack?.indexName;
  });
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function ProPromagenPage() {
  // Cast catalog data to expected types
  const exchangeCatalog = exchangesCatalog as unknown as ExchangeCatalogEntry[];
  const fxCatalog = fxPairsCatalog as unknown as FxPairCatalogEntry[];

  // Build indices catalog from exchanges with marketstack data
  const indicesCatalog = buildIndicesCatalog(exchangeCatalog);

  // Extract default IDs from SSOT
  // exchanges.selected.json has shape: { ids: string[] }
  const defaultExchangeIds = (exchangesSelected as { ids: string[] }).ids;
  
  // FX defaults come from the unified catalog (isDefaultFree === true)
  const defaultFxPairIds = getDefaultFxPairIds(fxCatalog);
  
  // Indices defaults: all selected exchanges with marketstack data
  const defaultIndicesIds = getDefaultIndicesIds(defaultExchangeIds, exchangeCatalog);

  // Build demo weather index for exchange cards
  // Shows placeholder weather data (no API cost)
  const demoWeatherIndex = buildDemoWeatherIndex(DEMO_EXCHANGE_WEATHER);

  return (
    <ProPromagenClient
      exchangeCatalog={exchangeCatalog}
      fxCatalog={fxCatalog}
      indicesCatalog={indicesCatalog}
      defaultExchangeIds={defaultExchangeIds}
      defaultFxPairIds={defaultFxPairIds}
      defaultIndicesIds={defaultIndicesIds}
      demoWeatherIndex={demoWeatherIndex}
    />
  );
}
