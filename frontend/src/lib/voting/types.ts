/**
 * @file src/lib/voting/types.ts
 * @description Type definitions for the voting system
 * 
 * Security: Types are intentionally strict to prevent injection and ensure
 * type safety at compile time. All string types are constrained where possible.
 */

/**
 * Valid signal types for votes.
 * Each type has different weight, reflecting user investment level.
 */
export type SignalType = 
  | 'card_like'      // Direct leaderboard thumbs-up (weight: 3)
  | 'image_like'     // Liking a generated image (weight: 2)
  | 'comment'        // Favorable comment on image (weight: 2)
  | 'image_upload';  // Image tagged to provider (weight: 1)

/**
 * User tier for vote weight calculation.
 */
export type UserTier = 'free' | 'paid';

/**
 * Individual vote record stored in KV.
 */
export type VoteRecord = {
  /** Unique vote ID (UUIDv4) */
  id: string;
  
  /** User ID (hashed for privacy) */
  userId: string;
  
  /** Provider receiving the vote */
  providerId: string;
  
  /** Type of engagement signal */
  signalType: SignalType;
  
  /** Base weight before tier multiplier */
  baseWeight: number;
  
  /** Final weight after tier multiplier */
  finalWeight: number;
  
  /** User tier at vote time (for audit) */
  userTier: UserTier;
  
  /** ISO timestamp of vote creation */
  createdAt: string;
  
  /** Vote expiry timestamp (for time decay) */
  expiresAt: string;
  
  /** Request metadata for security audit */
  meta: VoteMetadata;
};

/**
 * Request metadata for security auditing.
 * All sensitive fields are hashed.
 */
export type VoteMetadata = {
  /** Hashed IP address */
  ipHash: string;
  
  /** Hashed user agent */
  uaHash: string;
  
  /** Request origin */
  origin: string | null;
  
  /** Idempotency key to prevent replay */
  idempotencyKey: string;
};

/**
 * Aggregated vote statistics for a provider.
 */
export type ProviderVoteStats = {
  providerId: string;
  
  /** Total weighted votes */
  totalWeightedVotes: number;
  
  /** Total raw vote count */
  totalVoteCount: number;
  
  /** Breakdown by signal type */
  signals: {
    cardLikes: number;
    imageLikes: number;
    comments: number;
    imageUploads: number;
  };
  
  /** Bayesian score (0-100) */
  bayesianScore: number;
  
  /** Community-influenced rank (1-42) */
  communityRank: number;
  
  /** Last calculation timestamp */
  lastCalculated: string;
};

/**
 * Provider ranking entry for rankings.json
 */
export type ProviderRanking = {
  providerId: string;
  
  /** Seed ELO from Artificial Analysis (null if not benchmarked) */
  seedElo: number | null;
  
  /** Manual tier for providers without ELO */
  seedTier: 'top-tier' | 'mid-tier' | 'entry-tier' | 'specialized' | 'utility';
  
  /** Calculated Bayesian score from community votes */
  bayesianScore: number | null;
  
  /** Final blended Image Quality rank (1-42) */
  imageQualityRank: number;
  
  /** Raw vote statistics */
  stats: ProviderVoteStats | null;
};

/**
 * Rate limit state for a user/IP.
 */
export type RateLimitState = {
  /** Number of requests in current window */
  count: number;
  
  /** Window start timestamp */
  windowStart: number;
  
  /** Votes cast today (rolling 24h) */
  dailyVotes: string[]; // Provider IDs
  
  /** Last request timestamp */
  lastRequest: number;
};

/**
 * API request body for POST /api/providers/vote
 */
export type VoteRequestBody = {
  providerId: string;
  signalType: SignalType;
  idempotencyKey: string;
};

/**
 * API response for successful vote
 */
export type VoteSuccessResponse = {
  success: true;
  vote: {
    providerId: string;
    weight: number;
    rank: number | null;
  };
};

/**
 * API response for vote errors
 */
export type VoteErrorResponse = {
  success: false;
  error: string;
  code: VoteErrorCode;
};

/**
 * Error codes for vote failures
 */
export type VoteErrorCode =
  | 'INVALID_REQUEST'      // Malformed request body
  | 'INVALID_PROVIDER'     // Provider ID not found
  | 'INVALID_SIGNAL_TYPE'  // Unknown signal type
  | 'UNAUTHORIZED'         // Not authenticated
  | 'RATE_LIMITED'         // Too many requests
  | 'DAILY_LIMIT'          // 3 providers/day limit
  | 'ALREADY_VOTED'        // Already voted for this provider
  | 'REPLAY_DETECTED'      // Idempotency key reused
  | 'SUSPICIOUS_REQUEST'   // Failed security checks
  | 'INTERNAL_ERROR';      // Server error

/**
 * Rankings recalculation result
 */
export type RankingsUpdateResult = {
  success: boolean;
  providersUpdated: number;
  newRankings: ProviderRanking[];
  calculatedAt: string;
  duration: number; // ms
};
