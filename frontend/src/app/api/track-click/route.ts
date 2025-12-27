// frontend/src/app/api/track-click/route.ts
//
// Lightweight click/event tracking endpoint.
// Notes:
// - This is a *metered surface* if you later forward to Web Analytics/custom events.
// - Keep payloads small and rate-limit in-app (Pro WAF is the front door; this is defence in depth).
// - Must never trigger paid upstream calls.
//
// Existing features preserved: Yes.

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;

function getRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

function safeModeHeaderValue(): '0' | '1' {
  return env.safeMode.enabled ? '1' : '0';
}

function buildCommonHeaders(requestId: string, rate?: ReturnType<typeof rateLimit>): Headers {
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

function normaliseEvent(input: string): string {
  const s = input.trim().slice(0, 64);
  // Keep event names boring and log-friendly.
  if (!/^[a-z0-9_.-]+$/i.test(s)) return 'invalid';
  return s.toLowerCase();
}

function clampString(input: string, maxLen: number): string {
  const s = input.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normaliseMetaFromQuery(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  const reserved = new Set(['target', 'event']);

  let count = 0;
  for (const [k, v] of url.searchParams.entries()) {
    if (reserved.has(k)) continue;
    if (!k) continue;
    if (count >= 20) break;

    const key = clampString(k, 48);
    if (!/^[a-z0-9_.-]+$/i.test(key)) continue;

    out[key] = clampString(v, 160);
    count += 1;
  }

  return out;
}

function normaliseMetaFromBody(meta: Record<string, unknown> | undefined): JsonObject | undefined {
  if (!meta) return undefined;

  const out: JsonObject = {};
  let count = 0;

  for (const [k, v] of Object.entries(meta)) {
    if (count >= 20) break;
    const key = clampString(k, 48);
    if (!/^[a-z0-9_.-]+$/i.test(key)) continue;

    if (typeof v === 'string') out[key] = clampString(v, 240);
    else if (typeof v === 'number' || typeof v === 'boolean') out[key] = v;
    else if (v === null) out[key] = null;
    // Drop objects/arrays to keep payloads small & predictable.

    count += 1;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

const PostBodySchema = z
  .object({
    event: z.string().min(1).max(64),
    id: z.string().max(96).optional(),
    url: z.string().url().max(2048).optional(),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

/**
 * GET /api/track-click?target=<url>&...meta
 *
 * Supports the canonical builder in src/lib/routes.ts (query-string beacon style).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const requestId = getRequestId(req);

  const rate = rateLimit(req, {
    keyPrefix: 'track_click',
    max: env.isProd ? 600 : 10_000,
    windowSeconds: 60,
    keyParts: ['GET'],
  });

  const headers = buildCommonHeaders(requestId, rate);

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Rate limited', requestId },
      { status: 429, headers },
    );
  }

  const url = new URL(req.url);

  const target = url.searchParams.get('target') ?? '';
  if (!target) {
    return NextResponse.json(
      { ok: false, error: 'Missing target', requestId },
      { status: 400, headers },
    );
  }

  const event = normaliseEvent(url.searchParams.get('event') ?? 'click');
  const meta = normaliseMetaFromQuery(url);

  // Safe mode: accept but don’t process (keeps the UI happy while you de-risk spend/noise).
  if (env.safeMode.enabled) {
    return NextResponse.json({ ok: true, skipped: true, requestId }, { status: 200, headers });
  }

  // TODO: replace with your real analytics sink (server-side only).
  console.debug(
    JSON.stringify({
      level: 'info',
      route: '/api/track-click',
      method: 'GET',
      requestId,
      event,
      target: clampString(target, 2048),
      meta,
    }),
  );

  // Beacon-friendly: tiny response.
  return new Response(null, { status: 204, headers });
}

/**
 * POST /api/track-click
 *
 * Accepts a small JSON payload (typed), suitable for server-to-server or richer client events.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const requestId = getRequestId(req);

  const rate = rateLimit(req, {
    keyPrefix: 'track_click',
    max: env.isProd ? 300 : 10_000,
    windowSeconds: 60,
    keyParts: ['POST'],
  });

  const headers = buildCommonHeaders(requestId, rate);

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Rate limited', requestId },
      { status: 429, headers },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON', requestId },
      { status: 400, headers },
    );
  }

  const parsed = PostBodySchema.safeParse(raw);
  if (!parsed.success) {
    console.debug(
      JSON.stringify({
        level: 'warn',
        route: '/api/track-click',
        method: 'POST',
        requestId,
        event: 'schema_error',
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
    );

    return NextResponse.json(
      { ok: false, error: 'Bad payload', requestId },
      { status: 400, headers },
    );
  }

  const event = normaliseEvent(parsed.data.event);
  const meta = normaliseMetaFromBody(parsed.data.meta);

  if (env.safeMode.enabled) {
    return NextResponse.json({ ok: true, skipped: true, requestId }, { status: 200, headers });
  }

  // TODO: replace with your real analytics sink (server-side only).
  console.debug(
    JSON.stringify({
      level: 'info',
      route: '/api/track-click',
      method: 'POST',
      requestId,
      event,
      id: parsed.data.id ? clampString(parsed.data.id, 96) : undefined,
      url: parsed.data.url ? clampString(parsed.data.url, 2048) : undefined,
      meta,
    }),
  );

  return NextResponse.json({ ok: true, requestId }, { status: 200, headers });
}
