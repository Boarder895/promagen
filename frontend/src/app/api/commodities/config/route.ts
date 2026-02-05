// src/app/api/commodities/config/route.ts
/**
 * /api/commodities/config — SSOT endpoint for gateway Commodities feed initialisation.
 *
 * Returns ALL active commodities from the catalog for the movers grid.
 * The gateway fetches prices for all 78 commodities, and the frontend
 * sorts them to display top 4 winners and top 4 losers dynamically.
 *
 * Strict SSOT rules:
 * - No demo/synthetic prices are emitted.
 * - Only active commodities (isActive !== false) are included.
 *
 * Data source:
 * - frontend/src/data/commodities/commodities.catalog.json
 *
 * Authority: Compacted conversation 2026-02-03 (commodities movers grid)
 * Existing features preserved: Yes
 */

import { NextResponse } from 'next/server';

import commoditiesCatalogJson from '@/data/commodities/commodities.catalog.json';

type CommodityCatalogItem = {
  id: string;
  name: string;
  shortName?: string;
  symbol?: string;
  group?: string;
  subGroup?: string;
  emoji?: string;
  quoteCurrency?: string;
  isActive?: boolean;
  isSelectableInRibbon?: boolean;
  priority?: number;
  ribbonLabel?: string;
  ribbonSubtext?: string;
};

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const all = commoditiesCatalogJson as CommodityCatalogItem[];

  // Filter to only active commodities
  const active = all.filter((c) => c.isActive !== false);

  // Return ALL active commodity IDs for the gateway to fetch
  // The movers grid dynamically sorts these to find winners/losers
  const defaultCommodityIds = active.map((c) => c.id);

  const commodities = active.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName ?? null,
    symbol: c.symbol ?? null,
    group: c.group ?? null,
    subGroup: c.subGroup ?? null,
    emoji: c.emoji ?? null,
    quoteCurrency: c.quoteCurrency ?? null,
    isActive: c.isActive ?? true,
    isSelectableInRibbon: c.isSelectableInRibbon ?? true,
    priority: c.priority ?? null,
    ribbonLabel: c.ribbonLabel ?? c.name,
    ribbonSubtext: c.ribbonSubtext ?? null,
  }));

  return NextResponse.json(
    {
      version: 2,
      ssot: {
        catalog: 'frontend/src/data/commodities/commodities.catalog.json',
      },
      generatedAt: new Date().toISOString(),
      defaultCommodityIds,
      commodities,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
