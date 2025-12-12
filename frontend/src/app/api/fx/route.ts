import { NextResponse } from 'next/server';

import { getFxRibbon } from '@/lib/fx/providers';
import type { FxApiResponse, FxApiMode } from '@/types/finance-ribbon';

const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev';

function emptyResponse(mode: FxApiMode = 'live'): FxApiResponse {
  return {
    meta: {
      buildId: BUILD_ID,
      mode,
      sourceProvider: 'unknown',
      asOf: new Date().toISOString(),
    },
    data: [],
  };
}

export async function GET() {
  try {
    // The gateway owns provider selection + caching.
    const payload = (await getFxRibbon()) as FxApiResponse;

    // Ensure buildId is always present and stable.
    const body: FxApiResponse = {
      ...payload,
      meta: {
        ...payload.meta,
        buildId: payload?.meta?.buildId ?? BUILD_ID,
      },
    };

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error('[api/fx] failed', error);
    return NextResponse.json(emptyResponse('live'), { status: 503 });
  }
}
