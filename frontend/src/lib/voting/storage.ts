/**
 * @file src/lib/voting/storage.ts
 * @description Vercel KV storage layer for vote data
 *
 * Storage structure:
 * - votes:vote:{id} - Individual vote records
 * - votes:user:{hash} - User's vote history (for deduplication)
 * - votes:provider:{id} - Aggregated provider stats
 * - votes:rate:{hash} - Rate limit state
 * - votes:idem:{key} - Idempotency key tracking
 * - votes:rankings - Cached rankings
 *
 * Security:
 * - All user identifiers are hashed
 * - TTLs prevent unbounded storage growth
 * - Atomic operations where possible
 */

import kv from '@/lib/kv';
import type { VoteRecord, ProviderVoteStats, RateLimitState, ProviderRanking } from './types';
import { KV_KEYS, KV_NAMESPACE, VOTE_WINDOW_MS, IDEMPOTENCY_KEY_TTL_MS } from './constants';

// ============================================================================
// VOTE RECORDS
// ============================================================================

/**
 * Store a vote record.
 */
export async function storeVote(vote: VoteRecord): Promise<void> {
  const key = KV_KEYS.vote(vote.id);
  await kv.set(KV_NAMESPACE, key, vote);
}

/**
 * Get a vote record by ID.
 */
export async function getVote(voteId: string): Promise<VoteRecord | null> {
  const key = KV_KEYS.vote(voteId);
  return kv.get<VoteRecord>(KV_NAMESPACE, key);
}

/**
 * Delete a vote record.
 */
export async function deleteVote(voteId: string): Promise<void> {
  const key = KV_KEYS.vote(voteId);
  await kv.del(KV_NAMESPACE, key);
}

// ============================================================================
// USER VOTE HISTORY
// ============================================================================

/**
 * User vote history entry.
 */
export type UserVoteEntry = {
  providerId: string;
  voteId: string;
  votedAt: number; // Unix timestamp ms
};

/**
 * User vote history structure.
 */
export type UserVoteHistory = {
  votes: UserVoteEntry[];
};

/**
 * Get user's vote history.
 */
export async function getUserVoteHistory(userHash: string): Promise<UserVoteHistory> {
  const key = KV_KEYS.userVotes(userHash);
  const history = await kv.get<UserVoteHistory>(KV_NAMESPACE, key);
  return history ?? { votes: [] };
}

/**
 * Add vote to user's history.
 */
export async function addUserVote(userHash: string, entry: UserVoteEntry): Promise<void> {
  const history = await getUserVoteHistory(userHash);

  // Clean expired votes (older than 24h)
  const now = Date.now();
  const validVotes = history.votes.filter((v) => now - v.votedAt < VOTE_WINDOW_MS);

  // Add new vote
  validVotes.push(entry);

  const key = KV_KEYS.userVotes(userHash);
  await kv.set(KV_NAMESPACE, key, { votes: validVotes });
}

/**
 * Check if user has voted for a provider in the last 24h.
 */
export async function hasUserVotedForProvider(
  userHash: string,
  providerId: string,
): Promise<boolean> {
  const history = await getUserVoteHistory(userHash);
  const now = Date.now();

  return history.votes.some((v) => v.providerId === providerId && now - v.votedAt < VOTE_WINDOW_MS);
}

/**
 * Get count of user's votes in the last 24h.
 */
export async function getUserDailyVoteCount(userHash: string): Promise<number> {
  const history = await getUserVoteHistory(userHash);
  const now = Date.now();

  return history.votes.filter((v) => now - v.votedAt < VOTE_WINDOW_MS).length;
}

/**
 * Get provider IDs user has voted for in the last 24h.
 */
export async function getUserVotedProviderIds(userHash: string): Promise<string[]> {
  const history = await getUserVoteHistory(userHash);
  const now = Date.now();

  return history.votes.filter((v) => now - v.votedAt < VOTE_WINDOW_MS).map((v) => v.providerId);
}

// ============================================================================
// PROVIDER STATISTICS
// ============================================================================

/**
 * Get provider vote statistics.
 */
export async function getProviderStats(providerId: string): Promise<ProviderVoteStats | null> {
  const key = KV_KEYS.providerStats(providerId);
  return kv.get<ProviderVoteStats>(KV_NAMESPACE, key);
}

/**
 * Update provider vote statistics.
 */
export async function updateProviderStats(
  providerId: string,
  stats: ProviderVoteStats,
): Promise<void> {
  const key = KV_KEYS.providerStats(providerId);
  await kv.set(KV_NAMESPACE, key, stats);
}

/**
 * Increment provider stats with new vote.
 * This is an optimistic update for immediate feedback.
 */
export async function incrementProviderStats(
  providerId: string,
  signalType: string,
  weight: number,
): Promise<ProviderVoteStats> {
  const existing = await getProviderStats(providerId);

  const stats: ProviderVoteStats = existing ?? {
    providerId,
    totalWeightedVotes: 0,
    totalVoteCount: 0,
    signals: {
      cardLikes: 0,
      imageLikes: 0,
      comments: 0,
      imageUploads: 0,
    },
    bayesianScore: 0,
    communityRank: 0,
    lastCalculated: new Date().toISOString(),
  };

  // Increment totals
  stats.totalWeightedVotes += weight;
  stats.totalVoteCount += 1;

  // Increment signal-specific counter
  switch (signalType) {
    case 'card_like':
      stats.signals.cardLikes += 1;
      break;
    case 'image_like':
      stats.signals.imageLikes += 1;
      break;
    case 'comment':
      stats.signals.comments += 1;
      break;
    case 'image_upload':
      stats.signals.imageUploads += 1;
      break;
  }

  await updateProviderStats(providerId, stats);
  return stats;
}

/**
 * Get all provider stats (for ranking calculation).
 */
export async function getAllProviderStats(
  providerIds: string[],
): Promise<Map<string, ProviderVoteStats>> {
  const stats = new Map<string, ProviderVoteStats>();

  // Fetch all stats in parallel
  const results = await Promise.all(
    providerIds.map(async (id) => {
      const s = await getProviderStats(id);
      return { id, stats: s };
    }),
  );

  for (const result of results) {
    if (result.stats) {
      stats.set(result.id, result.stats);
    }
  }

  return stats;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Get rate limit state for an IP hash.
 */
export async function getRateLimitState(ipHash: string): Promise<RateLimitState | null> {
  const key = KV_KEYS.rateLimit(ipHash);
  return kv.get<RateLimitState>(KV_NAMESPACE, key);
}

/**
 * Update rate limit state.
 */
export async function updateRateLimitState(ipHash: string, state: RateLimitState): Promise<void> {
  const key = KV_KEYS.rateLimit(ipHash);
  await kv.set(KV_NAMESPACE, key, state);
}

/**
 * Increment rate limit counter.
 * Returns new state.
 */
export async function incrementRateLimit(
  ipHash: string,
  providerId: string,
): Promise<RateLimitState> {
  const now = Date.now();
  const existing = await getRateLimitState(ipHash);

  // Check if we need to reset the window (1 hour windows)
  const windowDuration = 60 * 60 * 1000; // 1 hour
  const windowStart = existing?.windowStart ?? now;
  const isNewWindow = now - windowStart > windowDuration;

  // Clean up old daily votes
  const dailyVotes = (existing?.dailyVotes ?? []).filter(
    // Keep only votes from last 24h (this is simplified, actual dedup is in user history)
    () => !isNewWindow,
  );

  // Add new provider to daily votes if not already there
  if (!dailyVotes.includes(providerId)) {
    dailyVotes.push(providerId);
  }

  const state: RateLimitState = {
    count: isNewWindow ? 1 : (existing?.count ?? 0) + 1,
    windowStart: isNewWindow ? now : windowStart,
    dailyVotes,
    lastRequest: now,
  };

  await updateRateLimitState(ipHash, state);
  return state;
}

// ============================================================================
// IDEMPOTENCY
// ============================================================================

/**
 * Check if idempotency key has been used.
 */
export async function isIdempotencyKeyUsed(key: string): Promise<boolean> {
  const kvKey = KV_KEYS.idempotency(key);
  const value = await kv.get<{ used: boolean }>(KV_NAMESPACE, kvKey);
  return value?.used === true;
}

/**
 * Mark idempotency key as used.
 */
export async function markIdempotencyKeyUsed(key: string): Promise<void> {
  const kvKey = KV_KEYS.idempotency(key);
  await kv.set(KV_NAMESPACE, kvKey, {
    used: true,
    timestamp: Date.now(),
    expiresAt: Date.now() + IDEMPOTENCY_KEY_TTL_MS,
  });
}

// ============================================================================
// RANKINGS
// ============================================================================

/**
 * Get cached rankings.
 */
export async function getCachedRankings(): Promise<ProviderRanking[] | null> {
  const key = KV_KEYS.rankings();
  const data = await kv.get<{ rankings: ProviderRanking[] }>(KV_NAMESPACE, key);
  return data?.rankings ?? null;
}

/**
 * Store calculated rankings.
 */
export async function storeCachedRankings(rankings: ProviderRanking[]): Promise<void> {
  const key = KV_KEYS.rankings();
  await kv.set(KV_NAMESPACE, key, {
    rankings,
    calculatedAt: new Date().toISOString(),
  });

  // Update last calculated timestamp
  const lastCalcKey = KV_KEYS.lastCalculated();
  await kv.set(KV_NAMESPACE, lastCalcKey, {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get last rankings calculation time.
 */
export async function getLastCalculationTime(): Promise<string | null> {
  const key = KV_KEYS.lastCalculated();
  const data = await kv.get<{ timestamp: string }>(KV_NAMESPACE, key);
  return data?.timestamp ?? null;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean up expired data (run periodically).
 * This should be called from a cron job.
 */
export async function cleanupExpiredData(): Promise<{
  votesDeleted: number;
  usersCleanedUp: number;
}> {
  // Note: Full implementation would require scanning KV
  // For Vercel KV, this would need a different approach
  // (e.g., maintaining a list of keys to clean)

  return {
    votesDeleted: 0,
    usersCleanedUp: 0,
  };
}
