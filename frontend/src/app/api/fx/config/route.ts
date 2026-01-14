// src/app/api/fx/config/route.ts
/**
 * /api/fx/config — SSOT endpoint for gateway FX feed initialization.
 *
 * Returns FX pairs catalog with default pairs for the ribbon.
 * Gateway fetches this on startup to know which pairs to query.
 *
 * Data source: frontend/src/data/fx/fx-pairs.json
 */

import { NextResponse } from 'next/server';

import fxPairsJson from '@/data/fx/fx-pairs.json';

// Type for FX pair from catalog
interface FxPairCatalog {
  id: string;
  base: string;
  quote: string;
  symbol?: string;
  isActive?: boolean;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  demoPrice?: number;
  demo?: { value: number; prevClose: number };
  priority?: number;
}

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const allPairs = fxPairsJson as FxPairCatalog[];

  // Filter active pairs only
  const activePairs = allPairs.filter((p) => p.isActive !== false);

  // Get default pairs (isDefaultFree = true)
  const defaultPairIds = activePairs.filter((p) => p.isDefaultFree === true).map((p) => p.id);

  // Build response format expected by gateway
  const pairs = activePairs.map((p) => ({
    id: p.id,
    base: p.base,
    quote: p.quote,
    symbol: p.symbol ?? `${p.base}/${p.quote}`,
    isDefaultFree: p.isDefaultFree ?? false,
    isDefaultPaid: p.isDefaultPaid ?? false,
    demoPrice: p.demoPrice ?? p.demo?.value ?? null,
    priority: p.priority ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'frontend/src/data/fx/fx-pairs.json',
      generatedAt: new Date().toISOString(),
      defaultPairIds,
      pairs,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
