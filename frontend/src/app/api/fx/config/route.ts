// src/app/api/fx/config/route.ts
/**
 * /api/fx/config — SSOT endpoint for gateway FX feed initialization.
 *
 * OPTION A (selected.json):
 * - fx-pairs.json is the FX catalogue (universe)
 * - fx.selected.json is the ordered default selection for the free ribbon
 *
 * Gateway fetches this on startup to know which pairs to query.
 */

import { NextResponse } from 'next/server';

import fxPairsJson from '@/data/fx/fx-pairs.json';
import fxSelectedJson from '@/data/fx/fx.selected.json';

interface FxPairCatalog {
  id: string;
  base: string;
  quote: string;
  symbol?: string;
  isActive?: boolean;
  priority?: number;
}

interface FxSelected {
  version?: number;
  ssot?: string;
  selectedIds?: unknown;
}

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

function readSelectedIds(): string[] {
  const parsed = fxSelectedJson as unknown as FxSelected;
  const raw = parsed?.selectedIds;

  if (!Array.isArray(raw)) {
    throw new Error('fx.selected.json must contain a selectedIds array');
  }

  const ids = raw.map((v) => String(v));
  if (!ids.length) {
    throw new Error('fx.selected.json selectedIds must not be empty');
  }

  return ids;
}

export async function GET(): Promise<Response> {
  const allPairs = fxPairsJson as FxPairCatalog[];

  // Filter active pairs only
  const activePairs = allPairs.filter((p) => p.isActive !== false);

  // Defaults are defined ONLY by fx.selected.json (order is explicit)
  const defaultPairIds = readSelectedIds();

  // Validate that selected IDs exist in the active catalogue
  const activeIdSet = new Set(activePairs.map((p) => p.id));
  const missing = defaultPairIds.filter((id) => !activeIdSet.has(id));
  if (missing.length) {
    throw new Error(`fx.selected.json references unknown or inactive IDs: ${missing.join(', ')}`);
  }

  // Build response format expected by the gateway
  const pairs = activePairs.map((p) => ({
    id: p.id,
    base: p.base,
    quote: p.quote,
    symbol: p.symbol ?? `${p.base}/${p.quote}`,
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
