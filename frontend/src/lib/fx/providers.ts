// frontend/src/lib/fx/providers.ts
/**
 * FX providers + caching for the finance ribbon.
 *
 * GUARANTEES (do not delete):
 * - Bulk request (N→1) ✅
 * - TTL caching ✅
 * - Single-flight de-duplication ✅
 * - 429 cooldown + ride-cache ✅
 * - SSOT-key invalidation ✅
 * - Trace snapshot includes missing symbol diagnostics ✅
 *
 * AGREED BEHAVIOUR (server truth):
 * - Always return the full SSOT list (prices may be null).
 * - A/B group caches: refresh half-at-a-time (4+4 when SSOT has 8).
 * - Weekend freeze (Europe/London): never fetch upstream on Sat/Sun.
 * - Traffic is informational only (does NOT influence TTL or refresh permission).
 */

import { createHash } from 'crypto';

import type { FxApiMeta, FxApiMode, FxApiQuote, FxApiResponse } from '@/types/finance-ribbon';
import { getDefaultFxPairsWithIndexForTier } from '@/data/fx';

type FxRibbonGroupId = 'A' | 'B';

type CacheDecision =
  | 'cache_hit'
  | 'cache_miss_refresh_A'
  | 'cache_miss_refresh_B'
  | 'singleflight_join_A'
  | 'singleflight_join_B'
  | 'weekend_freeze_ride_cache'
  | 'weekend_freeze_no_cache'
  | 'rate_limited_ride_cache'
  | 'rate_limited_no_cache'
  | 'ssot_changed_invalidate'
  | 'no_api_key_ride_cache'
  | 'no_api_key_no_cache';

export type FxRibbonTraceSnapshot = {
  // Base TTL policy (prod default remains 30 minutes unless env overrides)
  ttlSeconds: number;
  ssotKey: string;

  // Backwards-compatible “merged cache” view.
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

  weekendFreeze: {
    active: boolean;
    londonWeekday: string;
    timezone: string;
  };

  traffic: {
    windowSeconds: number;
    hitsInWindow: number;
    factor: number;
  };

  schedule: {
    cycleIndex: number;
    scheduledGroup: FxRibbonGroupId;
    cycleLengthSeconds: number;
  };

  groups: {
    A: {
      hasValue: boolean;
      asOf?: string;
      expiresAt?: string;
      inFlight: boolean;
      expectedSymbols: number;
      missingCount: number;
      missingSymbols: string[];
    };
    B: {
      hasValue: boolean;
      asOf?: string;
      expiresAt?: string;
      inFlight: boolean;
      expectedSymbols: number;
      missingCount: number;
      missingSymbols: string[];
    };
  };

  lastFetch?: {
    at?: string;
    group?: FxRibbonGroupId;
    expectedSymbols: number;
    missingCount: number;
    missingSymbols: string[];
  };
};

type FxRibbonPair = {
  id: string;
  base: string;
  quote: string;
  label: string;
  category: string;
  symbol: string;
};

type TwelveDataBulkItem = {
  symbol: string;
  rate?: string | number;
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
  | Record<string, TwelveDataBulkItem | unknown>;

export type FxProviderSummary = {
  modeLabel: string;
  emphasiseFallback: boolean;
  meta: { id: string; name: string };
};

type FxRibbonGroupCache = {
  group: FxRibbonGroupId;
  ssotKey: string;
  asOfIso: string;
  expiresAtMs: number;
  quotes: FxApiQuote[];
  expectedSymbols: number;
  missingSymbols: string[];
};

const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  'local-dev';

const LONDON_TIMEZONE = 'Europe/London';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}
function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
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

// IMPORTANT: user explicitly locked prod TTL at 30 minutes.
const BASE_TTL_SECONDS = readPositiveIntEnv('FX_RIBBON_TTL_SECONDS', isProd() ? 30 * 60 : 5 * 60);
const RATE_LIMIT_COOLDOWN_SECONDS = readPositiveIntEnv('FX_RIBBON_429_COOLDOWN_SECONDS', 10 * 60);

const TRAFFIC_WINDOW_SECONDS = readPositiveIntEnv('FX_RIBBON_TRAFFIC_WINDOW_SECONDS', 60);

const DEV_UPSTREAM_BUDGET_WINDOW_MS = readPositiveIntEnv(
  'FX_DEV_UPSTREAM_BUDGET_WINDOW_MS',
  60_000,
);
const DEV_UPSTREAM_BUDGET_MAX_CALLS = readPositiveIntEnv('FX_DEV_UPSTREAM_BUDGET_MAX_CALLS', 3);
const DEV_UPSTREAM_BUDGET_WARN_COOLDOWN_MS = readPositiveIntEnv(
  'FX_DEV_UPSTREAM_BUDGET_WARN_COOLDOWN_MS',
  30_000,
);

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

// Group caches and per-group single-flight.
let groupCacheA: FxRibbonGroupCache | null = null;
let groupCacheB: FxRibbonGroupCache | null = null;
let inFlightA: Promise<FxRibbonGroupCache> | null = null;
let inFlightB: Promise<FxRibbonGroupCache> | null = null;

// Diagnostics for trace.
let lastFetchAtMs: number | undefined;
let lastFetchGroup: FxRibbonGroupId | undefined;
let lastExpectedSymbols = 0;
let lastMissingSymbols: string[] = [];

let lastLondonWeekday = '—';
let lastWeekendFreeze = false;

const ribbonHitTimesMs: number[] = [];
let lastTrafficHits = 0;
let lastTrafficFactor = 1;

// Track upstream calls in dev so we can shout if someone accidentally multiplies fetch paths.
const upstreamCallTimesMs: number[] = [];
let lastBudgetWarnAtMs = 0;

// Schedule diagnostics
let lastCycleIndex = 0;
let lastScheduledGroup: FxRibbonGroupId = 'A';

function nowMs(): number {
  return Date.now();
}
function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function normaliseSymbol(symbol: string): string {
  const raw = String(symbol ?? '').trim();
  if (!raw) return '';

  const cleaned = raw.replace(/\s+/g, '').replace(/\\/g, '/').replace(/[_-]/g, '/').toUpperCase();

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
  const raw = orderedIds.join('|');
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 12);
  return `fxpairs:${hash}`;
}

function buildMeta(
  mode: FxApiMeta['mode'],
  sourceProvider: FxApiMeta['sourceProvider'],
  asOfIso: string,
): FxApiMeta {
  return { buildId: BUILD_ID, mode, sourceProvider, asOf: asOfIso };
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseTwelveDataBulk(json: unknown): Map<string, TwelveDataBulkItem> {
  const map = new Map<string, TwelveDataBulkItem>();
  if (!json) return map;

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

function buildRibbonPairsAndKey(): { pairs: FxRibbonPair[]; ssotKey: string } {
  const ssotPairs = getDefaultFxPairsWithIndexForTier('free');

  const orderedIds = ssotPairs.map((p) => p.id);
  const ssotKey = ssotKeyFromOrderedIds(orderedIds);

  const pairs: FxRibbonPair[] = ssotPairs.map((p) => {
    const base = p.base.toUpperCase();
    const quote = p.quote.toUpperCase();
    const label = p.label ?? `${base} / ${quote}`;
    const category = p.group ?? 'fx';
    const symbol = `${base}/${quote}`;

    return { id: p.id, base, quote, label, category, symbol };
  });

  return { pairs, ssotKey };
}

function buildEmptyQuotes(pairs: FxRibbonPair[]): FxApiQuote[] {
  return pairs.map((p) => ({
    id: p.id,
    base: p.base,
    quote: p.quote,
    label: p.label,
    category: p.category,
    price: null,
    change: null,
    changePct: null,
  }));
}

function groupSplit(pairs: FxRibbonPair[]): { A: FxRibbonPair[]; B: FxRibbonPair[] } {
  const half = Math.ceil(pairs.length / 2);
  return {
    A: pairs.slice(0, half),
    B: pairs.slice(half),
  };
}

function getLondonWeekdayShort(ms: number): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON_TIMEZONE, weekday: 'short' });
    return dtf.format(new Date(ms));
  } catch {
    // Fallback: UTC weekday
    const d = new Date(ms).getUTCDay();
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] ?? '—';
  }
}

function isWeekendLondon(ms: number): boolean {
  const wd = getLondonWeekdayShort(ms).toLowerCase();
  return wd.startsWith('sat') || wd.startsWith('sun');
}

function pruneTimes(times: number[], windowMs: number, now: number): void {
  for (;;) {
    const oldest = times.at(0);
    if (oldest === undefined) break;
    if (oldest >= now - windowMs) break;
    times.shift();
  }
}

function updateTraffic(now: number): void {
  // Traffic is observational only. It must NEVER influence TTL or refresh permission.
  const windowMs = TRAFFIC_WINDOW_SECONDS * 1000;
  ribbonHitTimesMs.push(now);
  pruneTimes(ribbonHitTimesMs, windowMs, now);

  lastTrafficHits = ribbonHitTimesMs.length;
  lastTrafficFactor = 1;
}

function nextScheduledGroup(): FxRibbonGroupId {
  // Alternation is based on the last *actual* upstream refresh, not wall-clock parity.
  // This avoids minute-parity regressions on restarts and ensures the schedule
  // only advances when a refresh truly happens.
  return lastFetchGroup === 'A' ? 'B' : 'A';
}

function isCycleDue(now: number): boolean {
  if (typeof lastFetchAtMs !== 'number') return true;
  return now - lastFetchAtMs >= BASE_TTL_SECONDS * 1000;
}

function invalidateForSsotChange(nextKey: string): void {
  if (nextKey === lastSsotKey) return;

  groupCacheA = null;
  groupCacheB = null;
  inFlightA = null;
  inFlightB = null;

  // Reset refresh authority state so the new SSOT can fetch without waiting for the old TTL window.
  lastFetchAtMs = undefined;
  lastFetchGroup = undefined;
  lastExpectedSymbols = 0;
  lastMissingSymbols = [];
  lastCycleIndex = 0;
  lastScheduledGroup = 'A';

  lastDecision = 'ssot_changed_invalidate';
  lastSsotKey = nextKey;
}

function bumpRateLimit(now: number): void {
  last429AtMs = now;
  rateLimitedUntilMs = now + RATE_LIMIT_COOLDOWN_SECONDS * 1000;

  // Extend caches so we can "ride" them during cooldown.
  if (groupCacheA)
    groupCacheA = {
      ...groupCacheA,
      expiresAtMs: Math.max(groupCacheA.expiresAtMs, rateLimitedUntilMs),
    };
  if (groupCacheB)
    groupCacheB = {
      ...groupCacheB,
      expiresAtMs: Math.max(groupCacheB.expiresAtMs, rateLimitedUntilMs),
    };
}

function isRateLimited(now: number): boolean {
  return typeof rateLimitedUntilMs === 'number' && rateLimitedUntilMs > now;
}

function logTrace(message: string, extra?: Record<string, unknown>): void {
  if (!isDev()) return;
  // Dev-only to avoid noisy prod logs.

  console.debug(`[fx.ribbon] ${message}`, extra ?? {});
}

function devUpstreamBudgetGuard(callSite: string, symbolCount: number): void {
  if (!isDev()) return;

  const now = nowMs();
  upstreamCallTimesMs.push(now);
  pruneTimes(upstreamCallTimesMs, DEV_UPSTREAM_BUDGET_WINDOW_MS, now);

  if (upstreamCallTimesMs.length <= DEV_UPSTREAM_BUDGET_MAX_CALLS) return;
  if (now - lastBudgetWarnAtMs < DEV_UPSTREAM_BUDGET_WARN_COOLDOWN_MS) return;

  lastBudgetWarnAtMs = now;

  const err = new Error('FX upstream budget exceeded');
  const stack = err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : '(no stack)';

  console.warn(
    `[fx.ribbon][DEV WARNING] Upstream calls are spiking (likely multiple fetch paths or dev HMR resets).\n` +
      `Window: ${DEV_UPSTREAM_BUDGET_WINDOW_MS}ms, calls: ${upstreamCallTimesMs.length}, max: ${DEV_UPSTREAM_BUDGET_MAX_CALLS}\n` +
      `Call site: ${callSite}, symbols: ${symbolCount}\n` +
      `Tip: check for multiple client pollers or extra endpoints calling Twelve Data.\n` +
      `${stack}`,
  );
}

async function fetchTwelveDataBulkExchangeRates(
  symbols: string[],
  callSite: string,
): Promise<Map<string, TwelveDataBulkItem>> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('Missing TWELVEDATA_API_KEY');

  devUpstreamBudgetGuard(callSite, symbols.length);

  const endpoint = 'exchange_rate';
  const baseUrl = 'https://api.twelvedata.com';
  const url = new URL(`${baseUrl}/${endpoint}`);

  url.searchParams.set('symbol', symbols.join(','));

  counters.upstreamCalls += 1;
  counters.upstreamSymbolsTotal += symbols.length;

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      // Twelve Data docs recommend this header form.
      Authorization: `apikey ${apiKey}`,
      accept: 'application/json',
    },
  });

  if (res.status === 429) {
    bumpRateLimit(nowMs());
    throw new Error('Twelve Data rate-limited (429)');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Twelve Data error: ${res.status} ${res.statusText}${body ? ` – ${body}` : ''}`,
    );
  }

  const json = (await res.json()) as TwelveDataBulkResponse;

  if (isPlainObject(json) && 'status' in json) {
    const status = String((json as { status?: unknown }).status ?? '');
    if (status && status !== 'ok') {
      const message = String((json as { message?: unknown }).message ?? 'unknown error');
      throw new Error(`Twelve Data response not ok: ${message}`);
    }
  }

  return parseTwelveDataBulk(json);
}

function getGroupRideCache(group: FxRibbonGroupId, ssotKey: string): FxRibbonGroupCache | null {
  const cache = group === 'A' ? groupCacheA : groupCacheB;
  if (!cache) return null;
  if (cache.ssotKey !== ssotKey) return null;
  return cache;
}

function getGroupFreshCache(
  group: FxRibbonGroupId,
  ssotKey: string,
  now: number,
): FxRibbonGroupCache | null {
  const cache = getGroupRideCache(group, ssotKey);
  if (!cache) return null;

  // IMPORTANT: group validity is policy TTL × 2 because each group refreshes every other cycle.
  // expiresAtMs is the single source of truth for freshness.
  if (cache.expiresAtMs <= now) return null;

  return cache;
}

function setGroupCache(next: FxRibbonGroupCache): void {
  if (next.group === 'A') groupCacheA = next;
  else groupCacheB = next;
}

function groupInFlight(group: FxRibbonGroupId): Promise<FxRibbonGroupCache> | null {
  return group === 'A' ? inFlightA : inFlightB;
}

function setGroupInFlight(group: FxRibbonGroupId, p: Promise<FxRibbonGroupCache> | null): void {
  if (group === 'A') inFlightA = p;
  else inFlightB = p;
}

function groupPairsToQuotes(
  pairs: FxRibbonPair[],
  map: Map<string, TwelveDataBulkItem>,
): FxApiQuote[] {
  return pairs.map((pair) => {
    const sym = normaliseSymbol(pair.symbol);
    const rate = parseRate(map.get(sym));

    return {
      id: pair.id,
      base: pair.base,
      quote: pair.quote,
      label: pair.label,
      category: pair.category,
      price: rate,
      change: null,
      changePct: null,
    };
  });
}

function mergeQuotesInSsotOrder(params: {
  ssotPairs: FxRibbonPair[];
  groupA: FxRibbonGroupCache | null;
  groupB: FxRibbonGroupCache | null;
}): FxApiQuote[] {
  const byId = new Map<string, FxApiQuote>();

  // Start with a complete, stable list (all null prices).
  for (const q of buildEmptyQuotes(params.ssotPairs)) byId.set(q.id, q);

  // Overlay whichever caches we have.
  for (const cache of [params.groupA, params.groupB]) {
    if (!cache) continue;
    for (const q of cache.quotes) byId.set(q.id, q);
  }

  return params.ssotPairs.map(
    (p) =>
      byId.get(p.id) ?? {
        id: p.id,
        base: p.base,
        quote: p.quote,
        label: p.label,
        category: p.category,
        price: null,
        change: null,
        changePct: null,
      },
  );
}

function newestAsOfIso(
  groupA: FxRibbonGroupCache | null,
  groupB: FxRibbonGroupCache | null,
): string {
  const a = groupA?.asOfIso;
  const b = groupB?.asOfIso;
  if (a && b) return Date.parse(a) >= Date.parse(b) ? a : b;
  return a ?? b ?? new Date().toISOString();
}

async function refreshGroup(params: {
  group: FxRibbonGroupId;
  ssotKey: string;
  pairs: FxRibbonPair[];
  symbols: string[];
  now: number;
}): Promise<FxRibbonGroupCache> {
  const { group, ssotKey, pairs, symbols, now } = params;

  const existingInFlight = groupInFlight(group);
  if (existingInFlight) {
    lastDecision = group === 'A' ? 'singleflight_join_A' : 'singleflight_join_B';
    logTrace('single-flight join', { group, ssotKey });
    return existingInFlight;
  }

  const decision: CacheDecision = group === 'A' ? 'cache_miss_refresh_A' : 'cache_miss_refresh_B';
  lastDecision = decision;

  // Refresh counter (trace-only). This increments only when we start a new upstream call.
  lastCycleIndex += 1;

  const promise = (async () => {
    try {
      const map = await fetchTwelveDataBulkExchangeRates(symbols, `fx_ribbon_group_${group}`);

      lastFetchAtMs = nowMs();
      lastFetchGroup = group;
      lastExpectedSymbols = symbols.length;

      const missing: string[] = [];
      for (const pair of pairs) {
        const sym = normaliseSymbol(pair.symbol);
        if (!map.has(sym)) missing.push(`${pair.id} -> ${pair.symbol}`);
      }
      lastMissingSymbols = missing;

      if (missing.length > 0) {
        logTrace('symbol lookup misses detected', {
          group,
          missingCount: missing.length,
          missingSymbols: missing,
        });
      }

      const quotes = groupPairsToQuotes(pairs, map);
      const asOfIso = new Date().toISOString();

      const cache: FxRibbonGroupCache = {
        group,
        ssotKey,
        asOfIso,
        // Each group refreshes every other cycle ⇒ hold window is 2× policy TTL.
        expiresAtMs: now + BASE_TTL_SECONDS * 2 * 1000,
        quotes,
        expectedSymbols: symbols.length,
        missingSymbols: missing,
      };

      setGroupCache(cache);

      lastError = undefined;

      logTrace('fetch ok → cached', {
        group,
        ssotKey,
        quoteCount: quotes.length,
        expiresAt: iso(cache.expiresAtMs),
      });

      return cache;
    } finally {
      setGroupInFlight(group, null);
    }
  })();

  setGroupInFlight(group, promise);

  return promise;
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

  return { modeLabel, emphasiseFallback: mode === 'fallback', meta: { id, name } };
}

export function getFxRibbonTraceSnapshot(): FxRibbonTraceSnapshot {
  const rideA = getGroupRideCache('A', lastSsotKey);
  const rideB = getGroupRideCache('B', lastSsotKey);

  const mergedHasValue = Boolean(rideA || rideB);
  const mergedAsOf = newestAsOfIso(rideA, rideB);

  const mergedExpiresAtMsCandidates: number[] = [];
  if (rideA) mergedExpiresAtMsCandidates.push(rideA.expiresAtMs);
  if (rideB) mergedExpiresAtMsCandidates.push(rideB.expiresAtMs);

  const mergedExpiresAtMs = mergedExpiresAtMsCandidates.length
    ? Math.min(...mergedExpiresAtMsCandidates)
    : undefined;

  return {
    ttlSeconds: BASE_TTL_SECONDS,
    ssotKey: lastSsotKey,
    cache: {
      hasValue: mergedHasValue,
      asOf: mergedHasValue ? mergedAsOf : undefined,
      expiresAt: typeof mergedExpiresAtMs === 'number' ? iso(mergedExpiresAtMs) : undefined,
      key: lastSsotKey,
    },
    inFlight: Boolean(inFlightA || inFlightB),
    lastDecision,
    lastError,
    counters: { ...counters },
    rateLimit: {
      until: typeof rateLimitedUntilMs === 'number' ? iso(rateLimitedUntilMs) : undefined,
      last429At: typeof last429AtMs === 'number' ? iso(last429AtMs) : undefined,
      cooldownSeconds: RATE_LIMIT_COOLDOWN_SECONDS,
    },
    weekendFreeze: {
      active: lastWeekendFreeze,
      londonWeekday: lastLondonWeekday,
      timezone: LONDON_TIMEZONE,
    },
    traffic: {
      windowSeconds: TRAFFIC_WINDOW_SECONDS,
      hitsInWindow: lastTrafficHits,
      factor: lastTrafficFactor,
    },
    schedule: {
      cycleIndex: lastCycleIndex,
      scheduledGroup: lastScheduledGroup,
      cycleLengthSeconds: BASE_TTL_SECONDS,
    },
    groups: {
      A: {
        hasValue: Boolean(rideA),
        asOf: rideA?.asOfIso,
        expiresAt: rideA ? iso(rideA.expiresAtMs) : undefined,
        inFlight: Boolean(inFlightA),
        expectedSymbols: rideA?.expectedSymbols ?? 0,
        missingCount: rideA?.missingSymbols.length ?? 0,
        missingSymbols: rideA?.missingSymbols ?? [],
      },
      B: {
        hasValue: Boolean(rideB),
        asOf: rideB?.asOfIso,
        expiresAt: rideB ? iso(rideB.expiresAtMs) : undefined,
        inFlight: Boolean(inFlightB),
        expectedSymbols: rideB?.expectedSymbols ?? 0,
        missingCount: rideB?.missingSymbols.length ?? 0,
        missingSymbols: rideB?.missingSymbols ?? [],
      },
    },
    lastFetch: {
      at: typeof lastFetchAtMs === 'number' ? iso(lastFetchAtMs) : undefined,
      group: lastFetchGroup,
      expectedSymbols: lastExpectedSymbols,
      missingCount: lastMissingSymbols.length,
      missingSymbols: [...lastMissingSymbols],
    },
  };
}

/**
 * TTL used by the API route for Cache-Control headers.
 * This returns the policy TTL (fixed; traffic does not affect it).
 */
export function getFxRibbonTtlSeconds(): number {
  return BASE_TTL_SECONDS;
}

function safeModeFromDidFetch(didFetch: boolean): FxApiMode {
  return didFetch ? 'live' : 'cached';
}

export async function getFxRibbon(): Promise<FxApiResponse> {
  counters.ribbonCalls += 1;

  const now = nowMs();
  updateTraffic(now);

  lastLondonWeekday = getLondonWeekdayShort(now);
  lastWeekendFreeze = isWeekendLondon(now);

  const { pairs, ssotKey } = buildRibbonPairsAndKey();
  invalidateForSsotChange(ssotKey);

  const split = groupSplit(pairs);
  const symbolsA = uniqueStrings(split.A.map((p) => normaliseSymbol(p.symbol)));
  const symbolsB = uniqueStrings(split.B.map((p) => normaliseSymbol(p.symbol)));

  // Next scheduled group is derived from the last successful refresh (state), not wall-clock parity.
  const scheduledGroup = nextScheduledGroup();
  lastScheduledGroup = scheduledGroup;

  const hasApiKey = Boolean(process.env.TWELVEDATA_API_KEY);

  // “Ride-cache” views (may be stale, but still useful for stable UI)
  const rideA = getGroupRideCache('A', ssotKey);
  const rideB = getGroupRideCache('B', ssotKey);

  // “Fresh” views (used only to decide whether to fetch upstream)
  const freshA = getGroupFreshCache('A', ssotKey, now);
  const freshB = getGroupFreshCache('B', ssotKey, now);

  // Global “no upstream calls” states.
  if (lastWeekendFreeze) {
    const hasAnyCache = Boolean(rideA || rideB);
    lastDecision = hasAnyCache ? 'weekend_freeze_ride_cache' : 'weekend_freeze_no_cache';

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
      error: hasAnyCache ? undefined : 'Weekend freeze (no cache available)',
    });
  }

  // In tests, never call upstream unless explicitly allowed.
  const isTest = process.env.NODE_ENV === 'test';
  const allowUpstreamInTests = process.env.FX_ALLOW_UPSTREAM_IN_TESTS === 'true';

  if (!hasApiKey || (isTest && !allowUpstreamInTests)) {
    const hasAnyCache = Boolean(rideA || rideB);
    lastDecision = hasAnyCache ? 'no_api_key_ride_cache' : 'no_api_key_no_cache';

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
      error: hasAnyCache ? undefined : 'Missing TWELVEDATA_API_KEY',
    });
  }

  if (isRateLimited(now)) {
    const hasAnyCache = Boolean(rideA || rideB);
    lastDecision = hasAnyCache ? 'rate_limited_ride_cache' : 'rate_limited_no_cache';

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
      error: hasAnyCache ? undefined : 'Rate-limited (no cache available)',
    });
  }

  // A/B refresh policy: only the scheduled half can refresh this cycle.
  const scheduled = scheduledGroup;
  const scheduledFresh = scheduled === 'A' ? freshA : freshB;

  // Global TTL gate: at most ONE upstream call per policy TTL window, regardless of traffic.
  const cycleDue = isCycleDue(now);
  const hasAnyCache = Boolean(rideA || rideB);

  // If we are still inside the TTL window, serve cache (ride-cache) and do not refresh.
  // Exception: if we have no cache at all, allow bootstrap refresh.
  if (!cycleDue && hasAnyCache) {
    lastDecision = 'cache_hit';

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
    });
  }

  // If scheduled half is still fresh, we do not fetch.
  if (scheduledFresh) {
    lastDecision = 'cache_hit';

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
    });
  }

  // Cache miss for the scheduled half ⇒ refresh *only that half*.
  try {
    const refreshed =
      scheduled === 'A'
        ? await refreshGroup({
            group: 'A',
            ssotKey,
            pairs: split.A,
            symbols: symbolsA,
            now,
          })
        : await refreshGroup({
            group: 'B',
            ssotKey,
            pairs: split.B,
            symbols: symbolsB,
            now,
          });

    const nextA = scheduled === 'A' ? refreshed : getGroupRideCache('A', ssotKey);
    const nextB = scheduled === 'B' ? refreshed : getGroupRideCache('B', ssotKey);

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: nextA, groupB: nextB });
    const asOfIso = newestAsOfIso(nextA, nextB);

    return buildResponse({
      mode: safeModeFromDidFetch(true),
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastError = message;

    // If we have *any* cache (even stale), serve it; otherwise return a full null-price list with an error.
    const fallbackA = getGroupRideCache('A', ssotKey);
    const fallbackB = getGroupRideCache('B', ssotKey);

    const hasAnyCache = Boolean(fallbackA || fallbackB);
    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: fallbackA, groupB: fallbackB });
    const asOfIso = newestAsOfIso(fallbackA, fallbackB);

    return buildResponse({
      mode: safeModeFromDidFetch(false),
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
      error: hasAnyCache ? undefined : message,
    });
  }
}
