// src/hooks/prompt-intelligence/use-market-mood.ts
// ============================================================================
// USE MARKET MOOD HOOK
// ============================================================================
// React hook for market mood detection and suggestions.
//
// Version: 1.2.0 — Uses shared useSyncComputation utility
// ============================================================================

import { useEffect, useMemo } from 'react';
import type { MarketState, SuggestedOption } from '@/lib/prompt-intelligence/types';
import {
  detectMarketState,
  getMarketMoodSuggestions,
  shouldShowMarketMood,
  getMarketMoodTheme,
  getMarketMoodIcon,
  type MarketDataInput,
} from '@/lib/prompt-intelligence';
import { useSyncComputation } from '@/hooks/use-sync-computation';

// ============================================================================
// Types
// ============================================================================

export interface UseMarketMoodOptions {
  /** Whether market mood is enabled (default: true) */
  enabled?: boolean;
  
  /** Maximum suggestions per category (default: 3) */
  maxSuggestionsPerCategory?: number;
  
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

export interface UseMarketMoodResult {
  /** Current market state */
  state: MarketState | null;
  
  /** Whether market mood should be shown (sufficient intensity) */
  isActive: boolean;
  
  /** Human-readable description */
  description: string | null;
  
  /** Theme colors for UI */
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
  
  /** Icon name for UI */
  icon: string | null;
  
  /** Market-influenced suggestions */
  suggestions: SuggestedOption[];
  
  /** Force refresh market state */
  refresh: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for market mood detection and suggestions.
 *
 * useSyncComputation handles the core detection + manual refresh.
 * useEffect only manages the auto-refresh interval timer.
 */
export function useMarketMood(
  marketData: MarketDataInput | undefined,
  options: UseMarketMoodOptions = {}
): UseMarketMoodResult {
  const {
    enabled = true,
    maxSuggestionsPerCategory = 3,
    refreshInterval = 0,
  } = options;
  
  // Stable key for market data changes
  const marketDataKey = JSON.stringify(marketData);
  
  // Core detection via shared utility
  const { value: detection, refresh } = useSyncComputation(
    () => {
      if (!enabled || !marketData) {
        return { state: null as MarketState | null, description: null as string | null };
      }
      const result = detectMarketState(marketData);
      return { state: result.state, description: result.description };
    },
    [enabled, marketDataKey]
  );
  
  const { state, description } = detection;
  
  // Auto-refresh interval — useEffect only for timer lifecycle
  useEffect(() => {
    if (refreshInterval <= 0 || !enabled) return;
    
    const timer = setInterval(refresh, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, enabled, refresh]);
  
  // Derived values
  const isActive = useMemo(() => (state ? shouldShowMarketMood(state) : false), [state]);
  
  const theme = useMemo(
    () => (state && isActive ? getMarketMoodTheme(state.type) : null),
    [state, isActive]
  );
  
  const icon = useMemo(
    () => (state && isActive ? getMarketMoodIcon(state.type) : null),
    [state, isActive]
  );
  
  const suggestions = useMemo(() => {
    if (!state || !isActive) return [];
    return getMarketMoodSuggestions(state, { maxPerCategory: maxSuggestionsPerCategory });
  }, [state, isActive, maxSuggestionsPerCategory]);
  
  return {
    state,
    isActive,
    description,
    theme,
    icon,
    suggestions,
    refresh,
  };
}

export default useMarketMood;
