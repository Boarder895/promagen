// src/app/api/fx/route.ts
/**
 * /api/fx — aggregate FX payload with guards and provenance.
 * Shape: { ok, quotes, nextUpdateAt, buildId?, mode }
 *
 * This route is the single entry point for FX data used by the
 * finance ribbon and mini FX widget. It calls the server-side
 * FX client, which handles provider selection, fallbacks and
 * short-lived caching.
 */

import { NextResponse } from 'next/server';

import type { FxQuotesPayload } from '@/types/finance-ribbon';
import { fetchFxSnapshot } from '@/lib/finance/fx-client';

function getBuildId(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || undefined;
}

export async function GET(): Promise<Response> {
  // During tests we keep behaviour deterministic and side-effect free:
  // return a tiny demo payload without touching real networks.
  if (process.env.NODE_ENV === 'test') {
    const now = Date.now();
    const body: FxQuotesPayload = {
      ok: true,
      mode: 'demo',
      quotes: [],
      nextUpdateAt: new Date(now + 60_000).toISOString(),
      buildId: getBuildId(),
    };

    return NextResponse.json(body, {
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  }

  try {
    const { quotes, mode } = await fetchFxSnapshot();
    const now = Date.now();

    const body: FxQuotesPayload = {
      ok: true,
      mode,
      quotes,
      nextUpdateAt: new Date(now + 5 * 60_000).toISOString(),
      buildId: getBuildId(),
    };

    return NextResponse.json(body, {
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  } catch {
    // If both providers fail, we fall back to a demo payload rather than
    // throwing a hard 5xx. This keeps the homepage calm in rough conditions.
    const now = Date.now();
    const body: FxQuotesPayload = {
      ok: true,
      mode: 'demo',
      quotes: [],
      nextUpdateAt: new Date(now + 60_000).toISOString(),
      buildId: getBuildId(),
    };

    return NextResponse.json(body, {
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  }
}
