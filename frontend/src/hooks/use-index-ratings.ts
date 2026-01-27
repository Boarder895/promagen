/**
 * Index Rating Data Hook
 * 
 * Hook for accessing Index Rating data for providers.
 * Handles database fetch, fallback logic, and display state.
 * 
 * @example
 * ```tsx
 * const { getRating, isLoading, error } = useIndexRatings(providerIds);
 * 
 * // Get rating for a specific provider
 * const midjourney = getRating('midjourney');
 * 
 * // Use in component
 * <IndexRatingCell rating={midjourney} />
 * ```
 * 
 * @see docs/authority/index-rating.md
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProviderRating, DisplayRating, ProviderMarketPower } from '@/types/index-rating';
import { getDisplayRating } from '@/lib/index-rating';

// =============================================================================
// TYPES
// =============================================================================

type Provider = {
  id: string;
  score?: number;
};

type UseIndexRatingsOptions = {
  /** Whether to poll for updates */
  polling?: boolean;
  /** Poll interval in milliseconds (default: 60000 = 1 minute) */
  pollInterval?: number;
  /** Market power data for badges */
  marketPowerData?: Record<string, ProviderMarketPower>;
};

type UseIndexRatingsReturn = {
  /** Get display rating for a provider */
  getRating: (providerId: string) => DisplayRating;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Last fetch timestamp */
  lastFetched: Date | null;
};

// =============================================================================
// API FETCH
// =============================================================================

type RatingsApiResponse = {
  ratings: Record<string, ProviderRating>;
  source: 'database' | 'fallback';
};

/**
 * Fetch ratings from API
 */
async function fetchRatings(providerIds: string[]): Promise<RatingsApiResponse> {
  const response = await fetch('/api/index-rating/ratings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ratings: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for accessing Index Rating data.
 */
export function useIndexRatings(
  providers: Provider[],
  options: UseIndexRatingsOptions = {}
): UseIndexRatingsReturn {
  const { 
    polling = false, 
    pollInterval = 60000,
    marketPowerData = {},
  } = options;

  const [ratings, setRatings] = useState<Map<string, ProviderRating>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Create provider map for quick lookup
  const providerMap = useMemo(() => {
    const map = new Map<string, Provider>();
    for (const provider of providers) {
      map.set(provider.id.toLowerCase(), provider);
    }
    return map;
  }, [providers]);

  // Provider IDs for fetch
  const providerIds = useMemo(
    () => providers.map(p => p.id.toLowerCase()),
    [providers]
  );

  // Fetch function
  const fetchData = useCallback(async () => {
    if (providerIds.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchRatings(providerIds);
      
      const ratingMap = new Map<string, ProviderRating>();
      for (const [id, rating] of Object.entries(data.ratings)) {
        // Convert from API response to ProviderRating type
        ratingMap.set(id.toLowerCase(), {
          providerId: rating.providerId,
          currentRating: rating.currentRating,
          previousRating: rating.previousRating,
          change: rating.change,
          changePercent: rating.changePercent,
          currentRank: rating.currentRank,
          previousRank: rating.previousRank,
          rankChangedAt: rating.rankChangedAt ? new Date(rating.rankChangedAt) : null,
          calculatedAt: new Date(rating.calculatedAt),
        });
      }
      
      setRatings(ratingMap);
      setLastFetched(new Date());
    } catch (err) {
      console.error('[useIndexRatings] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ratings');
    } finally {
      setIsLoading(false);
    }
  }, [providerIds]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling (if enabled)
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [polling, pollInterval, fetchData]);

  // Get rating function
  const getRating = useCallback((providerId: string): DisplayRating => {
    const normalizedId = providerId.toLowerCase();
    const provider = providerMap.get(normalizedId);
    const dbRating = ratings.get(normalizedId) || null;
    const marketPower = marketPowerData[normalizedId] || null;

    if (!provider) {
      // Provider not in list - return fallback
      return {
        rating: null,
        change: null,
        changePercent: null,
        state: 'fallback',
        source: 'fallback',
        rank: null,
        hasRankUp: false,
        isUnderdog: false,
        isNewcomer: false,
      };
    }

    return getDisplayRating(provider, dbRating, marketPower);
  }, [ratings, providerMap, marketPowerData]);

  return {
    getRating,
    isLoading,
    error,
    refetch: fetchData,
    lastFetched,
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default useIndexRatings;
