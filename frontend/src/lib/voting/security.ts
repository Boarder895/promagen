/**
 * @file src/lib/voting/security.ts
 * @description Security utilities for the voting system - Clerk Integration
 * 
 * Security measures implemented:
 * 1. Clerk JWT validation (server-side)
 * 2. HMAC-based request signing
 * 3. Timing-safe comparisons
 * 4. IP/UA hashing for privacy
 * 5. Origin validation
 * 6. User agent filtering
 * 7. Idempotency key validation
 * 8. Request fingerprinting
 * 9. CSRF token validation
 * 
 * IMPORTANT: This module uses Node.js crypto for server-side operations.
 * Never import this in client components.
 * 
 * Updated: January 2026 - Clerk integration for production security
 */

import { createHash, createHmac, timingSafeEqual, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
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
  const salt = process.env.IP_HASH_SALT || 'promagen-vote-ip-salt-v2-2026';
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
 * Handles various proxy headers safely with validation.
 */
export function getClientIp(request: NextRequest): string {
  // Check standard headers in order of trust
  // Vercel-specific headers take priority as they're set by the edge
  const headers = [
    'x-vercel-forwarded-for', // Vercel (most trusted in Vercel environment)
    'cf-connecting-ip',       // Cloudflare
    'x-real-ip',              // nginx proxy
    'x-forwarded-for',        // Standard proxy header
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs; take the first (client)
      const ip = value.split(',')[0]?.trim();
      if (ip && isValidIp(ip)) {
        return ip;
      }
    }
  }
  
  // Fallback to unknown (will still work but with reduced fingerprinting)
  return 'unknown';
}

/**
 * Validate IP address format (IPv4 and IPv6).
 * Prevents header injection attacks.
 */
function isValidIp(ip: string): boolean {
  // IPv4 pattern (strict)
  const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  
  // IPv6 pattern (simplified but covers most cases)
  const ipv6 = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^[a-fA-F0-9]{1,4}::(?:[a-fA-F0-9]{1,4}:){0,5}[a-fA-F0-9]{1,4}$/;
  
  // Length check to prevent DoS via long strings
  if (ip.length > 45) return false;
  
  return ipv4.test(ip) || ipv6.test(ip);
}

/**
 * Validate request origin.
 * Returns true if origin is allowed or same-origin.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  
  // No origin header means same-origin request (browser doesn't send it)
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
  
  // Preview deployments on Vercel
  if (process.env.VERCEL_ENV === 'preview' && origin.includes('.vercel.app')) {
    return true;
  }
  
  return false;
}

/**
 * Check if user agent is blocked.
 * Blocks known automation tools and requires a user agent.
 */
export function isBlockedUserAgent(ua: string | null): boolean {
  // Require user agent - browsers always send one
  if (!ua || ua.trim().length === 0) {
    return true;
  }
  
  // Length check to prevent DoS
  if (ua.length > 500) {
    return true;
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
 * Must be alphanumeric with hyphens, minimum length.
 */
export function isValidIdempotencyKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Must be at least minimum length
  if (key.length < MIN_IDEMPOTENCY_KEY_LENGTH) {
    return false;
  }
  
  // Maximum length to prevent DoS
  if (key.length > 64) {
    return false;
  }
  
  // Must be alphanumeric with hyphens only (no special chars)
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
  
  // Min length check
  if (id.length < 2) {
    return false;
  }
  
  // Format check (lowercase only, alphanumeric with hyphens)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(id) && !/^[a-z0-9]{2,}$/.test(id)) {
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
 * This is the first line of defense before any auth checks.
 */
export function performSecurityChecks(request: NextRequest): SecurityCheckResult {
  // 1. Check origin (CORS)
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
  
  // 3. Check content type (must be JSON for POST)
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        valid: false,
        error: 'Invalid content type',
        code: 'INVALID_CONTENT_TYPE',
      };
    }
  }
  
  // 4. Check content length
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size) || size > MAX_REQUEST_BODY_SIZE) {
      return {
        valid: false,
        error: 'Request too large',
        code: 'PAYLOAD_TOO_LARGE',
      };
    }
  }
  
  // 5. Check for suspicious headers (potential injection)
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
  for (const header of suspiciousHeaders) {
    const value = request.headers.get(header);
    if (value && (value.includes('<') || value.includes('>') || value.includes('\n'))) {
      return {
        valid: false,
        error: 'Invalid headers',
        code: 'HEADER_INJECTION',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Create request fingerprint for anomaly detection.
 * Combines multiple signals to identify unique clients.
 * Used for detecting vote manipulation patterns.
 */
export function createRequestFingerprint(request: NextRequest): string {
  const ip = getClientIp(request);
  const ua = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const secFetchDest = request.headers.get('sec-fetch-dest') || '';
  const secFetchMode = request.headers.get('sec-fetch-mode') || '';
  
  // Combine multiple browser fingerprint signals
  const components = [
    ip,
    ua,
    accept,
    acceptLanguage,
    acceptEncoding,
    secFetchDest,
    secFetchMode,
  ].join('|');
  
  return sha256(components);
}

// ============================================================================
// CLERK AUTHENTICATION (Production Security)
// ============================================================================

/**
 * Extract and validate user ID from Clerk session.
 * This is the authoritative authentication check.
 * 
 * Security:
 * - Uses Clerk's server-side auth() which validates JWT
 * - Never trusts client-supplied user IDs
 * - Returns null if not authenticated
 * 
 * @returns Clerk user ID or null if not authenticated
 */
export async function extractUserId(_request: NextRequest): Promise<string | null> {
  try {
    // Get authenticated user from Clerk (server-side)
    // This validates the session token cryptographically
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }
    
    // Validate userId format (Clerk IDs are always "user_" prefix)
    if (!userId.startsWith('user_') || userId.length < 10) {
      // This would indicate tampering or a bug
      console.error('[Security] Invalid Clerk userId format:', userId.slice(0, 10));
      return null;
    }
    
    return userId;
  } catch (error) {
    // Auth failed - treat as unauthenticated
    if (process.env.NODE_ENV === 'development') {
      console.error('[Security] Clerk auth error:', error);
    }
    return null;
  }
}

/**
 * Check if user has paid subscription.
 * Queries Clerk's user metadata for tier information.
 * 
 * Security:
 * - Never trusts client-supplied tier information
 * - Only reads from Clerk's server-side API
 * - Cached briefly to reduce API calls
 * 
 * @param userId - Clerk user ID
 * @returns true if user has 'paid' tier
 */
export async function checkPaidStatus(userId: string): Promise<boolean> {
  try {
    // Get full user object from Clerk (server-side)
    const user = await currentUser();
    
    if (!user || user.id !== userId) {
      return false;
    }
    
    // Read tier from public metadata (set by admin/webhook)
    const publicMetadata = user.publicMetadata as { tier?: string } | undefined;
    const tier = publicMetadata?.tier;
    
    return tier === 'paid';
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Security] Failed to check paid status:', error);
    }
    // Default to free tier on error (safer)
    return false;
  }
}

/**
 * Get user hash for rate limiting.
 * Uses Clerk user ID if authenticated, otherwise IP-based.
 * 
 * @param request - Next.js request
 * @param userId - Clerk user ID (if authenticated)
 * @returns Hash suitable for rate limit keys
 */
export function getUserHash(request: NextRequest, userId: string | null): string {
  if (userId) {
    // Authenticated user: hash their Clerk ID
    // This prevents cross-account rate limit evasion
    return sha256(`clerk:${userId}`);
  }
  
  // Anonymous: use IP hash (already includes salt)
  return hashIp(getClientIp(request));
}

// ============================================================================
// CRON AUTHENTICATION
// ============================================================================

/**
 * Validate cron job authentication.
 * Cron jobs must provide a secret header.
 * 
 * Security:
 * - Uses timing-safe comparison
 * - Requires CRON_SECRET env var to be set
 * - Rejects if no secret configured (fail closed)
 */
export function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || cronSecret.length < 32) {
    // No secret configured or too short = cron disabled
    console.error('[Security] CRON_SECRET not configured or too short');
    return false;
  }
  
  const providedSecret = request.headers.get('x-cron-secret');
  
  if (!providedSecret) {
    return false;
  }
  
  return safeCompare(providedSecret, cronSecret);
}

// ============================================================================
// CSRF TOKEN GENERATION (Optional Enhancement)
// ============================================================================

/**
 * Generate CSRF token for forms.
 * Can be used for additional protection on sensitive actions.
 */
export function generateCsrfToken(sessionId: string): string {
  const secret = process.env.CSRF_SECRET || process.env.CLERK_SECRET_KEY || 'fallback-csrf-secret';
  const timestamp = Math.floor(Date.now() / 1000);
  const data = `${sessionId}:${timestamp}`;
  return `${timestamp}.${hmacSign(data, secret)}`;
}

/**
 * Validate CSRF token.
 * Checks both signature and expiry (1 hour).
 */
export function validateCsrfToken(token: string, sessionId: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  // TypeScript safety: we've verified length === 2, so parts[0] and parts[1] exist
  const timestampStr = parts[0] as string;
  const signature = parts[1] as string;
  
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  
  // Check expiry (1 hour)
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > 3600) return false;
  
  // Verify signature
  const secret = process.env.CSRF_SECRET || process.env.CLERK_SECRET_KEY || 'fallback-csrf-secret';
  const data = `${sessionId}:${timestamp}`;
  const expectedSignature = hmacSign(data, secret);
  
  return safeCompare(signature, expectedSignature);
}
