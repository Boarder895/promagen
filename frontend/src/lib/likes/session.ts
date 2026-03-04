// src/lib/likes/session.ts
// ============================================================================
// LIKE SESSION — Cookie-based anonymous session management
// ============================================================================
// Generates and reads a random session ID from the `promagen-session` cookie.
// Used for like deduplication without requiring sign-in.
//
// Cookie config: httpOnly, sameSite=strict, maxAge=30 days, secure in prod.
//
// Authority: docs/authority/homepage.md §7.5
// Existing features preserved: Yes (additive module)
// ============================================================================

import 'server-only';

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

const COOKIE_NAME = 'promagen-session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Read the session ID from the request cookie.
 * Returns null if no session cookie exists.
 */
export function getSessionId(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Generate a new random session ID.
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Set the session cookie on a response.
 * Called when no existing session was found.
 */
export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

/**
 * Get or create session ID. If a new one is created, the cookie is set on the response.
 * Returns the session ID and whether it's newly created.
 */
export function ensureSession(
  req: NextRequest,
  response: NextResponse,
): { sessionId: string; isNew: boolean } {
  const existing = getSessionId(req);
  if (existing) {
    return { sessionId: existing, isNew: false };
  }

  const sessionId = generateSessionId();
  setSessionCookie(response, sessionId);
  return { sessionId, isNew: true };
}
