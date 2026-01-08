// src/hooks/use-market-mood-live.ts
// ============================================================================
// USE MARKET MOOD LIVE HOOK
// ============================================================================
// Connects live FX data from /api/fx to the Market Mood engine.
// Replaces demo market state with real market conditions.
//
// Features:
// - Polls /api/fx endpoint for live data
// - Maps FX ribbon data to MarketDataInput format
// - Uses detectMarketState for intelligent state detection
// - Respects user preference (enabled/disabled)
// - Caches results with TTL to minimize API calls
// - Falls back to neutral state on error
//
// FIX v1.1.0 (Jan 2026):
// - Changed lastFetchTime from useState to useRef to prevent re-render loop
// - Increased MIN_FETCH_INTERVAL_MS from 30s to 60s to reduce API calls
// - Removed lastFetchTime from useCallback dependencies
//
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { MarketState } from '@/lib/prompt-intelligence/types';
import {
  detectMarketState,
  type MarketDataInput,
  type FXPairData,
  type ExchangeData,
  type MarketStateResult,
} from '@/lib/prompt-intelligence';

// ============================================================================
// Types
// ============================================================================

/**
 * FX quote from the API response.
 */
interface FxApiQuote {
  id: string;
  base: string;
  quote: string;
  price: number | null;
  providerSymbol: string;
}

/**
 * FX API response shape.
 */
interface FxApiResponse {
  meta: {
    mode: 'live' | 'cached' | 'fallback';
    asOf: string;
    sourceProvider: string;
    ttlSeconds?: number;
  };
  data: FxApiQuote[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Hook return type.
 */
export interface UseMarketMoodLiveReturn {
  /** The detected market state */
  marketState: MarketState | null;
  
  /** Full detection result with secondary states */
  detectionResult: MarketStateResult | null;
  
  /** Whether data is currently loading */
  isLoading: boolean;
  
  /** Error message if fetch failed */
  error: string | null;
  
  /** Data freshness timestamp */
  asOf: string | null;
  
  /** Data source mode */
  dataMode: 'live' | 'cached' | 'fallback' | null;
  
  /** Force refresh the data */
  refresh: () => void;
}

// ============================================================================
// Configuration
// ============================================================================

/** Polling interval in ms (5 minutes default) */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** 
 * Minimum time between fetches in ms (60 seconds).
 * Increased from 30s to reduce API quota consumption.
 */
const MIN_FETCH_INTERVAL_MS = 60 * 1000;

// ============================================================================
// Previous Close Cache (for change % calculation)
// ============================================================================

/**
 * In-memory cache for previous prices to calculate change %.
 * Since the API only gives current prices, we track previous values.
 */
const previousPriceCache = new Map<string, { price: number; timestamp: number }>();

/**
 * Get previous close or estimate from cache.
 */
function getPreviousClose(id: string, currentPrice: number): number {
  const cached = previousPriceCache.get(id);
  
  if (cached) {
    // If cache is old (> 1 day), use current as baseline
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs < 24 * 60 * 60 * 1000) {
      return cached.price;
    }
  }
  
  // No cache or stale - use current price (0% change)
  // This happens on first load; subsequent loads will have data
  previousPriceCache.set(id, { price: currentPrice, timestamp: Date.now() });
  return currentPrice;
}

/**
 * Update the previous price cache after market close simulation.
 * Called periodically to maintain realistic change percentages.
 */
function updatePriceCache(quotes: FxApiQuote[]): void {
  for (const quote of quotes) {
    if (quote.price !== null) {
      previousPriceCache.set(quote.id, {
        price: quote.price,
        timestamp: Date.now(),
      });
    }
  }
}

// ============================================================================
// Data Mapping
// ============================================================================

/**
 * Map FX API quotes to MarketDataInput format.
 */
function mapApiToMarketData(response: FxApiResponse): MarketDataInput {
  const fxPairs: FXPairData[] = [];
  
  for (const quote of response.data) {
    if (quote.price === null) continue;
    
    const previousClose = getPreviousClose(quote.id, quote.price);
    const changePercent = previousClose !== 0
      ? ((quote.price - previousClose) / previousClose) * 100
      : 0;
    
    fxPairs.push({
      pair: `${quote.base}/${quote.quote}`,
      rate: quote.price,
      previousClose,
      changePercent,
    });
  }
  
  // Derive exchange data from time of day (basic heuristic)
  const exchanges = deriveExchangeStatus();
  
  return {
    fxPairs,
    exchanges,
    commodities: [], // Could be extended with commodity data
    crypto: [], // Could be extended with crypto data
    timestamp: new Date(),
  };
}

/**
 * Derive exchange open/closed status from current time.
 * This is a simplified version - production could use actual market calendars.
 */
function deriveExchangeStatus(): ExchangeData[] {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay();
  
  // Weekend - all closed
  if (utcDay === 0 || utcDay === 6) {
    return [
      { exchangeId: 'NYSE', isOpen: false },
      { exchangeId: 'LSE', isOpen: false },
      { exchangeId: 'TSE', isOpen: false },
    ];
  }
  
  // Weekday exchange hours (simplified, in UTC)
  const exchanges: ExchangeData[] = [];
  
  // NYSE: 14:30 - 21:00 UTC
  const nyseOpen = utcHour >= 14 && utcHour < 21;
  const nyseMinutesToTransition = nyseOpen
    ? (21 - utcHour) * 60 - now.getUTCMinutes()
    : utcHour < 14
      ? (14 - utcHour) * 60 + 30 - now.getUTCMinutes()
      : 24 * 60 - (utcHour - 14) * 60; // Next day
  
  exchanges.push({
    exchangeId: 'NYSE',
    isOpen: nyseOpen,
    minutesUntilTransition: Math.abs(nyseMinutesToTransition),
  });
  
  // LSE: 08:00 - 16:30 UTC
  const lseOpen = utcHour >= 8 && utcHour < 17;
  const lseMinutesToTransition = lseOpen
    ? (16 - utcHour) * 60 + 30 - now.getUTCMinutes()
    : utcHour < 8
      ? (8 - utcHour) * 60 - now.getUTCMinutes()
      : 24 * 60 - (utcHour - 8) * 60;
  
  exchanges.push({
    exchangeId: 'LSE',
    isOpen: lseOpen,
    minutesUntilTransition: Math.abs(lseMinutesToTransition),
  });
  
  // TSE (Tokyo): 00:00 - 06:00 UTC (09:00 - 15:00 JST)
  const tseOpen = utcHour >= 0 && utcHour < 6;
  
  exchanges.push({
    exchangeId: 'TSE',
    isOpen: tseOpen,
    minutesUntilTransition: tseOpen
      ? (6 - utcHour) * 60 - now.getUTCMinutes()
      : utcHour < 24
        ? (24 - utcHour) * 60 - now.getUTCMinutes()
        : 60,
  });
  
  return exchanges;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for live market mood detection.
 * 
 * @param enabled - Whether market mood feature is enabled
 * @returns Market state and detection results
 * 
 * @example
 * ```tsx
 * const { marketState, isLoading, error } = useMarketMoodLive(isMarketMoodEnabled);
 * 
 * if (marketState) {
 *   console.log(marketState.type); // 'high_volatility', 'low_volatility', etc.
 * }
 * ```
 */
export function useMarketMoodLive(enabled: boolean): UseMarketMoodLiveReturn {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<FxApiResponse | null>(null);
  
  // CRITICAL FIX: Use ref instead of state for lastFetchTime
  // This prevents the re-render loop that was causing API call floods.
  // When lastFetchTime was state, updating it would:
  //   1. Recreate fetchFxData (because it was in deps)
  //   2. Trigger useEffect (because fetchFxData changed)
  //   3. Call fetchFxData again → infinite loop!
  const lastFetchTimeRef = useRef(0);
  
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch FX data
  // NOTE: No longer depends on lastFetchTime - uses ref instead
  const fetchFxData = useCallback(async (force: boolean = false) => {
    // Skip if disabled
    if (!enabled) return;
    
    // Rate limit client-side fetches using ref (no re-render)
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fx', {
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`FX API returned ${response.status}`);
      }
      
      const data = (await response.json()) as FxApiResponse;
      
      // Check for API-level error
      if (data.error) {
        throw new Error(data.error.message || 'FX API error');
      }
      
      // Update previous price cache periodically
      if (data.data && data.data.length > 0) {
        // Only update cache every hour to maintain change %
        const cacheAge = now - lastFetchTimeRef.current;
        if (cacheAge > 60 * 60 * 1000) {
          updatePriceCache(data.data);
        }
      }
      
      setRawResponse(data);
      
      // Update ref (not state!) - this is the key fix
      lastFetchTimeRef.current = now;
      
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      const message = err instanceof Error ? err.message : 'Failed to fetch FX data';
      setError(message);
      
    } finally {
      setIsLoading(false);
    }
  }, [enabled]); // FIXED: removed lastFetchTime dependency
  
  // Manual refresh
  const refresh = useCallback(() => {
    void fetchFxData(true);
  }, [fetchFxData]);
  
  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      // Clear polling when disabled
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    
    // Initial fetch
    void fetchFxData(true);
    
    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      void fetchFxData(false);
    }, POLL_INTERVAL_MS);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, fetchFxData]);
  
  // Compute market state from raw data
  const detectionResult = useMemo((): MarketStateResult | null => {
    if (!enabled || !rawResponse || rawResponse.data.length === 0) {
      return null;
    }
    
    const marketData = mapApiToMarketData(rawResponse);
    return detectMarketState(marketData);
  }, [enabled, rawResponse]);
  
  // Extract primary market state
  const marketState = useMemo((): MarketState | null => {
    return detectionResult?.state ?? null;
  }, [detectionResult]);
  
  // Meta info
  const asOf = rawResponse?.meta?.asOf ?? null;
  const dataMode = rawResponse?.meta?.mode ?? null;
  
  return {
    marketState,
    detectionResult,
    isLoading,
    error,
    asOf,
    dataMode,
    refresh,
  };
}

// ============================================================================
// Export
// ============================================================================

export default useMarketMoodLive;
