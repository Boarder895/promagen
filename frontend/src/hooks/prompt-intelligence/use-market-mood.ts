// src/hooks/prompt-intelligence/use-market-mood.ts
// ============================================================================
// USE MARKET MOOD HOOK
// ============================================================================
// React hook for market mood detection and suggestions.
// ============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MarketState, SuggestedOption } from '@/lib/prompt-intelligence/types';
import {
  detectMarketState,
  getMarketMoodSuggestions,
  shouldShowMarketMood,
  getMarketMoodTheme,
  getMarketMoodIcon,
  type MarketDataInput,
} from '@/lib/prompt-intelligence';

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
  
  const [state, setState] = useState<MarketState | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  
  // Use ref to avoid stale closures
  const marketDataRef = useRef(marketData);
  marketDataRef.current = marketData;
  
  // Stable key for market data changes
  const marketDataKey = JSON.stringify(marketData);
  
  // Detect market state
  const detectState = useCallback(() => {
    if (!enabled || !marketDataRef.current) {
      setState(null);
      setDescription(null);
      return;
    }
    
    const result = detectMarketState(marketDataRef.current);
    setState(result.state);
    setDescription(result.description);
  }, [enabled]);
  
  // Initial detection and on data change
  useEffect(() => {
    detectState();
     
  }, [detectState, marketDataKey]);
  
  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0 || !enabled) return;
    
    const timer = setInterval(detectState, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, enabled, detectState]);
  
  // Derived values
  const isActive = useMemo(() => {
    return state ? shouldShowMarketMood(state) : false;
  }, [state]);
  
  const theme = useMemo(() => {
    return state && isActive ? getMarketMoodTheme(state.type) : null;
  }, [state, isActive]);
  
  const icon = useMemo(() => {
    return state && isActive ? getMarketMoodIcon(state.type) : null;
  }, [state, isActive]);
  
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
    refresh: detectState,
  };
}

export default useMarketMood;
