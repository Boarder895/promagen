// frontend/src/app/api/promagen-users/cron/route.ts
//
// Nightly/periodic cron to precompute Promagen Users (by country) from provider activity events.
// This endpoint is triggered by Vercel Cron (vercel.json) and protected by PROMAGEN_CRON_SECRET.
//
// Pro posture:
// - Run every 30 minutes (not daily) so aggregates stay fresh and UI shows “last 30 minutes” recency.
// - Use an advisory lock so overlapping invocations do not double-write.
// - Keep structured logs and a stable JSON result for observability.
//
// Existing features preserved: Yes.

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, hasDatabaseConfigured, withTx } from '@/lib/db';
import { env, requireCronSecret } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;

function getRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

function timingMs(startedAt: number): number {
  return Date.now() - startedAt;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function requireAuth(req: NextRequest): void {
  const expected = requireCronSecret();

  const provided =
    req.headers.get('x-promagen-cron') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    '';

  if (!provided || !constantTimeEquals(provided, expected)) {
    throw new Error('Unauthorized');
  }
}

async function ensureSchema(): Promise<void> {
  // Minimal schema bootstrap. Non-destructive.
  await db()`create table if not exists promagen_users_country_usage_30d (
    country_code text not null primary key,
    users_count bigint not null default 0,
    updated_at timestamptz not null default now()
  )`;

  await db()`create table if not exists promagen_users_cron_runs (
    id text not null primary key,
    ran_at timestamptz not null default now(),
    ok boolean not null,
    message text null,
    rows_affected bigint not null default 0
  )`;
}

/**
 * Aggregate provider activity events -> users by country (last N days).
 *
 * Input table expected (created elsewhere):
 * - provider_activity_events(country_code text, user_id text, created_at timestamptz, ...)
 *
 * Output table:
 * - promagen_users_country_usage_30d(country_code, users_count, updated_at)
 */
async function runAggregation(opts: {
  windowDays: number;
  dryRun: boolean;
  requestId: string;
}): Promise<{
  ok: boolean;
  message: string;
  totalRows: number;
  skipped?: boolean;
  affected?: number;
}> {
  const { windowDays, dryRun, requestId } = opts;

  // Vercel cron may call multiple times; use advisory lock to avoid overlap.
  const lockKey = 42_4242; // stable project-specific key

  return withTx(async (tx) => {
    const lock = await tx`select pg_try_advisory_lock(${lockKey}) as locked`;
    const locked = Boolean(lock[0]?.locked);

    if (!locked) {
      return {
        ok: true,
        message: 'Skipped (lock held by another cron)',
        totalRows: 0,
        skipped: true,
      };
    }

    try {
      // Count raw events to sanity-check volume (helps observability).
      const raw = await tx`
        select count(*)::bigint as c
        from provider_activity_events
        where created_at >= now() - (${windowDays}::text || ' days')::interval
      `;
      const rawRows = Number(raw[0]?.c ?? 0);

      if (dryRun) {
        return {
          ok: true,
          message: `Dry run (raw_rows=${rawRows})`,
          totalRows: rawRows,
          affected: 0,
        };
      }

      // Aggregate distinct users by country_code in window.
      const result = await tx`
        with agg as (
          select
            coalesce(nullif(country_code, ''), 'ZZ') as country_code,
            count(distinct user_id)::bigint as users_count
          from provider_activity_events
          where created_at >= now() - (${windowDays}::text || ' days')::interval
          group by 1
        )
        insert into promagen_users_country_usage_30d (country_code, users_count, updated_at)
        select country_code, users_count, now()
        from agg
        on conflict (country_code)
        do update set users_count = excluded.users_count, updated_at = excluded.updated_at
        returning 1 as affected
      `;

      const affected = result.length;

      // Record run (best-effort; don’t explode the cron result if logging fails).
      const runId = requestId;

      await tx`
        insert into promagen_users_cron_runs (id, ran_at, ok, message, rows_affected)
        values (${runId}, now(), true, ${'ok'}, ${affected})
        on conflict (id) do nothing
      `;

      return {
        ok: true,
        message: 'Aggregated + upserted',
        totalRows: rawRows,
        affected,
      };
    } finally {
      // Always release advisory lock.
      await tx`select pg_advisory_unlock(${lockKey})`;
    }
  });
}

async function countAggRows(tx: ReturnType<typeof db>): Promise<number> {
  const rows = await tx`select count(*)::bigint as c from promagen_users_country_usage_30d`;
  return Number(rows[0]?.c ?? 0);
}

export async function GET(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);

  try {
    requireAuth(request);

    if (!hasDatabaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message: 'DATABASE_URL not configured; cron skipped',
          requestId,
          cadenceMinutes: 30,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
            'X-Promagen-Request-Id': requestId,
            'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
          },
        },
      );
    }

    await ensureSchema();

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === '1';

    // Default to authority doc definition (30d). Can be tuned for experiments via env.
    const windowDays = Number(url.searchParams.get('windowDays') ?? env.analytics.usersWindowDays);

    const result = await runAggregation({
      windowDays: Number.isFinite(windowDays) ? windowDays : env.analytics.usersWindowDays,
      dryRun,
      requestId,
    });

    const durationMs = timingMs(startedAt);

    // Pull row count after run (useful in dashboards / logs).
    const totalAggRows = await withTx(async (tx) => countAggRows(tx));

    const status = result.ok ? 200 : 500;

    console.debug(
      JSON.stringify({
        level: 'info',
        route: '/api/promagen-users/cron',
        requestId,
        event: 'run',
        ok: result.ok,
        message: result.message,
        dryRun,
        windowDays: Math.max(1, Math.min(365, Math.floor(windowDays))),
        totalAggRows,
        durationMs,
        safeMode: env.safeMode.enabled,
      }),
    );

    const payload: JsonObject = {
      ok: result.ok,
      message: result.message,
      totalRows: result.totalRows,
      windowDays: Math.max(1, Math.min(365, Math.floor(windowDays))),
      dryRun,
      skipped: Boolean(result.skipped),
      cadenceMinutes: 30,
      requestId,
      ranAt: new Date().toISOString(),
      durationMs,
    };

    return NextResponse.json(payload, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Promagen-Request-Id': requestId,
        'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = timingMs(startedAt);

    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/promagen-users/cron',
        requestId,
        event: 'error',
        message,
        durationMs,
      }),
    );

    const isAuthError = message === 'Unauthorized';
    const status = isAuthError ? 404 : 500;
    const clientMessage = isAuthError ? 'Not Found' : message;

    return NextResponse.json(
      {
        ok: false,
        message: clientMessage,
        requestId,
        cadenceMinutes: 30,
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Promagen-Request-Id': requestId,
          'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
        },
      },
    );
  }
}
