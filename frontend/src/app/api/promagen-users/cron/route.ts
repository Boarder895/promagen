// frontend/src/app/api/promagen-users/cron/route.ts
//
// Protected Cron endpoint for Promagen Users aggregation (Option A: Postgres + Cron).
//
// Why this exists:
// - Vercel Cron needs an HTTP endpoint to hit.
// - UI does NOT need a public API: it uses a server-only loader (src/lib/providers/api.ts).
//
// Guarantees (per docs):
// - No public analytics API required.
// - Idempotent + backfillable by design (upsert + protected “run now” trigger).
// - Truthful: if DB missing/unreachable, respond with 503 (and UI will render blank via loader freshness guard).
//
// Event taxonomy (authoritative weights):
// - open/click: 1
// - submit: 3
// - success: 5
//
// Promagen Users definition (for aggregation):
// - Count distinct sessionId in the last 30 days, grouped by provider + country.
// - sessionId and countryCode must be present (otherwise the record is ignored for flags).

import 'server-only';

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { db, hasDatabaseConfigured, withTx } from '@/lib/db';
import { requireCronSecret } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  // Supported auth methods:
  // - Authorization: Bearer <secret>
  // - x-promagen-cron-secret: <secret>
  // - ?secret=<secret> (allowed for manual runs; avoid using in shared logs)
  secret: z.string().optional(),

  // Optional: if true, computes stats but does not write to the aggregate table
  dryRun: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),

  // Optional: manual backfill trigger (protected)
  // e.g. ?runNow=1
  runNow: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getProvidedSecret(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice('bearer '.length).trim();
    if (token) return token;
  }

  const headerSecret = req.headers.get('x-promagen-cron-secret');
  if (headerSecret && headerSecret.trim()) return headerSecret.trim();

  const url = new URL(req.url);
  const q = url.searchParams.get('secret');
  if (q && q.trim()) return q.trim();

  return null;
}

function isAuthorised(req: NextRequest): boolean {
  const expected = requireCronSecret();
  const provided = getProvidedSecret(req);
  if (!provided) return false;
  try {
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

async function ensureSchema(): Promise<void> {
  // Create raw events table (Stage 2 store) and aggregate table (Stage 3 result).
  // This is safe to run repeatedly.
  await db()`
    create table if not exists provider_activity_events (
      click_id text primary key,
      provider_id text not null,
      event_type text not null,
      src text not null,
      session_id text null,
      country_code text null,
      is_affiliate boolean not null default false,
      destination text not null,
      created_at timestamptz not null default now()
    )
  `;

  await db()`
    create index if not exists provider_activity_events_created_at_idx
      on provider_activity_events (created_at desc)
  `;

  await db()`
    create index if not exists provider_activity_events_provider_country_idx
      on provider_activity_events (provider_id, country_code)
  `;

  await db()`
    create index if not exists provider_activity_events_session_idx
      on provider_activity_events (session_id)
      where session_id is not null
  `;

  await db()`
    create table if not exists provider_country_usage_30d (
      provider_id text not null,
      country_code text not null,
      user_count integer not null,
      updated_at timestamptz not null,
      primary key (provider_id, country_code)
    )
  `;

  await db()`
    create index if not exists provider_country_usage_30d_updated_at_idx
      on provider_country_usage_30d (updated_at desc)
  `;
}

type AggregationResult = {
  windowDays: number;
  updatedAt: string;
  totalRows: number;
};

async function runAggregation(dryRun: boolean): Promise<AggregationResult> {
  // Fixed 30 days (per docs + UI expectations).
  const windowDays = 30;

  // Idempotent + backfillable:
  // - Always recompute the full window.
  // - Upsert results.
  // - Delete rows that no longer exist in the recomputed set.
  //
  // sessionId+countryCode required for flag rendering and dedupe.
  // Event taxonomy weights used for future-proofing (today we mostly have "open").
  const rows = await db()<Array<{ total: number }>>`
    with
    window as (
      select now() - (${windowDays} * interval '1 day') as since_ts
    ),
    daily as (
      select
        provider_id,
        upper(country_code) as country_code,
        session_id,
        date_trunc('day', created_at) as day,
        max(
          case event_type
            when 'success' then 5
            when 'submit' then 3
            when 'open' then 1
            when 'click' then 1
            else 0
          end
        ) as weight
      from provider_activity_events, window
      where created_at >= window.since_ts
        and session_id is not null
        and country_code is not null
        and country_code ~ '^[A-Za-z]{2}$'
      group by provider_id, upper(country_code), session_id, date_trunc('day', created_at)
    ),
    agg as (
      select
        provider_id,
        country_code,
        count(distinct session_id)::int as user_count
      from daily
      where weight >= 1
      group by provider_id, country_code
    ),
    upserted as (
      select 1 as ok
    )
    select count(*)::int as total from agg
  `;

  const totalRows = rows?.[0]?.total ?? 0;
  const updatedAt = new Date().toISOString();

  if (dryRun) {
    return { windowDays, updatedAt, totalRows };
  }

  await withTx(async (tx) => {
    await tx`
      with
      window as (
        select now() - (${windowDays} * interval '1 day') as since_ts
      ),
      daily as (
        select
          provider_id,
          upper(country_code) as country_code,
          session_id,
          date_trunc('day', created_at) as day,
          max(
            case event_type
              when 'success' then 5
              when 'submit' then 3
              when 'open' then 1
              when 'click' then 1
              else 0
            end
          ) as weight
        from provider_activity_events, window
        where created_at >= window.since_ts
          and session_id is not null
          and country_code is not null
          and country_code ~ '^[A-Za-z]{2}$'
        group by provider_id, upper(country_code), session_id, date_trunc('day', created_at)
      ),
      agg as (
        select
          provider_id,
          country_code,
          count(distinct session_id)::int as user_count
        from daily
        where weight >= 1
        group by provider_id, country_code
      ),
      upsert as (
        insert into provider_country_usage_30d (provider_id, country_code, user_count, updated_at)
        select provider_id, country_code, user_count, now()
        from agg
        on conflict (provider_id, country_code)
        do update set
          user_count = excluded.user_count,
          updated_at = excluded.updated_at
        returning provider_id, country_code
      )
      delete from provider_country_usage_30d t
      where not exists (
        select 1 from agg a
        where a.provider_id = t.provider_id and a.country_code = t.country_code
      )
    `;
  });

  return { windowDays, updatedAt, totalRows };
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorised(req)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return new Response('Bad request', {
      status: 400,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (!hasDatabaseConfigured()) {
    return new Response('DATABASE_URL not configured', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Ensure schema exists before we aggregate (safe, idempotent).
  await ensureSchema();

  const { dryRun } = parsed.data;

  const result = await runAggregation(Boolean(dryRun));

  return Response.json(
    {
      ok: true,
      windowDays: result.windowDays,
      updatedAt: result.updatedAt,
      totalRows: result.totalRows,
      dryRun: Boolean(dryRun),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// Allow POST too (some schedulers prefer POST).
export async function POST(req: NextRequest): Promise<Response> {
  return GET(req);
}
