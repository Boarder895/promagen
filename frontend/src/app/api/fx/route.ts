// src/app/api/fx/route.ts
/**
 * /api/fx — aggregate FX payload with guards and provenance.
 *
 * Shape:
 *   {
 *     ok: boolean;
 *     mode: 'demo' | 'live' | 'fallback';
 *     quotes: FxQuote[];
 *     nextUpdateAt: string; // ISO-8601 timestamp
 *     buildId?: string;
 *   }
 *
 * This route is the single entry point for FX data used by the
 * finance ribbon and mini FX widget. It calls external FX
 * providers directly for now, with short-lived in-memory caching
 * and explicit demo/fallback behaviour.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import pairsJson from '@/data/fx/pairs.json';
import financeConfigJson from '@/data/fx/finance.config.json';
import freePairIdsJson from '@/data/selected/fx.pairs.free.json';
import { buildDemoSnapshots } from '@/lib/fx/demo-walk';
import type { FxSnapshot } from '@/lib/fx/fetch';
import type {
  FxPair,
  FxPairId,
  FxQuote,
  FxQuotesPayload,
  FxProviderId,
} from '@/types/finance-ribbon';

type FinanceConfig = {
  pairs?: '*' | FxPairId[];
};

const financeConfig = financeConfigJson as FinanceConfig;

// -----------------------------------------------------------------------------
// Config & simple in-memory cache
// -----------------------------------------------------------------------------

// How long we consider a "live" payload fresh before re-hitting providers.
const LIVE_REFRESH_MS = 30 * 60_000; // 30 minutes

// How long to wait before retrying providers after a fallback/cache response.
const FALLBACK_REFRESH_MS = 10 * 60_000; // 10 minutes

// Demo can tick a bit faster since it's cheap and deterministic.
const DEMO_REFRESH_MS = 15 * 60_000; // 15 minutes

type CachedPayload = FxQuotesPayload;

let lastPayload: CachedPayload | null = null;

const ALL_PAIRS = pairsJson as FxPair[];
const DEFAULT_PAIR_IDS = freePairIdsJson as FxPairId[];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function getBuildId(): string | undefined {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.BUILD_ID ||
    process.env.GIT_COMMIT_SHA ||
    undefined
  );
}

function getPairsForRequest(): FxPair[] {
  const configPairs = financeConfig.pairs;

  const ids: FxPairId[] =
    configPairs === '*' || !configPairs || configPairs.length === 0
      ? (DEFAULT_PAIR_IDS as FxPairId[])
      : (configPairs as FxPairId[]);

  const allowed = new Set(ids.map((id) => id.toLowerCase()));

  return ALL_PAIRS.filter((pair) => allowed.has(pair.id.toLowerCase()));
}

function mapSnapshotToQuote(snapshot: FxSnapshot, provider: FxProviderId): FxQuote {
  return {
    pairId: snapshot.id as FxPairId,
    mid: snapshot.value,
    asOf: snapshot.asOf,
    provider,
  };
}

/**
 * Returns a cached payload if it is still fresh at the given time.
 */
function getCachedPayload(nowMs: number): CachedPayload | null {
  if (!lastPayload) {
    return null;
  }

  const next = Date.parse(lastPayload.nextUpdateAt);

  if (!Number.isFinite(next) || next <= nowMs) {
    return null;
  }

  return lastPayload;
}

function storePayload(payload: CachedPayload): void {
  lastPayload = payload;
}

// Basic timeout wrapper around fetch for server-side calls.
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 4_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...(init ?? {}),
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// -----------------------------------------------------------------------------
// Provider adapters
// -----------------------------------------------------------------------------

type GroupedPairs = Map<string, FxPair[]>;

function groupPairsByBase(pairs: FxPair[]): GroupedPairs {
  const groups: GroupedPairs = new Map();

  for (const pair of pairs) {
    const base = pair.base.toUpperCase();
    const existing = groups.get(base);

    if (existing) {
      existing.push(pair);
    } else {
      groups.set(base, [pair]);
    }
  }

  return groups;
}

// ExchangeRate-API response shape (primary provider)
interface ExchangeRateApiResponse {
  result?: string;
  base_code: string;
  time_last_update_utc?: string;
  conversion_rates?: Record<string, number>;
}

function isExchangeRateApiResponse(json: unknown): json is ExchangeRateApiResponse {
  if (!json || typeof json !== 'object') {
    return false;
  }

  const value = json as Partial<ExchangeRateApiResponse>;

  if (typeof value.base_code !== 'string') {
    return false;
  }

  if (value.conversion_rates && typeof value.conversion_rates !== 'object') {
    return false;
  }

  return true;
}

// exchangerate.host response shape (fallback provider)
interface ExchangerateHostResponse {
  base: string;
  date?: string;
  rates?: Record<string, number>;
}

function isExchangerateHostResponse(json: unknown): json is ExchangerateHostResponse {
  if (!json || typeof json !== 'object') {
    return false;
  }

  const value = json as Partial<ExchangerateHostResponse>;

  if (typeof value.base !== 'string') {
    return false;
  }

  if (value.rates && typeof value.rates !== 'object') {
    return false;
  }

  return true;
}

/**
 * Primary provider: ExchangeRate-API v6
 *
 *   GET https://v6.exchangerate-api.com/v6/YOUR-KEY/latest/USD
 *   → { result, base_code, time_last_update_utc, conversion_rates: { EUR: 0.92, ... } }
 */
async function fetchFromExchangeRateApi(pairs: FxPair[]): Promise<FxSnapshot[]> {
  const baseUrl = process.env.PROMAGEN_FX_EXCHANGE_RATE_API_BASE_URL;
  const apiKey = process.env.PROMAGEN_FX_EXCHANGE_RATE_API_KEY;

  if (!baseUrl || !apiKey) {
    console.warn('[fx] ExchangeRate-API not configured, skipping primary provider');
    return [];
  }

  const grouped = groupPairsByBase(pairs);
  const snapshots: FxSnapshot[] = [];

  for (const [base, basePairs] of grouped.entries()) {
    const url = `${stripTrailingSlash(baseUrl)}/${apiKey}/latest/${base}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn('[fx] ExchangeRate-API responded with', res.status);
      continue;
    }

    const json = (await res.json()) as unknown;

    if (!isExchangeRateApiResponse(json) || !json.conversion_rates) {
      console.warn('[fx] ExchangeRate-API malformed payload');
      continue;
    }

    const rates = json.conversion_rates;
    const asOf =
      typeof json.time_last_update_utc === 'string'
        ? new Date(json.time_last_update_utc).toISOString()
        : new Date().toISOString();

    for (const pair of basePairs) {
      const rate = rates[pair.quote.toUpperCase()];

      if (typeof rate !== 'number' || !Number.isFinite(rate)) {
        continue;
      }

      snapshots.push({
        id: pair.id as FxPairId,
        value: rate,
        prevClose: rate,
        asOf,
      });
    }
  }

  return snapshots;
}

/**
 * Fallback provider: https://exchangerate.host
 *
 *   GET https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,JPY
 *   → { base, date, rates: { EUR: 0.92, GBP: 0.78, ... } }
 */
async function fetchFromExchangerateHost(pairs: FxPair[]): Promise<FxSnapshot[]> {
  const baseUrl =
    process.env.PROMAGEN_FX_EXCHANGERATE_HOST_BASE_URL ?? 'https://api.exchangerate.host/latest';

  const grouped = groupPairsByBase(pairs);
  const snapshots: FxSnapshot[] = [];

  for (const [base, basePairs] of grouped.entries()) {
    const url = new URL(baseUrl);
    url.searchParams.set('base', base);
    const symbols = basePairs.map((p) => p.quote.toUpperCase()).join(',');
    url.searchParams.set('symbols', symbols);

    const res = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn('[fx] exchangerate.host responded with', res.status);
      continue;
    }

    const json = (await res.json()) as unknown;

    if (!isExchangerateHostResponse(json) || !json.rates) {
      console.warn('[fx] exchangerate.host malformed payload');
      continue;
    }

    const rates = json.rates;
    const asOf =
      typeof json.date === 'string' ? new Date(json.date).toISOString() : new Date().toISOString();

    for (const pair of basePairs) {
      const rate = rates[pair.quote.toUpperCase()];

      if (typeof rate !== 'number' || !Number.isFinite(rate)) {
        continue;
      }

      snapshots.push({
        id: pair.id as FxPairId,
        value: rate,
        prevClose: rate,
        asOf,
      });
    }
  }

  return snapshots;
}

// -----------------------------------------------------------------------------
// Payload builders
// -----------------------------------------------------------------------------

function buildDemoPayload(pairs: FxPair[], now: Date): FxQuotesPayload {
  // demo-walk expects an array of pair ids (string[]), not FxPair objects.
  const demoSnapshots = buildDemoSnapshots(
    pairs.map((pair) => pair.id),
    now,
  );

  const quotes: FxQuote[] = demoSnapshots.map((snapshot) =>
    mapSnapshotToQuote(snapshot, 'exchange-rate-api'),
  );

  return {
    ok: true,
    mode: 'demo',
    quotes,
    nextUpdateAt: new Date(now.getTime() + DEMO_REFRESH_MS).toISOString(),
    buildId: getBuildId(),
  };
}

function buildLivePayload(
  snapshots: FxSnapshot[],
  provider: FxProviderId,
  now: Date,
): FxQuotesPayload {
  const quotes: FxQuote[] = snapshots.map((snapshot) => mapSnapshotToQuote(snapshot, provider));

  const mode: FxQuotesPayload['mode'] = provider === 'exchangerate-host' ? 'fallback' : 'live';

  return {
    ok: true,
    mode,
    quotes,
    nextUpdateAt: new Date(now.getTime() + LIVE_REFRESH_MS).toISOString(),
    buildId: getBuildId(),
  };
}

/**
 * When providers are failing but we have a previous payload, we can extend
 * its life a little while making it clear to the frontend that this is a
 * stale-but-live-derived result.
 */
function buildFallbackFromCache(now: Date): FxQuotesPayload | null {
  if (!lastPayload) {
    return null;
  }

  return {
    ...lastPayload,
    nextUpdateAt: new Date(now.getTime() + FALLBACK_REFRESH_MS).toISOString(),
  };
}

// -----------------------------------------------------------------------------
// GET handler
// -----------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  const now = new Date();
  const nowMs = now.getTime();

  // 1. Fresh cache → short-circuit.
  const cached = getCachedPayload(nowMs);

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  }

  const pairs = getPairsForRequest();

  // 2. Primary provider: ExchangeRate-API.
  try {
    const primarySnapshots = await fetchFromExchangeRateApi(pairs);

    if (primarySnapshots.length > 0) {
      const payload = buildLivePayload(primarySnapshots, 'exchange-rate-api', now);

      storePayload(payload);

      return NextResponse.json(payload, {
        headers: {
          'cache-control': 'no-store',
        },
      }) as unknown as Response;
    }
  } catch (error) {
    console.error('[fx] Primary provider (ExchangeRate-API) failed', error);
  }

  // 3. Secondary provider: exchangerate.host.
  try {
    const fallbackSnapshots = await fetchFromExchangerateHost(pairs);

    if (fallbackSnapshots.length > 0) {
      const payload = buildLivePayload(fallbackSnapshots, 'exchangerate-host', now);

      storePayload(payload);

      return NextResponse.json(payload, {
        headers: {
          'cache-control': 'no-store',
        },
      }) as unknown as Response;
    }
  } catch (error) {
    console.error('[fx] Secondary provider (exchangerate.host) failed', error);
  }

  // 4. If everything fails, either reuse cache or drop to demo.
  const cachedFallback = buildFallbackFromCache(now);

  if (cachedFallback) {
    storePayload(cachedFallback);

    return NextResponse.json(cachedFallback, {
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  }

  const demoPayload = buildDemoPayload(pairs, now);

  storePayload(demoPayload);

  return NextResponse.json(demoPayload, {
    headers: {
      'cache-control': 'no-store',
    },
  }) as unknown as Response;
}
