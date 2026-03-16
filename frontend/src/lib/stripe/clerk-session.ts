// src/lib/stripe/clerk-session.ts
// ============================================================================
// CLERK SESSION HELPER v2.0.0
// ============================================================================
// Extracts userId and claims from Clerk's __session cookie JWT.
//
// WHY: Both auth() and clerkClient().users.getUser() fail in route handlers
// on Vercel production. The session cookies ARE present and valid (verified
// by clerkMiddleware). This helper decodes the JWT directly.
//
// Authority: docs/authority/stripe.md
// ============================================================================

import type { NextRequest } from 'next/server';

export interface SessionData {
  userId: string;
  email?: string;
  tier?: 'free' | 'paid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/**
 * Extract session data from Clerk's session JWT cookie.
 */
export function getSessionFromCookie(request: NextRequest): SessionData | null {
  const cookies = request.cookies.getAll();
  const sessionCookies = cookies.filter((c) => c.name.startsWith('__session'));

  for (const cookie of sessionCookies) {
    const data = decodeSessionJwt(cookie.value);
    if (data) return data;
  }

  return null;
}

/**
 * Simple userId extraction (backward compat).
 */
export function getUserIdFromSession(request: NextRequest): string | null {
  return getSessionFromCookie(request)?.userId ?? null;
}

/**
 * Decode a Clerk session JWT and extract relevant claims.
 */
function decodeSessionJwt(jwt: string): SessionData | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1];
    if (!payloadB64) return null;

    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as Record<string, unknown>;

    const sub = payload.sub;
    if (typeof sub !== 'string' || sub.length === 0) return null;

    // Extract public metadata if present in the JWT
    const metadata = payload.publicMetadata as Record<string, unknown> | undefined;

    return {
      userId: sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      tier: metadata?.tier === 'paid' ? 'paid' : 'free',
      stripeCustomerId: typeof metadata?.stripeCustomerId === 'string'
        ? metadata.stripeCustomerId : undefined,
      stripeSubscriptionId: typeof metadata?.stripeSubscriptionId === 'string'
        ? metadata.stripeSubscriptionId : undefined,
    };
  } catch {
    return null;
  }
}
