// frontend/src/app/api/feedback/route.ts
// ============================================================================
// FEEDBACK SUBMISSION ENDPOINT — User Feedback Invitation (Phase 7.10b)
// ============================================================================
//
// POST /api/feedback
//
// Receives user feedback (👍👌👎) from the frontend feedback widget.
// Links to existing prompt_events via promptEventId. Validates with Zod,
// rate-limits, and performs a dual write:
//   1. INSERT into feedback_events (idempotent via ON CONFLICT)
//   2. UPDATE prompt_events SET feedback_rating, feedback_credibility
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10
//
// Security posture:
// - Zod validation at boundary (no unvalidated data reaches DB)
// - In-memory rate limiting (5/min prod, generous in dev)
// - GDPR safe: no user IDs, no IPs stored in DB
// - Safe mode: accept but don't persist (keeps frontend happy during incidents)
// - Idempotent: one feedback per prompt event, first one wins
//
// Version: 1.0.0 — Phase 7.10b Feedback Submission Endpoint
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasDatabaseConfigured } from '@/lib/db';
import { env } from '@/lib/env';
import { ensureAllTables, insertFeedbackEvent } from '@/lib/learning/database';
import { rateLimit } from '@/lib/rate-limit';
import { FEEDBACK_RATINGS } from '@/types/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// ZOD SCHEMA
// ============================================================================

/**
 * Feedback submission request body schema.
 *
 * Validated at the API boundary — only clean data reaches the database.
 * The credibility score is re-validated server-side (must be in range).
 */
const FeedbackSubmissionSchema = z.object({
  /** Links back to the prompt_events row this feedback is about */
  promptEventId: z
    .string()
    .min(1, 'promptEventId is required')
    .max(128, 'promptEventId too long'),

  /** User's rating: 'positive' | 'neutral' | 'negative' */
  rating: z.enum(FEEDBACK_RATINGS as unknown as [string, ...string[]]),

  /** Client-computed credibility score — server validates range */
  credibilityScore: z
    .number()
    .min(0, 'credibilityScore must be >= 0')
    .max(2, 'credibilityScore must be <= 2'),

  /** Per-factor breakdown for admin drill-down */
  credibilityFactors: z.object({
    tier: z.number(),
    age: z.number(),
    frequency: z.number(),
    speed: z.number(),
  }),

  /** Milliseconds between copy action and feedback submission */
  responseTimeMs: z
    .number()
    .int()
    .min(0, 'responseTimeMs must be >= 0')
    .max(7 * 24 * 60 * 60 * 1_000, 'responseTimeMs must be <= 7 days'),

  /** Platform the prompt was built for (e.g. 'midjourney') */
  platform: z
    .string()
    .min(1, 'platform is required')
    .max(64, 'platform too long'),

  /** Platform tier (1–4) */
  tier: z.number().int().min(1).max(4),

  /** User tier at time of feedback ('free' | 'paid' | null for anon) */
  userTier: z.string().nullable().optional(),

  /** Account age in days at time of feedback */
  accountAgeDays: z.number().int().min(0).nullable().optional(),
});

type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;

// ============================================================================
// HELPERS
// ============================================================================

function getRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

function generateFeedbackId(): string {
  return `fb_${crypto.randomUUID()}`;
}

function safeModeHeaderValue(): '0' | '1' {
  return env.safeMode.enabled ? '1' : '0';
}

function buildHeaders(
  requestId: string,
  rate?: ReturnType<typeof rateLimit>,
): Headers {
  const h = new Headers();
  h.set('Cache-Control', 'no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('X-Promagen-Request-Id', requestId);
  h.set('X-Promagen-Safe-Mode', safeModeHeaderValue());

  if (rate) {
    h.set('X-RateLimit-Limit', String(rate.limit));
    h.set('X-RateLimit-Remaining', String(rate.remaining));
    h.set('X-RateLimit-Reset', rate.resetAt);
    if (!rate.allowed) h.set('Retry-After', String(rate.retryAfterSeconds));
  }

  return h;
}

// ============================================================================
// SCHEMA CACHE
// ============================================================================

/**
 * Schema flag — only run ensureAllTables once per cold start.
 * Avoids hitting Postgres with CREATE IF NOT EXISTS on every request.
 */
let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await ensureAllTables();
  schemaEnsured = true;
}

// ============================================================================
// POST HANDLER
// ============================================================================

/**
 * POST /api/feedback
 *
 * Accepts a feedback submission, validates, rate-limits, and dual-writes:
 *   1. INSERT into feedback_events (idempotent via ON CONFLICT)
 *   2. UPDATE prompt_events SET feedback_rating, feedback_credibility
 *
 * Returns { ok: true, id: string } on success.
 * Returns { ok: true, duplicate: true } if already rated (idempotent).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(req);

  // ── Rate limiting: 5/min prod, generous in dev ──
  const rate = rateLimit(req, {
    keyPrefix: 'feedback',
    max: env.isProd ? 5 : 1_000,
    windowSeconds: 60,
    keyParts: ['POST'],
  });

  const headers = buildHeaders(requestId, rate);

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Rate limited', requestId },
      { status: 429, headers },
    );
  }

  // ── Parse JSON body ──
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON', requestId },
      { status: 400, headers },
    );
  }

  // ── Validate with Zod ──
  const parsed = FeedbackSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    console.debug(
      JSON.stringify({
        level: 'warn',
        route: '/api/feedback',
        requestId,
        event: 'validation_error',
        issues: parsed.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      }),
    );

    return NextResponse.json(
      { ok: false, error: 'Validation failed', requestId },
      { status: 400, headers },
    );
  }

  const data: FeedbackSubmission = parsed.data;

  // ── Safe mode: accept but don't persist ──
  if (env.safeMode.enabled) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'safe_mode', requestId },
      { status: 200, headers },
    );
  }

  // ── Check database availability ──
  if (!hasDatabaseConfigured()) {
    console.debug(
      JSON.stringify({
        level: 'warn',
        route: '/api/feedback',
        requestId,
        event: 'no_database',
        message: 'DATABASE_URL not configured; feedback dropped silently',
      }),
    );

    return NextResponse.json(
      { ok: true, skipped: true, reason: 'no_database', requestId },
      { status: 200, headers },
    );
  }

  // ── Dual write: feedback_events + prompt_events ──
  try {
    await ensureSchema();

    const feedbackId = generateFeedbackId();

    const inserted = await insertFeedbackEvent({
      id: feedbackId,
      promptEventId: data.promptEventId,
      rating: data.rating as 'positive' | 'neutral' | 'negative',
      credibilityScore: data.credibilityScore,
      credibilityFactors: data.credibilityFactors,
      responseTimeMs: data.responseTimeMs,
      userTier: data.userTier ?? null,
      accountAgeDays: data.accountAgeDays ?? null,
      platform: data.platform,
      tier: data.tier,
    });

    const durationMs = Date.now() - startedAt;

    if (!inserted) {
      // Duplicate — already rated this prompt event. This is fine (idempotent).
      console.debug(
        JSON.stringify({
          level: 'info',
          route: '/api/feedback',
          requestId,
          event: 'duplicate',
          promptEventId: data.promptEventId,
          durationMs,
        }),
      );

      return NextResponse.json(
        { ok: true, duplicate: true, requestId },
        { status: 200, headers },
      );
    }

    console.debug(
      JSON.stringify({
        level: 'info',
        route: '/api/feedback',
        requestId,
        event: 'inserted',
        feedbackId,
        rating: data.rating,
        credibility: data.credibilityScore,
        platform: data.platform,
        tier: data.tier,
        responseTimeMs: data.responseTimeMs,
        durationMs,
      }),
    );

    return NextResponse.json(
      { ok: true, id: feedbackId, requestId },
      { status: 201, headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = Date.now() - startedAt;

    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/feedback',
        requestId,
        event: 'insert_error',
        message,
        durationMs,
      }),
    );

    // Return 503 so the frontend knows to stop retrying for this instance.
    return NextResponse.json(
      { ok: false, error: 'Storage unavailable', requestId },
      { status: 503, headers },
    );
  }
}
