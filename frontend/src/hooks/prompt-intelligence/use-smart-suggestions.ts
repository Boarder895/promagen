// src/hooks/prompt-intelligence/use-smart-suggestions.ts
// ============================================================================
// USE SMART SUGGESTIONS HOOK
// ============================================================================
// React hook for context-aware suggestions.
// ============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { SuggestedOption, MarketState } from '@/lib/prompt-intelligence/types';
import {
  getSuggestions,
  getTopSuggestions,
  detectMarketState,
  type MarketDataInput,
} from '@/lib/prompt-intelligence';

// ============================================================================
// Types
// ============================================================================

export interface UseSmartSuggestionsOptions {
  /** Maximum suggestions per category (default: 3) */
  maxPerCategory?: number;
  
  /** Maximum total suggestions for top suggestions (default: 10) */
  maxTotal?: number;
  
  /** Minimum score threshold (default: 55) */
  minScore?: number;
  
  /** Whether market mood is enabled */
  marketMoodEnabled?: boolean;
  
  /** Market data for mood detection */
  marketData?: MarketDataInput;
  
  /** Whether to enable suggestions (default: true) */
  enabled?: boolean;
  
  /** Custom subject text */
  customSubject?: string;
}

export interface UseSmartSuggestionsResult {
  /** Suggestions organized by category */
  byCategory: Partial<Record<PromptCategory, SuggestedOption[]>>;
  
  /** Top suggestions across all categories */
  topSuggestions: SuggestedOption[];
  
  /** Whether suggestions are loading */
  isLoading: boolean;
  
  /** Get suggestions for a specific category */
  forCategory: (category: PromptCategory) => SuggestedOption[];
  
  /** Refresh suggestions */
  refresh: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for context-aware suggestions.
 */
export function useSmartSuggestions(
  selections: Partial<Record<PromptCategory, string[]>>,
  options: UseSmartSuggestionsOptions = {}
): UseSmartSuggestionsResult {
  const {
    maxPerCategory = 3,
    maxTotal = 10,
    minScore = 55,
    marketMoodEnabled = false,
    marketData,
    enabled = true,
    customSubject,
  } = options;
  
  const [byCategory, setByCategory] = useState<Partial<Record<PromptCategory, SuggestedOption[]>>>({});
  const [topSuggestions, setTopSuggestions] = useState<SuggestedOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use ref for selections to avoid stale closures
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;
  
  // Detect market state if enabled
  const marketState = useMemo<MarketState | null>(() => {
    if (!marketMoodEnabled || !marketData) return null;
    return detectMarketState(marketData).state;
  }, [marketMoodEnabled, marketData]);
  
  // Stable key for selections
  const selectionsKey = JSON.stringify(selections);
  
  // Calculate suggestions
  const calculateSuggestions = useCallback(() => {
    if (!enabled) {
      setByCategory({});
      setTopSuggestions([]);
      return;
    }
    
    setIsLoading(true);
    
    // Get suggestions by category
    const result = getSuggestions({
      selections: selectionsRef.current,
      customSubject,
      maxPerCategory,
      marketMoodEnabled,
      marketState,
      minScore,
    });
    
    setByCategory(result.suggestions);
    
    // Get top suggestions
    const top = getTopSuggestions(selectionsRef.current, {
      maxTotal,
      market: marketMoodEnabled ? { enabled: true, data: marketData } : undefined,
    });
    
    setTopSuggestions(top);
    setIsLoading(false);
  }, [
    enabled,
    customSubject,
    maxPerCategory,
    maxTotal,
    minScore,
    marketMoodEnabled,
    marketState,
    marketData,
  ]);
  
  // Recalculate on changes
  useEffect(() => {
    calculateSuggestions();
     
  }, [calculateSuggestions, selectionsKey]);
  
  // Helper to get suggestions for a specific category
  const forCategory = useCallback((category: PromptCategory): SuggestedOption[] => {
    return byCategory[category] ?? [];
  }, [byCategory]);
  
  return {
    byCategory,
    topSuggestions,
    isLoading,
    forCategory,
    refresh: calculateSuggestions,
  };
}

export default useSmartSuggestions;
