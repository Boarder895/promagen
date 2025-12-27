// frontend/src/app/api/fx/route.ts
/**
 * /api/fx — COURIER ONLY (no authority).
 *
 * API Brain rules:
 * - This route MUST NOT decide freshness or eligibility.
 * - It MUST NOT call providers directly.
 * - It MAY ask the FX Refresh Authority for the current merged A+B ribbon state.
 * - It MUST emit CDN-honest cache headers that match the server TTL policy.
 *
 * Budget rules:
 * - Budget state MUST be computed inside the Authority (single SSOT).
 * - This route may only surface that state (no extra upstream calls).
 *
 * IMPORTANT:
 * - Response headers MUST be ASCII (undici/WebIDL ByteString).
 *   Emojis belong in JSON body only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { buildFxCacheControl, getFxBuildId, getFxRequestId } from '@/lib/fx/route';
import { getFxRibbon } from '@/lib/fx/providers';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Pro posture: keep the function short, but allow headroom for cold-start priming.
export const maxDuration = 30;

type FxBudgetState = 'ok' | 'warning' | 'blocked';

type FxApiBudgetMeta = {
  state: FxBudgetState;
  emoji?: string;
};

type FxApiResponseWithBudget = {
  meta: Record<string, unknown> & {
    buildId: string;
    mode: 'live' | 'cached' | 'fallback';
    sourceProvider: string;
    asOf: string;
    budget?: FxApiBudgetMeta;
    requestId?: string;
    safeMode?: boolean;
  };
  data: unknown[];
  error?: {
    code: string;
    message: string;
  };
};

type UnknownRecord = Record<string, unknown>;

function readString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(record: UnknownRecord, key: string): number | undefined {
  const value = record[key];
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function getBuildId(): string {
  return getFxBuildId();
}

function getRequestId(req: NextRequest): string {
  return getFxRequestId(req);
}

function isoNow(): string {
  return new Date().toISOString();
}

function asOfToMs(asOf: string): number {
  const ms = Date.parse(asOf);
  return Number.isFinite(ms) ? ms : Date.now();
}

export async function GET(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const buildId = getBuildId();

  // App-level rate limiting (defence in depth). WAF is your front line.
  const rl = rateLimit(request, {
    keyPrefix: 'fx',
    windowSeconds: 60,
    max: env.isProd ? 240 : 10_000,
    keyParts: ['GET', '/api/fx'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', observedAt: isoNow(), requestId },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(rl.retryAfterSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rl.resetAt,
          'X-Promagen-Request-Id': requestId,
          'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
        },
      },
    );
  }

  let mode: 'live' | 'cached' | 'fallback' = 'cached';
  let sourceProvider = 'unknown';
  let asOf = isoNow();
  let budgetState: FxBudgetState = 'ok';

  try {
    const ribbon = await getFxRibbon();

    const rawMeta = (ribbon?.meta ?? {}) as UnknownRecord;

    mode = (readString(rawMeta, 'mode') as typeof mode) ?? mode;
    sourceProvider = readString(rawMeta, 'sourceProvider') ?? sourceProvider;
    asOf = readString(rawMeta, 'asOf') ?? asOf;

    const rawBudget = rawMeta['budget'];
    if (rawBudget && typeof rawBudget === 'object') {
      const b = rawBudget as UnknownRecord;
      const st = readString(b, 'state');
      if (st === 'ok' || st === 'warning' || st === 'blocked') budgetState = st;
    }

    const enriched: FxApiResponseWithBudget = {
      ...(ribbon as UnknownRecord),
      meta: {
        ...(rawMeta as UnknownRecord),
        buildId,
        requestId,
        safeMode: env.safeMode.enabled,
      } as FxApiResponseWithBudget['meta'],
      data: Array.isArray((ribbon as UnknownRecord)?.data)
        ? ((ribbon as UnknownRecord).data as unknown[])
        : [],
    };

    // CDN-honest caching:
    // - Browser: do not cache (max-age=0)
    // - Edge/CDN: cache for policy TTL
    // - If payload carries an error, cache briefly so we don't amplify failures.
    const ttlSeconds = readNumber(rawMeta, 'ttlSeconds') ?? 1800;
    const cacheControl = buildFxCacheControl(ttlSeconds, Boolean(enriched.error));

    const asOfMs = asOfToMs(asOf);
    const durationMs = Date.now() - startedAt;

    // Structured logs: helps debug spend, caching, and budget behaviour.
    console.debug(
      JSON.stringify({
        route: '/api/fx',
        requestId,
        buildId,
        mode,
        sourceProvider,
        budget: budgetState,
        ttlSeconds,
        durationMs,
        asOfMs,
        safeMode: env.safeMode.enabled,
      }),
    );

    return NextResponse.json(enriched, {
      headers: {
        'Cache-Control': cacheControl,

        // Budget state is ASCII; emoji stays in JSON if authority includes it.
        'X-Promagen-Fx-Budget': budgetState,
        'X-Promagen-Fx-Budget-State': budgetState,

        'X-Promagen-Request-Id': requestId,
        'X-Promagen-Build-Id': buildId,
        'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',

        'X-RateLimit-Limit': String(rl.limit),
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Reset': rl.resetAt,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    console.error('[api/fx] error', {
      requestId,
      buildId,
      durationMs,
      safeMode: env.safeMode.enabled,
      err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });

    const fallback: FxApiResponseWithBudget = {
      meta: {
        buildId,
        mode: 'fallback',
        sourceProvider: 'none',
        asOf: isoNow(),
        requestId,
        safeMode: env.safeMode.enabled,
        budget: { state: 'ok' },
      },
      data: [],
      error: {
        code: 'FX_ROUTE_ERROR',
        message: 'FX route failed. See logs for requestId.',
      },
    };

    // Errors should not be cached long.
    const cacheControl = buildFxCacheControl(60, true);

    return NextResponse.json(fallback, {
      status: 200,
      headers: {
        'Cache-Control': cacheControl,
        'X-Promagen-Fx-Budget': 'ok',
        'X-Promagen-Fx-Budget-State': 'ok',
        'X-Promagen-Request-Id': requestId,
        'X-Promagen-Build-Id': buildId,
        'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
      },
    });
  }
}
