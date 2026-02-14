// src/hooks/use-commodity-tooltip-data.ts
// ============================================================================
// COMMODITY TOOLTIP DATA HOOK
// ============================================================================
// Derives all data needed by CommodityPromptTooltip from the commodity ID
// and deltaPct that are already available on CommodityMoverData.
//
// Resolves:
//   commodityId → group (from catalog)
//   commodityId + deltaPct → sceneCountryCode (seeded random from pool)
//   sceneCountryCode → season (hemisphere-aware)
//
// This hook avoids needing to thread new props through the grid/container.
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 3
// Existing features preserved: Yes
// ============================================================================

import { useMemo } from 'react';

import { selectSceneCountry } from '@/lib/commodities/commodity-prompt-generator';
import {
  getCommodityCountryPool,
  deriveSeason,
} from '@/lib/commodities/country-weather-resolver';
import type { CommodityGroup } from '@/lib/commodities/commodity-prompt-types';
import type { Season } from '@/lib/commodities/country-weather-resolver';

// Import catalog for group lookup
import catalogJson from '@/data/commodities/commodities.catalog.json';

// ============================================================================
// CATALOG INDEX (built once at module load)
// ============================================================================

interface CatalogEntry {
  id: string;
  group: string;
  name: string;
}

const catalogById = new Map<string, CatalogEntry>();
for (const entry of catalogJson as CatalogEntry[]) {
  catalogById.set(entry.id, entry);
}

// ============================================================================
// TYPES
// ============================================================================

export interface CommodityTooltipData {
  /** High-level commodity group (energy / agriculture / metals) */
  group: CommodityGroup;
  /** Scene country code selected from producer pool */
  sceneCountryCode: string;
  /** Season at the scene country */
  season: Season;
  /** Whether this commodity has tooltip data (false if not in catalog) */
  available: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Derive tooltip data from commodity ID and deltaPct.
 * Memoised — only recomputes when inputs change.
 *
 * @example
 * const tooltipData = useCommodityTooltipData('gold', 3.2);
 * // → { group: 'metals', sceneCountryCode: 'ZA', season: 'winter', available: true }
 */
export function useCommodityTooltipData(
  commodityId: string,
  deltaPct: number,
): CommodityTooltipData {
  return useMemo(() => {
    // Look up catalog entry
    const entry = catalogById.get(commodityId);
    if (!entry) {
      return {
        group: 'metals' as CommodityGroup,
        sceneCountryCode: 'US',
        season: 'summer' as Season,
        available: false,
      };
    }

    // Map catalog group to CommodityGroup type
    const group = entry.group as CommodityGroup;

    // Get producer country pool and select a scene country
    const pool = getCommodityCountryPool(commodityId);
    const sceneCountryCode = pool.length > 0
      ? selectSceneCountry(pool, commodityId, deltaPct)
      : 'US';

    // Derive hemisphere-aware season
    const season = deriveSeason(sceneCountryCode) ?? 'summer';

    return {
      group,
      sceneCountryCode,
      season,
      available: true,
    };
  }, [commodityId, deltaPct]);
}
