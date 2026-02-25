// src/hooks/use-learned-weights.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Learned Weights Hook
// ============================================================================
//
// Client hook that fetches co-occurrence data from the learning API,
// builds a fast lookup structure, and caches it module-level.
//
// Data only changes at 3 AM UTC (nightly cron), so we:
// 1. Fetch once on mount
// 2. Cache in module-level variable (survives re-renders)
// 3. Refetch every 10 minutes as background refresh
// 4. Return null gracefully if cron has not run yet
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md section 9.1
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import type { CoOccurrenceMatrix } from '@/lib/learning/co-occurrence';
import {
  buildCoOccurrenceLookup,
  type CoOccurrenceLookup,
} from '@/lib/learning/co-occurrence-lookup';
import { getBlendRatio } from '@/lib/learning/constants';

// ============================================================================
// MODULE-LEVEL CACHE
// ============================================================================

/** Cached lookup — survives re-renders, cleared on page refresh */
let cachedLookup: CoOccurrenceLookup | null = null;

/** Timestamp of last successful fetch */
let lastFetchedAt = 0;

/** How often to refetch (10 min — data only changes nightly) */
const REFETCH_INTERVAL_MS = 10 * 60 * 1000;

// ============================================================================
// RETURN TYPE
// ============================================================================

export interface UseLearnedWeightsReturn {
  /** Pre-built co-occurrence lookup (null = no data yet or loading) */
  coOccurrenceLookup: CoOccurrenceLookup | null;

  /** Current blend ratio: [curatedWeight, learnedWeight] based on event count */
  blendRatio: [curated: number, learned: number];

  /** Whether the initial fetch is in progress */
  isLoading: boolean;

  /** Error message if fetch failed (null = ok) */
  error: string | null;

  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// FETCH TYPES
// ============================================================================

interface CoOccurrenceApiResponse {
  ok: boolean;
  data: CoOccurrenceMatrix | null;
  updatedAt: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for accessing learned co-occurrence weights.
 *
 * Returns a pre-built lookup structure that the suggestion engine
 * can use for fast per-option scoring.
 */
export function useLearnedWeights(): UseLearnedWeightsReturn {
  const [lookup, setLookup] = useState<CoOccurrenceLookup | null>(cachedLookup);
  const [blendRatio, setBlendRatio] = useState<[number, number]>(() =>
    cachedLookup ? getBlendRatio(cachedLookup.eventCount) : [1.0, 0.0],
  );
  const [isLoading, setIsLoading] = useState(!cachedLookup);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeights = useCallback(async () => {
    // Skip if we fetched recently and have cached data
    const now = Date.now();
    if (cachedLookup && now - lastFetchedAt < REFETCH_INTERVAL_MS) {
      setLookup(cachedLookup);
      setBlendRatio(getBlendRatio(cachedLookup.eventCount));
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const response = await fetch('/api/learning/co-occurrence');

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const json = (await response.json()) as CoOccurrenceApiResponse;

      if (!json.ok) {
        throw new Error('API returned ok:false');
      }

      // Build lookup from matrix (null if no data yet)
      const newLookup = buildCoOccurrenceLookup(json.data);
      const eventCount = json.data?.eventCount ?? 0;

      // Update module cache
      cachedLookup = newLookup;
      lastFetchedAt = Date.now();

      // Update React state
      setLookup(newLookup);
      setBlendRatio(getBlendRatio(eventCount));
    } catch (err) {
      console.error('[useLearnedWeights] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      // Do not clear existing cached data on error — stale > nothing
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  // Background refetch interval
  useEffect(() => {
    intervalRef.current = setInterval(fetchWeights, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchWeights]);

  return {
    coOccurrenceLookup: lookup,
    blendRatio,
    isLoading,
    error,
    refetch: fetchWeights,
  };
}

export default useLearnedWeights;
