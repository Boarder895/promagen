// src/app/api/indices/config/route.ts
/**
 * /api/indices/config — SSOT endpoint for gateway Indices feed initialization.
 *
 * Returns exchange catalog with benchmark mappings for Marketstack.
 * Gateway fetches this on startup to know which benchmarks to query.
 *
 * Data sources:
 * - frontend/src/data/exchanges/exchanges.catalog.json (full catalog)
 * - frontend/src/data/exchanges/exchanges.selected.json (default 16)
 */

import { NextResponse } from 'next/server';

import exchangesCatalogJson from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelectedJson from '@/data/exchanges/exchanges.selected.json';

// Type for exchange from catalog
interface ExchangeCatalog {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2?: string;
  tz?: string;
  marketstack?: {
    benchmark: string;
    indexName: string;
  };
  isActive?: boolean;
}

// Type for selected exchanges
interface SelectedExchanges {
  ids: string[];
}

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const allExchanges = exchangesCatalogJson as ExchangeCatalog[];
  const selectedExchanges = exchangesSelectedJson as SelectedExchanges;

  // Filter active exchanges with marketstack config
  const activeExchanges = allExchanges.filter(
    (e) => e.isActive !== false && e.marketstack?.benchmark,
  );

  // Get default exchange IDs from selected.json
  const defaultExchangeIds = selectedExchanges.ids;

  // Build response format expected by gateway
  const exchanges = activeExchanges.map((e) => ({
    id: e.id,
    city: e.city,
    exchange: e.exchange,
    country: e.country,
    iso2: e.iso2 ?? null,
    tz: e.tz ?? null,
    benchmark: e.marketstack?.benchmark ?? null,
    indexName: e.marketstack?.indexName ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'frontend/src/data/exchanges/exchanges.catalog.json',
      generatedAt: new Date().toISOString(),
      defaultExchangeIds,
      exchanges,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
