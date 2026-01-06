/**
 * @file src/lib/voting/index.ts
 * @description Public exports for the voting system
 * 
 * Usage:
 *   import { validateVoteRequest, checkRateLimit } from '@/lib/voting';
 * 
 * Note: Some exports are server-only (use crypto).
 * Client components should only import types.
 * 
 * Updated: January 2026 - Clerk integration, enhanced security
 */

// Types (safe for client)
export type {
  SignalType,
  UserTier,
  VoteRecord,
  VoteMetadata,
  ProviderVoteStats,
  ProviderRanking,
  RateLimitState,
  VoteRequestBody,
  VoteSuccessResponse,
  VoteErrorResponse,
  VoteErrorCode,
  RankingsUpdateResult,
} from './types';

// Constants (safe for client)
export {
  SIGNAL_WEIGHTS,
  PAID_MULTIPLIER,
  MAX_DAILY_VOTES,
  MAX_VOTES_PER_PROVIDER,
  VOTE_WINDOW_MS,
  BAYESIAN_MIN_VOTES,
  TIME_DECAY_HALF_LIFE_DAYS,
  BLEND_THRESHOLDS,
  SEED_ELO_SCORES,
  SEED_TIERS,
} from './constants';

// Validation (safe for client with Zod)
export {
  VoteRequestSchema,
  VoteQuerySchema,
  SignalTypeSchema,
  ProviderIdSchema,
  IdempotencyKeySchema,
  validateVoteRequest,
  safeValidateVoteRequest,
  isValidSignalType,
  validateProviderExists,
} from './validation';

export type {
  ValidatedVoteRequest,
  ValidatedVoteRecord,
  ValidatedRateLimitState,
  ValidatedProviderStats,
} from './validation';

// Security (SERVER ONLY - uses crypto and Clerk)
export {
  // Hashing utilities
  sha256,
  hmacSign,
  safeCompare,
  generateVoteId,
  hashIp,
  hashUserAgent,
  
  // Request utilities
  getClientIp,
  validateOrigin,
  isBlockedUserAgent,
  isValidIdempotencyKey,
  isValidProviderId,
  
  // Security checks
  performSecurityChecks,
  createRequestFingerprint,
  
  // Clerk integration (server-side auth)
  extractUserId,
  checkPaidStatus,
  getUserHash,
  
  // Cron auth
  validateCronAuth,
  
  // CSRF (optional)
  generateCsrfToken,
  validateCsrfToken,
} from './security';

export type { SecurityCheckResult } from './security';

// Storage (SERVER ONLY - uses KV)
export {
  storeVote,
  getVote,
  deleteVote,
  getUserVoteHistory,
  addUserVote,
  hasUserVotedForProvider,
  getUserDailyVoteCount,
  getUserVotedProviderIds,
  getProviderStats,
  updateProviderStats,
  incrementProviderStats,
  getAllProviderStats,
  getRateLimitState,
  updateRateLimitState,
  incrementRateLimit,
  isIdempotencyKeyUsed,
  markIdempotencyKeyUsed,
  getCachedRankings,
  storeCachedRankings,
  getLastCalculationTime,
  cleanupExpiredData,
} from './storage';

export type { UserVoteEntry, UserVoteHistory } from './storage';

// Rate Limiting (SERVER ONLY)
export {
  checkRateLimit,
  consumeRateLimit,
  getRateLimitHeaders,
  detectSuspiciousActivity,
  resetRateLimits,
} from './rate-limiter';

export type { 
  RateLimitResult, 
  RateLimitCode,
  SuspiciousActivityResult,
} from './rate-limiter';

// Bayesian Scoring
export {
  calculateTimeDecay,
  applyTimeDecayToVotes,
  calculateBayesianScore,
  calculateGlobalAverage,
  eloToQualityScore,
  getSeedScore,
  getSeedTier,
  getBlendWeights,
  calculateBlendedScore,
  calculateRankings,
  updateProviderBayesianScore,
} from './bayesian';
