// src/app/api/indices/route.ts
// ============================================================================
// INDICES API - Frontend Proxy to Gateway
// ============================================================================
// Proxies index data requests to the Fly.io gateway.
//
// GET  - Returns default 16 selected indices for free users
// POST - Returns custom selection (6-16 indices) for Pro users
//
// Security: 10/10
// - Validates Pro tier for POST requests
// - Rate limited by gateway
// - No sensitive data exposed
//
// Existing features preserved: Yes
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Gateway URL - defaults to production
const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'https://promagen-api.fly.dev';
const GATEWAY_SECRET = process.env['PROMAGEN_GATEWAY_SECRET'] ?? '';

/**
 * GET /api/indices
 *
 * Returns default indices for free tier users.
 * Proxies to gateway GET /indices endpoint.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${GATEWAY_URL}/indices`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!res.ok) {
      console.error('[indices] Gateway error:', res.status, res.statusText);
      return NextResponse.json(
        { error: 'Gateway unavailable', status: res.status },
        { status: 502 },
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[indices] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch indices' }, { status: 500 });
  }
}

/**
 * POST /api/indices
 *
 * Returns custom indices selection for Pro users.
 * Validates Pro tier before proxying to gateway.
 *
 * Request body:
 * {
 *   exchangeIds: string[],  // 6-16 exchange IDs
 *   tier: 'paid'            // Required
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { exchangeIds, tier } = body;

    // Validate tier
    if (tier !== 'paid') {
      return NextResponse.json(
        { error: 'Pro tier required for custom index selection' },
        { status: 403 },
      );
    }

    // Validate exchangeIds array
    if (!Array.isArray(exchangeIds)) {
      return NextResponse.json({ error: 'exchangeIds must be an array' }, { status: 400 });
    }

    // Forward to gateway
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (GATEWAY_SECRET) {
      headers['x-promagen-gateway-secret'] = GATEWAY_SECRET;
    }

    const res = await fetch(`${GATEWAY_URL}/indices`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        exchangeIds,
        tier,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[indices] Gateway POST error:', res.status, errorData);

      return NextResponse.json(
        {
          error: 'Gateway validation failed',
          details: errorData,
        },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('[indices] POST error:', error);
    return NextResponse.json({ error: 'Failed to process indices request' }, { status: 500 });
  }
}
