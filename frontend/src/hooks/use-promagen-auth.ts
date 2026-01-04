// src/hooks/use-promagen-auth.ts
//
// Promagen authentication hook.
// Wraps Clerk's useAuth/useUser to provide a simplified interface
// for Promagen's features (voting, saved prompts, prompt builder, etc.)
//
// Lock State Progression:
// 1. anonymous_limit: Anonymous user has used 5 free prompts → Sign in CTA
// 2. unlocked: Anonymous under limit OR authenticated with quota OR paid
// 3. quota_reached: Free authenticated user has used 30/day → Go Pro CTA
//
// Reference Frame:
// - Anonymous: Greenwich (no location detection)
// - Free signed-in: User location (no choice)
// - Paid signed-in: Toggle between "user" and "greenwich"
//
// Usage:
//   const { isAuthenticated, userId, userTier, promptLockState, referenceFrame } = usePromagenAuth();
//
// Authority: docs/authority/clerk-auth.md, docs/authority/paid_tier.md
//

'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useCallback, useState } from 'react';
import { useDailyUsage } from './use-daily-usage';
import { useUserLocation } from './use-user-location';
import {
  ANONYMOUS_FREE_LIMIT,
  getCategoryLimitsForTier,
} from '@/lib/usage';
import {
  type ReferenceFrame,
  type GeoCoordinates,
  GREENWICH,
} from '@/lib/location';

// ============================================================================
// TYPES
// ============================================================================

export type UserTier = 'free' | 'paid';

/**
 * Lock state for the prompt builder.
 * Controls which UI elements are locked and why.
 *
 * State progression:
 * - anonymous_limit: Anonymous user hit 5-prompt limit → "Sign in to continue"
 * - unlocked: Full access (anonymous under limit, OR authenticated under quota, OR paid)
 * - quota_reached: Free authenticated user hit 30/day → "Go Pro for unlimited"
 */
export type PromptLockState =
  | 'unlocked'           // Full access
  | 'anonymous_limit'    // Anonymous user has used 5 free prompts
  | 'quota_reached';     // Free authenticated user has used 30 prompts today

/**
 * Usage information for anonymous users.
 */
export interface AnonymousUsageInfo {
  /** Cumulative usage count */
  count: number;
  /** Limit for anonymous users (5) */
  limit: number;
  /** Remaining prompts */
  remaining: number;
}

/**
 * Usage information for authenticated users.
 */
export interface DailyUsageInfo {
  /** Current usage count for today */
  count: number;
  /** Daily limit (null for paid = unlimited) */
  limit: number | null;
  /** Remaining prompts (null for paid) */
  remaining: number | null;
  /** ISO timestamp of next reset */
  resetTime: string | null;
}

/**
 * Location information for exchange ordering.
 */
export interface LocationInfo {
  /** Current reference frame */
  referenceFrame: ReferenceFrame;
  /** Effective coordinates for ordering */
  coordinates: GeoCoordinates;
  /** Whether location is being detected */
  isLoading: boolean;
  /** User's city name (if detected) */
  cityName?: string;
  /** Whether using fallback location */
  isFallback: boolean;
}

export interface PromagenAuthState {
  /** True when the user is signed in */
  isAuthenticated: boolean;
  /** True while Clerk is loading auth state */
  isLoading: boolean;
  /** Clerk user ID (null if not authenticated) */
  userId: string | null;
  /** User's email address (null if not authenticated) */
  email: string | null;
  /** User's display name (null if not authenticated) */
  displayName: string | null;
  /** User's avatar URL (null if not authenticated) */
  avatarUrl: string | null;
  /** User's subscription tier (defaults to 'free') */
  userTier: UserTier;
  /** Vote weight multiplier based on tier (1.0 for free, 1.5 for paid) */
  voteWeight: number;
  /** Current lock state for prompt builder */
  promptLockState: PromptLockState;
  /** Daily prompt usage info for authenticated users (null if anonymous) */
  dailyUsage: DailyUsageInfo | null;
  /** Anonymous usage info (null if authenticated) */
  anonymousUsage: AnonymousUsageInfo | null;
  /** Category selection limits based on tier */
  categoryLimits: Record<string, number>;
  /** Track a prompt copy (returns true if allowed) */
  trackPromptCopy: (providerId?: string) => Promise<boolean>;
  /** Location and reference frame info */
  locationInfo: LocationInfo;
  /** Set reference frame (paid users only) */
  setReferenceFrame: (frame: ReferenceFrame) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * usePromagenAuth - Get current authentication state
 *
 * Provides a unified interface for auth-dependent features:
 * - Voting system (requires isAuthenticated)
 * - Saved prompts (requires userId)
 * - Tier-based features (uses userTier)
 * - Prompt builder access (uses promptLockState)
 * - Exchange ordering (uses locationInfo)
 *
 * Lock State Logic:
 * 1. If not authenticated AND anonymous limit reached → 'anonymous_limit'
 * 2. If authenticated AND free tier AND daily limit reached → 'quota_reached'
 * 3. Otherwise → 'unlocked'
 *
 * Reference Frame Logic:
 * - Anonymous: Greenwich (no location detection, saves API calls)
 * - Free signed-in: Detect location, use as reference (no toggle)
 * - Paid signed-in: Use stored preference (default: 'user')
 *
 * @example
 * ```tsx
 * function Homepage() {
 *   const { locationInfo, isAuthenticated } = usePromagenAuth();
 *
 *   const { left, right } = useMemo(
 *     () => getRailsRelative(exchanges, locationInfo.coordinates),
 *     [exchanges, locationInfo.coordinates]
 *   );
 *
 *   return <HomepageGrid left={left} right={right} />;
 * }
 * ```
 */
export function usePromagenAuth(): PromagenAuthState {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  // Extract user tier and reference frame from Clerk's public metadata
  const publicMetadata = user?.publicMetadata as {
    tier?: UserTier;
    referenceFrame?: ReferenceFrame;
  } | undefined;

  const userTier: UserTier = publicMetadata?.tier ?? 'free';
  const storedReferenceFrame: ReferenceFrame = publicMetadata?.referenceFrame ?? 'user';

  // Vote weight: 1.5x for paid users (silent multiplier)
  const voteWeight = userTier === 'paid' ? 1.5 : 1.0;

  const isAuthenticated = isLoaded && isSignedIn === true;

  // ============================================================================
  // LOCATION DETECTION
  // ============================================================================

  // Only detect location for authenticated users (saves API calls for anonymous)
  const {
    location,
    coordinates: detectedCoordinates,
    isLoading: isLocationLoading,
    isFallback,
  } = useUserLocation({
    enabled: isAuthenticated,
  });

  // ============================================================================
  // REFERENCE FRAME LOGIC
  // ============================================================================

  // Local state for optimistic updates
  const [localReferenceFrame, setLocalReferenceFrame] = useState<ReferenceFrame | null>(null);

  // Determine effective reference frame
  let effectiveReferenceFrame: ReferenceFrame;
  let effectiveCoordinates: GeoCoordinates;

  if (!isAuthenticated) {
    // Anonymous: Always Greenwich (no location detection)
    effectiveReferenceFrame = 'greenwich';
    effectiveCoordinates = GREENWICH;
  } else if (userTier === 'paid') {
    // Paid: Use stored preference (or local optimistic state)
    effectiveReferenceFrame = localReferenceFrame ?? storedReferenceFrame;
    effectiveCoordinates = effectiveReferenceFrame === 'greenwich'
      ? GREENWICH
      : detectedCoordinates;
  } else {
    // Free signed-in: Always user location (no choice)
    effectiveReferenceFrame = 'user';
    effectiveCoordinates = detectedCoordinates;
  }

  /**
   * Set reference frame (paid users only).
   * Updates Clerk metadata and local state optimistically.
   */
  const setReferenceFrame = useCallback(async (frame: ReferenceFrame) => {
    if (userTier !== 'paid') {
      console.warn('[usePromagenAuth] Reference frame toggle is paid-only');
      return;
    }

    // Optimistic update
    setLocalReferenceFrame(frame);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ referenceFrame: frame }),
      });

      if (!response.ok) {
        // Revert on error
        setLocalReferenceFrame(null);
        console.error('[usePromagenAuth] Failed to save reference frame');
      }
    } catch (error) {
      // Revert on error
      setLocalReferenceFrame(null);
      console.error('[usePromagenAuth] Error saving reference frame:', error);
    }
  }, [userTier]);

  // ============================================================================
  // DAILY USAGE TRACKING
  // ============================================================================

  const {
    count,
    limit,
    remaining,
    isAtLimit,
    resetTime,
    trackUsage,
    isAnonymous,
  } = useDailyUsage({
    userTier,
    isAuthenticated,
    userId: userId ?? null,
  });

  // ============================================================================
  // LOCK STATE DETERMINATION
  // ============================================================================

  let promptLockState: PromptLockState = 'unlocked';

  if (!isAuthenticated) {
    // Anonymous user
    if (isAtLimit) {
      // Anonymous user hit 5-prompt limit
      promptLockState = 'anonymous_limit';
    }
    // Otherwise unlocked (anonymous with remaining prompts)
  } else if (userTier === 'free' && isAtLimit) {
    // Authenticated free user hit 30/day limit
    promptLockState = 'quota_reached';
  }
  // Paid users are always unlocked

  // ============================================================================
  // CATEGORY LIMITS
  // ============================================================================

  // Category selection limits based on tier
  // Note: Anonymous users get free tier limits
  const categoryLimits = getCategoryLimitsForTier(userTier);

  // ============================================================================
  // USAGE INFO FOR UI
  // ============================================================================

  // Daily usage info for authenticated users
  const dailyUsage: DailyUsageInfo | null = isAuthenticated
    ? {
        count,
        limit,
        remaining,
        resetTime,
      }
    : null;

  // Anonymous usage info
  const anonymousUsage: AnonymousUsageInfo | null =
    !isAuthenticated && isAnonymous
      ? {
          count,
          limit: ANONYMOUS_FREE_LIMIT,
          remaining: remaining ?? ANONYMOUS_FREE_LIMIT - count,
        }
      : null;

  // ============================================================================
  // LOCATION INFO FOR UI
  // ============================================================================

  const locationInfo: LocationInfo = {
    referenceFrame: effectiveReferenceFrame,
    coordinates: effectiveCoordinates,
    isLoading: isAuthenticated && isLocationLoading,
    cityName: location?.city,
    isFallback: !isAuthenticated || isFallback,
  };

  return {
    isAuthenticated,
    isLoading: !isLoaded,
    userId: userId ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    displayName: user?.fullName ?? user?.firstName ?? null,
    avatarUrl: user?.imageUrl ?? null,
    userTier,
    voteWeight,
    promptLockState,
    dailyUsage,
    anonymousUsage,
    categoryLimits,
    trackPromptCopy: trackUsage,
    locationInfo,
    setReferenceFrame,
  };
}

export default usePromagenAuth;
