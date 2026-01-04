/**
 * @file src/lib/voting/constants.ts
 * @description Configuration constants for the voting system
 * 
 * Security: All limits are intentionally conservative to prevent abuse.
 * Values are tuned for defense-in-depth.
 */

import type { SignalType } from './types';

// ============================================================================
// VOTE WEIGHTS
// ============================================================================

/**
 * Base weights for each signal type.
 * Higher weight = more user investment in the signal.
 */
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  card_like: 3,      // Direct engagement with leaderboard
  image_like: 2,     // Engagement with generated content
  comment: 2,        // Written engagement (future feature)
  image_upload: 1,   // Passive tagging (future feature)
} as const;

/**
 * Paid user vote weight multiplier.
 * Applied server-side only, never disclosed to users.
 */
export const PAID_MULTIPLIER = 1.5;

// ============================================================================
// RATE LIMITS
// ============================================================================

/**
 * Maximum providers a user can vote for per rolling 24h window.
 */
export const MAX_DAILY_VOTES = 3;

/**
 * Maximum votes for a single provider per 24h window.
 */
export const MAX_VOTES_PER_PROVIDER = 1;

/**
 * Rolling window duration in milliseconds (24 hours).
 */
export const VOTE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Rate limit: max requests per minute per IP.
 * Conservative to prevent brute force.
 */
export const RATE_LIMIT_PER_MINUTE = 10;

/**
 * Rate limit: max requests per hour per IP.
 */
export const RATE_LIMIT_PER_HOUR = 60;

/**
 * Cooldown between votes from same IP (ms).
 * Prevents rapid-fire voting scripts.
 */
export const MIN_VOTE_INTERVAL_MS = 2000;

// ============================================================================
// BAYESIAN SCORING
// ============================================================================

/**
 * Minimum votes threshold for Bayesian calculation.
 * Providers with fewer votes are pulled toward global average.
 */
export const BAYESIAN_MIN_VOTES = 25;

/**
 * Time decay half-life in days.
 * After this many days, a vote has 50% weight.
 */
export const TIME_DECAY_HALF_LIFE_DAYS = 70;

/**
 * Maximum age for votes (days).
 * Votes older than this are pruned.
 */
export const MAX_VOTE_AGE_DAYS = 180;

// ============================================================================
// SCORE BLENDING (Community vs Editorial)
// ============================================================================

/**
 * Community vote influence based on total vote count.
 * Format: [voteThreshold, seedWeight, communityWeight]
 */
export const BLEND_THRESHOLDS: [number, number, number][] = [
  [0, 1.0, 0.0],     // 0-24 votes: 100% seed, 0% community
  [25, 0.75, 0.25],  // 25-49 votes: 75% seed, 25% community
  [50, 0.50, 0.50],  // 50-99 votes: 50% seed, 50% community
  [100, 0.30, 0.70], // 100+ votes: 30% seed, 70% community
];

// ============================================================================
// KV STORAGE KEYS
// ============================================================================

/**
 * KV namespace for vote data.
 */
export const KV_NAMESPACE = 'promagen:votes';

/**
 * KV key patterns.
 */
export const KV_KEYS = {
  /** Individual vote record */
  vote: (voteId: string) => `${KV_NAMESPACE}:vote:${voteId}`,
  
  /** User's vote history (for deduplication) */
  userVotes: (userHash: string) => `${KV_NAMESPACE}:user:${userHash}`,
  
  /** Provider vote aggregates */
  providerStats: (providerId: string) => `${KV_NAMESPACE}:provider:${providerId}`,
  
  /** Rate limit state by IP hash */
  rateLimit: (ipHash: string) => `${KV_NAMESPACE}:rate:${ipHash}`,
  
  /** Idempotency key tracking */
  idempotency: (key: string) => `${KV_NAMESPACE}:idem:${key}`,
  
  /** Global rankings cache */
  rankings: () => `${KV_NAMESPACE}:rankings`,
  
  /** Last calculation timestamp */
  lastCalculated: () => `${KV_NAMESPACE}:last-calc`,
} as const;

// ============================================================================
// SECURITY
// ============================================================================

/**
 * Allowed origins for CORS.
 * Null origin allowed for same-origin requests.
 */
export const ALLOWED_ORIGINS = [
  'https://promagen.com',
  'https://www.promagen.com',
  'https://promagen.vercel.app',
  null, // Same-origin requests
] as const;

/**
 * Suspicious patterns in user agents.
 * Requests with these are rejected.
 */
export const BLOCKED_USER_AGENTS = [
  'curl',
  'wget',
  'python-requests',
  'go-http-client',
  'java/',
  'apache-httpclient',
  'scrapy',
  'bot',
  'crawler',
  'spider',
] as const;

/**
 * Idempotency key expiry (ms).
 * Keys are tracked to prevent replay attacks.
 */
export const IDEMPOTENCY_KEY_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Minimum idempotency key length.
 */
export const MIN_IDEMPOTENCY_KEY_LENGTH = 16;

/**
 * Maximum request body size (bytes).
 */
export const MAX_REQUEST_BODY_SIZE = 1024; // 1KB

// ============================================================================
// CRON CONFIGURATION
// ============================================================================

/**
 * Cron schedule for rankings recalculation.
 * Runs every hour at minute 0.
 */
export const CRON_SCHEDULE = '0 * * * *';

/**
 * Cron job timeout (ms).
 */
export const CRON_TIMEOUT_MS = 30_000;

/**
 * Secret for cron job authentication.
 * Must match CRON_SECRET env var.
 */
export const CRON_SECRET_HEADER = 'x-cron-secret';

// ============================================================================
// SEED DATA (Artificial Analysis ELO)
// ============================================================================

/**
 * Initial ELO scores from Artificial Analysis.
 * Used as seed data before community votes accumulate.
 */
export const SEED_ELO_SCORES: Record<string, number> = {
  'flux': 1143,
  'ideogram': 1102,
  'midjourney': 1093,
  'stability': 1084,
  'openai': 984,
} as const;

/**
 * Manual tiers for providers without external benchmarks.
 */
export const SEED_TIERS: Record<string, 'top-tier' | 'mid-tier' | 'entry-tier' | 'specialized' | 'utility'> = {
  // Top-tier (no ELO, but industry leaders)
  'adobe-firefly': 'top-tier',
  'runway': 'top-tier',
  'google-imagen': 'top-tier',
  'leonardo': 'top-tier',
  
  // Mid-tier (good quality, competitive)
  'canva': 'mid-tier',
  'lexica': 'mid-tier',
  'openart': 'mid-tier',
  'nightcafe': 'mid-tier',
  'jasper': 'mid-tier',
  'freepik': 'mid-tier',
  'playground': 'mid-tier',
  'microsoft-designer': 'mid-tier',
  'dreamstudio': 'mid-tier',
  'imagine-meta': 'mid-tier',
  'photoleap': 'mid-tier',
  'clipdrop': 'mid-tier',
  'getimg': 'mid-tier',
  'artbreeder': 'mid-tier',
  'bluewillow': 'mid-tier',
  'fotor': 'mid-tier',
  'picsart': 'mid-tier',
  'simplified': 'mid-tier',
  'vistacreate': 'mid-tier',
  'bing': 'mid-tier',
  '123rf': 'mid-tier',
  'artguru': 'mid-tier',
  'myedit': 'mid-tier',
  
  // Entry-tier (basic quality, accessible)
  'craiyon': 'entry-tier',
  'deepai': 'entry-tier',
  'hotpot': 'entry-tier',
  'pixlr': 'entry-tier',
  'artistly': 'entry-tier',
  'visme': 'entry-tier',
  'picwish': 'entry-tier',
  'dreamlike': 'entry-tier',
  
  // Specialized (niche use cases)
  'novelai': 'specialized', // Anime focus
  
  // Utility (not primarily generative)
  'removebg': 'utility', // Background removal
} as const;

/**
 * ELO to score conversion factor.
 * Maps ELO range (900-1200) to quality score (60-100).
 */
export const ELO_TO_SCORE_BASE = 900;
export const ELO_TO_SCORE_SCALE = 0.133; // (100-60) / (1200-900)

/**
 * Tier to base score mapping.
 */
export const TIER_BASE_SCORES: Record<string, number> = {
  'top-tier': 85,
  'mid-tier': 70,
  'entry-tier': 55,
  'specialized': 75,
  'utility': 50,
} as const;
