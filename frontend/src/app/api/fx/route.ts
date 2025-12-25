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
 * - Emoji may exist in the JSON body, but MUST NOT be placed into headers.
 *
 * Existing features preserved: Yes.
 */

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
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
  error?: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

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
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (typeof sha === 'string' && sha.trim().length > 0) return sha.slice(0, 12);

  const build =
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.VERCEL_ENV;

  if (typeof build === 'string' && build.trim().length > 0) return build.trim();

  return 'local-dev';
}

function getRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

function normaliseBudgetState(state: unknown): FxBudgetState {
  if (state === 'ok' || state === 'warning' || state === 'blocked') return state;
  return 'ok';
}

function normaliseMode(mode: unknown, cached: unknown): FxApiResponseWithBudget['meta']['mode'] {
  if (mode === 'live' || mode === 'cached' || mode === 'fallback') return mode;
  if (cached === true) return 'cached';
  return 'live';
}

function asOfToMs(asOf: string): number | undefined {
  const ms = Date.parse(asOf);
  return Number.isFinite(ms) ? ms : undefined;
}

function buildEmergencyFallback(message: string, requestId: string): FxApiResponseWithBudget {
  const buildId = getBuildId();
  const asOf = new Date().toISOString();

  return {
    meta: {
      buildId,
      mode: 'fallback',
      sourceProvider: 'fallback',
      asOf,
      budget: { state: 'ok' },
      requestId,
      safeMode: env.safeMode.enabled,
    },
    data: [],
    error: message,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);

  // App-level rate limiting (defence in depth). Keep generous; WAF is your front line.
  const decision = rateLimit(request, {
    keyPrefix: 'fx',
    windowSeconds: 60,
    max: env.isProd ? 240 : 10_000,
    keyParts: ['GET', '/api/fx'],
  });

  if (!decision.allowed) {
    const payload = buildEmergencyFallback('Rate limited', requestId);
    const durationMs = Date.now() - startedAt;

    console.warn(
      JSON.stringify({
        level: 'warn',
        route: '/api/fx',
        requestId,
        event: 'rate_limited',
        retryAfterSeconds: decision.retryAfterSeconds,
        durationMs,
      }),
    );

    return NextResponse.json(payload, {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(decision.retryAfterSeconds),
        'X-RateLimit-Limit': String(decision.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': decision.resetAt,
        'X-Promagen-Role': 'fx.ribbon',
        'X-Promagen-Request-Id': requestId,
      },
    });
  }

  try {
    const payload = await getFxRibbon();

    const buildId = getBuildId();

    const anyPayload = payload as unknown as UnknownRecord;
    const rawMeta = isRecord(anyPayload['meta']) ? (anyPayload['meta'] as UnknownRecord) : {};

    // Keep /api/fx contract stable: always emit asOf + sourceProvider in meta.
    const asOf = readString(rawMeta, 'asOf') ?? new Date().toISOString();

    const apiMode = normaliseMode(rawMeta['mode'], rawMeta['cached']);

    const sourceProvider =
      apiMode === 'cached'
        ? 'cache'
        : readString(rawMeta, 'sourceProvider') ??
          readString(rawMeta, 'providerId') ??
          'twelvedata';

    const budgetRaw = isRecord(rawMeta['budget'])
      ? (rawMeta['budget'] as UnknownRecord)
      : undefined;
    const state = normaliseBudgetState(budgetRaw?.['state']);
    const emoji = typeof budgetRaw?.['emoji'] === 'string' ? String(budgetRaw.emoji) : undefined;

    const payloadWithBudget: FxApiResponseWithBudget = {
      ...(payload as unknown as Omit<FxApiResponseWithBudget, 'meta'>),
      meta: {
        ...(rawMeta as Record<string, unknown>),
        buildId,
        mode: apiMode,
        asOf,
        sourceProvider,
        budget: { state, ...(emoji ? { emoji } : {}) },
        requestId,
        safeMode: env.safeMode.enabled,
      },
    };

    // CDN-honest caching:
    // - Browser: do not cache (max-age=0)
    // - Edge/CDN: cache for policy TTL
    // - If payload carries an error, cache briefly so we don't amplify failures.
    const ttlSeconds = readNumber(rawMeta, 'ttlSeconds') ?? 1800;
    const sMaxAgeSeconds = payloadWithBudget.error ? Math.min(60, ttlSeconds) : ttlSeconds;
    const staleWhileRevalidateSeconds = Math.min(120, ttlSeconds);

    const cacheControl = `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`;

    const asOfMs = asOfToMs(asOf);
    const durationMs = Date.now() - startedAt;

    console.debug(
      JSON.stringify({
        level: 'info',
        route: '/api/fx',
        requestId,
        event: 'served',
        mode: apiMode,
        provider: sourceProvider,
        budget: state,
        ttlSeconds,
        durationMs,
      }),
    );

    return NextResponse.json(payloadWithBudget, {
      headers: {
        'Cache-Control': cacheControl,

        // Reflective “Brain” headers (ASCII only)
        'X-Promagen-Role': 'fx.ribbon',
        'X-Promagen-Mode': apiMode,
        'X-Promagen-Provider': sourceProvider,
        ...(asOfMs ? { 'X-Promagen-AsOfMs': String(asOfMs) } : {}),
        'X-Promagen-Request-Id': requestId,

        // Budget (reflective; computed by Authority)
        'X-Promagen-Fx-Budget': state,
        'X-Promagen-Fx-Budget-State': state,

        // Rate limit info (best-effort)
        'X-RateLimit-Limit': String(decision.limit),
        'X-RateLimit-Remaining': String(decision.remaining),
        'X-RateLimit-Reset': decision.resetAt,

        // Safe mode (Vercel flip-switch)
        'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = Date.now() - startedAt;

    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/fx',
        requestId,
        event: 'error',
        message,
        durationMs,
      }),
    );

    try {
      const fallback = buildEmergencyFallback(message, requestId);
      const state = normaliseBudgetState(fallback.meta.budget?.state);

      return NextResponse.json(fallback, {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Promagen-Role': 'fx.ribbon',
          'X-Promagen-Request-Id': requestId,
          'X-Promagen-Fx-Budget': state,
          'X-Promagen-Fx-Budget-State': state,
          'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
        },
      });
    } catch {
      return NextResponse.json(buildEmergencyFallback(message, requestId), {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'X-Promagen-Request-Id': requestId },
      });
    }
  }
}
