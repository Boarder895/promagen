// src/app/api/commodities/route.ts
/**
 * /api/commodities — COURIER ONLY (no authority).
 *
 * API Brain rules:
 * - This route MUST NOT decide freshness or eligibility.
 * - It MUST NOT call providers directly.
 * - It MUST call the commodities “authority/client” layer (lib/commodities/providers).
 * - It MUST emit CDN-honest cache headers.
 *
 * Security posture:
 * - Rate limited (defence in depth).
 * - ASCII-only headers (undici/WebIDL ByteString).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import {
  buildCommoditiesCacheControl,
  getCommoditiesBuildId,
  getCommoditiesRequestId,
} from '@/lib/commodities/route';
import { getCommoditiesRibbon, toCommoditiesApiResponse } from '@/lib/commodities/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Keep short, but allow headroom for cold-start + gateway fetch.
export const maxDuration = 20;

function isoNow(): string {
  return new Date().toISOString();
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = getCommoditiesRequestId();
  const buildId = getCommoditiesBuildId();

  // App-level rate limiting (defence in depth). WAF is your front line.
  const rl = rateLimit(req, {
    keyPrefix: 'commodities',
    windowSeconds: 60,
    max: env.isProd ? 240 : 10_000,
    keyParts: ['GET', '/api/commodities'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', observedAt: isoNow(), requestId },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json; charset=utf-8',

          'Retry-After': String(rl.retryAfterSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rl.resetAt,

          'X-Promagen-Request-Id': requestId,
          'X-Promagen-Build-Id': buildId,
          'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
        },
      },
    );
  }

  const generatedAt = isoNow();

  const result = await getCommoditiesRibbon();

  const payload = toCommoditiesApiResponse({
    requestId,
    buildId,
    generatedAt,
    result,
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': buildCommoditiesCacheControl({ sMaxAgeSeconds: 300 }),
      'Content-Type': 'application/json; charset=utf-8',

      'X-Promagen-Request-Id': requestId,
      'X-Promagen-Build-Id': buildId,
      'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',

      'X-RateLimit-Limit': String(rl.limit),
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': rl.resetAt,
    },
  });
}
