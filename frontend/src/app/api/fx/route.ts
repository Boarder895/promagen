import { NextResponse } from 'next/server';

import { getFxRibbon, getFxRibbonTtlSeconds } from '@/lib/fx/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const payload = await getFxRibbon();

    // Edge/shared-cache protection:
    // - Browser: do not cache (max-age=0)
    // - CDN: cache for the remaining TTL window (s-maxage) so serverless instances do not thundering-herd Twelve Data.
    //
    // Note: We compute "remaining" from payload.meta.asOf so cache duration matches the actual upstream fetch time.
    const ttlSeconds = getFxRibbonTtlSeconds();

    const asOfMs = Date.parse(payload.meta.asOf);
    const ageSeconds = Number.isFinite(asOfMs)
      ? Math.max(0, Math.floor((Date.now() - asOfMs) / 1000))
      : 0;

    // Normal case: cache until the TTL expires.
    // Stale/rate-limited case (age > ttl): still cache, but only briefly so we can recover quickly once limits clear.
    const sMaxAgeSeconds =
      ageSeconds > ttlSeconds ? Math.min(60, ttlSeconds) : Math.max(5, ttlSeconds - ageSeconds);

    const cacheControl = `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=60`;

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': cacheControl,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    return NextResponse.json(
      {
        meta: {
          buildId:
            process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev',
          mode: 'live',
          sourceProvider: 'twelvedata',
          asOf: new Date().toISOString(),
        },
        data: [],
        error: message,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
