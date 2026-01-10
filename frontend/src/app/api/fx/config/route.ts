// src/app/api/fx/config/route.ts
// =============================================================================
// FX PAIRS CONFIG API - SINGLE SOURCE OF TRUTH ENDPOINT
// =============================================================================
//
// This endpoint exposes fx.pairs.json to external consumers (gateway).
// The gateway fetches from here on startup to get the SSOT pairs.
//
// SSOT FILE: frontend/src/data/fx/fx.pairs.json
// =============================================================================

import { NextResponse } from 'next/server';

import fxPairsIndex from '@/data/fx/fx-pairs.json';
import pairsCatalog from '@/data/fx/fx-pairs.json';

export const runtime = 'edge';
export const revalidate = 3600; // Cache for 1 hour

interface FxPairIndexEntry {
  id: string;
  baseCountryCode?: string;
  quoteCountryCode?: string;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  group?: string;
  homeLongitude?: number;
}

interface FxCatalogEntry {
  id: string;
  base?: string;
  quote?: string;
  label?: string;
  precision?: number;
}

export interface FxPairConfig {
  id: string;
  base: string;
  quote: string;
}

export async function GET(): Promise<Response> {
  try {
    // Build catalog lookup for base/quote
    const catalogById = new Map<string, FxCatalogEntry>();
    for (const entry of pairsCatalog as FxCatalogEntry[]) {
      if (entry && typeof entry.id === 'string') {
        catalogById.set(entry.id.toLowerCase(), entry);
      }
    }

    // Filter to isDefaultFree pairs and join with catalog
    const pairs: FxPairConfig[] = (fxPairsIndex as FxPairIndexEntry[])
      .filter((p) => p && p.isDefaultFree === true)
      .map((p) => {
        const id = String(p.id).toLowerCase();
        const meta = catalogById.get(id);

        // Derive base/quote from catalog or from ID
        const parts = id.split('-');
        const base = meta?.base?.toUpperCase() ?? parts[0]?.toUpperCase() ?? '';
        const quote = meta?.quote?.toUpperCase() ?? parts[1]?.toUpperCase() ?? '';

        return { id, base, quote };
      })
      .filter((p) => p.id && p.base && p.quote);

    return NextResponse.json(
      {
        version: 1,
        ssot: 'frontend/src/data/fx/fx.pairs.json',
        generatedAt: new Date().toISOString(),
        pairs,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error('[api/fx/config] Error:', err);
    return NextResponse.json(
      { error: 'Failed to load FX config' },
      { status: 500 },
    );
  }
}
