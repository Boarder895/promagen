/**
 * @file src/hooks/use-daily-usage.ts
 * @description Hook for tracking prompt builder usage
 *
 * Provides:
 * - Current usage count (anonymous or authenticated)
 * - Daily limit (null for paid users)
 * - Remaining prompts
 * - Whether user is at limit
 * - Track usage function (called on Copy prompt click)
 *
 * Flow:
 * - Anonymous users: localStorage tracking (5 cumulative limit)
 * - Free authenticated: Vercel KV tracking (10/day limit)
 * - Paid authenticated: No tracking (unlimited)
 *
 * Authority: docs/authority/paid_tier.md §3.2, §3.3
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FREE_DAILY_LIMIT,
  ANONYMOUS_FREE_LIMIT,
  getAnonymousUsageState,
  incrementAnonymousCount,
  isAnonymousAtLimit,
} from '@/lib/usage';

// ============================================================================
// TYPES
// ============================================================================

export interface DailyUsageState {
  /** Current usage count for today (or cumulative for anonymous) */
  count: number;
  /** Usage limit (null for paid users = unlimited) */
  limit: number | null;
  /** Remaining prompts (null for paid users) */
  remaining: number | null;
  /** Whether user has reached their limit */
  isAtLimit: boolean;
  /** ISO timestamp of next reset (null for anonymous - cumulative) */
  resetTime: string | null;
  /** Whether usage data is loading */
  isLoading: boolean;
  /** Error message if tracking failed */
  error: string | null;
  /** Whether this is anonymous tracking */
  isAnonymous: boolean;
}

export interface UseDailyUsageReturn extends DailyUsageState {
  /** Track a prompt copy. Returns true if successful, false if at limit. */
  trackUsage: (providerId?: string) => Promise<boolean>;
  /** Refresh usage status from server (no-op for anonymous) */
  refreshUsage: () => Promise<void>;
}

export interface UseDailyUsageOptions {
  /** User's tier (free or paid) */
  userTier: 'free' | 'paid';
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** User ID (for caching) - null for anonymous */
  userId: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get user's timezone.
 */
function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Create initial state based on authentication status.
 */
function createInitialState(isAuthenticated: boolean, userTier: 'free' | 'paid'): DailyUsageState {
  if (!isAuthenticated) {
    // Anonymous user - get from localStorage
    if (typeof window !== 'undefined') {
      const state = getAnonymousUsageState();
      return {
        count: state.count,
        limit: state.limit,
        remaining: state.remaining,
        isAtLimit: state.isAtLimit,
        resetTime: null, // Anonymous is cumulative, no daily reset
        isLoading: false,
        error: null,
        isAnonymous: true,
      };
    }
    // SSR - return safe defaults
    return {
      count: 0,
      limit: ANONYMOUS_FREE_LIMIT,
      remaining: ANONYMOUS_FREE_LIMIT,
      isAtLimit: false,
      resetTime: null,
      isLoading: false,
      error: null,
      isAnonymous: true,
    };
  }

  // Authenticated user - initial state before server fetch
  return {
    count: 0,
    limit: userTier === 'paid' ? null : FREE_DAILY_LIMIT,
    remaining: userTier === 'paid' ? null : FREE_DAILY_LIMIT,
    isAtLimit: false,
    resetTime: null,
    isLoading: userTier !== 'paid', // Only load for free users
    error: null,
    isAnonymous: false,
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useDailyUsage - Track prompt builder usage
 *
 * Handles three user states:
 * 1. Anonymous: localStorage tracking (5 cumulative prompts)
 * 2. Free authenticated: Server tracking (10/day)
 * 3. Paid authenticated: No limits
 */
export function useDailyUsage(options: UseDailyUsageOptions): UseDailyUsageReturn {
  const { userTier, isAuthenticated, userId } = options;

  const [state, setState] = useState<DailyUsageState>(() =>
    createInitialState(isAuthenticated, userTier)
  );

  // ============================================================================
  // ANONYMOUS TRACKING
  // ============================================================================

  /**
   * Refresh anonymous usage from localStorage.
   */
  const refreshAnonymousUsage = useCallback(() => {
    if (typeof window === 'undefined') return;

    const anonState = getAnonymousUsageState();
    setState({
      count: anonState.count,
      limit: anonState.limit,
      remaining: anonState.remaining,
      isAtLimit: anonState.isAtLimit,
      resetTime: null,
      isLoading: false,
      error: null,
      isAnonymous: true,
    });
  }, []);

  /**
   * Track anonymous prompt copy.
   * Returns true if allowed, false if at limit.
   */
  const trackAnonymousUsage = useCallback(async (): Promise<boolean> => {
    // Check limit before incrementing
    if (isAnonymousAtLimit()) {
      // Update state to reflect limit
      refreshAnonymousUsage();
      return false;
    }

    // Increment and update state
    const newState = incrementAnonymousCount();

    setState({
      count: newState.count,
      limit: newState.limit,
      remaining: newState.remaining,
      isAtLimit: newState.isAtLimit,
      resetTime: null,
      isLoading: false,
      error: null,
      isAnonymous: true,
    });

    return true;
  }, [refreshAnonymousUsage]);

  // ============================================================================
  // AUTHENTICATED TRACKING
  // ============================================================================

  /**
   * Fetch current usage status from server.
   */
  const refreshAuthenticatedUsage = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
      return;
    }

    // Paid users don't need to fetch
    if (userTier === 'paid') {
      setState((prev) => ({
        ...prev,
        limit: null,
        remaining: null,
        isAtLimit: false,
        isLoading: false,
        isAnonymous: false,
      }));
      return;
    }

    try {
      const timezone = getTimezone();
      const response = await fetch(`/api/usage/track?timezone=${encodeURIComponent(timezone)}`, {
        method: 'GET',
        headers: {
          'x-timezone': timezone,
        },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }

      const data = await response.json();

      if (data.success && data.usage) {
        const limit = FREE_DAILY_LIMIT;
        const count = typeof data.usage.count === 'number' ? data.usage.count : 0;

        setState({
          count,
          limit,
          remaining: Math.max(0, limit - count),
          isAtLimit: count >= limit,
          resetTime: data.usage.resetTime ?? null,
          isLoading: false,
          error: null,
          isAnonymous: false,
        });
      }
    } catch (error) {
      console.error('[useDailyUsage] Failed to fetch usage:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load usage data',
        isAnonymous: false,
      }));
    }
  }, [isAuthenticated, userId, userTier]);

  /**
   * Track authenticated prompt copy.
   * Returns true if successful, false if at limit.
   */
  const trackAuthenticatedUsage = useCallback(
    async (providerId?: string): Promise<boolean> => {
      // Paid users don't need tracking - always allow
      if (userTier === 'paid') {
        return true;
      }

      // Not authenticated - shouldn't happen, but allow for safety
      if (!isAuthenticated || !userId) {
        return true;
      }

      // Already at limit - reject immediately
      if (state.isAtLimit) {
        return false;
      }

      try {
        const timezone = getTimezone();
        const response = await fetch('/api/usage/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-timezone': timezone,
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            timezone,
            providerId: providerId ?? undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.code === 'LIMIT_REACHED') {
            // Update state to reflect limit reached
            setState((prev) => ({
              ...prev,
              isAtLimit: true,
              remaining: 0,
            }));
            return false;
          }
          throw new Error(data.error || 'Failed to track usage');
        }

        // Update state with new usage
        if (data.success && data.usage) {
          setState((prev) => ({
            ...prev,
            count: data.usage.count,
            remaining: data.usage.remaining,
            isAtLimit: data.usage.isAtLimit,
            resetTime: data.usage.resetTime,
            error: null,
          }));
        }

        return true;
      } catch (error) {
        console.error('[useDailyUsage] Failed to track usage:', error);
        // Fail open - allow the copy to proceed
        return true;
      }
    },
    [isAuthenticated, userId, userTier, state.isAtLimit]
  );

  // ============================================================================
  // UNIFIED INTERFACE
  // ============================================================================

  /**
   * Refresh usage - delegates to appropriate handler.
   */
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) {
      refreshAnonymousUsage();
    } else {
      await refreshAuthenticatedUsage();
    }
  }, [isAuthenticated, refreshAnonymousUsage, refreshAuthenticatedUsage]);

  /**
   * Track usage - delegates to appropriate handler.
   */
  const trackUsage = useCallback(
    async (providerId?: string): Promise<boolean> => {
      if (!isAuthenticated) {
        return trackAnonymousUsage();
      } else {
        return trackAuthenticatedUsage(providerId);
      }
    },
    [isAuthenticated, trackAnonymousUsage, trackAuthenticatedUsage]
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch usage on mount and when auth changes
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  // Update state when auth status changes
  useEffect(() => {
    if (!isAuthenticated) {
      // Switched to anonymous - refresh from localStorage
      refreshAnonymousUsage();
    } else if (userTier === 'paid') {
      // Paid user - clear limits
      setState((prev) => ({
        ...prev,
        limit: null,
        remaining: null,
        isAtLimit: false,
        isAnonymous: false,
      }));
    }
  }, [isAuthenticated, userTier, refreshAnonymousUsage]);

  return {
    ...state,
    trackUsage,
    refreshUsage,
  };
}

export default useDailyUsage;
