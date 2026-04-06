// frontend/src/app/api/providers/route.ts
//
// Providers API endpoint.
// Returns the provider catalog enriched with Promagen Users data when available.
//
// Existing features preserved: Yes.

import { NextResponse } from 'next/server';

import { getProvidersWithPromagenUsers } from '@/lib/providers/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const providers = await getProvidersWithPromagenUsers();

    return NextResponse.json(providers, {
      status: 200,
      headers: {
        // Allow caching for 5 minutes, stale-while-revalidate for 1 hour.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/providers',
        event: 'request_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );

    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
  }
}
