// src/hooks/use-ai-optimisation.ts
// ============================================================================
// useAiOptimisation — AI Prompt Optimisation (Call 3) + Animation Controller
// ============================================================================
// Calls POST /api/optimise-prompt to optimise the assembled prompt for
// a specific provider. Manages the algorithm cycling animation timing
// that plays during the API call.
//
// Animation phases (ai-disguise.md §8):
//   Phase 1 — Fast cycling (160–200ms) while waiting for API response
//   Phase 2 — Deceleration (350→500→700→1000ms) after response arrives
//   Phase 3 — Landing ("✓ 97 algorithms applied") then reveal
//
// Human factors:
//   §3 Anticipatory Dopamine — the cycling animation creates the
//       expectation-acceleration-reward pattern.
//   §6 Temporal Compression — reading speed makes 2–4s feel shorter.
//   §18 Animation as Communication — answers "Is something happening?"
//
// Authority: ai-disguise.md §6, §8, §10
// Scope: Prompt Lab (/studio/playground) ONLY
// One Brain rule: Does NOT replace client-side optimizer for standard builder.
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { shuffleAlgorithms, FINALE_NAMES, getAlgorithmCount } from '@/data/algorithm-names';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Provider context for optimisation (richer than tier generation context
 * because optimisation needs idealMin/idealMax/maxChars/categoryOrder).
 */
export interface OptimisationProviderContext {
  name: string;
  tier: number;
  promptStyle: string;
  sweetSpot: number;
  tokenLimit: number;
  maxChars: number | null;
  idealMin: number;
  idealMax: number;
  qualityPrefix?: string[];
  weightingSyntax?: string;
  supportsWeighting?: boolean;
  negativeSupport: 'separate' | 'inline' | 'none' | 'converted';
  categoryOrder?: string[];
}

/** The result returned by the API after optimisation */
export interface AiOptimiseResult {
  /** The optimised prompt text */
  optimised: string;
  /** The optimised negative prompt */
  negative?: string;
  /** Brief descriptions of changes made (for transparency panel) */
  changes: string[];
  /** Character count of optimised prompt */
  charCount: number;
  /** Estimated token count */
  tokenEstimate: number;
}

/** Animation state exposed to the UI */
export type AnimationPhase = 'idle' | 'cycling' | 'decelerating' | 'landing' | 'complete';

export interface UseAiOptimisationReturn {
  /** The AI-optimised result (null until first optimisation) */
  result: AiOptimiseResult | null;
  /** Whether the API call + animation sequence is in progress */
  isOptimising: boolean;
  /** Error message if the call failed */
  error: string | null;
  /** Current animation phase */
  animationPhase: AnimationPhase;
  /** Current algorithm name being displayed (during cycling/decelerating) */
  currentAlgorithm: string | null;
  /** The final "N algorithms applied" count (set during landing phase) */
  algorithmCount: number | null;
  /** Trigger optimisation */
  optimise: (
    promptText: string,
    providerId: string,
    providerContext: OptimisationProviderContext,
    originalSentence?: string,
  ) => Promise<boolean>;
  /** Clear all results and reset animation */
  clear: () => void;
}

// ============================================================================
// TIMING CONSTANTS (ai-disguise.md §8)
// ============================================================================

/** Fast cycling interval range (ms) — randomised per cycle */
const CYCLE_MIN_MS = 160;
const CYCLE_MAX_MS = 200;

/** Deceleration intervals (ms) — slot-machine slowdown */
const DECEL_INTERVALS = [350, 500, 700, 1000] as const;

/** Minimum total animation display time (ms) */
const MIN_DISPLAY_MS = 1800;

/** Pause after landing message before revealing result (ms) */
const LANDING_PAUSE_MS = 400;

/** Hard timeout — stop animation with error (ms) */
const HARD_TIMEOUT_MS = 12000;

// ============================================================================
// HELPERS
// ============================================================================

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Sleep for ms */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// HOOK
// ============================================================================

export function useAiOptimisation(): UseAiOptimisationReturn {
  const [result, setResult] = useState<AiOptimiseResult | null>(null);
  const [isOptimising, setIsOptimising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [currentAlgorithm, setCurrentAlgorithm] = useState<string | null>(null);
  const [algorithmCount, setAlgorithmCount] = useState<number | null>(null);

  // Refs for coordinating async animation with API response
  const abortRef = useRef<AbortController | null>(null);
  const apiResolvedRef = useRef(false);
  const apiResultRef = useRef<AiOptimiseResult | null>(null);
  const apiErrorRef = useRef<string | null>(null);
  const cancelAnimationRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationRef.current = true;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const optimise = useCallback(
    async (
      promptText: string,
      providerId: string,
      providerContext: OptimisationProviderContext,
      originalSentence?: string,
    ): Promise<boolean> => {
      if (!promptText.trim()) {
        setError('No prompt text to optimise.');
        return false;
      }

      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset state
      cancelAnimationRef.current = false;
      apiResolvedRef.current = false;
      apiResultRef.current = null;
      apiErrorRef.current = null;
      setResult(null);
      setError(null);
      setIsOptimising(true);
      setAlgorithmCount(null);

      const animationStart = Date.now();

      // ── Fire API call (runs in background while animation plays) ────
      const apiPromise = (async () => {
        try {
          const res = await fetch('/api/optimise-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              promptText: promptText.trim(),
              originalSentence: originalSentence?.trim(),
              providerId,
              providerContext,
            }),
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          if (!res.ok) {
            const data = await res.json().catch(() => ({ message: 'Request failed' }));
            apiErrorRef.current = data.message ?? 'Optimisation failed. Please try again.';
          } else {
            const data = await res.json();
            if (data.result) {
              apiResultRef.current = data.result as AiOptimiseResult;
            } else {
              apiErrorRef.current = 'No optimisation result returned.';
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.error('[useAiOptimisation] API error:', err);
          apiErrorRef.current = 'Something went wrong. Please try again.';
        } finally {
          apiResolvedRef.current = true;
        }
      })();

      // ── Phase 1: Fast cycling ──────────────────────────────────────
      setAnimationPhase('cycling');
      const shuffled = shuffleAlgorithms();
      let index = 0;

      // Cycle through algorithm names until API resolves AND minimum time elapsed
      while (
        !cancelAnimationRef.current &&
        (!apiResolvedRef.current || Date.now() - animationStart < MIN_DISPLAY_MS)
      ) {
        // Hard timeout safety valve
        if (Date.now() - animationStart > HARD_TIMEOUT_MS) {
          break;
        }

        const name = shuffled[index % shuffled.length];
        if (name) setCurrentAlgorithm(name);
        index++;

        await sleep(randInt(CYCLE_MIN_MS, CYCLE_MAX_MS));
      }

      if (cancelAnimationRef.current) {
        setIsOptimising(false);
        setAnimationPhase('idle');
        return false;
      }

      // ── Phase 2: Deceleration ──────────────────────────────────────
      setAnimationPhase('decelerating');

      // Show a few more from the shuffled list with increasing delay
      for (const interval of DECEL_INTERVALS) {
        if (cancelAnimationRef.current) break;
        const name = shuffled[index % shuffled.length];
        if (name) setCurrentAlgorithm(name);
        index++;
        await sleep(interval);
      }

      // Show finale names (last 3)
      for (const finaleName of FINALE_NAMES) {
        if (cancelAnimationRef.current) break;
        setCurrentAlgorithm(finaleName);
        await sleep(800);
      }

      if (cancelAnimationRef.current) {
        setIsOptimising(false);
        setAnimationPhase('idle');
        return false;
      }

      // ── Ensure API has resolved ────────────────────────────────────
      await apiPromise;

      // ── Phase 3: Landing ───────────────────────────────────────────
      const count = getAlgorithmCount();
      setAlgorithmCount(count);
      setAnimationPhase('landing');
      setCurrentAlgorithm(`✓ ${count} algorithms applied`);

      await sleep(LANDING_PAUSE_MS);

      // ── Complete: reveal result or error ────────────────────────────
      if (apiErrorRef.current) {
        setError(apiErrorRef.current);
        setAnimationPhase('idle');
        setCurrentAlgorithm(null);
        setIsOptimising(false);
        return false;
      }

      if (apiResultRef.current) {
        setResult(apiResultRef.current);
        setAnimationPhase('complete');
        setCurrentAlgorithm(null);
        setIsOptimising(false);
        return true;
      }

      // Shouldn't reach here, but safety fallback
      setError('No result received.');
      setAnimationPhase('idle');
      setCurrentAlgorithm(null);
      setIsOptimising(false);
      return false;
    },
    [],
  );

  const clear = useCallback(() => {
    cancelAnimationRef.current = true;
    if (abortRef.current) abortRef.current.abort();
    setResult(null);
    setError(null);
    setAnimationPhase('idle');
    setCurrentAlgorithm(null);
    setAlgorithmCount(null);
    setIsOptimising(false);
  }, []);

  return {
    result,
    isOptimising,
    error,
    animationPhase,
    currentAlgorithm,
    algorithmCount,
    optimise,
    clear,
  };
}
