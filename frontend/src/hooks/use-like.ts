// src/hooks/use-like.ts
// ============================================================================
// USE-LIKE HOOK — Optimistic like/unlike with batched status
// ============================================================================
// Manages like state for a set of prompt IDs (e.g., 4 tier prompts).
// On mount: fetches liked status for all IDs in one request.
// On toggle: optimistic update + fire-and-forget API call.
//
// Features:
// - Batched status fetch on mount (single GET for all prompt IDs)
// - Optimistic increment/decrement with rollback on error
// - GTM analytics events (prompt_liked, prompt_like_removed)
// - Never blocks UI — errors are swallowed silently
//
// Authority: docs/authority/homepage.md §7.4, §7.7, §7.8
// Existing features preserved: Yes (additive hook)
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '@/lib/analytics/events';

// ============================================================================
// TYPES
// ============================================================================

export interface LikeState {
  /** Whether the current session has liked this prompt */
  liked: boolean;
  /** Total like count for this prompt */
  count: number;
  /** True while a like/unlike request is in-flight */
  isUpdating: boolean;
}

export interface UseLikeResult {
  /** Like states keyed by prompt ID */
  states: Map<string, LikeState>;
  /** Toggle like for a prompt. Returns the new liked state. */
  toggleLike: (promptId: string, meta?: LikeEventMeta) => void;
  /** True while the initial status fetch is in progress */
  isLoadingStatus: boolean;
}

/** Metadata passed to analytics events */
interface LikeEventMeta {
  tier?: string;
  source?: 'showcase' | 'pulse';
  is_authenticated?: boolean;
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_STATE: LikeState = { liked: false, count: 0, isUpdating: false };

// ============================================================================
// HOOK
// ============================================================================

/**
 * Manages like state for a set of prompt IDs.
 *
 * @param promptIds — Array of prompt IDs to track. Changes trigger re-fetch.
 */
export function useLike(promptIds: string[]): UseLikeResult {
  const [states, setStates] = useState<Map<string, LikeState>>(new Map());
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const isMountedRef = useRef(true);

  // Stable key for dependency tracking
  const idsKey = promptIds.join(',');

  // ── Fetch status on mount / when IDs change ──────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    if (promptIds.length === 0) {
      setIsLoadingStatus(false);
      return;
    }

    let cancelled = false;

    async function fetchStatus() {
      try {
        const params = new URLSearchParams({ promptIds: promptIds.join(',') });
        const res = await fetch(`/api/prompts/like/status?${params.toString()}`);

        if (!res.ok || cancelled || !isMountedRef.current) return;

        const data = await res.json();
        if (!data.success || cancelled || !isMountedRef.current) return;

        const newStates = new Map<string, LikeState>();
        const statuses = data.statuses as Record<string, { liked: boolean; count: number }>;

        for (const id of promptIds) {
          const s = statuses[id];
          newStates.set(id, {
            liked: s?.liked ?? false,
            count: s?.count ?? 0,
            isUpdating: false,
          });
        }

        setStates(newStates);
      } catch {
        // Silent failure — default states remain (not liked, 0 count)
      } finally {
        if (isMountedRef.current && !cancelled) {
          setIsLoadingStatus(false);
        }
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // ── Toggle like (optimistic) ─────────────────────────────────────────
  const toggleLike = useCallback(
    (promptId: string, meta?: LikeEventMeta) => {
      const current = states.get(promptId) ?? DEFAULT_STATE;

      // Prevent double-clicks while updating
      if (current.isUpdating) return;

      const willLike = !current.liked;

      // ── Optimistic update ──────────────────────────────────────────
      setStates((prev) => {
        const next = new Map(prev);
        next.set(promptId, {
          liked: willLike,
          count: willLike ? current.count + 1 : Math.max(0, current.count - 1),
          isUpdating: true,
        });
        return next;
      });

      // ── Analytics ──────────────────────────────────────────────────
      const eventName = willLike ? 'prompt_liked' : 'prompt_like_removed';
      trackEvent(eventName, {
        prompt_id: promptId,
        tier: meta?.tier,
        source: meta?.source ?? 'showcase',
        is_authenticated: meta?.is_authenticated,
      });

      // ── API call (fire-and-forget with rollback on error) ──────────
      const method = willLike ? 'POST' : 'DELETE';
      fetch('/api/prompts/like', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId }),
      })
        .then(async (res) => {
          if (!isMountedRef.current) return;

          if (res.ok) {
            const data = await res.json();
            // Reconcile with server truth
            setStates((prev) => {
              const next = new Map(prev);
              next.set(promptId, {
                liked: willLike,
                count: data.likeCount ?? (willLike ? current.count + 1 : current.count - 1),
                isUpdating: false,
              });
              return next;
            });
          } else {
            // Rollback on error
            setStates((prev) => {
              const next = new Map(prev);
              next.set(promptId, { ...current, isUpdating: false });
              return next;
            });
          }
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          // Rollback on network error
          setStates((prev) => {
            const next = new Map(prev);
            next.set(promptId, { ...current, isUpdating: false });
            return next;
          });
        });
    },
    [states],
  );

  return { states, toggleLike, isLoadingStatus };
}
