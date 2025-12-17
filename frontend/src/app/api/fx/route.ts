// frontend/src/app/api/fx/route.ts
/**
 * /api/fx — COURIER ONLY (no authority).
 *
 * API Brain rules:
 * - This route MUST NOT decide freshness or eligibility.
 * - It MUST NOT call providers directly.
 * - It MAY ask the FX Refresh Authority for the current merged A+B ribbon state.
 * - It MUST emit CDN-honest cache headers that match the server TTL policy.
 */

import { NextResponse } from 'next/server';

import { getFxRibbon, getFxRibbonTtlSeconds } from '@/lib/fx/providers';
import { getDefaultFxPairsWithIndexForTier } from '@/data/fx';
import type { FxApiQuote, FxApiResponse } from '@/types/finance-ribbon';

// We rely on our own server-side cache + explicit Cache-Control.
// Do not let Next.js static caching get involved.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildEmergencyFallback(error: string): FxApiResponse {
  // Emergency response must still be deterministic and SSOT-ordered.
  // We use the free tier list because that is the always-available baseline.
  const pairs = getDefaultFxPairsWithIndexForTier('free');

  const data: FxApiQuote[] = pairs.map((p) => ({
    id: p.id,
    base: p.base.toUpperCase(),
    quote: p.quote.toUpperCase(),
    label: p.label ?? `${p.base.toUpperCase()} / ${p.quote.toUpperCase()}`,
    category: String(p.group ?? 'fx'),
    price: null,
    change: null,
    changePct: null,
  }));

  return {
    meta: {
      buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev',
      mode: 'fallback',
      sourceProvider: 'fallback',
      asOf: new Date().toISOString(),
    },
    data,
    error,
  };
}

export async function GET() {
  try {
    // Courier-only: ask the Refresh Authority for the current merged A+B state.
    // Any refresh eligibility/TTL/single-flight decisions live inside the Authority.
    const payload = await getFxRibbon();

    // CDN-honest caching:
    // - Browser: do not cache (max-age=0)
    // - Edge/CDN: cache for policy TTL
    // - If payload carries an error, cache briefly so we don't amplify failures.
    const ttlSeconds = getFxRibbonTtlSeconds();
    const sMaxAgeSeconds = payload.error ? Math.min(60, ttlSeconds) : ttlSeconds;

    const cacheControl = `public, max-age=0, s-maxage=${sMaxAgeSeconds}`;

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': cacheControl,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    return NextResponse.json(buildEmergencyFallback(message), {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
