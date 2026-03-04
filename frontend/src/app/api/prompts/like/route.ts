// src/app/api/prompts/like/route.ts
// ============================================================================
// LIKE API — POST (like) + DELETE (unlike)
// ============================================================================
// POST /api/prompts/like   — Add a like for a prompt
// DELETE /api/prompts/like — Remove a like for a prompt
//
// Session-based: uses promagen-session cookie for deduplication.
// Authenticated users get their Clerk userId stored for credibility weighting.
// Rate limited: 60 likes per session per hour.
//
// Authority: docs/authority/homepage.md §7.4
// Existing features preserved: Yes (additive route)
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@clerk/nextjs/server';

import { hasDatabaseConfigured } from '@/lib/db';
import { ensureLikeTables, insertLike, removeLike } from '@/lib/likes/database';
import { getSessionId, generateSessionId, setSessionCookie } from '@/lib/likes/session';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION
// ============================================================================

const LikeRequestSchema = z.object({
  promptId: z.string().min(1, 'promptId is required').max(200, 'promptId too long'),
});

// ============================================================================
// POST — Add a like
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limiting ──────────────────────────────────────────────────
    const sessionId = getSessionId(req);
    const rateLimitResult = rateLimit(req, {
      keyPrefix: 'like:post',
      max: 60,
      windowSeconds: 3600,
      keyParts: sessionId ? [sessionId] : undefined,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limited', retryAfter: rateLimitResult.retryAfterSeconds },
        { status: 429 },
      );
    }

    // ── Database check ─────────────────────────────────────────────────
    if (!hasDatabaseConfigured()) {
      // Safe mode: accept but don't persist (keeps UI happy)
      return NextResponse.json({
        success: true,
        likeCount: 0,
        alreadyLiked: false,
        _safeMode: true,
      });
    }

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const parsed = LikeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { promptId } = parsed.data;

    // ── Ensure tables exist ────────────────────────────────────────────
    await ensureLikeTables();

    // ── Session + auth ─────────────────────────────────────────────────
    let effectiveSessionId = sessionId;
    let isNewSession = false;
    if (!effectiveSessionId) {
      effectiveSessionId = generateSessionId();
      isNewSession = true;
    }

    // Clerk auth (nullable for anonymous users)
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.userId ?? null;
    } catch {
      // Auth unavailable — proceed as anonymous
    }

    // Derive country from timezone header (non-PII)
    const tz = req.headers.get('x-vercel-ip-timezone') ?? null;
    let countryCode: string | null = null;
    if (tz) {
      // Best-effort: extract country from IANA timezone
      // e.g., "America/New_York" → we don't know country, but the IP country header is better
      countryCode = req.headers.get('x-vercel-ip-country') ?? null;
    } else {
      countryCode = req.headers.get('x-vercel-ip-country') ?? null;
    }

    // ── Insert like ────────────────────────────────────────────────────
    const result = await insertLike(promptId, effectiveSessionId, userId, countryCode);

    // ── Build response with session cookie if new ──────────────────────
    const response = NextResponse.json(result);
    if (isNewSession) {
      setSessionCookie(response, effectiveSessionId);
    }
    return response;
  } catch (error) {
    console.error('[Like API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — Remove a like
// ============================================================================

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limiting ──────────────────────────────────────────────────
    const sessionId = getSessionId(req);
    const rateLimitResult = rateLimit(req, {
      keyPrefix: 'like:delete',
      max: 60,
      windowSeconds: 3600,
      keyParts: sessionId ? [sessionId] : undefined,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limited', retryAfter: rateLimitResult.retryAfterSeconds },
        { status: 429 },
      );
    }

    // ── Database check ─────────────────────────────────────────────────
    if (!hasDatabaseConfigured()) {
      return NextResponse.json({ success: true, likeCount: 0, alreadyLiked: false, _safeMode: true });
    }

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const parsed = LikeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { promptId } = parsed.data;

    if (!sessionId) {
      // No session = can't have liked anything
      return NextResponse.json({ success: true, likeCount: 0, alreadyLiked: false });
    }

    // ── Ensure tables exist ────────────────────────────────────────────
    await ensureLikeTables();

    // ── Remove like ────────────────────────────────────────────────────
    const result = await removeLike(promptId, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Like API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
