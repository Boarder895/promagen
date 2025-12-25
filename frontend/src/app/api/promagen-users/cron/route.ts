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
import type { SqlClient } from '@/lib/db';
import { env, requireCronSecret } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pro: give the job room (schema checks + aggregation can take time on first run).
export const maxDuration = 300;

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

async function acquireLock(tx: SqlClient): Promise<boolean> {
  // Transaction-level lock: released automatically at tx end.
  // Use a stable integer; changing this will allow parallel runs.
  const LOCK_ID = 914_227_113;
  const rows = await tx<{ locked: boolean }[]>`
    select pg_try_advisory_xact_lock(${LOCK_ID}) as locked
  `;
  return rows[0]?.locked === true;
}

async function runAggregation(opts: {
  windowDays: number;
  dryRun: boolean;
  requestId: string;
}): Promise<{ ok: boolean; message: string; totalRows: number; skipped?: boolean }> {
  const { windowDays, dryRun, requestId } = opts;

  const WINDOW_DAYS = Math.max(1, Math.min(365, Math.floor(windowDays)));

  const countAggRows = async (sql: SqlClient): Promise<number> => {
    const rows = await sql<{ c: number }[]>`
      with agg as (
        select
          coalesce(nullif(country_code, ''), 'XX') as country_code,
          count(distinct session_id) as users_count
        from provider_activity_events
        where created_at >= now() - (${WINDOW_DAYS}::int || ' days')::interval
          and session_id is not null
        group by 1
      )
      select count(*)::int as c from agg
    `;
    return rows[0]?.c ?? 0;
  };

  if (dryRun) {
    const totalRows = await countAggRows(db());
    return { ok: true, message: 'Dry run (no writes)', totalRows };
  }

  return withTx(async (tx) => {
    const locked = await acquireLock(tx);
    if (!locked) {
      return { ok: true, message: 'Skipped (lock busy)', totalRows: 0, skipped: true };
    }

    // Compute and upsert in one shot.
    const result = await tx<{ affected: number }[]>`
      with agg as (
        select
          coalesce(nullif(country_code, ''), 'XX') as country_code,
          count(distinct session_id) as users_count
        from provider_activity_events
        where created_at >= now() - (${WINDOW_DAYS}::int || ' days')::interval
          and session_id is not null
        group by 1
      ), upserted as (
        insert into promagen_users_country_usage_30d (country_code, users_count, updated_at)
        select country_code, users_count, now()
        from agg
        on conflict (country_code) do update
          set users_count = excluded.users_count,
              updated_at = excluded.updated_at
        returning 1
      ), pruned as (
        delete from promagen_users_country_usage_30d
        where country_code not in (select country_code from agg)
        returning 1
      )
      select (select count(*)::int from upserted) + (select count(*)::int from pruned) as affected
    `;

    const totalAggRows = await countAggRows(tx);

    // Record run (best-effort; don’t explode the cron result if logging fails).
    const runId = requestId;
    const affected = result[0]?.affected ?? 0;

    await tx`
      insert into promagen_users_cron_runs (id, ran_at, ok, message, rows_affected)
      values (${runId}, now(), true, ${'ok'}, ${affected})
      on conflict (id) do nothing
    `;

    return {
      ok: true,
      message: 'Aggregated + upserted',
      totalRows: totalAggRows,
    };
  });
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
          headers: { 'Cache-Control': 'no-store', 'X-Promagen-Request-Id': requestId },
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

    console.debug(
      JSON.stringify({
        level: 'info',
        route: '/api/promagen-users/cron',
        requestId,
        event: 'run',
        ok: result.ok,
        message: result.message,
        windowDays: Math.max(1, Math.min(365, Math.floor(windowDays))),
        dryRun,
        skipped: Boolean(result.skipped),
        totalRows: result.totalRows,
        durationMs,
      }),
    );

    const status = result.ok ? 200 : 500;

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
        'X-Promagen-Request-Id': requestId,
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

    const status = message === 'Unauthorized' ? 401 : 500;

    return NextResponse.json(
      {
        ok: false,
        message,
        requestId,
        cadenceMinutes: 30,
      },
      {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Promagen-Request-Id': requestId },
      },
    );
  }
}
