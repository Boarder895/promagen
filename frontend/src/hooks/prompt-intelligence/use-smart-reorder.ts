// src/hooks/prompt-intelligence/use-smart-reorder.ts
// ============================================================================
// USE SMART REORDER HOOK
// ============================================================================
// React hook for smart reordering of dropdown options.
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import {
  getOrderedOptions,
  type MarketDataInput,
} from '@/lib/prompt-intelligence';

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
  
  const [orderedOptions, setOrderedOptions] = useState<ScoredOption[]>([]);
  
  // Use ref for selections
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;
  
  // Stable keys for dependencies
  const selectionsKey = JSON.stringify(selections);
  const optionsKey = JSON.stringify(options);
  
  // Calculate ordered options
  const calculateOrder = useCallback(() => {
    if (!enabled || options.length === 0) {
      setOrderedOptions(options.map(o => ({ option: o, score: 50, isRecommended: false })));
      return;
    }
    
    const scored = getOrderedOptions({
      options,
      category,
      selections: selectionsRef.current,
      market: marketMoodEnabled ? { enabled: true, data: marketData } : undefined,
    });
    
    setOrderedOptions(scored.map(s => ({
      ...s,
      isRecommended: s.score >= recommendedThreshold,
    })));
  }, [enabled, options, category, marketMoodEnabled, marketData, recommendedThreshold]);
  
  // Recalculate on changes
  useEffect(() => {
    calculateOrder();
     
  }, [calculateOrder, selectionsKey, optionsKey]);
  
  // Derived values
  const optionStrings = useMemo(() => {
    return orderedOptions.map(o => o.option);
  }, [orderedOptions]);
  
  const recommended = useMemo(() => {
    return orderedOptions.filter(o => o.isRecommended).map(o => o.option);
  }, [orderedOptions]);
  
  // Score lookup map
  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    orderedOptions.forEach(o => map.set(o.option, o.score));
    return map;
  }, [orderedOptions]);
  
  // Recommended lookup set
  const recommendedSet = useMemo(() => {
    return new Set(recommended);
  }, [recommended]);
  
  // Helper functions
  const getScore = useCallback((option: string): number => {
    return scoreMap.get(option) ?? 50;
  }, [scoreMap]);
  
  const isRecommendedFn = useCallback((option: string): boolean => {
    return recommendedSet.has(option);
  }, [recommendedSet]);
  
  return {
    orderedOptions,
    options: optionStrings,
    recommended,
    getScore,
    isRecommended: isRecommendedFn,
    reorder: calculateOrder,
  };
}

export default useSmartReorder;
