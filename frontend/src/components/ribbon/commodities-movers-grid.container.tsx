// src/components/ribbon/commodities-movers-grid.container.tsx
// ============================================================================
// COMMODITIES MOVERS GRID - CONTAINER
// ============================================================================
// Orchestrator for the Commodities movers grid:
// - Polls /api/commodities via centralised useCommoditiesQuotes hook
// - Polls /api/fx via centralised useFxQuotes hook for EUR/GBP conversions
// - Joins SSOT commodity metadata + API quotes + FX rates
// - Sorts by % change to get top 4 winners and losers
// - Re-sorts every ~10 minutes (rolling evaluation)
// - Passes data to presentational CommoditiesMoversGrid component
//
// v2.1: EUR/GBP Conversion Support (4 Feb 2026)
// - Fetches FX rates via useFxQuotes hook
// - Builds ConversionRates from FX data
// - Passes rates to sortCommoditiesIntoMovers for EUR/GBP display
//
// Refresh schedule (coordinated with FX):
// - FX (Top):     Even hours (:00, :02, :04...)
// - FX (Bottom):  Odd hours (:01, :03, :05...)
// - Commodities:  :10, :40 (10 min offset from FX)
//
// Authority: Compacted conversation 2026-02-04
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo, useRef, useCallback } from 'react';

import CommoditiesMoversGrid from '@/components/ribbon/commodities-movers-grid';
import { useCommoditiesQuotes } from '@/hooks/use-commodities-quotes';
import { useFxQuotes } from '@/hooks/use-fx-quotes';
import {
  sortCommoditiesIntoMovers,
  getEmptyMovers,
  type CommodityCatalogEntry,
} from '@/lib/commodities/sort-movers';
import { buildConversionRates } from '@/lib/commodities/convert';
import type { SortedCommodityMovers } from '@/types/commodities-movers';

// Import the full catalog
import catalogJson from '@/data/commodities/commodities.catalog.json';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum time between re-sorts (in milliseconds).
 * Prevents jarring card shuffles when data updates frequently.
 * Design spec: ~10 minutes
 */
const RE_SORT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Number of winners and losers to display.
 */
const TOP_N = 4;

// ============================================================================
// CATALOG PREPARATION
// ============================================================================

/**
 * Cast the imported JSON to our type.
 * The catalog has more fields than we need; we only use a subset.
 */
const catalog = catalogJson as unknown as CommodityCatalogEntry[];

// ============================================================================
// COMPONENT
// ============================================================================

export default function CommoditiesMoversGridContainer(): React.ReactElement {
  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch commodities data via centralised polling
  const { quotes, movementById, status: commoditiesStatus } = useCommoditiesQuotes({
    enabled: true,
  });

  // Fetch FX data for EUR/GBP conversions
  // Uses the same centralised polling as the FX ribbons
  const { quotesById: fxQuotesById, status: fxStatus } = useFxQuotes({
    enabled: true,
  });

  // ============================================================================
  // BUILD CONVERSION RATES FROM FX DATA
  // ============================================================================

  const conversionRates = useMemo(() => {
    // Only build rates if we have FX data
    if (fxStatus !== 'ready' || fxQuotesById.size === 0) {
      return null;
    }
    return buildConversionRates(fxQuotesById);
  }, [fxQuotesById, fxStatus]);

  // ============================================================================
  // ROLLING SORT LOGIC
  // ============================================================================

  // Track last sort time and cached result
  const lastSortRef = useRef<{
    sortedAt: number;
    result: SortedCommodityMovers;
    quotesKey: string;
    ratesKey: string;
  } | null>(null);

  // Re-sorts only when:
  // 1. We have no cached result yet
  // 2. Data has changed AND enough time has passed since last sort
  // This prevents jarring shuffles while still staying reasonably current.

  const shouldResort = useCallback(
    (quotesKey: string, ratesKey: string): boolean => {
      // No cache → always sort
      if (!lastSortRef.current) return true;

      // Check if enough time has passed
      const elapsed = Date.now() - lastSortRef.current.sortedAt;
      if (elapsed < RE_SORT_INTERVAL_MS) {
        // Time not passed, but check if FX rates changed significantly
        // (allows immediate EUR/GBP update on first FX data)
        if (lastSortRef.current.ratesKey !== ratesKey && lastSortRef.current.ratesKey === '') {
          return true; // First time getting FX rates
        }
        return false;
      }

      // Time has passed → resort
      return true;
    },
    [],
  );

  // Create a stable key from quotes to detect changes
  const quotesKey = useMemo(() => {
    if (!quotes.length) return '';
    return quotes
      .map((q) => `${q.id}:${q.value}:${movementById[q.id]?.deltaPct ?? 0}`)
      .sort()
      .join('|');
  }, [quotes, movementById]);

  // Create a stable key from FX rates to detect changes
  const ratesKey = useMemo(() => {
    if (!conversionRates) return '';
    return Object.entries(conversionRates)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}:${v?.toFixed(4)}`)
      .sort()
      .join('|');
  }, [conversionRates]);

  // Compute sorted movers with rolling evaluation
  const movers = useMemo<SortedCommodityMovers>(() => {
    // No quotes yet → return empty or cached
    if (!quotes.length || !Object.keys(movementById).length) {
      return lastSortRef.current?.result ?? getEmptyMovers();
    }

    // Check if we should resort
    if (!shouldResort(quotesKey, ratesKey)) {
      return lastSortRef.current?.result ?? getEmptyMovers();
    }

    // Perform sort with conversion rates
    const sorted = sortCommoditiesIntoMovers(
      quotes,
      movementById,
      catalog,
      TOP_N,
      conversionRates, // v2.1: Pass FX rates for EUR/GBP conversions
    );

    // Cache result
    lastSortRef.current = {
      sortedAt: sorted.sortedAt,
      result: sorted,
      quotesKey,
      ratesKey,
    };

    return sorted;
  }, [quotes, movementById, quotesKey, ratesKey, shouldResort, conversionRates]);

  // ============================================================================
  // LOADING AND STALE STATES
  // ============================================================================

  const isLoading = commoditiesStatus === 'loading' && !lastSortRef.current;
  const isStale = commoditiesStatus === 'loading' && Boolean(lastSortRef.current);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <CommoditiesMoversGrid
      winners={movers.winners}
      losers={movers.losers}
      isLoading={isLoading}
      isStale={isStale}
    />
  );
}
