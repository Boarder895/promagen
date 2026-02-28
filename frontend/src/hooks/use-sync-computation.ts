// src/hooks/use-sync-computation.ts
// ============================================================================
// USE SYNC COMPUTATION — Shared Utility Hook
// ============================================================================
//
// Generic hook for synchronous computations that need:
//   1. Stable memoisation keyed on serialised deps (no reference traps)
//   2. A manual refresh() trigger that forces recomputation
//
// Replaces the repeated pattern of:
//   useState(counter) + useMemo([...deps, counter]) + useCallback(setCounter)
//
// Usage:
//   const { value, refresh } = useSyncComputation(
//     () => expensiveCompute(a, b),
//     [aKey, bKey]            // ← already-serialised / primitive deps
//   );
//
// The compute function runs synchronously inside useMemo.
// It is never called inside useEffect, so there is no setState cycle.
//
// Version: 1.0.0
// Created: 2026-02-28
// Existing features preserved: Yes (new file, nothing changed).
// ============================================================================

import { useState, useMemo, useCallback } from 'react';

/**
 * Synchronous computation with manual refresh.
 *
 * @param compute  Pure function that returns the computed value.
 *                 Runs inside useMemo — must be synchronous.
 * @param deps     Dependency list (primitives / serialised keys).
 *                 When any dep changes the computation re-runs.
 *
 * @returns `{ value, refresh }` where `refresh()` forces a recompute
 *          by incrementing an internal counter dep.
 */
export function useSyncComputation<T>(
  compute: () => T,
  deps: React.DependencyList
): { value: T; refresh: () => void } {
  const [tick, setTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(compute, [...deps, tick]);

  const refresh = useCallback(() => {
    setTick(c => c + 1);
  }, []);

  return { value, refresh };
}

export default useSyncComputation;
