/**
 * @file src/lib/voting/rate-limiter.ts
 * @description Rate limiting for vote API
 * 
 * Multi-layer rate limiting:
 * 1. Per-minute limit (prevent burst attacks)
 * 2. Per-hour limit (prevent sustained attacks)
 * 3. Daily vote limit (3 providers per user)
 * 4. Per-provider limit (1 vote per provider per 24h)
 * 5. Minimum interval (2s between votes)
 * 
 * Security: Rate limits are enforced server-side.
 * Client-side limits are for UX only.
 */

import type { NextRequest } from 'next/server';
import {
  getRateLimitState,
  incrementRateLimit,
  getUserDailyVoteCount,
  hasUserVotedForProvider,
} from './storage';
import { getClientIp, hashIp } from './security';
import {
  RATE_LIMIT_PER_MINUTE,
  RATE_LIMIT_PER_HOUR,
  MIN_VOTE_INTERVAL_MS,
  MAX_DAILY_VOTES,
} from './constants';

// ============================================================================
// TYPES
// ============================================================================

export type RateLimitResult = {
  allowed: boolean;
  reason?: string;
  code?: RateLimitCode;
  retryAfter?: number; // Seconds until retry allowed
  remaining?: number;  // Remaining requests in window
};

export type RateLimitCode =
  | 'MINUTE_LIMIT'
  | 'HOUR_LIMIT'
  | 'DAILY_LIMIT'
  | 'PROVIDER_LIMIT'
  | 'INTERVAL_LIMIT';

// ============================================================================
// RATE LIMIT CHECK
// ============================================================================

/**
 * Check if request is rate limited.
 * Does NOT consume a rate limit token.
 */
export async function checkRateLimit(
  request: NextRequest,
  userHash: string,
  providerId: string
): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const now = Date.now();
  
  // 1. Check IP-based rate limits
  const rateLimitState = await getRateLimitState(ipHash);
  
  if (rateLimitState) {
    const windowAge = now - rateLimitState.windowStart;
    const minuteWindow = 60 * 1000;
    const hourWindow = 60 * 60 * 1000;
    
    // Check per-minute limit
    if (windowAge < minuteWindow && rateLimitState.count >= RATE_LIMIT_PER_MINUTE) {
      return {
        allowed: false,
        reason: 'Too many requests. Please slow down.',
        code: 'MINUTE_LIMIT',
        retryAfter: Math.ceil((minuteWindow - windowAge) / 1000),
        remaining: 0,
      };
    }
    
    // Check per-hour limit
    if (windowAge < hourWindow && rateLimitState.count >= RATE_LIMIT_PER_HOUR) {
      return {
        allowed: false,
        reason: 'Hourly limit reached. Please try again later.',
        code: 'HOUR_LIMIT',
        retryAfter: Math.ceil((hourWindow - windowAge) / 1000),
        remaining: 0,
      };
    }
    
    // Check minimum interval
    const timeSinceLastRequest = now - rateLimitState.lastRequest;
    if (timeSinceLastRequest < MIN_VOTE_INTERVAL_MS) {
      return {
        allowed: false,
        reason: 'Please wait before voting again.',
        code: 'INTERVAL_LIMIT',
        retryAfter: Math.ceil((MIN_VOTE_INTERVAL_MS - timeSinceLastRequest) / 1000),
        remaining: Math.max(0, RATE_LIMIT_PER_MINUTE - rateLimitState.count - 1),
      };
    }
  }
  
  // 2. Check user-based limits
  const dailyVoteCount = await getUserDailyVoteCount(userHash);
  
  if (dailyVoteCount >= MAX_DAILY_VOTES) {
    return {
      allowed: false,
      reason: 'Daily vote limit reached.',
      code: 'DAILY_LIMIT',
      remaining: 0,
    };
  }
  
  // 3. Check per-provider limit
  const hasVoted = await hasUserVotedForProvider(userHash, providerId);
  
  if (hasVoted) {
    return {
      allowed: false,
      reason: 'Already voted for this provider.',
      code: 'PROVIDER_LIMIT',
      remaining: MAX_DAILY_VOTES - dailyVoteCount,
    };
  }
  
  // All checks passed
  return {
    allowed: true,
    remaining: MAX_DAILY_VOTES - dailyVoteCount - 1,
  };
}

/**
 * Consume a rate limit token.
 * Call this AFTER vote is successfully recorded.
 */
export async function consumeRateLimit(
  request: NextRequest,
  providerId: string
): Promise<void> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  
  await incrementRateLimit(ipHash, providerId);
}

// ============================================================================
// RATE LIMIT HEADERS
// ============================================================================

/**
 * Generate rate limit headers for response.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (result.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = String(result.remaining);
  }
  
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  
  if (!result.allowed && result.code) {
    headers['X-RateLimit-Reason'] = result.code;
  }
  
  return headers;
}

// ============================================================================
// SUSPICIOUS ACTIVITY DETECTION
// ============================================================================

/**
 * Check for suspicious voting patterns.
 * Returns true if activity appears suspicious.
 */
export async function detectSuspiciousActivity(
  request: NextRequest
): Promise<boolean> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  
  const rateLimitState = await getRateLimitState(ipHash);
  
  if (!rateLimitState) {
    return false;
  }
  
  const now = Date.now();
  const minuteWindow = 60 * 1000;
  const windowAge = now - rateLimitState.windowStart;
  
  // Flag if many requests in short time
  if (windowAge < minuteWindow && rateLimitState.count > RATE_LIMIT_PER_MINUTE / 2) {
    // More than half the limit in less than a minute
    return true;
  }
  
  // Flag if very rapid requests
  const timeSinceLastRequest = now - rateLimitState.lastRequest;
  if (timeSinceLastRequest < 500) { // Less than 500ms
    return true;
  }
  
  return false;
}

// ============================================================================
// ADMIN: RATE LIMIT RESET
// ============================================================================

/**
 * Reset rate limits for an IP (admin function).
 * Used for support/debugging only.
 */
export async function resetRateLimits(ipHash: string): Promise<void> {
  // This would require a delete operation in KV
  // Implementation depends on KV adapter
  
  // For now, we can set to empty state
  const emptyState = {
    count: 0,
    windowStart: Date.now(),
    dailyVotes: [],
    lastRequest: 0,
  };
  
  const { updateRateLimitState } = await import('./storage');
  await updateRateLimitState(ipHash, emptyState);
}
