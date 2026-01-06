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
 * 6. Fingerprint-based anomaly detection
 * 
 * Security: Rate limits are enforced server-side.
 * Client-side limits are for UX only.
 * 
 * Updated: January 2026 - Enhanced suspicious activity detection
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

export type SuspiciousActivityResult = {
  suspicious: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
} | null;

// ============================================================================
// RATE LIMIT CHECK
// ============================================================================

/**
 * Check if request is rate limited.
 * Does NOT consume a rate limit token.
 * 
 * @param request - Next.js request
 * @param userHash - Hashed user identifier (Clerk ID hash or IP hash)
 * @param providerId - Provider being voted for
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
// SUSPICIOUS ACTIVITY DETECTION (Enhanced)
// ============================================================================

// In-memory fingerprint tracking (short-lived, for anomaly detection)
const fingerprintCache = new Map<string, { count: number; firstSeen: number; ips: Set<string> }>();
const FINGERPRINT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FINGERPRINT_ALERT_THRESHOLD = 10; // Votes from same fingerprint
const IP_DIVERSITY_THRESHOLD = 3; // Different IPs with same fingerprint

// Clean up old entries periodically
let lastCleanup = Date.now();
function cleanupFingerprintCache(): void {
  const now = Date.now();
  if (now - lastCleanup < FINGERPRINT_CACHE_TTL) return;
  lastCleanup = now;
  
  for (const [key, value] of fingerprintCache.entries()) {
    if (now - value.firstSeen > FINGERPRINT_CACHE_TTL) {
      fingerprintCache.delete(key);
    }
  }
}

/**
 * Check for suspicious voting patterns.
 * Returns details about suspicious activity if detected.
 * 
 * Detection strategies:
 * 1. Rapid burst detection (many requests in short time)
 * 2. Fingerprint clustering (same browser fingerprint from multiple IPs)
 * 3. Request timing analysis (unnaturally consistent intervals)
 * 
 * @param request - Next.js request
 * @param fingerprint - Browser fingerprint hash (optional)
 */
export async function detectSuspiciousActivity(
  request: NextRequest,
  fingerprint?: string
): Promise<SuspiciousActivityResult> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  
  const rateLimitState = await getRateLimitState(ipHash);
  
  // Clean up cache periodically
  cleanupFingerprintCache();
  
  const issues: Array<{ reason: string; severity: 'low' | 'medium' | 'high' }> = [];
  
  // ========================================================================
  // 1. RATE-BASED DETECTION
  // ========================================================================
  
  if (rateLimitState) {
    const now = Date.now();
    const minuteWindow = 60 * 1000;
    const windowAge = now - rateLimitState.windowStart;
    
    // Flag if many requests in short time
    if (windowAge < minuteWindow && rateLimitState.count > RATE_LIMIT_PER_MINUTE / 2) {
      issues.push({
        reason: 'High request rate',
        severity: 'medium',
      });
    }
    
    // Flag if very rapid requests (likely automated)
    const timeSinceLastRequest = now - rateLimitState.lastRequest;
    if (timeSinceLastRequest < 500) { // Less than 500ms
      issues.push({
        reason: 'Rapid-fire requests',
        severity: 'high',
      });
    }
    
    // Flag unnaturally consistent timing (bot pattern)
    // Note: This would require storing timing history, simplified here
    if (timeSinceLastRequest > 1900 && timeSinceLastRequest < 2100) {
      // Suspiciously close to the 2s minimum interval
      issues.push({
        reason: 'Consistent timing pattern',
        severity: 'low',
      });
    }
  }
  
  // ========================================================================
  // 2. FINGERPRINT-BASED DETECTION
  // ========================================================================
  
  if (fingerprint) {
    // Track fingerprint occurrences
    let entry = fingerprintCache.get(fingerprint);
    
    if (!entry) {
      entry = { count: 0, firstSeen: Date.now(), ips: new Set() };
      fingerprintCache.set(fingerprint, entry);
    }
    
    entry.count += 1;
    entry.ips.add(ipHash);
    
    // Flag if same fingerprint from many different IPs (VPN/proxy rotation)
    if (entry.ips.size >= IP_DIVERSITY_THRESHOLD) {
      issues.push({
        reason: 'Fingerprint from multiple IPs',
        severity: 'high',
      });
    }
    
    // Flag if same fingerprint has many votes
    if (entry.count >= FINGERPRINT_ALERT_THRESHOLD) {
      issues.push({
        reason: 'High fingerprint activity',
        severity: 'medium',
      });
    }
  }
  
  // ========================================================================
  // 3. HEADER-BASED DETECTION
  // ========================================================================
  
  const ua = request.headers.get('user-agent') || '';
  
  // Check for headless browser indicators
  if (ua.includes('HeadlessChrome') || ua.includes('PhantomJS')) {
    issues.push({
      reason: 'Headless browser detected',
      severity: 'high',
    });
  }
  
  // Check for missing typical browser headers
  if (!request.headers.get('accept-language')) {
    issues.push({
      reason: 'Missing Accept-Language header',
      severity: 'low',
    });
  }
  
  if (!request.headers.get('sec-fetch-dest')) {
    // Modern browsers send Sec-Fetch-* headers
    issues.push({
      reason: 'Missing Sec-Fetch headers',
      severity: 'low',
    });
  }
  
  // ========================================================================
  // DETERMINE FINAL RESULT
  // ========================================================================
  
  if (issues.length === 0) {
    return null;
  }
  
  // Calculate overall severity
  const hasHigh = issues.some((i) => i.severity === 'high');
  const hasMedium = issues.some((i) => i.severity === 'medium');
  const severity: 'low' | 'medium' | 'high' = hasHigh 
    ? 'high' 
    : hasMedium 
      ? 'medium' 
      : 'low';
  
  return {
    suspicious: true,
    reason: issues.map((i) => i.reason).join(', '),
    severity,
  };
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
