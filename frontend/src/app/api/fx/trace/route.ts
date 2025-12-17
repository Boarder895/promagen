// frontend/src/app/api/fx/trace/route.ts
import { NextResponse } from 'next/server';

import { getFxRibbonTraceSnapshot } from '@/lib/fx/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const snapshot = getFxRibbonTraceSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      // API Brain: trace is observation-only and must never trigger refresh.
      // Keep it CDN-honest by making no caching promises here.
      'Cache-Control': 'no-store',
    },
  });
}
