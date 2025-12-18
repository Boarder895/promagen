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
 */

import { NextResponse } from 'next/server';

import { getFxRibbon, getFxRibbonBudgetIndicator, getFxRibbonTtlSeconds } from '@/lib/fx/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  };
  data: unknown[];
  error?: string;
};

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

function normaliseBudgetState(state: unknown): FxBudgetState {
  if (state === 'ok' || state === 'warning' || state === 'blocked') return state;
  return 'ok';
}

function buildEmergencyFallback(message: string): FxApiResponseWithBudget {
  const buildId = getBuildId();
  const asOf = new Date().toISOString();

  const indicator = getFxRibbonBudgetIndicator();
  const state = normaliseBudgetState(indicator?.state);
  const emoji = typeof indicator?.emoji === 'string' ? indicator.emoji : undefined;

  return {
    meta: {
      buildId,
      mode: 'fallback',
      sourceProvider: 'fallback',
      asOf,
      budget: { state, ...(emoji ? { emoji } : {}) },
    },
    data: [],
    error: message,
  };
}

export async function GET(): Promise<Response> {
  try {
    const payload = await getFxRibbon();

    const buildId = getBuildId();
    const asOf =
      typeof payload?.meta?.asOf === 'string' && payload.meta.asOf.trim().length > 0
        ? payload.meta.asOf
        : new Date().toISOString();

    const sourceProvider =
      payload?.meta?.mode === 'cached'
        ? 'cache'
        : String(payload?.meta?.sourceProvider ?? 'twelvedata');

    const indicator = payload?.meta?.budget ?? getFxRibbonBudgetIndicator();
    const state = normaliseBudgetState((indicator as { state?: unknown } | undefined)?.state);
    const emoji =
      typeof (indicator as { emoji?: unknown } | undefined)?.emoji === 'string'
        ? String((indicator as { emoji?: unknown }).emoji)
        : undefined;

    const payloadWithBudget: FxApiResponseWithBudget = {
      ...(payload as unknown as Omit<FxApiResponseWithBudget, 'meta'>),
      meta: {
        ...(payload as unknown as { meta: Record<string, unknown> }).meta,
        buildId,
        asOf,
        sourceProvider,
        budget: { state, ...(emoji ? { emoji } : {}) },
      } as FxApiResponseWithBudget['meta'],
    };

    // CDN-honest caching:
    // - Browser: do not cache (max-age=0)
    // - Edge/CDN: cache for policy TTL
    // - If payload carries an error, cache briefly so we don't amplify failures.
    const ttlSeconds = getFxRibbonTtlSeconds();
    const sMaxAgeSeconds = payloadWithBudget.error ? Math.min(60, ttlSeconds) : ttlSeconds;
    const staleWhileRevalidateSeconds = Math.min(120, ttlSeconds);

    const cacheControl = `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`;

    return NextResponse.json(payloadWithBudget, {
      headers: {
        'Cache-Control': cacheControl,

        // Headers MUST be ASCII. Emoji stays in the JSON body only.
        'X-Promagen-Fx-Budget': state,
        'X-Promagen-Fx-Budget-State': state,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    try {
      const fallback = buildEmergencyFallback(message);

      // Even on fallback, keep headers ASCII.
      const state = normaliseBudgetState(fallback.meta.budget?.state);

      return NextResponse.json(fallback, {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Promagen-Fx-Budget': state,
          'X-Promagen-Fx-Budget-State': state,
        },
      });
    } catch {
      return NextResponse.json(buildEmergencyFallback(message), {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
}
