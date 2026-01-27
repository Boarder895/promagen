/**
 * Event Tracking API
 * 
 * Tracks user engagement events for the Index Rating system.
 * 
 * Supported events:
 * - prompt_builder_open: User opens provider detail page
 * - prompt_submit: User clicks Copy in prompt builder
 * - social_click: User clicks social media icon
 * 
 * SECURITY:
 * - Input validation on all fields
 * - Rate limiting per session
 * - Parameterized database queries
 * - No sensitive data logging
 * 
 * @see docs/authority/index-rating.md
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db, hasDatabaseConfigured } from '@/lib/db';
import { isValidEventType, type TrackEventRequest, type IndexRatingEventType } from '@/types/index-rating';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum events per session per minute (rate limiting) */
const MAX_EVENTS_PER_SESSION_PER_MINUTE = 30;

/** Maximum provider ID length */
const MAX_PROVIDER_ID_LENGTH = 50;

/** Maximum src field length */
const MAX_SRC_LENGTH = 100;

/** Maximum session ID length */
const MAX_SESSION_ID_LENGTH = 100;

/** Allowed event types for this endpoint */
const ALLOWED_EVENT_TYPES: IndexRatingEventType[] = [
  'prompt_builder_open',
  'prompt_submit',
  'social_click',
];

// In-memory rate limiter (resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// =============================================================================
// HELPERS
// =============================================================================

/** Character set for ID generation */
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a simple random ID without external deps
 */
function generateId(length: number = 16): string {
  let result = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      // Non-null assertion safe: array length matches loop bounds
      const byte = array[i]!;
      result += ID_CHARS.charAt(byte % ID_CHARS.length);
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
    }
  }
  return result;
}

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Check rate limit for a session.
 * Simple in-memory rate limiting.
 * 
 * @param sessionId - Session identifier
 * @returns true if request should be allowed
 */
function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(sessionId);
  
  if (!existing || now > existing.resetAt) {
    // Reset or create new entry
    rateLimitMap.set(sessionId, {
      count: 1,
      resetAt: now + 60000, // 1 minute window
    });
    return true;
  }
  
  if (existing.count >= MAX_EVENTS_PER_SESSION_PER_MINUTE) {
    return false;
  }
  
  existing.count++;
  return true;
}

/**
 * Clean up expired rate limit entries (called periodically)
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate and sanitize provider ID.
 * 
 * @param providerId - Raw provider ID
 * @returns Sanitized provider ID or null if invalid
 */
function validateProviderId(providerId: unknown): string | null {
  if (typeof providerId !== 'string') {
    return null;
  }
  
  const trimmed = providerId.toLowerCase().trim();
  
  // Check length
  if (trimmed.length === 0 || trimmed.length > MAX_PROVIDER_ID_LENGTH) {
    return null;
  }
  
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
    return null;
  }
  
  return trimmed;
}

/**
 * Validate event type.
 * 
 * @param eventType - Raw event type
 * @returns Validated event type or null if invalid
 */
function validateEventType(eventType: unknown): IndexRatingEventType | null {
  if (typeof eventType !== 'string') {
    return null;
  }
  
  const trimmed = eventType.trim();
  
  if (!isValidEventType(trimmed)) {
    return null;
  }
  
  // Additional check: only allow events this endpoint handles
  if (!ALLOWED_EVENT_TYPES.includes(trimmed as IndexRatingEventType)) {
    return null;
  }
  
  return trimmed as IndexRatingEventType;
}

/**
 * Validate and sanitize src field.
 * 
 * @param src - Raw src value
 * @returns Sanitized src or null
 */
function validateSrc(src: unknown): string | null {
  if (src === undefined || src === null) {
    return null;
  }
  
  if (typeof src !== 'string') {
    return null;
  }
  
  const trimmed = src.trim();
  
  if (trimmed.length === 0 || trimmed.length > MAX_SRC_LENGTH) {
    return null;
  }
  
  // Only allow safe characters
  if (!/^[a-z0-9_\-./]+$/i.test(trimmed)) {
    return null;
  }
  
  return trimmed;
}

/**
 * Validate and sanitize session ID.
 * 
 * @param sessionId - Raw session ID
 * @returns Sanitized session ID or generated one
 */
function validateSessionId(sessionId: unknown): string {
  if (typeof sessionId !== 'string') {
    return generateId(16);
  }
  
  const trimmed = sessionId.trim();
  
  if (trimmed.length === 0 || trimmed.length > MAX_SESSION_ID_LENGTH) {
    return generateId(16);
  }
  
  // Only allow safe characters
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
    return generateId(16);
  }
  
  return trimmed;
}

// =============================================================================
// DATABASE
// =============================================================================

/**
 * Insert event into database (parameterized query)
 */
async function insertEvent(
  eventId: string,
  providerId: string,
  eventType: IndexRatingEventType,
  src: string | null,
  sessionId: string,
  countryCode: string | null,
  ip: string | null,
  userAgent: string | null
): Promise<void> {
  await db()`
    INSERT INTO provider_activity_events (
      click_id,
      provider_id,
      event_type,
      src,
      user_id,
      country_code,
      ip,
      user_agent,
      is_affiliate,
      destination,
      created_at
    ) VALUES (
      ${eventId},
      ${providerId},
      ${eventType},
      ${src},
      ${sessionId},
      ${countryCode},
      ${ip},
      ${userAgent},
      FALSE,
      NULL,
      NOW()
    )
  `;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // Parse request body
    // ─────────────────────────────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Validate required fields
    // ─────────────────────────────────────────────────────────────────────────────
    const rawBody = body as TrackEventRequest;

    const providerId = validateProviderId(rawBody.providerId);
    if (!providerId) {
      return NextResponse.json(
        { error: 'Invalid providerId' },
        { status: 400 }
      );
    }

    const eventType = validateEventType(rawBody.eventType);
    if (!eventType) {
      return NextResponse.json(
        { error: 'Invalid eventType' },
        { status: 400 }
      );
    }

    const src = validateSrc(rawBody.src);
    const sessionId = validateSessionId(rawBody.sessionId);

    // ─────────────────────────────────────────────────────────────────────────────
    // Rate limiting
    // ─────────────────────────────────────────────────────────────────────────────
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Check database configuration
    // ─────────────────────────────────────────────────────────────────────────────
    if (!hasDatabaseConfigured()) {
      // Graceful degradation - accept but don't persist
      console.warn('[Event Track] Database not configured, event not persisted');
      return NextResponse.json({ ok: true, persisted: false });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Extract request metadata
    // ─────────────────────────────────────────────────────────────────────────────
    const headersList = await headers();
    
    // Get country code from Vercel geo header
    const countryCode = headersList.get('x-vercel-ip-country') || null;
    
    // Get IP (for rate limiting analytics, not stored long-term)
    const forwardedFor = headersList.get('x-forwarded-for');
    const ip = forwardedFor 
      ? (forwardedFor.split(',')[0]?.trim() ?? null) 
      : null;
    
    // Get user agent (truncated for storage)
    const rawUserAgent = headersList.get('user-agent');
    const userAgent = rawUserAgent ? rawUserAgent.substring(0, 500) : null;

    // ─────────────────────────────────────────────────────────────────────────────
    // Insert event
    // ─────────────────────────────────────────────────────────────────────────────
    const eventId = `evt_${generateId(16)}`;
    
    await insertEvent(
      eventId,
      providerId,
      eventType,
      src,
      sessionId,
      countryCode,
      ip,
      userAgent
    );

    // Log success (no sensitive data)
    console.debug('[Event Track] Event recorded', {
      eventType,
      providerId,
      src,
    });

    return NextResponse.json({ 
      ok: true, 
      persisted: true,
      eventId,
    });

  } catch (error) {
    // Log error (no sensitive data)
    console.error('[Event Track] Error:', error instanceof Error ? error.message : 'Unknown');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// RUNTIME CONFIG
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
