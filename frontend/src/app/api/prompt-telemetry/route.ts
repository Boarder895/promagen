// frontend/src/app/api/prompt-telemetry/route.ts
// ============================================================================
// PROMPT TELEMETRY ENDPOINT — Collective Intelligence Engine (Phase 5)
// ============================================================================
//
// POST /api/prompt-telemetry
//
// Receives anonymous prompt events from the frontend prompt builder.
// Only high-quality prompts pass the quality gates (score >= 90, 4+ categories).
// Events are stored in Neon Postgres for nightly aggregation by the learning cron.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.1 + § 9.4
//
// Security posture:
// - Zod validation at boundary (no unvalidated data reaches DB)
// - In-memory rate limiting (10/min prod, generous in dev)
// - GDPR safe: no user IDs, no IPs stored in DB
// - Safe mode: accept but don't persist (keeps frontend happy during incidents)
// - IP used only for rate limiting key, never written to prompt_events
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, hasDatabaseConfigured } from '@/lib/db';
import { env } from '@/lib/env';
import { ensureAllTables } from '@/lib/learning/database';
import { rateLimit } from '@/lib/rate-limit';
import { PromptTelemetryEventSchema } from '@/types/prompt-telemetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// HELPERS
// ============================================================================

function getRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

function generateEventId(): string {
  return `evt_${crypto.randomUUID()}`;
}

function safeModeHeaderValue(): '0' | '1' {
  return env.safeMode.enabled ? '1' : '0';
}

function buildHeaders(requestId: string, rate?: ReturnType<typeof rateLimit>): Headers {
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
 * POST /api/prompt-telemetry
 *
 * Accepts a PromptTelemetryEvent, validates, rate-limits, and inserts into Postgres.
 * Returns { ok: true, id: string } on success.
 *
 * Quality gates (enforced by Zod schema):
 * - score >= 90
 * - categoryCount >= 4
 */
export async function POST(req: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(req);

  // ── Rate limiting ──
  const rate = rateLimit(req, {
    keyPrefix: 'prompt_telemetry',
    max: env.isProd ? 10 : 1_000,
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
  const parsed = PromptTelemetryEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.debug(
      JSON.stringify({
        level: 'warn',
        route: '/api/prompt-telemetry',
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

  const data = parsed.data;

  // ── Safe mode: accept but don't persist ──
  if (env.safeMode.enabled) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'safe_mode', requestId },
      { status: 200, headers },
    );
  }

  // ── Check database availability ──
  if (!hasDatabaseConfigured()) {
    // Graceful degradation: frontend doesn't need to know DB is missing.
    // Log for observability, return success so the UI doesn't retry.
    console.debug(
      JSON.stringify({
        level: 'warn',
        route: '/api/prompt-telemetry',
        requestId,
        event: 'no_database',
        message: 'DATABASE_URL not configured; event dropped silently',
      }),
    );

    return NextResponse.json(
      { ok: true, skipped: true, reason: 'no_database', requestId },
      { status: 200, headers },
    );
  }

  // ── Insert into Postgres ──
  try {
    await ensureSchema();

    const eventId = generateEventId();
    const sql = db();

    await sql`
      INSERT INTO prompt_events (
        id, session_id, attempt_number, selections, category_count,
        char_length, score, score_factors, platform, tier,
        scene_used, outcome
      ) VALUES (
        ${eventId},
        ${data.sessionId},
        ${data.attemptNumber},
        ${JSON.stringify(data.selections)},
        ${data.categoryCount},
        ${data.charLength},
        ${data.score},
        ${JSON.stringify(data.scoreFactors)},
        ${data.platform},
        ${data.tier},
        ${data.sceneUsed},
        ${JSON.stringify(data.outcome)}
      )
    `;

    const durationMs = Date.now() - startedAt;

    console.debug(
      JSON.stringify({
        level: 'info',
        route: '/api/prompt-telemetry',
        requestId,
        event: 'inserted',
        eventId,
        platform: data.platform,
        tier: data.tier,
        score: data.score,
        categoryCount: data.categoryCount,
        sceneUsed: data.sceneUsed ?? 'none',
        durationMs,
      }),
    );

    return NextResponse.json({ ok: true, id: eventId, requestId }, { status: 201, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = Date.now() - startedAt;

    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/prompt-telemetry',
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
