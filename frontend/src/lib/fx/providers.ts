/**
 * FX providers + caching for the finance ribbon.
 *
 * Goals:
 * - Single upstream request for all ribbon symbols (bulk exchange_rate).
 * - Server-side TTL caching to avoid repeated upstream calls.
 * - Single-flight de-duplication under concurrency.
 * - Backoff + "ride the cache" on rate limit.
 * - SSOT-aware cache key so edits to fx.pairs.json invalidate immediately.
 */

import { createHash } from 'crypto';
import type { FxApiMeta, FxApiMode, FxApiQuote, FxApiResponse } from '@/types/finance-ribbon';
import { getDefaultFxPairsWithIndexForTier } from '@/data/fx';

type CacheDecision =
  | 'cache_hit'
  | 'cache_miss'
  | 'singleflight_join'
  | 'rate_limited_ride_cache'
  | 'rate_limited_no_cache'
  | 'ssot_changed_invalidate';

export type FxRibbonTraceSnapshot = {
  ttlSeconds: number;
  ssotKey: string;
  cache: {
    hasValue: boolean;
    asOf?: string;
    expiresAt?: string;
    key?: string;
  };
  inFlight: boolean;
  lastDecision?: CacheDecision;
  lastError?: string;
  counters: {
    ribbonCalls: number;
    upstreamCalls: number;
    upstreamSymbolsTotal: number;
  };
  rateLimit: {
    until?: string;
    last429At?: string;
    cooldownSeconds?: number;
  };
};

type FxRibbonCache = {
  key: string;
  payload: FxApiResponse;
  expiresAtMs: number;
};

type FxRibbonPair = {
  id: string; // SSOT id, e.g. "gbp-usd"
  base: string; // "GBP"
  quote: string; // "USD"
  label: string; // "GBP / USD"
  category: string; // e.g. "core"
  symbol: string; // Twelve Data symbol, e.g. "GBP/USD"
};

type TwelveDataBulkItem = {
  symbol: string;

  // Some Twelve Data responses use "rate"
  rate?: string | number;

  // The exchange_rate endpoint often uses "exchange_rate"
  exchange_rate?: string | number;

  timestamp?: number;
};

type TwelveDataBulkResponse = {
  code?: number;
  message?: string;
  status?: string;
  data?: TwelveDataBulkItem[] | Record<string, TwelveDataBulkItem>;
};

export type FxProviderSummary = {
  modeLabel: string;
  emphasiseFallback: boolean;
  meta: {
    id: string;
    name: string;
  };
};

const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  'local-dev';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return i;
}

// Default TTL: 30 mins in prod; 5 mins locally.
const CACHE_TTL_SECONDS = readPositiveIntEnv('FX_RIBBON_TTL_SECONDS', isProd() ? 30 * 60 : 5 * 60);

// Rate-limit cooldown (seconds) applied when Twelve Data returns 429.
// While rate-limited, we "ride the cache" and avoid retry storms.
const RATE_LIMIT_COOLDOWN_SECONDS = readPositiveIntEnv('FX_RIBBON_429_COOLDOWN_SECONDS', 10 * 60);

let ribbonCache: FxRibbonCache | null = null;
let ribbonInFlight: Promise<FxApiResponse> | null = null;

let lastDecision: CacheDecision | undefined;
let lastError: string | undefined;

let rateLimitedUntilMs: number | undefined;
let last429AtMs: number | undefined;

let lastSsotKey = 'ssot:unknown';

const counters = {
  ribbonCalls: 0,
  upstreamCalls: 0,
  upstreamSymbolsTotal: 0,
};

function nowMs(): number {
  return Date.now();
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function normaliseSymbol(symbol: string): string {
  // Twelve Data expects FX pairs as "EUR/USD" etc.
  return symbol.trim();
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function ssotKeyFromOrderedIds(orderedIds: string[]): string {
  // Stable fingerprint of the SSOT order.
  // Any change to ids or their order changes the key => cache invalidates instantly.
  const raw = orderedIds.join('|');
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 12);
  return `fxpairs:${hash}`;
}

function buildMeta(
  mode: FxApiMeta['mode'],
  sourceProvider: FxApiMeta['sourceProvider'],
  asOfIso: string,
): FxApiMeta {
  return {
    buildId: BUILD_ID,
    mode,
    sourceProvider,
    asOf: asOfIso,
  };
}

function buildResponse(params: {
  mode: FxApiMeta['mode'];
  sourceProvider: FxApiMeta['sourceProvider'];
  asOfIso: string;
  data: FxApiQuote[];
  error?: string;
}): FxApiResponse {
  return {
    meta: buildMeta(params.mode, params.sourceProvider, params.asOfIso),
    data: params.data,
    error: params.error,
  };
}

function canUseCache(ms: number, key: string): boolean {
  return ribbonCache !== null && ribbonCache.key === key && ribbonCache.expiresAtMs > ms;
}

function invalidateForSsotChange(nextKey: string): void {
  if (nextKey === lastSsotKey) return;

  // SSOT changed: invalidate cache and any in-flight request so we can reflect changes immediately.
  ribbonCache = null;
  ribbonInFlight = null;

  lastDecision = 'ssot_changed_invalidate';
  lastSsotKey = nextKey;
}

function bumpRateLimit(now: number): void {
  last429AtMs = now;
  rateLimitedUntilMs = now + RATE_LIMIT_COOLDOWN_SECONDS * 1000;

  // If we have a cache value, extend its life so we can ride it while rate-limited.
  if (ribbonCache) {
    const extended = Math.max(ribbonCache.expiresAtMs, rateLimitedUntilMs);
    ribbonCache = { ...ribbonCache, expiresAtMs: extended };
  }
}

function isRateLimited(now: number): boolean {
  return typeof rateLimitedUntilMs === 'number' && rateLimitedUntilMs > now;
}

function parseTwelveDataBulk(data: TwelveDataBulkResponse): Map<string, TwelveDataBulkItem> {
  const map = new Map<string, TwelveDataBulkItem>();

  if (!data || typeof data !== 'object') return map;

  // Some responses are array-based
  if (Array.isArray(data.data)) {
    for (const item of data.data) {
      if (!item?.symbol) continue;
      map.set(normaliseSymbol(item.symbol), item);
    }
    return map;
  }

  // Some responses are record-based
  const record = data.data;
  if (record && typeof record === 'object' && !Array.isArray(record)) {
    for (const [k, v] of Object.entries(record)) {
      if (!v) continue;
      const sym = v.symbol ? normaliseSymbol(v.symbol) : normaliseSymbol(k);
      map.set(sym, v);
    }
  }

  return map;
}

function parseRate(item: TwelveDataBulkItem | undefined): number | null {
  if (!item) return null;

  const raw = item.rate ?? item.exchange_rate;
  if (raw === undefined || raw === null) return null;

  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;

  return n;
}

function buildRibbonPairsAndKey(): { pairs: FxRibbonPair[]; key: string } {
  // SSOT-driven, ordered exactly as fx.pairs.json defines it (via data/fx index).
  const ssotPairs = getDefaultFxPairsWithIndexForTier('free');

  const orderedIds = ssotPairs.map((p) => p.id);
  const key = ssotKeyFromOrderedIds(orderedIds);

  const pairs: FxRibbonPair[] = ssotPairs.map((p) => {
    const base = p.base.toUpperCase();
    const quote = p.quote.toUpperCase();
    const label = p.label ?? `${base} / ${quote}`;
    const category = p.group ?? 'fx';
    const symbol = `${base}/${quote}`;

    return {
      id: p.id,
      base,
      quote,
      label,
      category,
      symbol,
    };
  });

  return { pairs, key };
}

function pairsToQuotes(pairs: FxRibbonPair[], map: Map<string, TwelveDataBulkItem>): FxApiQuote[] {
  const out: FxApiQuote[] = [];

  for (const pair of pairs) {
    const sym = normaliseSymbol(pair.symbol);
    const rate = parseRate(map.get(sym));

    out.push({
      id: pair.id, // IMPORTANT: matches SSOT id used by the UI ribbon
      base: pair.base,
      quote: pair.quote,
      label: pair.label,
      category: pair.category,
      price: rate,
      change: null,
      changePct: null,
    });
  }

  return out;
}

async function fetchTwelveDataBulkExchangeRates(
  symbols: string[],
): Promise<Map<string, TwelveDataBulkItem>> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    throw new Error('Missing TWELVEDATA_API_KEY');
  }

  const endpoint = 'exchange_rate';
  const baseUrl = 'https://api.twelvedata.com';
  const url = new URL(`${baseUrl}/${endpoint}`);

  // Twelve Data: comma-separated symbols like "EUR/USD,GBP/USD"
  url.searchParams.set('symbol', symbols.join(','));
  url.searchParams.set('apikey', apiKey);

  counters.upstreamCalls += 1;
  counters.upstreamSymbolsTotal += symbols.length;

  const res = await fetch(url.toString(), {
    method: 'GET',
    // Upstream fetch should not be cached by Next — our own cache handles it.
    cache: 'no-store',
  });

  if (res.status === 429) {
    const now = nowMs();
    bumpRateLimit(now);
    throw new Error('Twelve Data rate-limited (429)');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Twelve Data error: ${res.status} ${res.statusText}${body ? ` – ${body}` : ''}`,
    );
  }

  const json = (await res.json()) as TwelveDataBulkResponse;
  if (json?.status && json.status !== 'ok') {
    throw new Error(`Twelve Data response not ok: ${json.message ?? 'unknown error'}`);
  }

  return parseTwelveDataBulk(json);
}

function logTrace(message: string, extra?: Record<string, unknown>): void {
  console.debug(`[fx.ribbon] ${message}`, extra ?? {});
}

export function getFxProviderSummary(
  mode: FxApiMode | null,
  providerId: string | null,
): FxProviderSummary {
  const id = (providerId ?? 'twelvedata').toLowerCase();

  const name =
    id === 'twelvedata'
      ? 'Twelve Data'
      : id === 'cache'
      ? 'Cache'
      : id === 'fallback'
      ? 'Fallback'
      : providerId ?? 'Unknown';

  const modeLabel =
    mode === 'cached'
      ? 'Cached'
      : mode === 'fallback'
      ? 'Fallback'
      : mode === 'live'
      ? 'Live'
      : '—';

  return {
    modeLabel,
    emphasiseFallback: mode === 'fallback',
    meta: { id, name },
  };
}

export function getFxRibbonTraceSnapshot(): FxRibbonTraceSnapshot {
  return {
    ttlSeconds: CACHE_TTL_SECONDS,
    ssotKey: lastSsotKey,
    cache: {
      hasValue: Boolean(ribbonCache),
      asOf: ribbonCache?.payload.meta.asOf,
      expiresAt: ribbonCache ? iso(ribbonCache.expiresAtMs) : undefined,
      key: ribbonCache?.key,
    },
    inFlight: Boolean(ribbonInFlight),
    lastDecision,
    lastError,
    counters: { ...counters },
    rateLimit: {
      until: typeof rateLimitedUntilMs === 'number' ? iso(rateLimitedUntilMs) : undefined,
      last429At: typeof last429AtMs === 'number' ? iso(last429AtMs) : undefined,
      cooldownSeconds: RATE_LIMIT_COOLDOWN_SECONDS,
    },
  };
}

export function getFxRibbonTtlSeconds(): number {
  return CACHE_TTL_SECONDS;
}

export async function getFxRibbon(): Promise<FxApiResponse> {
  counters.ribbonCalls += 1;

  // Compute pairs + SSOT key every call (small, and guarantees correctness).
  const { pairs, key } = buildRibbonPairsAndKey();
  invalidateForSsotChange(key);

  const now = nowMs();

  // 1) If rate-limited, ride the cache if possible (avoid retry storms).
  if (isRateLimited(now)) {
    if (canUseCache(now, key)) {
      lastDecision = 'rate_limited_ride_cache';
      logTrace('rate-limited → riding cache', {
        until: iso(rateLimitedUntilMs as number),
        key,
        expiresAt: iso((ribbonCache as FxRibbonCache).expiresAtMs),
      });
      return (ribbonCache as FxRibbonCache).payload;
    }

    lastDecision = 'rate_limited_no_cache';
    logTrace('rate-limited with no cache → returning empty', {
      until: iso(rateLimitedUntilMs as number),
      key,
    });

    const asOfIso = new Date().toISOString();
    return buildResponse({
      mode: 'live',
      sourceProvider: 'twelvedata',
      asOfIso,
      data: [],
      error: 'Rate-limited and no valid cache available',
    });
  }

  // 2) Cache hit (SSOT-keyed)
  if (canUseCache(now, key)) {
    lastDecision = 'cache_hit';
    logTrace('cache hit', {
      key,
      ttlSeconds: CACHE_TTL_SECONDS,
      expiresAt: iso((ribbonCache as FxRibbonCache).expiresAtMs),
      asOf: (ribbonCache as FxRibbonCache).payload.meta.asOf,
    });
    return (ribbonCache as FxRibbonCache).payload;
  }

  // 3) Single-flight: if one request is in-flight, join it (only valid for same SSOT key).
  if (ribbonInFlight) {
    lastDecision = 'singleflight_join';
    logTrace('single-flight join', { key });
    return ribbonInFlight;
  }

  // 4) Cache miss: fetch new values
  lastDecision = 'cache_miss';

  const symbols = uniqueStrings(pairs.map((p) => normaliseSymbol(p.symbol)));

  ribbonInFlight = (async () => {
    try {
      logTrace('cache miss → fetching bulk', {
        key,
        pairCount: pairs.length,
        symbolCount: symbols.length,
        ttlSeconds: CACHE_TTL_SECONDS,
      });

      const map = await fetchTwelveDataBulkExchangeRates(symbols);

      const quotes = pairsToQuotes(pairs, map);

      const asOfIso = new Date().toISOString();
      const payload = buildResponse({
        mode: 'live',
        sourceProvider: 'twelvedata',
        asOfIso,
        data: quotes,
      });

      ribbonCache = {
        key,
        payload,
        expiresAtMs: nowMs() + CACHE_TTL_SECONDS * 1000,
      };

      lastError = undefined;

      logTrace('fetch ok → cached', {
        key,
        quoteCount: quotes.length,
        expiresAt: iso((ribbonCache as FxRibbonCache).expiresAtMs),
      });

      return payload;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;

      // If we have *any* cached value for the same key, prefer it.
      const now2 = nowMs();
      if (ribbonCache && ribbonCache.key === key && ribbonCache.expiresAtMs > now2) {
        logTrace('fetch failed → serving cached value', { key, message });
        return ribbonCache.payload;
      }

      logTrace('fetch failed → returning empty', { key, message });

      const asOfIso = new Date().toISOString();
      return buildResponse({
        mode: 'live',
        sourceProvider: 'twelvedata',
        asOfIso,
        data: [],
        error: message,
      });
    } finally {
      ribbonInFlight = null;
    }
  })();

  return ribbonInFlight;
}
