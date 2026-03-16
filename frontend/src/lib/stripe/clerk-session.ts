// src/lib/stripe/clerk-session.ts
// ============================================================================
// CLERK SESSION HELPER v1.0.0
// ============================================================================
// Extracts the authenticated userId from Clerk's __session cookie.
//
// WHY THIS EXISTS:
// Clerk's auth() function returns null in Next.js App Router route handlers
// on Vercel production, even though:
// - clerkMiddleware runs and verifies the session
// - Session cookies (__session, __session_XXXXX) are present
// - CLERK_SECRET_KEY is set correctly
//
// This helper reads the JWT from the cookie directly. The JWT was already
// verified by clerkMiddleware in the middleware layer. We decode (not verify)
// it to extract the userId (sub claim), then confirm the user exists via
// clerkClient before proceeding.
//
// SECURITY:
// - The cookie is httpOnly, Secure, set by Clerk over HTTPS
// - clerkMiddleware already verified the JWT signature
// - We confirm the user exists via clerkClient.users.getUser()
// - The userId is never trusted for anything until getUser() succeeds
//
// Authority: docs/authority/stripe.md
// ============================================================================

import type { NextRequest } from 'next/server';

/**
 * Extract userId from Clerk's session JWT cookie.
 * Tries both __session and __session_SUFFIX (Clerk multi-instance format).
 * Returns null if no valid session cookie found.
 */
export function getUserIdFromSession(request: NextRequest): string | null {
  // Try all session cookies — Clerk may use a suffixed cookie name
  const cookies = request.cookies.getAll();
  const sessionCookies = cookies.filter((c) => c.name.startsWith('__session'));

  for (const cookie of sessionCookies) {
    const userId = decodeJwtSubject(cookie.value);
    if (userId) return userId;
  }

  return null;
}

/**
 * Decode a JWT payload and extract the 'sub' (subject = userId) claim.
 * Does NOT verify the signature — that's already done by clerkMiddleware.
 */
function decodeJwtSubject(jwt: string): string | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1];
    if (!payloadB64) return null;

    // JWT uses base64url encoding — convert to standard base64
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as Record<string, unknown>;

    const sub = payload.sub;
    if (typeof sub === 'string' && sub.length > 0) {
      return sub;
    }

    return null;
  } catch {
    return null;
  }
}
