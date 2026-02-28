// src/hooks/prompt-intelligence/use-prompt-analysis.ts
// ============================================================================
// USE PROMPT ANALYSIS HOOK
// ============================================================================
// React hook for real-time prompt analysis with debouncing.
//
// Version: 1.2.0 — Inlined setTimeout body (no useCallback), consolidated state
//
// NOTE: This hook cannot use useSyncComputation because it genuinely needs
// debounced (async-ish) computation. The 4 synchronous hooks use the shared
// utility; this hook keeps useEffect + setTimeout for the debounce.
// ============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  analyzePrompt,
  type PromptState,
  type MarketContext,
  type PromptAnalysis,
} from '@/lib/prompt-intelligence';

import type { ScoringWeights } from '@/lib/learning/weight-recalibration';

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

  /** Per-tier scoring weights from Phase 6 (null = use static formula) */
  learnedWeights?: ScoringWeights | null;

  /** Platform tier ID for per-tier weights */
  tierId?: number;
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
// Internal State
// ============================================================================

interface AnalysisState {
  analysis: PromptAnalysis | null;
  isAnalyzing: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time prompt analysis with debouncing.
 *
 * All dynamic values are read from refs inside the setTimeout callback,
 * so the effect only re-fires when genuine input keys change — not when
 * unstable object references are recreated on re-render.
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
    learnedWeights,
    tierId,
  } = options;
  
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    analysis: null,
    isAnalyzing: false,
  });
  
  // ── Refs: hold latest values so the setTimeout body is always current ──
  const stateRef = useRef(state);
  stateRef.current = state;
  
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  
  const learnedWeightsRef = useRef(learnedWeights);
  learnedWeightsRef.current = learnedWeights;
  
  const tierIdRef = useRef(tierId);
  tierIdRef.current = tierId;
  
  // Memoize market context
  const marketContext = useMemo<MarketContext | undefined>(() => {
    if (!marketMoodEnabled) return undefined;
    return { enabled: true, data: marketData };
  }, [marketMoodEnabled, marketData]);
  
  const marketContextRef = useRef(marketContext);
  marketContextRef.current = marketContext;
  
  // ── Inline analysis function (reads everything from refs) ──────────────
  // Not wrapped in useCallback — called directly from setTimeout and from
  // the returned reanalyze. Reads all dynamic values from refs so it never
  // goes stale and never appears in useEffect deps.
  const runAnalysis = () => {
    if (!enabledRef.current) return;
    
    const result = analyzePrompt(stateRef.current, marketContextRef.current, {
      learnedWeights: learnedWeightsRef.current,
      tierId: tierIdRef.current,
    });
    
    setAnalysisState({ analysis: result, isAnalyzing: false });
  };
  
  // ── Stable dependency keys ─────────────────────────────────────────────
  const selectionsKey = JSON.stringify(state.selections);
  const negativesKey = JSON.stringify(state.negatives);
  
  // ── Debounced analysis on state change ─────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setAnalysisState({ analysis: null, isAnalyzing: false });
      return;
    }
    
    setAnalysisState(prev => ({ ...prev, isAnalyzing: true }));
    const timer = setTimeout(runAnalysis, debounceMs);
    return () => clearTimeout(timer);
     
  }, [
    state.subject,
    state.platformId,
    selectionsKey,
    negativesKey,
    enabled,
    debounceMs,
  ]);
  
  // Quick-access values
  const healthScore = analysisState.analysis?.healthScore ?? 0;
  const conflictCount = analysisState.analysis?.conflicts.conflicts.length ?? 0;
  const fillPercent = analysisState.analysis?.summary.fillPercent ?? 0;
  const hasHardConflicts = analysisState.analysis?.conflicts.hasHardConflicts ?? false;
  
  return {
    analysis: analysisState.analysis,
    isAnalyzing: analysisState.isAnalyzing,
    reanalyze: runAnalysis,
    healthScore,
    conflictCount,
    fillPercent,
    hasHardConflicts,
  };
}

export default usePromptAnalysis;
