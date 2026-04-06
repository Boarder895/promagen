// frontend/src/app/api/admin/learning/migrate/route.ts
// ============================================================================
// ADMIN — Learning Pipeline Migration & Health Check
// ============================================================================
//
// POST /api/admin/learning/migrate — Run migrations (create tables if needed)
// GET  /api/admin/learning/migrate — Health check (table status + event counts)
//
// Protected by PROMAGEN_CRON_SECRET (same as other admin/cron endpoints).
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { hasDatabaseConfigured } from '@/lib/db';
import { env, requireCronSecret } from '@/lib/env';
import {
  ensureAllTables,
  checkLearningHealth,
} from '@/lib/learning/database';

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

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function requireAuth(req: NextRequest): void {
  const expected = requireCronSecret();
  const url = new URL(req.url);
  const authorization = req.headers.get('authorization') ?? '';
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length).trim()
    : '';

  const provided = (
    bearerSecret ||
    req.headers.get('x-promagen-cron') ||
    req.headers.get('x-cron-secret') ||
    req.headers.get('x-promagen-cron-secret') ||
    url.searchParams.get('secret') ||
    ''
  ).trim();

  if (!provided || !constantTimeEquals(provided, expected)) {
    throw new Error('Unauthorized');
  }
}

function commonHeaders(requestId: string): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Promagen-Request-Id': requestId,
    'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
  };
}

// ============================================================================
// POST — Run Migrations
// ============================================================================

/**
 * POST /api/admin/learning/migrate
 *
 * Creates all learning pipeline tables (idempotent).
 * Returns health check result after migration.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(req);

  try {
    requireAuth(req);

    if (!hasDatabaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message: 'DATABASE_URL not configured',
          requestId,
        },
        { status: 200, headers: commonHeaders(requestId) },
      );
    }

    await ensureAllTables();
    const health = await checkLearningHealth();

    const durationMs = Date.now() - startedAt;

    console.debug(
      JSON.stringify({
        level: 'info',
        route: '/api/admin/learning/migrate',
        requestId,
        event: 'migrated',
        tables: health.tables,
        durationMs,
      }),
    );

    return NextResponse.json(
      {
        ok: true,
        message: 'Migration complete',
        ...health,
        requestId,
        durationMs,
      },
      { status: 200, headers: commonHeaders(requestId) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    // Return 404 for auth errors (security: don't reveal endpoint exists)
    const isAuthError = message === 'Unauthorized';

    return NextResponse.json(
      { ok: false, message: isAuthError ? 'Not Found' : message, requestId },
      { status: isAuthError ? 404 : 500, headers: commonHeaders(requestId) },
    );
  }
}

// ============================================================================
// GET — Health Check
// ============================================================================

/**
 * GET /api/admin/learning/migrate
 *
 * Returns learning pipeline health without modifying anything.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const requestId = getRequestId(req);

  try {
    requireAuth(req);

    if (!hasDatabaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message: 'DATABASE_URL not configured',
          requestId,
        },
        { status: 200, headers: commonHeaders(requestId) },
      );
    }

    const health = await checkLearningHealth();

    return NextResponse.json(
      {
        ok: true,
        ...health,
        requestId,
      },
      { status: 200, headers: commonHeaders(requestId) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isAuthError = message === 'Unauthorized';

    return NextResponse.json(
      { ok: false, message: isAuthError ? 'Not Found' : message, requestId },
      { status: isAuthError ? 404 : 500, headers: commonHeaders(requestId) },
    );
  }
}
