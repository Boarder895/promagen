// src/app/api/commodities/catalog/route.ts
/**
 * /api/commodities/catalog — Expose the commodities catalogue (SSOT universe).
 *
 * Used by:
 * - Pro picker UI (future)
 * - Gateway symbol resolution (future)
 *
 * Strict SSOT rules:
 * - This endpoint exposes the catalogue (universe) only.
 * - The movers grid uses ALL active commodities dynamically.
 */

import { NextResponse } from 'next/server';

import commoditiesJson from '@/data/commodities/commodities.catalog.json';
import type { Commodity } from '@/types/finance-ribbon';

export const runtime = 'edge';
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const catalog = (commoditiesJson as Commodity[]).filter((c) => c.isActive !== false);

  const items = catalog.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName ?? null,
    symbol: c.symbol ?? null,
    group: c.group ?? null,
    subGroup: c.subGroup ?? null,
    emoji: c.emoji ?? null,
    quoteCurrency: c.quoteCurrency ?? null,
    isSelectableInRibbon: c.isSelectableInRibbon ?? true,
    priority: c.priority ?? null,
    tags: c.tags ?? null,
    ribbonLabel: c.ribbonLabel ?? c.name,
    ribbonSubtext: c.ribbonSubtext ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'src/data/commodities/commodities.catalog.json',
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
