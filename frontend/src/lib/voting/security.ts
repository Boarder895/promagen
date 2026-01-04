/**
 * @file src/lib/voting/security.ts
 * @description Security utilities for the voting system
 * 
 * Security measures implemented:
 * 1. HMAC-based request signing
 * 2. Timing-safe comparisons
 * 3. IP/UA hashing for privacy
 * 4. Origin validation
 * 5. User agent filtering
 * 6. Idempotency key validation
 * 7. Request fingerprinting
 * 
 * IMPORTANT: This module uses Node.js crypto for server-side operations.
 * Never import this in client components.
 */

import { createHash, createHmac, timingSafeEqual, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import {
  ALLOWED_ORIGINS,
  BLOCKED_USER_AGENTS,
  MIN_IDEMPOTENCY_KEY_LENGTH,
  MAX_REQUEST_BODY_SIZE,
} from './constants';

// ============================================================================
// HASHING UTILITIES
// ============================================================================

/**
 * Create a SHA-256 hash of input.
 * Used for hashing IPs, user agents, etc.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Create an HMAC-SHA256 signature.
 * Used for request signing and verification.
 */
export function hmacSign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Timing-safe comparison of two strings.
 * Prevents timing attacks on token comparison.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  // Ensure equal length for timing-safe comparison
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  
  if (aBuffer.length !== bBuffer.length) {
    // Still do a comparison to maintain constant time
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Generate a cryptographically secure UUID.
 */
export function generateVoteId(): string {
  return randomUUID();
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Hash client IP for privacy-preserving storage.
 * Adds salt to prevent rainbow table attacks.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'promagen-vote-ip-salt';
  return sha256(`${ip}:${salt}`);
}

/**
 * Hash user agent for privacy-preserving storage.
 */
export function hashUserAgent(ua: string): string {
  return sha256(ua);
}

/**
 * Extract client IP from Next.js request.
 * Handles various proxy headers safely.
 */
export function getClientIp(request: NextRequest): string {
  // Check standard headers in order of trust
  const headers = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip', // Cloudflare
    'x-vercel-forwarded-for', // Vercel
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs; take the first
      const ip = value.split(',')[0]?.trim();
      if (ip && isValidIp(ip)) {
        return ip;
      }
    }
  }
  
  // Fallback to unknown
  return 'unknown';
}

/**
 * Basic IP address validation.
 */
function isValidIp(ip: string): boolean {
  // IPv4 pattern
  const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  // IPv6 pattern (simplified)
  const ipv6 = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/;
  
  return ipv4.test(ip) || ipv6.test(ip);
}

/**
 * Validate request origin.
 * Returns true if origin is allowed or same-origin.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  
  // No origin header means same-origin request
  if (!origin) {
    return true;
  }
  
  // Check against allowed origins
  const allowed = ALLOWED_ORIGINS as readonly (string | null)[];
  
  // Exact match
  if (allowed.includes(origin)) {
    return true;
  }
  
  // Development mode allows localhost
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user agent is blocked.
 * Blocks known automation tools.
 */
export function isBlockedUserAgent(ua: string | null): boolean {
  if (!ua) {
    return true; // Require user agent
  }
  
  const lower = ua.toLowerCase();
  
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (lower.includes(blocked)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate idempotency key format.
 */
export function isValidIdempotencyKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Must be at least minimum length
  if (key.length < MIN_IDEMPOTENCY_KEY_LENGTH) {
    return false;
  }
  
  // Must be alphanumeric with hyphens only
  if (!/^[a-zA-Z0-9-]+$/.test(key)) {
    return false;
  }
  
  return true;
}

/**
 * Validate provider ID format.
 * Must be lowercase alphanumeric with hyphens.
 */
export function isValidProviderId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // Max length check
  if (id.length > 50) {
    return false;
  }
  
  // Format check
  if (!/^[a-z0-9-]+$/.test(id)) {
    return false;
  }
  
  return true;
}

// ============================================================================
// REQUEST SECURITY CHECKS
// ============================================================================

export type SecurityCheckResult = {
  valid: boolean;
  error?: string;
  code?: string;
};

/**
 * Perform comprehensive security checks on incoming request.
 */
export function performSecurityChecks(request: NextRequest): SecurityCheckResult {
  // 1. Check origin
  if (!validateOrigin(request)) {
    return {
      valid: false,
      error: 'Invalid request origin',
      code: 'ORIGIN_REJECTED',
    };
  }
  
  // 2. Check user agent
  const ua = request.headers.get('user-agent');
  if (isBlockedUserAgent(ua)) {
    return {
      valid: false,
      error: 'Request blocked',
      code: 'UA_BLOCKED',
    };
  }
  
  // 3. Check content type
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return {
      valid: false,
      error: 'Invalid content type',
      code: 'INVALID_CONTENT_TYPE',
    };
  }
  
  // 4. Check content length
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_REQUEST_BODY_SIZE) {
      return {
        valid: false,
        error: 'Request too large',
        code: 'PAYLOAD_TOO_LARGE',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Create request fingerprint for anomaly detection.
 * Combines multiple signals to identify unique clients.
 */
export function createRequestFingerprint(request: NextRequest): string {
  const ip = getClientIp(request);
  const ua = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  
  const components = [ip, ua, accept, acceptLanguage, acceptEncoding].join('|');
  
  return sha256(components);
}

// ============================================================================
// USER ID EXTRACTION
// ============================================================================

/**
 * Extract and validate user ID from request.
 * Returns null if not authenticated.
 * 
 * Security: This checks multiple auth mechanisms and validates tokens.
 */
export function extractUserId(request: NextRequest): string | null {
  // Check for auth cookie
  const authCookie = request.cookies.get('auth_token');
  if (authCookie?.value) {
    // TODO: Integrate with actual auth system
    // For now, hash the token as user ID
    // In production, this should validate JWT/session
    return sha256(authCookie.value);
  }
  
  // Check for Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.length >= 32) {
      // TODO: Validate JWT
      return sha256(token);
    }
  }
  
  // Development fallback (remove in production)
  if (process.env.NODE_ENV === 'development') {
    const ip = getClientIp(request);
    return sha256(`dev:${ip}`);
  }
  
  return null;
}

/**
 * Check if user has paid subscription.
 * 
 * Security: Must query actual subscription system.
 * Never trust client-supplied tier information.
 */
export async function checkPaidStatus(userId: string): Promise<boolean> {
  // TODO: Integrate with actual subscription system
  // This should:
  // 1. Query user database
  // 2. Check subscription status
  // 3. Verify subscription is active
  // 4. Cache result briefly (1 minute)
  
  // For now, return false (free tier)
  // In production, implement actual check
  
  // Placeholder: Check if user ID ends with 'paid' (for testing)
  if (process.env.NODE_ENV === 'development') {
    return userId.endsWith('paid');
  }
  
  return false;
}

// ============================================================================
// CRON AUTHENTICATION
// ============================================================================

/**
 * Validate cron job authentication.
 * Cron jobs must provide a secret header.
 */
export function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    // No secret configured = cron disabled
    return false;
  }
  
  const providedSecret = request.headers.get('x-cron-secret');
  
  if (!providedSecret) {
    return false;
  }
  
  return safeCompare(providedSecret, cronSecret);
}
