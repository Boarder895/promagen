// src/app/api/crypto/catalog/route.ts
/**
 * /api/crypto/catalog — Expose the crypto assets catalogue (SSOT).
 *
 * Used by:
 * - Pro picker UI (future)
 * - Gateway symbol resolution (future)
 *
 * Data is public, but remains SSOT-driven and filtered.
 */

import { NextResponse } from 'next/server';

import { assetsCatalog } from '@/data/crypto';

export const runtime = 'edge';
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const catalog = assetsCatalog.filter((a) => a.isActive !== false);

  const items = catalog.map((a) => ({
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    rankHint: a.rankHint ?? null,
    isSelectableInRibbon: a.isSelectableInRibbon ?? true,
    tags: a.tags ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'src/data/crypto/assets.catalog.json',
      generatedAt: new Date().toISOString(),
      items,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
