// src/app/api/commodities/config/route.ts
/**
 * /api/commodities/config — SSOT endpoint for gateway Commodities feed initialization.
 *
 * Returns commodities catalog with default items for the ribbon.
 * Gateway fetches this on startup to know which commodities to query.
 *
 * Note: Commodities provider is currently TBD (TwelveData removed Jan 2026).
 * This endpoint still exists so gateway fallback works correctly.
 *
 * Data source: frontend/src/data/commodities/commodities.catalog.json
 */

import { NextResponse } from 'next/server';

import commoditiesCatalogJson from '@/data/commodities/commodities.catalog.json';

// Type for commodity from catalog
interface CommodityCatalog {
  id: string;
  name: string;
  shortName?: string;
  symbol?: string;
  group?: string;
  subGroup?: string;
  emoji?: string;
  isActive?: boolean;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  isSelectableInRibbon?: boolean;
  demoPrice?: number;
  priority?: number;
}

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const allCommodities = commoditiesCatalogJson as CommodityCatalog[];

  // Filter active commodities only
  const activeCommodities = allCommodities.filter((c) => c.isActive !== false);

  // Get default commodities (isDefaultFree = true)
  const defaultCommodityIds = activeCommodities
    .filter((c) => c.isDefaultFree === true)
    .map((c) => c.id);

  // Build response format expected by gateway
  const commodities = activeCommodities.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName ?? null,
    symbol: c.symbol ?? null,
    group: c.group ?? null,
    subGroup: c.subGroup ?? null,
    emoji: c.emoji ?? null,
    isDefaultFree: c.isDefaultFree ?? false,
    isDefaultPaid: c.isDefaultPaid ?? false,
    isSelectableInRibbon: c.isSelectableInRibbon ?? true,
    demoPrice: c.demoPrice ?? null,
    priority: c.priority ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'frontend/src/data/commodities/commodities.catalog.json',
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
