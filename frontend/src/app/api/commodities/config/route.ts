// src/app/api/commodities/config/route.ts
/**
 * /api/commodities/config — SSOT endpoint for gateway Commodities feed initialisation.
 *
 * Option A (selected.json list):
 * - Free-tier defaults come ONLY from src/data/commodities/commodities.selected.json (ordered).
 * - Paid users may select any IDs from src/data/commodities/commodities.catalog.json (validated in gateway).
 *
 * Strict SSOT rules:
 * - No demo/synthetic prices are emitted.
 * - Defaults must be a subset of the catalogue; if not, this route throws.
 *
 * Data sources:
 * - frontend/src/data/commodities/commodities.catalog.json
 * - frontend/src/data/commodities/commodities.selected.json
 */

import { NextResponse } from 'next/server';

import commoditiesCatalogJson from '@/data/commodities/commodities.catalog.json';
import commoditiesSelectedJson from '@/data/commodities/commodities.selected.json';

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

type CommoditiesSelected = {
  ids: string[];
};

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const all = commoditiesCatalogJson as CommodityCatalogItem[];
  const selected = commoditiesSelectedJson as CommoditiesSelected;

  const active = all.filter((c) => c.isActive !== false);

  const defaultCommodityIds = Array.isArray(selected.ids) ? selected.ids : [];

  const idSet = new Set(active.map((c) => c.id));
  const missing = defaultCommodityIds.filter((id) => !idSet.has(id));

  if (missing.length > 0) {
    throw new Error(
      `commodities SSOT integrity error: commodities.selected.json contains ids not present in commodities.catalog.json: ${missing.join(
        ', ',
      )}`,
    );
  }

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
      version: 1,
      ssot: {
        catalog: 'frontend/src/data/commodities/commodities.catalog.json',
        selected: 'frontend/src/data/commodities/commodities.selected.json',
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
