// frontend/src/app/go/[providerId]/route.ts
//
// Outbound redirect authority.
// Rules (per your docs):
// - UI must never link directly to external provider URLs.
// - All outbound links MUST go through: /go/{providerId}?src=<surface>[&sid=<sessionId>]
// - Logging must be best-effort and must never block the redirect.
// - Stage 1 writes a raw activity record keyed by click_id (idempotent).
//
// Pro posture:
// - Treat /go/* as a potential bot target (open-redirect probing).
// - WAF is first line; app rate limiting is second line.
// - Keep responses no-store and noindex.
//
// Existing features preserved: Yes.

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import rawProviders from '@/data/providers/providers.json';
import { db, hasDatabaseConfigured } from '@/lib/db';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Redirects must remain fast.
export const maxDuration = 10;

const ProviderRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    website: z.string().url(),
    affiliateUrl: z.string().url().optional().nullable(),
    requiresDisclosure: z.boolean().optional(),
    affiliate: z
      .object({
        enabled: z.boolean().optional(),
        subIdParam: z.string().min(1).optional(),
      })
      .optional()
      .nullable(),
  })
  .strict();

type ProviderRecord = z.infer<typeof ProviderRecordSchema>;

let providersCache: ProviderRecord[] | null = null;

function getRequestId(request: NextRequest): string {
  const vercelId = request.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

function getProviders(): ProviderRecord[] {
  if (providersCache) return providersCache;

  const parsed = z.array(ProviderRecordSchema).parse(rawProviders);

  // Normalise and keep only what we need for outbound.
  providersCache = parsed.map((p) => ({
    id: p.id,
    name: p.name,
    website: p.website,
    affiliateUrl: p.affiliateUrl ?? null,
    requiresDisclosure: p.requiresDisclosure ?? false,
    affiliate: p.affiliate ?? null,
  }));

  return providersCache;
}

function findProvider(providerId: string): ProviderRecord | null {
  return getProviders().find((p) => p.id === providerId) ?? null;
}

function parseUrl(input: string | null | undefined): URL | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u;
  } catch {
    return null;
  }
}

function pickDestination(
  provider: ProviderRecord,
): { url: URL; isAffiliate: boolean; subIdParam: string } | null {
  // Backwards-compatible behaviour:
  // - If affiliateUrl exists AND affiliate.enabled is not explicitly false, use affiliateUrl.
  // - Otherwise fall back to website.
  const affiliateEnabled = provider.affiliate?.enabled ?? true;
  const subIdParam = provider.affiliate?.subIdParam?.trim() || 'click_id';

  const primary = parseUrl(provider.website);
  const affiliate = parseUrl(provider.affiliateUrl ?? null);

  const chosen = affiliate && affiliateEnabled ? affiliate : primary;
  if (!chosen) return null;

  return {
    url: chosen,
    isAffiliate: Boolean(
      affiliate && affiliateEnabled && chosen.toString() === affiliate.toString(),
    ),
    subIdParam,
  };
}

function getCountryFromHeaders(headers: Headers): string | null {
  const raw =
    headers.get('x-vercel-ip-country') ??
    headers.get('cf-ipcountry') ??
    headers.get('x-geo-country') ??
    headers.get('x-country');

  if (!raw) return null;

  const cc = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;

  // Common “unknown” placeholders to ignore (defensive).
  if (cc === 'XX' || cc === 'ZZ') return null;

  return cc;
}

const QuerySchema = z.object({
  src: z.string().min(1).max(64),
  sid: z
    .string()
    .min(8)
    .max(96)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),

  // Optional UTMs (kept minimal; do not accept arbitrary query keys)
  utm_medium: z.string().max(64).optional(),
  utm_campaign: z.string().max(96).optional(),
  utm_content: z.string().max(96).optional(),
});

type BuiltDestination = {
  clickId: string;
  destination: URL;
  isAffiliate: boolean;
  src: string;
  sessionId?: string;
};

function buildDestination(
  provider: ProviderRecord,
  query: z.infer<typeof QuerySchema>,
): BuiltDestination | null {
  const picked = pickDestination(provider);
  if (!picked) return null;

  const clickId = crypto.randomUUID();

  // Copy URL so we never mutate shared instances.
  const dest = new URL(picked.url.toString());

  // Always include canonical click_id; also set the affiliate sub-id param for partner tracking.
  dest.searchParams.set(picked.subIdParam, clickId);
  dest.searchParams.set('click_id', clickId);

  // Always tag Promagen source; safe UTMs only.
  dest.searchParams.set('utm_source', 'promagen');
  dest.searchParams.set('utm_medium', query.utm_medium ?? query.src);
  if (query.utm_campaign) dest.searchParams.set('utm_campaign', query.utm_campaign);
  if (query.utm_content) dest.searchParams.set('utm_content', query.utm_content);

  return {
    clickId,
    destination: dest,
    isAffiliate: picked.isAffiliate,
    src: query.src,
    sessionId: query.sid,
  };
}

async function bestEffortInsertActivity(record: {
  clickId: string;
  providerId: string;
  eventType: 'open';
  src: string;
  sessionId: string | null;
  countryCode: string | null;
  destination: string;
}): Promise<void> {
  if (!hasDatabaseConfigured()) return;

  // Never block redirect: timebox the write.
  const TIMEBOX_MS = 250;

  const write = async () => {
    // Stage 1: raw events table keyed by click_id (idempotent).
    await db()`
      insert into provider_activity_events
        (click_id, provider_id, event_type, src, session_id, country_code, destination, created_at)
      values
        (${record.clickId}, ${record.providerId}, ${record.eventType}, ${record.src}, ${record.sessionId}, ${record.countryCode}, ${record.destination}, now())
      on conflict (click_id) do nothing
    `;
  };

  await Promise.race([
    write(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, TIMEBOX_MS);
    }),
  ]).catch(() => {
    // Swallow failures; redirect must still succeed. Cron/health will surface issues later.
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { providerId: string } },
): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);

  // App rate limit: keep fairly strict; WAF should also protect /go/*.
  const decision = rateLimit(request, {
    keyPrefix: 'go',
    windowSeconds: 60,
    max: env.isProd ? 120 : 10_000,
    keyParts: ['GET', '/go'],
  });

  if (!decision.allowed) {
    const durationMs = Date.now() - startedAt;

    console.warn(
      JSON.stringify({
        level: 'warn',
        route: '/go/[providerId]',
        requestId,
        event: 'rate_limited',
        retryAfterSeconds: decision.retryAfterSeconds,
        durationMs,
      }),
    );

    return new Response('Too many requests', {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': String(decision.retryAfterSeconds),
        'X-Robots-Tag': 'noindex, nofollow',
        'X-RateLimit-Limit': String(decision.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': decision.resetAt,
        'X-Promagen-Request-Id': requestId,
      },
    });
  }

  const providerId = (context?.params?.providerId ?? '').trim();
  const provider = providerId ? findProvider(providerId) : null;

  if (!provider) {
    return new Response('Unknown provider', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Promagen-Request-Id': requestId,
      },
    });
  }

  // Parse and validate query string.
  const url = new URL(request.url);
  const queryRaw = Object.fromEntries(url.searchParams.entries());
  const queryParsed = QuerySchema.safeParse(queryRaw);

  if (!queryParsed.success) {
    return new Response('Bad request', {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Promagen-Request-Id': requestId,
      },
    });
  }

  const built = buildDestination(provider, queryParsed.data);
  if (!built) {
    return new Response('No destination available', {
      status: 422,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Promagen-Request-Id': requestId,
      },
    });
  }

  const countryCode = getCountryFromHeaders(request.headers);

  // Stage 1: capture activity (best-effort; never blocks redirect)
  void bestEffortInsertActivity({
    clickId: built.clickId,
    providerId: provider.id,
    eventType: 'open',
    src: built.src,
    sessionId: built.sessionId ?? null,
    countryCode,
    destination: built.destination.toString(),
  });

  const durationMs = Date.now() - startedAt;

  console.debug(
    JSON.stringify({
      level: 'info',
      route: '/go/[providerId]',
      requestId,
      event: 'redirect',
      providerId: provider.id,
      hasDb: hasDatabaseConfigured(),
      durationMs,
    }),
  );

  // IMPORTANT: Response.redirect(...) can yield an immutable Headers guard at runtime.
  // Construct the redirect response with headers set up-front (no post-creation mutation).
  return new Response(null, {
    status: 302,
    headers: {
      Location: built.destination.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Promagen-Request-Id': requestId,

      // Rate limit info (best-effort)
      'X-RateLimit-Limit': String(decision.limit),
      'X-RateLimit-Remaining': String(decision.remaining),
      'X-RateLimit-Reset': decision.resetAt,
    },
  });
}
