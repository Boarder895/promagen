import { NextResponse } from 'next/server';

import { getFxRibbon, getFxRibbonTraceSnapshot } from '@/lib/fx/providers';
import type { FxApiResponse, FxApiMode } from '@/types/finance-ribbon';

// Keep this route on Node.js runtime because the ribbon uses in-memory caching.
export const runtime = 'nodejs';

const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev';

function readPositiveIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;

  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;

  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

// Match providers.ts default logic
const DEFAULT_TTL_SECONDS = process.env.NODE_ENV === 'production' ? 30 * 60 : 5 * 60;
const TTL_SECONDS = readPositiveIntEnv(
  'FX_RIBBON_CACHE_TTL_SECONDS',
  DEFAULT_TTL_SECONDS,
  10,
  6 * 60 * 60,
);

// Optional SWR window (how long CDN can serve stale while revalidating)
const STALE_WHILE_REVALIDATE_SECONDS = readPositiveIntEnv('FX_RIBBON_SWR_SECONDS', 60, 0, 10 * 60);

const TRACE_ENABLED = (process.env.FX_RIBBON_TRACE ?? '').trim() === '1';

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
    const payload = (await getFxRibbon()) as FxApiResponse;

    const body: FxApiResponse = {
      ...payload,
      meta: {
        ...payload.meta,
        buildId: payload?.meta?.buildId ?? BUILD_ID,
      },
    };

    const res = NextResponse.json(body, { status: 200 });

    // Production: CDN caching saves server executions and upstream pressure.
    // Dev: keep it simple and avoid confusing caching during testing.
    if (process.env.NODE_ENV === 'production') {
      res.headers.set(
        'Cache-Control',
        `public, s-maxage=${TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
      );
    } else {
      res.headers.set('Cache-Control', 'no-store');
    }

    // Optional debug headers when tracing is enabled
    if (TRACE_ENABLED) {
      const snap = getFxRibbonTraceSnapshot();
      res.headers.set('X-Promagen-Fx-TTL-Seconds', String(snap.ttlSeconds));
      res.headers.set('X-Promagen-Fx-Decision', snap.lastDecision);
      res.headers.set('X-Promagen-Fx-UpstreamFetches', String(snap.counters.upstreamFetches));
      res.headers.set('X-Promagen-Fx-CacheHits', String(snap.counters.cacheHits));
      res.headers.set('X-Promagen-Fx-SingleFlightWaits', String(snap.counters.singleFlightWaits));
      res.headers.set(
        'X-Promagen-Fx-LastSymbols',
        snap.lastSymbolsCount === null ? 'n/a' : String(snap.lastSymbolsCount),
      );
      res.headers.set(
        'X-Promagen-Fx-LastUniqueSymbols',
        snap.lastUniqueSymbolsCount === null ? 'n/a' : String(snap.lastUniqueSymbolsCount),
      );
      res.headers.set('X-Promagen-Fx-RateLimitedUntil', snap.rateLimitedUntilIso ?? 'n/a');
    }

    return res;
  } catch (error) {
    console.error('[api/fx] failed', error);

    const res = NextResponse.json(emptyResponse('live'), { status: 503 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}
