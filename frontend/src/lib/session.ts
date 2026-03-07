// src/lib/session.ts
// ============================================================================
// SESSION MANAGEMENT — Cookie-based anonymous session tracking
// ============================================================================
//
// Provides anonymous session identification via httpOnly cookies.
// Used by heartbeat API for online user tracking.
// GDPR-safe: no user IDs, no PII — just a random UUID per browser session.
//
// Extracted from the retired likes/session.ts (7 March 2026).
//
// Existing features preserved: Yes.
// ============================================================================

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const COOKIE_NAME = 'promagen-session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Read session ID from the request cookie.
 * Returns null if no session cookie exists.
 */
export function getSessionId(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  return cookie?.value ?? null;
}

/**
 * Generate a new random session ID.
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Set the session cookie on a response.
 */
export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}
