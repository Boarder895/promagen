// src/hooks/prompt-intelligence/use-prompt-analysis.ts
// ============================================================================
// USE PROMPT ANALYSIS HOOK
// ============================================================================
// React hook for real-time prompt analysis with debouncing.
// ============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  analyzePrompt,
  type PromptState,
  type MarketContext,
  type PromptAnalysis,
} from '@/lib/prompt-intelligence';

// ============================================================================
// Types
// ============================================================================

export interface UsePromptAnalysisOptions {
  /** Debounce delay in ms (default: 150) */
  debounceMs?: number;
  
  /** Whether to enable market mood (default: false) */
  marketMoodEnabled?: boolean;
  
  /** Market data for mood detection */
  marketData?: MarketContext['data'];
  
  /** Whether analysis is enabled (default: true) */
  enabled?: boolean;
}

export interface UsePromptAnalysisResult {
  /** Current analysis result */
  analysis: PromptAnalysis | null;
  
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  
  /** Force immediate re-analysis */
  reanalyze: () => void;
  
  /** Quick access to health score */
  healthScore: number;
  
  /** Quick access to conflict count */
  conflictCount: number;
  
  /** Quick access to fill percentage */
  fillPercent: number;
  
  /** Whether prompt has hard conflicts */
  hasHardConflicts: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time prompt analysis with debouncing.
 */
export function usePromptAnalysis(
  state: PromptState,
  options: UsePromptAnalysisOptions = {}
): UsePromptAnalysisResult {
  const {
    debounceMs = 150,
    marketMoodEnabled = false,
    marketData,
    enabled = true,
  } = options;
  
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Track latest state for debounced callback
  const stateRef = useRef(state);
  stateRef.current = state;
  
  // Memoize market context
  const marketContext = useMemo<MarketContext | undefined>(() => {
    if (!marketMoodEnabled) return undefined;
    return {
      enabled: true,
      data: marketData,
    };
  }, [marketMoodEnabled, marketData]);
  
  // Perform analysis
  const performAnalysis = useCallback(() => {
    if (!enabled) return;
    
    setIsAnalyzing(true);
    
    // Run analysis synchronously (it's all client-side)
    const result = analyzePrompt(stateRef.current, marketContext);
    
    setAnalysis(result);
    setIsAnalyzing(false);
  }, [enabled, marketContext]);
  
  // Create stable key for dependency tracking
  const selectionsKey = JSON.stringify(state.selections);
  const negativesKey = JSON.stringify(state.negatives);
  
  // Debounced analysis on state change
  useEffect(() => {
    if (!enabled) {
      setAnalysis(null);
      return;
    }
    
    const timer = setTimeout(performAnalysis, debounceMs);
    return () => clearTimeout(timer);
     
  }, [
    state.subject,
    state.platformId,
    selectionsKey,
    negativesKey,
    enabled,
    debounceMs,
    performAnalysis,
  ]);
  
  // Extract quick-access values
  const healthScore = analysis?.healthScore ?? 0;
  const conflictCount = analysis?.conflicts.conflicts.length ?? 0;
  const fillPercent = analysis?.summary.fillPercent ?? 0;
  const hasHardConflicts = analysis?.conflicts.hasHardConflicts ?? false;
  
  return {
    analysis,
    isAnalyzing,
    reanalyze: performAnalysis,
    healthScore,
    conflictCount,
    fillPercent,
    hasHardConflicts,
  };
}

export default usePromptAnalysis;
