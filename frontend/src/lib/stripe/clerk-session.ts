// src/lib/stripe/clerk-session.ts
// ============================================================================
// CLERK SESSION HELPER v1.0.0
// ============================================================================
// Extracts userId from Clerk's __session cookie JWT.
//
// WHY: Clerk's auth() returns null in Next.js App Router route handlers on
// Vercel production. The session cookies ARE present and valid (verified by
// clerkMiddleware), but auth() doesn't read them in route handlers.
//
// This helper decodes the JWT from the cookie to get the userId (sub claim).
// The JWT was already signature-verified by clerkMiddleware. We then confirm
// the user exists via clerkClient.users.getUser() in the route handler.
//
// Authority: docs/authority/stripe.md
// ============================================================================

import type { NextRequest } from 'next/server';

/**
 * Extract userId from Clerk's session JWT cookie.
 * Tries all __session* cookies (Clerk may use a suffixed name).
 */
export function getUserIdFromSession(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();
  const sessionCookies = cookies.filter((c) => c.name.startsWith('__session'));

  for (const cookie of sessionCookies) {
    const userId = decodeJwtSubject(cookie.value);
    if (userId) return userId;
  }

  return null;
}

/**
 * Decode a JWT payload and extract the 'sub' claim.
 * Does NOT verify signature — clerkMiddleware already did that.
 */
function decodeJwtSubject(jwt: string): string | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1];
    if (!payloadB64) return null;

    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as Record<string, unknown>;

    const sub = payload.sub;
    if (typeof sub === 'string' && sub.length > 0) return sub;

    return null;
  } catch {
    return null;
  }
}
