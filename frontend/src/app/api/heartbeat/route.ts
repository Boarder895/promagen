// src/app/api/heartbeat/route.ts
// ============================================================================
// HEARTBEAT API — Client presence signal
// ============================================================================
// POST /api/heartbeat
//
// Receives a heartbeat from a browser session every 60 seconds.
// Stores session → countryCode in Vercel KV with 120s TTL.
// Stale heartbeats auto-expire (no manual pruning needed).
//
// Body: { countryCode: "GB" }
// countryCode is derived client-side from Intl timezone (not PII).
//
// Rate limit: 2 per minute per session (heartbeat fires every 60s).
// If KV is unavailable, returns success silently (component stays hidden).
//
// Authority: docs/authority/homepage.md §8.4
// Existing features preserved: Yes (additive route only)
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasKvConfigured, setHeartbeat } from '@/lib/kv/heartbeat-store';
import { getSessionId, generateSessionId, setSessionCookie } from '@/lib/likes/session';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION
// ============================================================================

const HeartbeatSchema = z.object({
  countryCode: z
    .string()
    .min(2, 'countryCode must be at least 2 characters')
    .max(3, 'countryCode must be at most 3 characters')
    .regex(/^[A-Z]{2,3}$/, 'countryCode must be uppercase ISO alpha-2/3'),
});

// ============================================================================
// POST — Record heartbeat
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limiting (2/min per session) ────────────────────────────────
    const sessionId = getSessionId(req);
    const rateLimitResult = rateLimit(req, {
      keyPrefix: 'heartbeat',
      max: 2,
      windowSeconds: 60,
      keyParts: sessionId ? [sessionId] : undefined,
    });
    if (!rateLimitResult.allowed) {
      // Silent accept (don't break client polling loop)
      return NextResponse.json({ success: true, _rateLimited: true });
    }

    // ── KV check ────────────────────────────────────────────────────────
    if (!hasKvConfigured()) {
      // No KV = no heartbeat storage = online users component hidden
      return NextResponse.json({ success: true, _kvUnavailable: true });
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const parsed = HeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      // Accept anyway with fallback country (don't break client)
      const fallbackCC = req.headers.get('x-vercel-ip-country') ?? 'XX';
      const effectiveSession = sessionId ?? generateSessionId();
      await setHeartbeat(effectiveSession, fallbackCC);

      const response = NextResponse.json({ success: true });
      if (!sessionId) setSessionCookie(response, effectiveSession);
      return response;
    }

    const { countryCode } = parsed.data;

    // ── Session management ──────────────────────────────────────────────
    let effectiveSessionId = sessionId;
    let isNewSession = false;
    if (!effectiveSessionId) {
      effectiveSessionId = generateSessionId();
      isNewSession = true;
    }

    // ── Store heartbeat ─────────────────────────────────────────────────
    await setHeartbeat(effectiveSessionId, countryCode);

    // ── Response ────────────────────────────────────────────────────────
    const response = NextResponse.json({ success: true });
    if (isNewSession) {
      setSessionCookie(response, effectiveSessionId);
    }
    return response;
  } catch (error) {
    console.error('[heartbeat] Error:', error);
    // Always return success to not break client polling
    return NextResponse.json({ success: true });
  }
}
