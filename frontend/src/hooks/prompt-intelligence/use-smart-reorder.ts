// src/hooks/prompt-intelligence/use-smart-reorder.ts
// ============================================================================
// USE SMART REORDER HOOK
// ============================================================================
// React hook for smart reordering of dropdown options.
//
// Version: 1.2.0 — Uses shared useSyncComputation utility
// ============================================================================

import { useCallback, useMemo } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import {
  getOrderedOptions,
  type MarketDataInput,
} from '@/lib/prompt-intelligence';
import { useSyncComputation } from '@/hooks/use-sync-computation';

// ============================================================================
// Types
// ============================================================================

export interface ScoredOption {
  /** The option text */
  option: string;
  
  /** Relevance score (0-100) */
  score: number;
  
  /** Whether this option is recommended */
  isRecommended: boolean;
}

export interface UseSmartReorderOptions {
  /** Whether market mood influences ordering */
  marketMoodEnabled?: boolean;
  
  /** Market data for mood detection */
  marketData?: MarketDataInput;
  
  /** Whether reordering is enabled (default: true) */
  enabled?: boolean;
  
  /** Minimum score to be considered recommended (default: 65) */
  recommendedThreshold?: number;
}

export interface UseSmartReorderResult {
  /** Reordered options with scores */
  orderedOptions: ScoredOption[];
  
  /** Just the option strings in order */
  options: string[];
  
  /** Recommended options (score >= threshold) */
  recommended: string[];
  
  /** Get score for a specific option */
  getScore: (option: string) => number;
  
  /** Check if option is recommended */
  isRecommended: (option: string) => boolean;
  
  /** Force re-order */
  reorder: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for smart reordering of dropdown options.
 */
export function useSmartReorder(
  options: string[],
  category: PromptCategory,
  selections: Partial<Record<PromptCategory, string[]>>,
  hookOptions: UseSmartReorderOptions = {}
): UseSmartReorderResult {
  const {
    marketMoodEnabled = false,
    marketData,
    enabled = true,
    recommendedThreshold = 65,
  } = hookOptions;
  
  // Stable keys for dependency tracking
  const selectionsKey = JSON.stringify(selections);
  const optionsKey = JSON.stringify(options);
  
  // Core computation via shared utility
  const { value: orderedOptions, refresh: reorder } = useSyncComputation<ScoredOption[]>(
    () => {
      if (!enabled || options.length === 0) {
        return options.map(o => ({ option: o, score: 50, isRecommended: false }));
      }
      
      const scored = getOrderedOptions({
        options,
        category,
        selections,
        market: marketMoodEnabled ? { enabled: true, data: marketData } : undefined,
      });
      
      return scored.map(s => ({
        ...s,
        isRecommended: s.score >= recommendedThreshold,
      }));
    },
    [enabled, optionsKey, category, selectionsKey, marketMoodEnabled, marketData, recommendedThreshold]
  );
  
  // Derived values
  const optionStrings = useMemo(() => orderedOptions.map(o => o.option), [orderedOptions]);
  
  const recommended = useMemo(
    () => orderedOptions.filter(o => o.isRecommended).map(o => o.option),
    [orderedOptions]
  );
  
  // Lookup structures
  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    orderedOptions.forEach(o => map.set(o.option, o.score));
    return map;
  }, [orderedOptions]);
  
  const recommendedSet = useMemo(() => new Set(recommended), [recommended]);
  
  // Helpers
  const getScore = useCallback(
    (option: string): number => scoreMap.get(option) ?? 50,
    [scoreMap]
  );
  
  const isRecommendedFn = useCallback(
    (option: string): boolean => recommendedSet.has(option),
    [recommendedSet]
  );
  
  return {
    orderedOptions,
    options: optionStrings,
    recommended,
    getScore,
    isRecommended: isRecommendedFn,
    reorder,
  };
}

export default useSmartReorder;
