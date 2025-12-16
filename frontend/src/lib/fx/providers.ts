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
  lastFetch?: {
    at?: string;
    expectedSymbols: number;
    missingCount: number;
    missingSymbols: string[];
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

type TwelveDataBulkResponse =
  | {
      code?: number;
      message?: string;
      status?: string;
      data?: TwelveDataBulkItem[] | Record<string, TwelveDataBulkItem>;
    }
  // IMPORTANT: Twelve Data sometimes returns a TOP-LEVEL record keyed by symbol
  | Record<string, TwelveDataBulkItem | unknown>;

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

let lastFetchAtMs: number | undefined;
let lastExpectedSymbols = 0;
let lastMissingSymbols: string[] = [];

function nowMs(): number {
  return Date.now();
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Canonicalise an FX symbol so “eur/usd”, “EUR/USD”, “EURUSD”, “eur-usd” all become “EUR/USD”.
 */
export function normaliseSymbol(symbol: string): string {
  const raw = String(symbol ?? '').trim();
  if (!raw) return '';

  const cleaned = raw.replace(/\s+/g, '').replace(/\\/g, '/').replace(/-/g, '/').toUpperCase();

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').filter(Boolean);
    const base = parts[0] ?? '';
    const quote = parts[1] ?? '';
    if (!base || !quote) return cleaned;
    return `${base}/${quote}`;
  }

  const lettersOnly = cleaned.replace(/[^A-Z]/g, '');
  if (lettersOnly.length === 6) {
    const base = lettersOnly.slice(0, 3);
    const quote = lettersOnly.slice(3, 6);
    return `${base}/${quote}`;
  }

  return cleaned;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parse Twelve Data bulk response.
 *
 * Supported shapes:
 * 1) { status: "ok", data: [ {symbol, rate}, ... ] }
 * 2) { status: "ok", data: { "eur/usd": {symbol, rate}, ... } }
 * 3) { "eur/usd": {symbol, rate}, "gbp/usd": {symbol, rate}, ... }  <-- THIS IS YOUR CURRENT REALITY
 */
function parseTwelveDataBulk(json: unknown): Map<string, TwelveDataBulkItem> {
  const map = new Map<string, TwelveDataBulkItem>();
  if (!json) return map;

  // If it’s the wrapped form with "data"
  if (isPlainObject(json) && 'data' in json) {
    const data = (json as { data?: unknown }).data;

    if (Array.isArray(data)) {
      for (const item of data) {
        if (!isPlainObject(item)) continue;
        const sym = (item.symbol as string | undefined) ?? '';
        if (!sym) continue;
        map.set(normaliseSymbol(sym), item as TwelveDataBulkItem);
      }
      return map;
    }

    if (isPlainObject(data)) {
      for (const [k, v] of Object.entries(data)) {
        if (!isPlainObject(v)) continue;
        const sym = (v.symbol as string | undefined) ?? k;
        map.set(normaliseSymbol(sym), v as TwelveDataBulkItem);
      }
      return map;
    }

    return map;
  }

  // If it’s the TOP-LEVEL record form: { "eur/usd": {...}, ... }
  if (isPlainObject(json)) {
    for (const [k, v] of Object.entries(json)) {
      if (!isPlainObject(v)) continue;
      const sym = (v.symbol as string | undefined) ?? k;
      if (!sym) continue;
      map.set(normaliseSymbol(sym), v as TwelveDataBulkItem);
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

  // ✅ LINT FIX: actually use the TwelveDataBulkResponse type
  const json = (await res.json()) as TwelveDataBulkResponse;

  // If the wrapped response exists and says "not ok", surface it.
  if (isPlainObject(json) && 'status' in json) {
    const status = String((json as { status?: unknown }).status ?? '');
    if (status && status !== 'ok') {
      const message = String((json as { message?: unknown }).message ?? 'unknown error');
      throw new Error(`Twelve Data response not ok: ${message}`);
    }
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
    lastFetch: {
      at: typeof lastFetchAtMs === 'number' ? iso(lastFetchAtMs) : undefined,
      expectedSymbols: lastExpectedSymbols,
      missingCount: lastMissingSymbols.length,
      missingSymbols: [...lastMissingSymbols],
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

      // Trace: missing symbols (this is the regression detector)
      lastFetchAtMs = nowMs();
      lastExpectedSymbols = symbols.length;
      lastMissingSymbols = symbols.filter((s) => !map.has(normaliseSymbol(s)));

      if (lastMissingSymbols.length > 0) {
        logTrace('symbol lookup misses detected', {
          missingCount: lastMissingSymbols.length,
          missingSymbols: lastMissingSymbols,
        });
      }

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
