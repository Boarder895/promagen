// src/app/api/admin/catalog/route.ts
// ============================================================================
// ADMIN CATALOG ROUTE v1.0.0
// ============================================================================
// Returns lightweight catalog data for admin tooling.
//
// GET /api/admin/catalog
//
// v1.0.0:
// - FIX: Route was an empty file, which produced 500 errors.
// - Returns summary counts + core catalog payloads for admin surfaces.
// - Production is secret-gated; local development is allowed without a secret
//   so the route does not explode during local UI work.
//
// Authority: code-standard.md §16
// Security: 9/10 — protected in production, dev-friendly locally
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelected from '@/data/exchanges/exchanges.selected.json';
import fxPairs from '@/data/fx/fx-pairs.json';
import providers from '@/data/providers/providers.json';
import { env, requireCronSecret } from '@/lib/env';

const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function isAuthorized(request: NextRequest): boolean {
  if (env.nodeEnv !== 'production' && !env.cron.secret) {
    return true;
  }

  let expected = '';
  try {
    expected = requireCronSecret();
  } catch {
    return env.nodeEnv !== 'production';
  }

  const authorization = request.headers.get('authorization') ?? '';
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length).trim()
    : '';

  const provided = (
    bearerSecret ||
    request.headers.get('x-promagen-cron') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('x-promagen-cron-secret') ||
    request.nextUrl.searchParams.get('secret') ||
    ''
  ).trim();

  return provided.length > 0 && constantTimeEquals(provided, expected);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const selectedExchangeIds = Array.isArray((exchangesSelected as { ids?: string[] }).ids)
      ? (exchangesSelected as { ids: string[] }).ids
      : [];

    const defaultFxPairIds = (Array.isArray(fxPairs) ? fxPairs : [])
      .filter((row) => row && typeof row === 'object' && (row as { isDefaultFree?: boolean }).isDefaultFree === true)
      .map((row) => String((row as { id?: string }).id ?? ''))
      .filter(Boolean);

    return NextResponse.json(
      {
        success: true,
        catalog: {
          providers,
          exchanges: exchangesCatalog,
          fxPairs,
          defaults: {
            exchangeIds: selectedExchangeIds,
            fxPairIds: defaultFxPairIds,
          },
        },
        counts: {
          providers: Array.isArray(providers) ? providers.length : 0,
          exchanges: Array.isArray(exchangesCatalog) ? exchangesCatalog.length : 0,
          fxPairs: Array.isArray(fxPairs) ? fxPairs.length : 0,
          defaultExchanges: selectedExchangeIds.length,
          defaultFxPairs: defaultFxPairIds.length,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin/catalog] Error:', message);
    return NextResponse.json(
      { error: 'Failed to load admin catalog' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
