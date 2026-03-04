// src/hooks/use-community-pulse.ts
// ============================================================================
// COMMUNITY PULSE — Data Hook
// ============================================================================
// Fetches the community pulse feed from the API and auto-refreshes every
// 30 seconds (per spec §14.4 "Feed refreshes periodically").
//
// Features:
// - Initial fetch on mount
// - 30-second polling interval
// - Cleanup on unmount (no leaked timers)
// - Error resilience: last-good data preserved, empty feed fallback
// - Manual refresh support
//
// Authority: docs/authority/homepage.md §6
// Existing features preserved: Yes (additive hook only)
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CommunityPulseEntry, CommunityPulseResponse } from '@/types/homepage';

// ============================================================================
// TYPES
// ============================================================================

export interface UseCommunityPulseResult {
  /** Most recent 20 pulse entries */
  entries: CommunityPulseEntry[];
  /** Single most-liked entry from last 24 hours (null if no likes yet) */
  mostLikedToday: CommunityPulseEntry | null;
  /** True during initial fetch only */
  isLoading: boolean;
  /** Error message if fetch failed (null when OK) */
  error: string | null;
  /** Force an immediate re-fetch */
  refresh: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Polling interval (ms) — per spec: 30-second refresh. */
const POLL_INTERVAL_MS = 30_000;

/** Fetch timeout (ms) — fail fast, don't block UI. */
const FETCH_TIMEOUT_MS = 8_000;

// ============================================================================
// HOOK
// ============================================================================

export function useCommunityPulse(): UseCommunityPulseResult {
  const [entries, setEntries] = useState<CommunityPulseEntry[]>([]);
  const [mostLikedToday, setMostLikedToday] = useState<CommunityPulseEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Core fetch ──────────────────────────────────────────────────────────
  const doFetch = useCallback(async (isInitial: boolean) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch('/api/homepage/community-pulse', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!mountedRef.current) return;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: CommunityPulseResponse = await res.json();
      if (!mountedRef.current) return;

      setEntries(data.entries ?? []);
      setMostLikedToday(data.mostLikedToday ?? null);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;

      // On poll failures, keep last-good data (don't clear entries)
      if (isInitial) {
        // On initial load failure, show error but empty entries remain
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
      // Silent failure on subsequent polls — keep showing stale data
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Mount: initial fetch + start polling ────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    void doFetch(true);

    // Start 30-second polling
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        void doFetch(false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [doFetch]);

  // ── Manual refresh ──────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    void doFetch(false);
  }, [doFetch]);

  return { entries, mostLikedToday, isLoading, error, refresh };
}
