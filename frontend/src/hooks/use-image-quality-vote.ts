/**
 * @file src/hooks/use-image-quality-vote.ts
 * @description Hook for managing image quality voting state and API calls
 * 
 * Features:
 * - Rolling 24-hour window per provider
 * - Max 3 providers per day
 * - Animated feedback on successful vote
 * - Optimistic UI updates
 * - Idempotency keys for replay protection
 * - Auto-refresh of vote state
 * 
 * Security:
 * - Generates cryptographically random idempotency keys
 * - Does not expose server-side weight calculations
 * - Graceful degradation on API failure
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  hasVotedForProvider,
  canVote,
  recordVote,
  getVotedProviderIds,
  getRemainingVotes,
} from '@/lib/vote-storage';

// ============================================================================
// TYPES
// ============================================================================

export type VoteState = 'idle' | 'voted' | 'animating' | 'error';

export type UseImageQualityVoteReturn = {
  /** Whether the user has voted for this specific provider */
  hasVoted: boolean;
  
  /** Whether the user can still vote (has remaining daily votes) */
  canVoteMore: boolean;
  
  /** Current animation/state */
  voteState: VoteState;
  
  /** Trigger a vote for this provider */
  vote: () => Promise<boolean>;
  
  /** Number of remaining votes today */
  remainingVotes: number;
  
  /** Whether the system is ready (hydrated from localStorage) */
  isReady: boolean;
  
  /** Current rank of the provider (if known) */
  currentRank: number | null;
};

// ============================================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================================

/**
 * Generate a cryptographically random idempotency key.
 * Uses crypto.getRandomValues for security.
 */
function generateIdempotencyKey(): string {
  if (typeof window === 'undefined') {
    return `server-${Date.now()}-${Math.random().toString(36)}`;
  }
  
  // Use crypto API for secure random
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  
  // Convert to hex string
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `vote-${hex}`;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for managing image quality votes for a specific provider.
 * 
 * @param providerId - The provider to track votes for
 * @param isAuthenticated - Whether user is signed in (required to vote)
 */
export function useImageQualityVote(
  providerId: string,
  isAuthenticated: boolean = false
): UseImageQualityVoteReturn {
  // Local state
  const [hasVoted, setHasVoted] = useState(false);
  const [canVoteMore, setCanVoteMore] = useState(false);
  const [remainingVotes, setRemainingVotes] = useState(3);
  const [voteState, setVoteState] = useState<VoteState>('idle');
  const [isReady, setIsReady] = useState(false);
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  
  // Prevent duplicate API calls
  const pendingVoteRef = useRef<string | null>(null);

  // ========================================================================
  // HYDRATION
  // ========================================================================

  useEffect(() => {
    const voted = hasVotedForProvider(providerId);
    const canVoteNow = canVote();
    const remaining = getRemainingVotes();
    
    setHasVoted(voted);
    setCanVoteMore(canVoteNow);
    setRemainingVotes(remaining);
    setVoteState(voted ? 'voted' : 'idle');
    setIsReady(true);
  }, [providerId]);

  // ========================================================================
  // AUTO-REFRESH (every minute)
  // ========================================================================

  useEffect(() => {
    const interval = setInterval(() => {
      const voted = hasVotedForProvider(providerId);
      const canVoteNow = canVote();
      const remaining = getRemainingVotes();
      
      setHasVoted(voted);
      setCanVoteMore(canVoteNow);
      setRemainingVotes(remaining);
      
      // Reset to idle if vote expired
      if (!voted && voteState === 'voted') {
        setVoteState('idle');
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [providerId, voteState]);

  // ========================================================================
  // VOTE FUNCTION
  // ========================================================================

  const vote = useCallback(async (): Promise<boolean> => {
    // Must be authenticated
    if (!isAuthenticated) {
      return false;
    }

    // Already voted for this provider
    if (hasVotedForProvider(providerId)) {
      return false;
    }

    // No remaining votes
    if (!canVote()) {
      return false;
    }

    // Prevent duplicate submissions
    if (pendingVoteRef.current === providerId) {
      return false;
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey();
    pendingVoteRef.current = providerId;

    // Record vote locally FIRST (optimistic update)
    const recorded = recordVote(providerId);
    if (!recorded) {
      pendingVoteRef.current = null;
      return false;
    }

    // Trigger animation
    setVoteState('animating');
    
    // Update local state
    setHasVoted(true);
    setCanVoteMore(canVote());
    setRemainingVotes(getRemainingVotes());

    // Send to API
    try {
      const response = await fetch('/api/providers/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId,
          signalType: 'card_like',
          idempotencyKey,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update rank if returned
        if (data.vote?.rank) {
          setCurrentRank(data.vote.rank);
        }
      } else {
        // API failed but local vote is already recorded
        // Log for debugging but don't disrupt UX
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Vote] API returned error:', response.status);
        }
      }
    } catch (error) {
      // Network error - vote is recorded locally
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Vote] Network error:', error);
      }
    } finally {
      pendingVoteRef.current = null;
    }

    // End animation after delay
    setTimeout(() => {
      setVoteState('voted');
    }, 400); // Match CSS animation duration

    return true;
  }, [providerId, isAuthenticated]);

  return {
    hasVoted,
    canVoteMore,
    voteState,
    vote,
    remainingVotes,
    isReady,
    currentRank,
  };
}

// ============================================================================
// HELPER HOOK: ALL VOTED PROVIDERS
// ============================================================================

/**
 * Hook to get all voted provider IDs.
 * Useful for displaying vote state across multiple providers.
 */
export function useVotedProviders(): {
  votedIds: string[];
  isReady: boolean;
} {
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setVotedIds(getVotedProviderIds());
    setIsReady(true);
  }, []);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setVotedIds(getVotedProviderIds());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return { votedIds, isReady };
}

// ============================================================================
// HELPER HOOK: VOTE STATS
// ============================================================================

/**
 * Hook to fetch vote statistics for a provider.
 */
export function useProviderVoteStats(providerId: string) {
  const [stats, setStats] = useState<{
    totalVotes: number;
    bayesianScore: number | null;
    communityRank: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const response = await fetch(`/api/providers/vote?providerId=${providerId}`);
        
        if (response.ok && !cancelled) {
          const data = await response.json();
          setStats({
            totalVotes: data.totalVotes ?? 0,
            bayesianScore: data.bayesianScore ?? null,
            communityRank: data.communityRank ?? null,
          });
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  return { stats, loading };
}
