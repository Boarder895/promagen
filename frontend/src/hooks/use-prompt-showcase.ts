// src/hooks/use-prompt-showcase.ts
// ============================================================================
// PROMPT OF THE MOMENT — Data Hook
// ============================================================================
// Fetches the current prompt showcase from the API and auto-refreshes
// when the 10-minute rotation period expires.
//
// Features:
// - Initial fetch on mount
// - Auto-refresh aligned to nextRotationAt boundary (+500ms buffer)
// - previousData held for 800ms crossfade transition
// - Retry on error (30s backoff)
// - Cleanup on unmount (no leaked timers)
//
// Authority: docs/authority/homepage.md §4
// Existing features preserved: Yes (additive file only)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PromptOfTheMoment } from '@/types/homepage';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePromptShowcaseResult {
  /** Current prompt data (null while loading or on hard error) */
  data: PromptOfTheMoment | null;
  /** Previous data held briefly for crossfade transition */
  previousData: PromptOfTheMoment | null;
  /** True during initial fetch only */
  isLoading: boolean;
  /** True during the 800ms crossfade between cities */
  isTransitioning: boolean;
  /** Error message if fetch failed (null when OK) */
  error: string | null;
  /** Force a re-fetch */
  refresh: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Rotation cadence — must match API route's ROTATION_MS */
const ROTATION_MS = 10 * 60 * 1000;

/** Duration of the crossfade overlay (ms) */
const CROSSFADE_MS = 800;

/** Retry delay after a failed fetch (ms) */
const RETRY_DELAY_MS = 30_000;

/** Minimum delay between fetches (ms) — prevents hammering if clock skew */
const MIN_FETCH_DELAY_MS = 5_000;

// ============================================================================
// HOOK
// ============================================================================

export function usePromptShowcase(): UsePromptShowcaseResult {
  const [data, setData] = useState<PromptOfTheMoment | null>(null);
  const [previousData, setPreviousData] = useState<PromptOfTheMoment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Clear any pending timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
  }, []);

  // Schedule next fetch at rotation boundary (computed client-side)
  const scheduleNext = useCallback(() => {
    const now = Date.now();
    const currentSlot = Math.floor(now / ROTATION_MS);
    const nextBoundary = (currentSlot + 1) * ROTATION_MS;
    const delay = Math.max(nextBoundary - now + 500, MIN_FETCH_DELAY_MS); // +500ms buffer
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) void doFetch(true);
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core fetch logic
  const doFetch = useCallback(async (isRefresh: boolean) => {
    try {
      // Start crossfade if refreshing with existing data
      if (isRefresh && data) {
        setIsTransitioning(true);
        setPreviousData(data);
      }

      const res = await fetch('/api/homepage/prompt-of-the-moment');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: PromptOfTheMoment = await res.json();
      if (!mountedRef.current) return;

      setData(json);
      setError(null);

      // End crossfade after animation duration
      if (isRefresh) {
        fadeTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setIsTransitioning(false);
            setPreviousData(null);
          }
        }, CROSSFADE_MS);
      }

      // Schedule next rotation fetch (client-side boundary, not API value)
      scheduleNext();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load');
      setIsTransitioning(false);

      // Retry after delay
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) void doFetch(true);
      }, RETRY_DELAY_MS);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
   
  }, [data, scheduleNext]);

  // Mount: initial fetch
  useEffect(() => {
    mountedRef.current = true;
    void doFetch(false);

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    clearTimers();
    void doFetch(true);
  }, [doFetch, clearTimers]);

  return { data, previousData, isLoading, isTransitioning, error, refresh };
}
