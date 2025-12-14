// C:\Users\Proma\Projects\promagen\frontend\src\app\api\fx\route.ts
//
// Force dynamic runtime so Next never tries to statically optimise this route during build.
// This fixes: "Dynamic server usage: 'no-store' fetch ..." in `next build`.
//
// Node runtime is required because we rely on in-memory caching + single-flight in the provider layer.

import { NextResponse } from 'next/server';

import { getFxRibbon } from '@/lib/fx/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const payload = await getFxRibbon();

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
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
          error: message,
        },
        data: [],
      },
      { status: 500 },
    );
  }
}
