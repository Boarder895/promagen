// frontend/src/app/api/promagen-users/cron/route.ts
//
// Periodic cron to precompute Promagen Users (by provider + country) from provider activity events.
// This endpoint is triggered by Vercel Cron (vercel.json) and protected by PROMAGEN_CRON_SECRET.
//
// Authority: docs/authority/ribbon-homepage.md § Promagen Users
// Authority: docs/authority/ai_providers.md § Analytics-derived metrics
//
// Pro posture:
// - Run every 30 minutes so aggregates stay fresh.
// - Use an advisory lock so overlapping invocations do not double-write.
// - Keep structured logs and a stable JSON result for observability.
//
// Updated: January 22, 2026 - Fixed aggregation to be per-provider (GROUP BY provider_id, country_code)
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

/**
 * Constant-time string comparison to prevent timing attacks on secret validation.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Validate cron authentication.
 * Accepts secret via header or query param (for manual testing).
 */
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

/**
 * Ensure required database tables exist.
 * Non-destructive (CREATE IF NOT EXISTS).
 *
 * Tables:
 * - provider_activity_events: Raw click/activity events (already exists from /go route)
 * - provider_country_usage_30d: Per-provider aggregation (NEW - fixed schema)
 * - promagen_users_cron_runs: Cron run log for observability
 */
async function ensureSchema(): Promise<void> {
  const sql = db();

  // Ensure the raw events table exists (should already exist from /go route)
  // This is idempotent and won't modify existing table
  await sql`
    create table if not exists provider_activity_events (
      click_id text not null primary key,
      provider_id text not null,
      event_type text not null default 'open',
      src text,
      user_id text,
      country_code text,
      ip text,
      user_agent text,
      is_affiliate boolean default false,
      destination text,
      created_at timestamptz not null default now()
    )
  `;

  // Create index on provider_activity_events for efficient aggregation
  await sql`
    create index if not exists idx_provider_activity_events_aggregation
    on provider_activity_events (provider_id, country_code, created_at)
  `;

  // NEW: Per-provider aggregation table (fixed schema)
  // Primary key is (provider_id, country_code) so we get per-provider breakdown
  await sql`
    create table if not exists provider_country_usage_30d (
      provider_id text not null,
      country_code text not null,
      users_count bigint not null default 0,
      updated_at timestamptz not null default now(),
      primary key (provider_id, country_code)
    )
  `;

  // Create index for efficient lookups by provider
  await sql`
    create index if not exists idx_provider_country_usage_30d_provider
    on provider_country_usage_30d (provider_id)
  `;

  // Cron run log table (updated to track providers_affected)
  await sql`
    create table if not exists promagen_users_cron_runs (
      id text not null primary key,
      ran_at timestamptz not null default now(),
      ok boolean not null,
      message text null,
      rows_affected bigint not null default 0,
      providers_affected bigint not null default 0
    )
  `;

  // Add providers_affected column if it doesn't exist (migration for existing tables)
  await sql`
    alter table promagen_users_cron_runs
    add column if not exists providers_affected bigint not null default 0
  `;
}

/**
 * Aggregate provider activity events -> users by (provider_id, country_code) for last N days.
 *
 * FIXED: Now groups by both provider_id AND country_code (was missing provider_id).
 * This is required per spec: "Top up to 6 countries by Promagen usage for THAT PROVIDER"
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
  providersAffected?: number;
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
          providersAffected: 0,
        };
      }

      // FIXED: Aggregate distinct users by (provider_id, country_code) in window.
      // This gives per-provider breakdown required by the spec.
      const result = await tx`
        with agg as (
          select
            lower(trim(provider_id)) as provider_id,
            coalesce(nullif(upper(trim(country_code)), ''), 'ZZ') as country_code,
            count(distinct coalesce(user_id, click_id))::bigint as users_count
          from provider_activity_events
          where created_at >= now() - (${windowDays}::text || ' days')::interval
            and provider_id is not null
            and trim(provider_id) <> ''
          group by 1, 2
        )
        insert into provider_country_usage_30d (provider_id, country_code, users_count, updated_at)
        select provider_id, country_code, users_count, now()
        from agg
        on conflict (provider_id, country_code)
        do update set users_count = excluded.users_count, updated_at = excluded.updated_at
        returning provider_id
      `;

      const affected = result.length;

      // Count distinct providers affected
      const distinctProviders = new Set(result.map((r) => r.provider_id));
      const providersAffected = distinctProviders.size;

      // Record run for observability
      await tx`
        insert into promagen_users_cron_runs (id, ran_at, ok, message, rows_affected, providers_affected)
        values (${requestId}, now(), true, ${'ok'}, ${affected}, ${providersAffected})
        on conflict (id) do nothing
      `;

      return {
        ok: true,
        message: 'Aggregated + upserted (per-provider)',
        totalRows: rawRows,
        affected,
        providersAffected,
      };
    } finally {
      // Always release advisory lock.
      await tx`select pg_advisory_unlock(${lockKey})`;
    }
  });
}

async function countAggRows(): Promise<{ rows: number; providers: number }> {
  const sql = db();
  const result = await sql`
    select
      count(*)::bigint as rows,
      count(distinct provider_id)::bigint as providers
    from provider_country_usage_30d
  `;
  return {
    rows: Number(result[0]?.rows ?? 0),
    providers: Number(result[0]?.providers ?? 0),
  };
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
    const aggCounts = await countAggRows();

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
        totalAggRows: aggCounts.rows,
        totalProviders: aggCounts.providers,
        affected: result.affected,
        providersAffected: result.providersAffected,
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
      affected: result.affected ?? 0,
      providersAffected: result.providersAffected ?? 0,
      totalAggRows: aggCounts.rows,
      totalProviders: aggCounts.providers,
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

    // Return 404 for auth errors (security: don't reveal endpoint exists)
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
