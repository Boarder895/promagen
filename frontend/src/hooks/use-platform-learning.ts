// src/hooks/use-platform-learning.ts
// ============================================================================
// PER-PLATFORM LEARNING — Client Hook
// ============================================================================
//
// Phase 7.5, Part 7.5e — Fetches per-platform learning data from the two
// Phase 7.5 GET routes, builds O(1) lookup structures, and exposes blended
// lookup functions + batch variants to the suggestion engine.
//
// Follows the same pattern as use-learned-weights.ts:
// 1. Fetch once on mount (parallel requests)
// 2. Cache in module-level variables (survives re-renders)
// 3. Refetch every 10 minutes as background refresh
// 4. Return null gracefully if cron has not run yet
//
// SEPARATION OF CONCERNS:
// - use-learned-weights.ts → tier-level data (Phases 5–7.4)
// - use-platform-learning.ts → platform-specific data (Phase 7.5)
// The suggestion engine calls both hooks. When platform data exists,
// it overrides tier-level data via confidence blending. When absent,
// tier-level data passes through unchanged (zero regression).
//
// STATE ARCHITECTURE:
// Uses a single consolidated state object to ensure all post-fetch updates
// land in ONE setState call → ONE re-render. This eliminates React act()
// warnings in tests and reduces unnecessary intermediate renders in prod.
//
// Authority: docs/authority/phase-7.5-per-platform-learning-buildplan.md § 5
//
// Version: 1.2.0 — Consolidated state (single setState per update cycle)
// Created: 2026-02-27
// Updated: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import type { PlatformTermQualityData } from '@/lib/learning/platform-term-quality';
import {
  buildPlatformTermQualityLookup,
  type PlatformTermQualityLookup,
} from '@/lib/learning/platform-term-quality-lookup';

import type { PlatformCoOccurrenceData } from '@/lib/learning/platform-co-occurrence';
import {
  buildPlatformCoOccurrenceLookup,
  type PlatformCoOccurrenceLookup,
} from '@/lib/learning/platform-co-occurrence-lookup';

// ============================================================================
// MODULE-LEVEL CACHE
// ============================================================================

/** Cached platform term quality lookup — survives re-renders */
let cachedTermQualityLookup: PlatformTermQualityLookup | null = null;

/** Cached platform co-occurrence lookup — survives re-renders */
let cachedCoOccurrenceLookup: PlatformCoOccurrenceLookup | null = null;

/** Cached ISO timestamp of newest updatedAt from API (for dataAge) */
let cachedUpdatedAt: string | null = null;

/** Timestamp of last successful fetch */
let lastFetchedAt = 0;

/** How often to refetch (10 min — data only changes nightly at 3 AM UTC) */
const REFETCH_INTERVAL_MS = 10 * 60 * 1000;

// ============================================================================
// RETURN TYPE
// ============================================================================

export interface UsePlatformLearningReturn {
  /** Pre-built platform term quality lookup (null = no data yet or loading) */
  platformTermQualityLookup: PlatformTermQualityLookup | null;

  /** Pre-built platform co-occurrence lookup (null = no data yet or loading) */
  platformCoOccurrenceLookup: PlatformCoOccurrenceLookup | null;

  /** Whether the initial fetch is in progress */
  isLoading: boolean;

  /** Error message if fetch failed (null = ok) */
  error: string | null;

  /** ISO timestamp of when learning data was last computed by cron (null = no data) */
  lastUpdatedAt: string | null;

  /**
   * Milliseconds since learning data was last computed (null = no data).
   * >86_400_000 (24h) suggests cron may have failed — surface in Admin Command Centre.
   */
  dataAge: number | null;

  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// INTERNAL STATE TYPE
// ============================================================================

/**
 * Single consolidated state object.
 *
 * Using one useState instead of six eliminates React act() warnings —
 * all post-fetch updates land in a single setState call (one re-render)
 * instead of 5 sequential setState calls (5 re-renders, each flagged by
 * React's test-mode act() boundary checker).
 */
interface PlatformLearningState {
  termQualityLookup: PlatformTermQualityLookup | null;
  coOccurrenceLookup: PlatformCoOccurrenceLookup | null;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  dataAge: number | null;
}

// ============================================================================
// FETCH TYPES
// ============================================================================

interface PlatformTermQualityApiResponse {
  ok: boolean;
  data: PlatformTermQualityData | null;
  updatedAt: string | null;
}

interface PlatformCoOccurrenceApiResponse {
  ok: boolean;
  data: PlatformCoOccurrenceData | null;
  updatedAt: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for accessing per-platform learning data.
 *
 * Returns pre-built lookup structures that the suggestion engine uses
 * to blend platform-specific quality/co-occurrence data with tier-level
 * fallbacks via confidence weighting.
 *
 * When no platform data exists (cron hasn't run, Phase 7.5 disabled,
 * or platform has insufficient events), both lookups return null.
 * The suggestion engine falls back to tier-level data seamlessly.
 */
export function usePlatformLearning(): UsePlatformLearningReturn {
  const [state, setState] = useState<PlatformLearningState>(() => ({
    termQualityLookup: cachedTermQualityLookup,
    coOccurrenceLookup: cachedCoOccurrenceLookup,
    isLoading: !cachedTermQualityLookup && !cachedCoOccurrenceLookup,
    error: null,
    lastUpdatedAt: cachedUpdatedAt,
    dataAge: cachedUpdatedAt
      ? Date.now() - new Date(cachedUpdatedAt).getTime()
      : null,
  }));

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlatformData = useCallback(async () => {
    // Skip if we fetched recently and have cached data
    const now = Date.now();
    if (
      (cachedTermQualityLookup || cachedCoOccurrenceLookup) &&
      now - lastFetchedAt < REFETCH_INTERVAL_MS
    ) {
      // Single atomic update from cache
      setState({
        termQualityLookup: cachedTermQualityLookup,
        coOccurrenceLookup: cachedCoOccurrenceLookup,
        isLoading: false,
        error: null,
        lastUpdatedAt: cachedUpdatedAt,
        dataAge: cachedUpdatedAt
          ? Date.now() - new Date(cachedUpdatedAt).getTime()
          : null,
      });
      return;
    }

    // NOTE: Promise.allSettled NEVER throws — it wraps every rejection in
    // { status: 'rejected', reason }. The outer try/catch only guards
    // against bugs in our own processing code (json parsing etc.).

    try {
      // Fetch both endpoints in parallel — neither blocks the other
      const [termQualityResponse, coOccurrenceResponse] =
        await Promise.allSettled([
          fetch('/api/learning/platform-term-quality'),
          fetch('/api/learning/platform-co-occurrence'),
        ]);

      // ── Detect total failure (both rejected) ──────────────────────
      if (
        termQualityResponse.status === 'rejected' &&
        coOccurrenceResponse.status === 'rejected'
      ) {
        const reason = termQualityResponse.reason;
        const msg =
          reason instanceof Error
            ? reason.message
            : 'Failed to fetch platform data';
        console.debug('[usePlatformLearning] Both fetches rejected:', msg);

        // Single atomic update — error path
        setState((prev) => ({
          ...prev,
          error: msg,
          isLoading: false,
        }));
        return;
      }

      // Track newest updatedAt across both responses
      let newestUpdatedAt: string | null = cachedUpdatedAt;

      // ── Process platform term quality ──────────────────────────────
      if (
        termQualityResponse.status === 'fulfilled' &&
        termQualityResponse.value.ok
      ) {
        const json =
          (await termQualityResponse.value.json()) as PlatformTermQualityApiResponse;

        if (json.ok && json.data) {
          cachedTermQualityLookup = buildPlatformTermQualityLookup(json.data);
        }
        if (json.updatedAt) {
          if (!newestUpdatedAt || json.updatedAt > newestUpdatedAt) {
            newestUpdatedAt = json.updatedAt;
          }
        }
      }

      // ── Process platform co-occurrence ─────────────────────────────
      if (
        coOccurrenceResponse.status === 'fulfilled' &&
        coOccurrenceResponse.value.ok
      ) {
        const json =
          (await coOccurrenceResponse.value.json()) as PlatformCoOccurrenceApiResponse;

        if (json.ok && json.data) {
          cachedCoOccurrenceLookup = buildPlatformCoOccurrenceLookup(json.data);
        }
        if (json.updatedAt) {
          if (!newestUpdatedAt || json.updatedAt > newestUpdatedAt) {
            newestUpdatedAt = json.updatedAt;
          }
        }
      }

      // Update module-level cache
      cachedUpdatedAt = newestUpdatedAt;
      lastFetchedAt = Date.now();

      // ── Single atomic state update — success path ──────────────────
      setState({
        termQualityLookup: cachedTermQualityLookup,
        coOccurrenceLookup: cachedCoOccurrenceLookup,
        isLoading: false,
        error: null,
        lastUpdatedAt: newestUpdatedAt,
        dataAge: newestUpdatedAt
          ? Date.now() - new Date(newestUpdatedAt).getTime()
          : null,
      });
    } catch (err) {
      // Guards against JSON parse errors or buildLookup crashes
      console.debug('[usePlatformLearning] Processing error:', err);

      // Single atomic update — catch path
      // Do not clear existing cached lookups — stale > nothing
      setState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : 'Failed to process platform data',
        isLoading: false,
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPlatformData();
  }, [fetchPlatformData]);

  // Background refetch interval
  useEffect(() => {
    intervalRef.current = setInterval(fetchPlatformData, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPlatformData]);

  return {
    platformTermQualityLookup: state.termQualityLookup,
    platformCoOccurrenceLookup: state.coOccurrenceLookup,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdatedAt: state.lastUpdatedAt,
    dataAge: state.dataAge,
    refetch: fetchPlatformData,
  };
}

export default usePlatformLearning;

// ============================================================================
// TEST UTILITY — reset module-level cache (not for production use)
// ============================================================================

/** @internal Reset module-level cache — used by tests only */
export function _resetCacheForTesting(): void {
  cachedTermQualityLookup = null;
  cachedCoOccurrenceLookup = null;
  cachedUpdatedAt = null;
  lastFetchedAt = 0;
}
