// src/lib/vote-storage.ts
// Manages localStorage for image quality votes
// Rolling 24-hour window per provider, max 3 providers per day

const STORAGE_KEY = 'promagen:image-quality-votes';
const MAX_DAILY_VOTES = 3;
const VOTE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export type StoredVote = {
  providerId: string;
  votedAt: number; // Unix timestamp (ms)
};

export type VoteStorage = {
  votes: StoredVote[];
};

/**
 * Get current vote storage from localStorage
 */
export function getVoteStorage(): VoteStorage {
  if (typeof window === 'undefined') {
    return { votes: [] };
  }
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { votes: [] };
    
    const parsed = JSON.parse(raw) as VoteStorage;
    if (!parsed.votes || !Array.isArray(parsed.votes)) {
      return { votes: [] };
    }
    
    return parsed;
  } catch {
    return { votes: [] };
  }
}

/**
 * Save vote storage to localStorage
 */
export function setVoteStorage(storage: VoteStorage): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch {
    // Storage full or unavailable - fail silently
  }
}

/**
 * Clean expired votes (older than 24 hours)
 */
export function cleanExpiredVotes(storage: VoteStorage): VoteStorage {
  const now = Date.now();
  const validVotes = storage.votes.filter(
    (vote) => now - vote.votedAt < VOTE_EXPIRY_MS
  );
  
  return { votes: validVotes };
}

/**
 * Check if user has already voted for a specific provider within 24 hours
 */
export function hasVotedForProvider(providerId: string): boolean {
  const storage = cleanExpiredVotes(getVoteStorage());
  return storage.votes.some((vote) => vote.providerId === providerId);
}

/**
 * Get count of valid votes in the current 24-hour rolling window
 */
export function getDailyVoteCount(): number {
  const storage = cleanExpiredVotes(getVoteStorage());
  return storage.votes.length;
}

/**
 * Check if user can vote (has remaining daily votes)
 */
export function canVote(): boolean {
  return getDailyVoteCount() < MAX_DAILY_VOTES;
}

/**
 * Get remaining votes for today
 */
export function getRemainingVotes(): number {
  return Math.max(0, MAX_DAILY_VOTES - getDailyVoteCount());
}

/**
 * Record a new vote for a provider
 * Returns true if vote was recorded, false if blocked (already voted or limit reached)
 */
export function recordVote(providerId: string): boolean {
  // Clean expired votes first
  const storage = cleanExpiredVotes(getVoteStorage());
  
  // Check if already voted for this provider
  if (storage.votes.some((vote) => vote.providerId === providerId)) {
    return false;
  }
  
  // Check daily limit
  if (storage.votes.length >= MAX_DAILY_VOTES) {
    return false;
  }
  
  // Record the vote
  storage.votes.push({
    providerId,
    votedAt: Date.now(),
  });
  
  setVoteStorage(storage);
  return true;
}

/**
 * Get all provider IDs the user has voted for (within 24 hours)
 */
export function getVotedProviderIds(): string[] {
  const storage = cleanExpiredVotes(getVoteStorage());
  return storage.votes.map((vote) => vote.providerId);
}

/**
 * Get time until a specific provider vote expires (ms)
 * Returns null if user hasn't voted for this provider
 */
export function getVoteExpiryTime(providerId: string): number | null {
  const storage = getVoteStorage();
  const vote = storage.votes.find((v) => v.providerId === providerId);
  
  if (!vote) return null;
  
  const expiresAt = vote.votedAt + VOTE_EXPIRY_MS;
  const remaining = expiresAt - Date.now();
  
  return remaining > 0 ? remaining : null;
}
