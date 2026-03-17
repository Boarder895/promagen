// src/hooks/use-ab-test.ts
// ============================================================================
// A/B TEST VARIANT ASSIGNMENT — Client Hook
// ============================================================================
//
// Phase 7.6, Part 7.6e — Fetches the user's A/B test variant assignment
// from GET /api/learning/ab-assignment and exposes it to the UI layer.
//
// Follows the same pattern as use-platform-learning.ts:
// 1. Fetch once on mount
// 2. Cache in module-level variables (survives re-renders)
// 3. Refetch every 10 minutes (test could end mid-session)
// 4. Return null gracefully if no test is running
//
// Uses consolidated state (single setState per update) to avoid React
// act() warnings in tests.
//
// The returned variantWeights are a partial overlay on SCORE_WEIGHTS:
//   - Variant A (control): null → suggestion engine uses default weights
//   - Variant B (variant):  { ... } → merged as { ...SCORE_WEIGHTS, ...variantWeights }
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 5
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAbHash } from '@/lib/telemetry/ab-hash';

// ============================================================================
// MODULE-LEVEL CACHE
// ============================================================================

/** Cached test ID — survives re-renders */
let cachedTestId: string | null = null;

/** Cached test name */
let cachedTestName: string | null = null;

/** Cached variant assignment */
let cachedVariant: 'A' | 'B' | null = null;

/** Cached variant weight overrides */
let cachedWeights: Record<string, number> | null = null;

/** Cached abHash (read once from localStorage, never changes) */
let cachedAbHash: string | null = null;

/** Timestamp of last successful fetch */
let lastFetchedAt = 0;

/** How often to refetch (10 min — test could end between cron runs) */
const REFETCH_INTERVAL_MS = 10 * 60 * 1000;

// ============================================================================
// API RESPONSE TYPE
// ============================================================================

interface ABAssignmentApiResponse {
  testId: string | null;
  testName: string | null;
  variant: 'A' | 'B' | null;
  weights: Record<string, number> | null;
  splitPct: number | null;
}

// ============================================================================
// RETURN TYPE
// ============================================================================

export interface UseABTestReturn {
  /** Active A/B test ID (null if none running) */
  activeTestId: string | null;

  /** Active A/B test name (null if none running) */
  activeTestName: string | null;

  /** Assigned variant: 'A' (control) or 'B' (variant), null if no test */
  variant: 'A' | 'B' | null;

  /** Variant-specific weight overrides (null = use default weights) */
  variantWeights: Record<string, number> | null;

  /** The stable anonymous browser hash used for assignment */
  abHash: string | null;

  /** Whether the assignment fetch is loading */
  isLoading: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// INTERNAL STATE TYPE
// ============================================================================

interface ABTestState {
  activeTestId: string | null;
  activeTestName: string | null;
  variant: 'A' | 'B' | null;
  variantWeights: Record<string, number> | null;
  abHash: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for A/B test variant assignment.
 *
 * 1. Reads/creates abHash from localStorage (via getAbHash())
 * 2. Fetches GET /api/learning/ab-assignment?abHash=<hash>
 * 3. Returns variant assignment + weight overrides
 * 4. Caches assignment in module-level variable (same pattern as other hooks)
 * 5. Refetches every 10 minutes (test could end mid-session)
 *
 * When no test is running, all fields are null — callers use default weights.
 *
 * @example
 * ```tsx
 * const { activeTestId, variant, variantWeights, abHash } = useABTest();
 *
 * // In suggestion engine: merge as { ...SCORE_WEIGHTS, ...variantWeights }
 * // In telemetry: pass abHash, activeTestId, variant to sendPromptTelemetry()
 * ```
 */
export function useABTest(): UseABTestReturn {
  const [state, setState] = useState<ABTestState>(() => ({
    activeTestId: cachedTestId,
    activeTestName: cachedTestName,
    variant: cachedVariant,
    variantWeights: cachedWeights,
    abHash: cachedAbHash,
    isLoading: cachedTestId === null && cachedVariant === null && lastFetchedAt === 0,
    error: null,
  }));

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAssignment = useCallback(async () => {
    // Get the stable anonymous hash (creates on first call, cached thereafter)
    if (!cachedAbHash) {
      cachedAbHash = getAbHash();
    }

    // SSR or no hash → graceful null
    if (!cachedAbHash) {
      setState({
        activeTestId: null,
        activeTestName: null,
        variant: null,
        variantWeights: null,
        abHash: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Skip if we fetched recently and have cached data
    const now = Date.now();
    if (lastFetchedAt > 0 && now - lastFetchedAt < REFETCH_INTERVAL_MS) {
      setState({
        activeTestId: cachedTestId,
        activeTestName: cachedTestName,
        variant: cachedVariant,
        variantWeights: cachedWeights,
        abHash: cachedAbHash,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/learning/ab-assignment?abHash=${encodeURIComponent(cachedAbHash)}`,
      );

      if (!response.ok) {
        throw new Error(`AB assignment fetch failed: ${response.status}`);
      }

      const data = (await response.json()) as ABAssignmentApiResponse;

      // Update module-level cache
      cachedTestId = data.testId;
      cachedTestName = data.testName;
      cachedVariant = data.variant;
      cachedWeights = data.weights;
      lastFetchedAt = Date.now();

      // Single atomic state update
      setState({
        activeTestId: data.testId,
        activeTestName: data.testName,
        variant: data.variant,
        variantWeights: data.weights,
        abHash: cachedAbHash,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.debug('[useABTest] Fetch error:', err);

      // Don't clear cached data — stale assignment > no assignment
      setState((prev) => ({
        ...prev,
        abHash: cachedAbHash,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch AB assignment',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  // Background refetch interval
  useEffect(() => {
    intervalRef.current = setInterval(fetchAssignment, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchAssignment]);

  return {
    activeTestId: state.activeTestId,
    activeTestName: state.activeTestName,
    variant: state.variant,
    variantWeights: state.variantWeights,
    abHash: state.abHash,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchAssignment,
  };
}

export default useABTest;

// ============================================================================
// TEST UTILITY — reset module-level cache (not for production use)
// ============================================================================

/** @internal Reset module-level cache — used by tests only */
export function _resetCacheForTesting(): void {
  cachedTestId = null;
  cachedTestName = null;
  cachedVariant = null;
  cachedWeights = null;
  cachedAbHash = null;
  lastFetchedAt = 0;
}
