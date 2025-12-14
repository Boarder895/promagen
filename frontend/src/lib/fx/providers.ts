// C:\Users\Proma\Projects\promagen\frontend\src\lib\fx\providers.ts
// -----------------------------------------------------------------------------
// FX provider + server-side ribbon loader (Twelve Data only).
//
// Rules (as requested):
// - Disregard all API providers apart from Twelve Data.
// - No demo mode. No demo fallback. Ever.
// - SSOT for ribbon pairs is derived from:
//     src/data/fx/fx.pairs.json + src/data/fx/pairs.json (via fx-pairs.ts)
// - Cache results server-side to protect quotas.
// - NO hard-coded cap. Whatever SSOT returns is what we request.
//
// Upgrades implemented here:
// 1) TTL configurable by env (default: 30m prod, 5m dev).
// 2) Internal counter/trace for upstream calls (proof of bulk/cached/single-flight).
//
// Big wins:
// - ONE upstream call for ALL ribbon symbols (bulk exchange_rate request).
// - Single-flight de-duplication: concurrent callers share one upstream call.
// - Backoff on 429s: extend TTL and ride cache during rate limits.
// -----------------------------------------------------------------------------

import rawProviders from '@/data/fx/providers.json';
import { assertFxRibbonSsotValid, getFxRibbonPairs, buildSlashPair } from '@/lib/finance/fx-pairs';
import type { FxApiResponse, FxApiQuote, FxApiMode } from '@/types/finance-ribbon';

export type FxProviderTier = 'primary' | 'fallback' | 'unknown';

export interface FxProviderMeta {
  id: string;
  name: string;
  tier: FxProviderTier | string;
  role: string;
  url: string;
  copy: string;
}

const PROVIDERS: FxProviderMeta[] = (rawProviders as FxProviderMeta[])
  .map((p) => ({ ...p, id: String(p.id).toLowerCase() }))
  .filter((p) => p.id === 'twelvedata'); // enforce Twelve Data only

const providersById = new Map<string, FxProviderMeta>();
for (const provider of PROVIDERS) providersById.set(provider.id, provider);

export function getFxProviderMeta(id: string | null | undefined): FxProviderMeta | null {
  if (!id) return null;
  return providersById.get(id.toLowerCase()) ?? null;
}

export interface FxProviderSummary {
  meta: FxProviderMeta;
  modeLabel: string;
  provenanceLabel: string;
  emphasiseFallback: boolean;
}

export function getFxProviderSummary(
  mode: FxApiMode | null | undefined,
  providerId: string | null | undefined,
): FxProviderSummary {
  const meta = getFxProviderMeta(providerId) ??
    getFxProviderMeta('twelvedata') ?? {
      id: 'twelvedata',
      name: 'Twelve Data',
      tier: 'primary',
      role: 'Primary FX provider',
      url: 'https://twelvedata.com',
      copy: 'Primary live FX quotes provider (Twelve Data).',
    };

  const modeLabel = mode === 'cached' ? 'Cached data' : 'Live data';

  return {
    meta,
    modeLabel,
    provenanceLabel: meta.copy,
    emphasiseFallback: false, // there is no fallback
  };
}

// -----------------------------------------------------------------------------
// Config (ENV)
// -----------------------------------------------------------------------------

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

// TTL in seconds:
// - Production default: 1800s (30 minutes)
// - Dev default: 300s (5 minutes)
const DEFAULT_TTL_SECONDS = process.env.NODE_ENV === 'production' ? 30 * 60 : 5 * 60;

// Allowable range: 10s .. 6h
const CACHE_TTL_SECONDS = readPositiveIntEnv(
  'FX_RIBBON_CACHE_TTL_SECONDS',
  DEFAULT_TTL_SECONDS,
  10,
  6 * 60 * 60,
);
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

// Trace toggle (logs + optional headers via route)
const TRACE_ENABLED = (process.env.FX_RIBBON_TRACE ?? '').trim() === '1';

// Backoff base/max in seconds (optional; safe defaults)
const BACKOFF_BASE_SECONDS = readPositiveIntEnv('FX_RIBBON_BACKOFF_BASE_SECONDS', 60, 5, 30 * 60); // default 60s
const BACKOFF_MAX_SECONDS = readPositiveIntEnv(
  'FX_RIBBON_BACKOFF_MAX_SECONDS',
  15 * 60,
  30,
  60 * 60,
); // default 15m

// -----------------------------------------------------------------------------
// Trace / counters (in-memory, per server process)
// -----------------------------------------------------------------------------

type FxRibbonDecision =
  | 'cache_hit'
  | 'single_flight_wait'
  | 'upstream_fetch'
  | 'rate_limited_cache'
  | 'rate_limited_no_cache'
  | 'upstream_error_cache'
  | 'upstream_error_no_cache';

type FxRibbonCounters = {
  callsTotal: number;
  cacheHits: number;
  singleFlightWaits: number;
  upstreamFetches: number;
  rateLimitedServes: number;
  errors: number;
};

type FxRibbonTraceSnapshot = {
  enabled: boolean;
  lastDecision: FxRibbonDecision;
  lastFetchId: string | null;
  lastUpstreamAtIso: string | null;
  lastSymbolsCount: number | null;
  lastUniqueSymbolsCount: number | null;
  ttlSeconds: number;
  rateLimitedUntilIso: string | null;
  counters: FxRibbonCounters;
};

const counters: FxRibbonCounters = {
  callsTotal: 0,
  cacheHits: 0,
  singleFlightWaits: 0,
  upstreamFetches: 0,
  rateLimitedServes: 0,
  errors: 0,
};

let lastDecision: FxRibbonDecision = 'cache_hit';
let lastFetchId: string | null = null;
let lastUpstreamAtIso: string | null = null;
let lastSymbolsCount: number | null = null;
let lastUniqueSymbolsCount: number | null = null;

function traceLog(message: string, extra?: Record<string, unknown>) {
  if (!TRACE_ENABLED) return;
  const base = {
    scope: 'fx.ribbon',
    ttlSeconds: CACHE_TTL_SECONDS,
    decision: lastDecision,
    fetchId: lastFetchId,
  };
  console.info(message, { ...base, ...(extra ?? {}) });
}

export function getFxRibbonTraceSnapshot(): FxRibbonTraceSnapshot {
  return {
    enabled: TRACE_ENABLED,
    lastDecision,
    lastFetchId,
    lastUpstreamAtIso,
    lastSymbolsCount,
    lastUniqueSymbolsCount,
    ttlSeconds: CACHE_TTL_SECONDS,
    rateLimitedUntilIso:
      rateLimitedUntilMs > Date.now() ? new Date(rateLimitedUntilMs).toISOString() : null,
    counters: { ...counters },
  };
}

// -----------------------------------------------------------------------------
// Server-side cache + single-flight + 429 backoff
// -----------------------------------------------------------------------------

type FxRibbonCache = {
  expiresAt: number;
  payload: FxApiResponse;
};

let ribbonCache: FxRibbonCache | null = null;

// Single-flight: if many requests arrive concurrently, they all await the same promise.
let ribbonInFlight: Promise<FxApiResponse> | null = null;

// 429 backoff state
let rateLimitedUntilMs = 0;
let rateLimitBackoffMs = BACKOFF_BASE_SECONDS * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function buildId(): string {
  return process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev';
}

function buildResponse(mode: FxApiMode, quotes: FxApiQuote[]): FxApiResponse {
  return {
    meta: {
      buildId: buildId(),
      mode,
      sourceProvider: 'twelvedata',
      asOf: nowIso(),
    },
    data: quotes,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  const n =
    typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

class RateLimitedError extends Error {
  public readonly status = 429;

  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>');
      const msg = `HTTP ${res.status} for ${url} :: ${body.slice(0, 200)}`;
      if (res.status === 429) throw new RateLimitedError(msg);
      throw new Error(msg);
    }

    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// Twelve Data bulk FX fetch (one request, many symbols)
// We use /exchange_rate with symbol=EUR/USD,GBP/USD,... (comma-separated)
// -----------------------------------------------------------------------------

type TwelveDataExchangeRateItem = {
  symbol?: string;
  rate?: string | number;
  price?: string | number;
  close?: string | number;
  status?: string;
  message?: string;
  code?: number | string;
};

function looksRateLimitedPayload(raw: unknown): boolean {
  if (!isRecord(raw)) return false;

  const status = typeof raw.status === 'string' ? raw.status.toLowerCase() : '';
  const msg = typeof raw.message === 'string' ? raw.message.toLowerCase() : '';
  const code = raw.code;

  const codeNum =
    typeof code === 'number' ? code : typeof code === 'string' ? Number(code) : Number.NaN;

  return (
    status === 'error' &&
    (codeNum === 429 ||
      msg.includes('too many') ||
      msg.includes('rate limit') ||
      msg.includes('minute') ||
      msg.includes('limit'))
  );
}

function parseExchangeRateValue(item: unknown): number | null {
  if (!isRecord(item)) return null;
  const it = item as TwelveDataExchangeRateItem;

  if (typeof it.status === 'string' && it.status.toLowerCase() === 'error') return null;

  const v = it.rate ?? it.price ?? it.close;
  return toFiniteNumber(v);
}

async function fetchTwelveDataBulkExchangeRates(
  symbols: string[],
  apiKey: string,
): Promise<Map<string, number | null>> {
  const endpoint = new URL('https://api.twelvedata.com/exchange_rate');
  endpoint.searchParams.set('symbol', symbols.join(','));
  endpoint.searchParams.set('apikey', apiKey);

  const raw = await fetchJsonWithTimeout(endpoint.toString(), 8_000);

  // Sometimes 200 OK but payload is {status:"error", code:429, ...}
  if (looksRateLimitedPayload(raw)) {
    throw new RateLimitedError(`Twelve Data rate-limited payload for ${endpoint.toString()}`);
  }

  // Sometimes 200 OK but payload is {status:"error", message:"..."}
  if (isRecord(raw)) {
    const status = typeof raw.status === 'string' ? raw.status.toLowerCase() : '';
    if (status === 'error') {
      const msg = typeof raw.message === 'string' ? raw.message : 'Unknown Twelve Data error';
      throw new Error(`FX: Twelve Data error: ${msg}`);
    }
  }

  const out = new Map<string, number | null>();

  // Format A: array of items [{symbol, rate}, ...]
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const sym =
        typeof (item as TwelveDataExchangeRateItem).symbol === 'string'
          ? String((item as TwelveDataExchangeRateItem).symbol)
          : null;
      if (!sym) continue;
      out.set(sym, parseExchangeRateValue(item));
    }
    for (const s of symbols) if (!out.has(s)) out.set(s, null);
    return out;
  }

  // Format B: single item {symbol, rate}
  if (isRecord(raw) && ('rate' in raw || 'price' in raw || 'close' in raw)) {
    const sym =
      typeof raw.symbol === 'string' ? raw.symbol : symbols.length === 1 ? symbols[0] : null;

    if (sym) out.set(sym, parseExchangeRateValue(raw));
    for (const s of symbols) if (!out.has(s)) out.set(s, null);
    return out;
  }

  // Format C: object keyed by symbol { "EUR/USD": {...}, "GBP/USD": {...}, ... }
  if (isRecord(raw)) {
    for (const s of symbols) {
      out.set(s, parseExchangeRateValue(raw[s]));
    }
    return out;
  }

  throw new Error('FX: Unexpected Twelve Data response format for bulk exchange_rate.');
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

export async function getFxRibbon(): Promise<FxApiResponse> {
  counters.callsTotal += 1;

  const now = Date.now();

  // If currently rate-limited: do not attempt upstream calls.
  if (now < rateLimitedUntilMs) {
    if (ribbonCache) {
      counters.rateLimitedServes += 1;
      lastDecision = 'rate_limited_cache';
      traceLog('[fx.ribbon] rate-limited; serving cache', {
        rateLimitedUntil: new Date(rateLimitedUntilMs).toISOString(),
      });

      return {
        ...ribbonCache.payload,
        meta: {
          ...ribbonCache.payload.meta,
          mode: 'cached',
        },
      };
    }

    counters.errors += 1;
    lastDecision = 'rate_limited_no_cache';
    traceLog('[fx.ribbon] rate-limited; no cache available');

    throw new RateLimitedError('FX: Rate-limited and no cache available.');
  }

  // Cache hit
  if (ribbonCache && ribbonCache.expiresAt > now) {
    counters.cacheHits += 1;
    lastDecision = 'cache_hit';
    traceLog('[fx.ribbon] cache hit');

    return {
      ...ribbonCache.payload,
      meta: {
        ...ribbonCache.payload.meta,
        mode: 'cached',
      },
    };
  }

  // Single-flight: if another request is already fetching, await it.
  if (ribbonInFlight) {
    counters.singleFlightWaits += 1;
    lastDecision = 'single_flight_wait';
    traceLog('[fx.ribbon] single-flight wait');
    return ribbonInFlight;
  }

  ribbonInFlight = (async () => {
    const fetchId = `fx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    lastFetchId = fetchId;

    try {
      assertFxRibbonSsotValid();

      // SSOT-driven list (free tier by default) – NO trimming here.
      const pairs = getFxRibbonPairs({ tier: 'free', order: 'ssot' });

      const twelveKey = (process.env.TWELVEDATA_API_KEY ?? '').trim();
      if (!twelveKey) {
        throw new Error(
          'FX: TWELVEDATA_API_KEY is missing. Twelve Data is the only allowed provider.',
        );
      }

      if (!pairs || pairs.length === 0) {
        throw new Error('FX: SSOT returned zero ribbon pairs.');
      }

      // Build symbol list in SSOT order
      const symbolsInOrder: string[] = pairs.map((p) => {
        const base = String(p.base ?? '').toUpperCase();
        const quote = String(p.quote ?? '').toUpperCase();
        return buildSlashPair(base, quote);
      });

      // De-dupe for request (keeps order for UI using original list)
      const uniqueSymbols = Array.from(new Set(symbolsInOrder));

      lastSymbolsCount = symbolsInOrder.length;
      lastUniqueSymbolsCount = uniqueSymbols.length;

      counters.upstreamFetches += 1;
      lastDecision = 'upstream_fetch';
      lastUpstreamAtIso = nowIso();

      traceLog('[fx.ribbon] upstream fetch (bulk)', {
        symbols: symbolsInOrder.length,
        uniqueSymbols: uniqueSymbols.length,
        endpoint: 'exchange_rate',
      });

      // ONE bulk request for all symbols
      const ratesBySymbol = await fetchTwelveDataBulkExchangeRates(uniqueSymbols, twelveKey);

      const quotes: FxApiQuote[] = [];
      let anyPrice = false;

      for (const p of pairs) {
        const base = String(p.base ?? '').toUpperCase();
        const quote = String(p.quote ?? '').toUpperCase();
        const slash = buildSlashPair(base, quote);

        const price = ratesBySymbol.get(slash) ?? null;
        if (price !== null) anyPrice = true;

        quotes.push({
          id: String(p.id), // must match SSOT id (e.g. "gbp-usd") for the UI join
          base,
          quote,
          label: String(p.label ?? `${base} / ${quote}`),
          category: String(p.category ?? 'fx'),
          price,
          change: null,
          changePct: null,
        });
      }

      if (!anyPrice) {
        throw new Error('FX: Twelve Data returned no valid prices for the ribbon pairs.');
      }

      const payload = buildResponse('live', quotes);

      // Store cache
      ribbonCache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };

      // Success resets backoff
      rateLimitedUntilMs = 0;
      rateLimitBackoffMs = BACKOFF_BASE_SECONDS * 1000;

      traceLog('[fx.ribbon] upstream fetch success', {
        cachedForSeconds: CACHE_TTL_SECONDS,
      });

      return payload;
    } catch (err: unknown) {
      // 429 backoff behaviour:
      // - Extend TTL (if we have cache) and serve cached result
      // - Exponential backoff up to a cap
      if (err instanceof RateLimitedError) {
        const nowInner = Date.now();

        rateLimitedUntilMs = nowInner + rateLimitBackoffMs;
        rateLimitBackoffMs = Math.min(rateLimitBackoffMs * 2, BACKOFF_MAX_SECONDS * 1000);

        if (ribbonCache) {
          counters.rateLimitedServes += 1;
          lastDecision = 'rate_limited_cache';

          // Extend cache so we ride it during the cool-down
          ribbonCache.expiresAt = Math.max(ribbonCache.expiresAt, rateLimitedUntilMs);

          traceLog('[fx.ribbon] rate-limited; serving cache + extending TTL', {
            rateLimitedUntil: new Date(rateLimitedUntilMs).toISOString(),
            nextBackoffMs: rateLimitBackoffMs,
          });

          return {
            ...ribbonCache.payload,
            meta: {
              ...ribbonCache.payload.meta,
              mode: 'cached',
            },
          };
        }

        counters.errors += 1;
        lastDecision = 'rate_limited_no_cache';
        traceLog('[fx.ribbon] rate-limited; no cache available (throwing)', {
          rateLimitedUntil: new Date(rateLimitedUntilMs).toISOString(),
          nextBackoffMs: rateLimitBackoffMs,
        });

        throw err;
      }

      // Non-429 failure: if cache exists, serve it (economical + resilient)
      if (ribbonCache) {
        counters.errors += 1;
        lastDecision = 'upstream_error_cache';
        traceLog('[fx.ribbon] upstream error; serving cache', {
          error: err instanceof Error ? err.message : String(err),
        });

        return {
          ...ribbonCache.payload,
          meta: {
            ...ribbonCache.payload.meta,
            mode: 'cached',
          },
        };
      }

      counters.errors += 1;
      lastDecision = 'upstream_error_no_cache';
      traceLog('[fx.ribbon] upstream error; no cache available (throwing)', {
        error: err instanceof Error ? err.message : String(err),
      });

      throw err;
    } finally {
      ribbonInFlight = null;
    }
  })();

  return ribbonInFlight;
}
