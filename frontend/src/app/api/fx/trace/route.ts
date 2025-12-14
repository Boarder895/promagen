// C:\Users\Proma\Projects\promagen\frontend\src\app\api\fx\trace\route.ts
//
// FX trace endpoint: returns internal cache/single-flight counters and last decision.
// Purpose: prove API savings from a browser tab without relying on console output.
//
// This route is intentionally dynamic (never statically optimised).

import { NextResponse } from 'next/server';

import { getFxRibbonTraceSnapshot } from '@/lib/fx/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = getFxRibbonTraceSnapshot();

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
