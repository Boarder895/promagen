// src/hooks/prompt-intelligence/use-smart-suggestions.ts
// ============================================================================
// USE SMART SUGGESTIONS HOOK
// ============================================================================
// React hook for context-aware suggestions.
//
// Version: 1.2.0 — Uses shared useSyncComputation utility
// ============================================================================

import { useMemo, useCallback } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { SuggestedOption, MarketState } from '@/lib/prompt-intelligence/types';
import {
  getSuggestions,
  getTopSuggestions,
  detectMarketState,
  type MarketDataInput,
} from '@/lib/prompt-intelligence';
import { useSyncComputation } from '@/hooks/use-sync-computation';

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
  
  // Detect market state if enabled
  const marketState = useMemo<MarketState | null>(() => {
    if (!marketMoodEnabled || !marketData) return null;
    return detectMarketState(marketData).state;
  }, [marketMoodEnabled, marketData]);
  
  // Stable key for selections
  const selectionsKey = JSON.stringify(selections);
  
  // Core computation via shared utility
  const { value: computed, refresh } = useSyncComputation(
    () => {
      if (!enabled) {
        return {
          byCategory: {} as Partial<Record<PromptCategory, SuggestedOption[]>>,
          topSuggestions: [] as SuggestedOption[],
        };
      }
      
      const result = getSuggestions({
        selections,
        customSubject,
        maxPerCategory,
        marketMoodEnabled,
        marketState,
        minScore,
      });
      
      const top = getTopSuggestions(selections, {
        maxTotal,
        market: marketMoodEnabled ? { enabled: true, data: marketData } : undefined,
      });
      
      return {
        byCategory: result.suggestions,
        topSuggestions: top,
      };
    },
    [enabled, customSubject, maxPerCategory, maxTotal, minScore, marketMoodEnabled, marketState, marketData, selectionsKey]
  );
  
  // Helper to get suggestions for a specific category
  const forCategory = useCallback(
    (category: PromptCategory): SuggestedOption[] => computed.byCategory[category] ?? [],
    [computed.byCategory]
  );
  
  return {
    byCategory: computed.byCategory,
    topSuggestions: computed.topSuggestions,
    isLoading: false, // Synchronous — never loading
    forCategory,
    refresh,
  };
}

export default useSmartSuggestions;
