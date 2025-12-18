// frontend/src/lib/fx/providers.ts
/**
 * FX providers + caching + refresh authority (SSOT aligned).
 *
 * Guarantees (per promagen-api-brain-v2.md):
 * - Bulk-only upstream request (N→1) ✅
 * - TTL caching ✅
 * - Single-flight de-duplication ✅
 * - Group A/B slicing with alternation ✅
 * - Trace / traffic is observational only (no influence on refresh permission) ✅
 * - Weekend freeze (Europe/London) ✅
 *
 * NOTE: This file is the refresh authority. Any upstream eligibility decision MUST live here.
 */

import { assertFxRibbonSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

import type { FxApiMode as FxRibbonUiApiMode } from '@/types/finance-ribbon';

export type FxRibbonGroupId = 'A' | 'B';

export type FxRibbonPair = {
  id: string;
  base: string;
  quote: string;
};

export type FxRibbonQuote = {
  id: string;
  base: string;
  quote: string;
  // price may be null when we must serve a placeholder (no cache and blocked/frozen).
  price: number | null;
  providerSymbol?: string;
};

type FxApiMode = 'live' | 'cached';

type FxApiError =
  | 'Weekend freeze (no cache available)'
  | 'Missing TWELVEDATA_API_KEY'
  | 'Rate-limited (no cache available)'
  | string;

type FxApiBudgetMeta = {
  state: FxRibbonBudgetState;
  emoji?: string;
};

type FxApiMeta = {
  mode: FxApiMode;
  sourceProvider: 'twelvedata';
  asOf?: string; // ISO
  ttlSeconds: number;
  // Budget indicator is informational only; the server is the authority.
  budget?: FxApiBudgetMeta;
};

export type FxApiResponse = {
  meta: FxApiMeta;
  data: FxRibbonQuote[];
  error?: FxApiError;
};

export type CacheDecision =
  | 'cache_hit'
  | 'cache_miss_refresh_A'
  | 'cache_miss_refresh_B'
  | 'singleflight_join_A'
  | 'singleflight_join_B'
  | 'rate_limited_ride_cache'
  | 'rate_limited_no_cache'
  | 'weekend_freeze_ride_cache'
  | 'weekend_freeze_no_cache'
  | 'no_api_key_ride_cache'
  | 'no_api_key_no_cache'
  | 'budget_blocked'
  | 'budget_blocked_ride_cache'
  | 'budget_blocked_no_cache';

export type FxRibbonTraceSnapshot = {
  // Base TTL policy (prod default remains 30 minutes unless env overrides)
  ttlSeconds: number;
  ssotKey: string;

  inFlight: boolean;
  budget: FxRibbonBudgetSnapshot;
  budgetIndicator: FxRibbonBudgetIndicator;

  // Backwards-compatible “merged cache” view.
  cache: {
    hasValue: boolean;
    asOf?: string;
    expiresAt?: string;
    key?: string;
  };

  lastDecision?: CacheDecision;
  lastError?: string;

  // Minimal counters (observational only)
  counters: {
    ribbonCalls: number;
    upstreamCalls: number;
    upstream429s: number;
  };

  rateLimit: {
    // Optional for backwards-compat with older callers' empty snapshots.
    isLimited?: boolean;
    until?: string;
    last429At?: string;
  };

  weekendFreeze: {
    isWeekendLondon: boolean;
    londonWeekday?: string;
    timezone: string;
  };

  traffic: {
    // window size used for observational trace only
    windowSeconds: number;
    hitsInWindow: number;
    factor: number;
  };

  schedule: {
    cycleIndex: number;
    scheduledGroup: FxRibbonGroupId;
    cycleLengthSeconds: number;
    // Optional for backwards-compat with older callers' empty snapshots.
    cycleDue?: boolean;
  };

  // Group snapshots (ride cache)
  groups: {
    A: {
      hasValue: boolean;
      asOf?: string;
      expiresAt?: string;
      key?: string;
      inFlight: boolean;
      expectedSymbols: number;
      missingCount: number;
      missingSymbols: string[];
    };
    B: {
      hasValue: boolean;
      asOf?: string;
      expiresAt?: string;
      key?: string;
      inFlight: boolean;
      expectedSymbols: number;
      missingCount: number;
      missingSymbols: string[];
    };
  };

  lastFetch: {
    at?: string;
    group?: FxRibbonGroupId;
    expectedSymbols: number;
    missingCount: number;
    missingSymbols: string[];
  };
};

type TwelveDataBulkItem = {
  symbol: string;
  rate: string | number;
  timestamp?: string; // seconds or ISO, sometimes absent in batch
};

type TwelveDataBulkResponse =
  | {
      status?: string;
      message?: string;
      data?: TwelveDataBulkItem[] | Record<string, TwelveDataBulkItem | unknown>;
    }
  | Record<string, TwelveDataBulkItem | unknown>;

const LONDON_TIMEZONE = 'Europe/London';

function nowMs(): number {
  return Date.now();
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

// IMPORTANT: user explicitly locked prod TTL at 30 minutes.
const BASE_TTL_SECONDS = readPositiveIntEnv('FX_RIBBON_TTL_SECONDS', isProd() ? 1800 : 300);

// Rate-limit cooldown after 429 (seconds)
const RATE_LIMIT_COOLDOWN_SECONDS = readPositiveIntEnv(
  'FX_RIBBON_RATE_LIMIT_COOLDOWN_SECONDS',
  120,
);

// Traffic window used for observational trace only (ms)
const TRAFFIC_WINDOW_MS = readPositiveIntEnv('FX_RIBBON_TRAFFIC_WINDOW_MS', 60_000);

// Dev guard: if upstream calls explode (should not happen with TTL+singleflight), warn loudly.
const DEV_UPSTREAM_BUDGET_WINDOW_MS = readPositiveIntEnv(
  'FX_DEV_UPSTREAM_BUDGET_WINDOW_MS',
  60_000,
);
const DEV_UPSTREAM_BUDGET_MAX_CALLS = readPositiveIntEnv('FX_DEV_UPSTREAM_BUDGET_MAX_CALLS', 8);
const DEV_UPSTREAM_BUDGET_WARN_COOLDOWN_MS = readPositiveIntEnv(
  'FX_DEV_UPSTREAM_BUDGET_WARN_COOLDOWN_MS',
  30_000,
);

const FX_RIBBON_DAILY_ALLOWANCE_CALLS = readPositiveIntEnv('FX_RIBBON_DAILY_ALLOWANCE_CALLS', 800);
const FX_RIBBON_PER_MINUTE_ALLOWANCE_CALLS = readPositiveIntEnv(
  'FX_RIBBON_PER_MINUTE_ALLOWANCE_CALLS',
  8,
);

// Budget safety margin (authoritative):
// - Warning at ~70% of allowance
// - Block at ~95% of allowance
const FX_RIBBON_BUDGET_WARN_RATIO = 0.7;
const FX_RIBBON_BUDGET_BLOCK_RATIO = 0.95;
const FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS = 60;

const FX_RIBBON_BUDGET_BLOCKED_ERROR = 'FX upstream budget blocked';

export type FxRibbonBudgetState = 'ok' | 'warning' | 'blocked';

export type FxRibbonBudgetSnapshot = {
  // State is computed for the *next* potential upstream call (authoritative guard).
  state: FxRibbonBudgetState;

  // Day key is London-local (matches weekend-freeze timezone).
  dayKey: string;

  daily: {
    allowance: number;
    used: number;
    warnAt: number;
    blockAt: number;
    remaining: number;
    pctUsed: number;
  };

  minute: {
    windowSeconds: number;
    allowance: number;
    used: number;
    warnAt: number;
    blockAt: number;
    remaining: number;
    // Optional for backwards-compat with older callers' empty snapshots.
    pctUsed?: number;
  };
};

let lastDecision: CacheDecision | undefined;
let lastError: string | undefined;

// Observational traffic (request hits)
const trafficHitTimesMs: number[] = [];
let lastTrafficFactor = 1;

// Dev upstream guard ledger (any upstream leader call timestamps)
const upstreamCallTimesMs: number[] = [];
let lastBudgetWarnAtMs = 0;

// Rate-limit cooldown state
let rateLimitUntilMs = 0;
let last429AtMs = 0;

// In-memory upstream budget ledger (best-effort; per-process). This is *not* traffic-based.
// It only records actual upstream attempts (bulk calls), never client polling.
let budgetDayKey: string | undefined;
let budgetDailyUsedCalls = 0;
const budgetMinuteCallTimesMs: number[] = [];

let lastWeekendFreeze = false;
let lastLondonWeekday: string | undefined;

let lastFetchAtMs = 0;
let lastFetchGroup: FxRibbonGroupId | undefined;
let lastSsotKey = 'unknown';
let lastCycleIndex = 0;

// Group caches
type FxRibbonGroupCache = {
  group: FxRibbonGroupId;
  ssotKey: string;
  asOfMs: number;
  expiresAtMs: number;
  quotes: FxRibbonQuote[];
  expectedSymbols: number;
  missingSymbols: string[];
};

let groupCacheA: FxRibbonGroupCache | null = null;
let groupCacheB: FxRibbonGroupCache | null = null;

// In-flight single-flight promises per group
let inFlightA: Promise<FxRibbonGroupCache> | null = null;
let inFlightB: Promise<FxRibbonGroupCache> | null = null;

export function normaliseSymbol(sym: string): string {
  // Normalise to a consistent form so symbols from different sources match.
  // Accepts: "AUD" | "aud" | "AUDUSD" | "AUD/USD" | "AUD-USD" | "AUD USD"
  const raw = sym.trim().toUpperCase();
  if (!raw) return raw;

  // Pull out three-letter currency codes in order.
  const codes = raw.match(/[A-Z]{3}/g);
  if (!codes || codes.length === 0) return raw;
  if (codes.length === 1) return codes[0];

  return `${codes[0]}/${codes[1]}`;
}

function uniqueStrings(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function pruneTimes(arr: number[], windowMs: number, now: number): void {
  const cutoff = now - windowMs;
  while (arr.length > 0) {
    const head = arr[0];
    if (typeof head !== 'number' || head >= cutoff) break;
    arr.shift();
  }
}

function groupCacheKey(group: FxRibbonGroupId, ssotKey: string): string {
  return `fx:ribbon:${ssotKey}:group:${group}`;
}

function groupInFlight(group: FxRibbonGroupId): Promise<FxRibbonGroupCache> | null {
  return group === 'A' ? inFlightA : inFlightB;
}

function getGroupCache(group: FxRibbonGroupId): FxRibbonGroupCache | null {
  return group === 'A' ? groupCacheA : groupCacheB;
}

function setGroupCache(group: FxRibbonGroupId, cache: FxRibbonGroupCache | null): void {
  if (group === 'A') groupCacheA = cache;
  else groupCacheB = cache;
}

function setGroupInFlight(group: FxRibbonGroupId, p: Promise<FxRibbonGroupCache> | null): void {
  if (group === 'A') inFlightA = p;
  else inFlightB = p;
}

function isWeekendLondon(now: number): boolean {
  // Weekend freeze uses Europe/London timezone.
  try {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON_TIMEZONE,
      weekday: 'short',
    });
    const weekday = dtf.format(new Date(now)); // e.g. "Sat"
    return weekday === 'Sat' || weekday === 'Sun';
  } catch {
    // If timezone formatting fails (should not), be safe: do NOT freeze.
    return false;
  }
}

function getLondonWeekday(now: number): string | undefined {
  try {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON_TIMEZONE,
      weekday: 'short',
    });
    return dtf.format(new Date(now));
  } catch {
    return undefined;
  }
}

function getLondonDayKey(now: number): string {
  // London-local YYYY-MM-DD for daily budget rollover.
  // Use Intl DateTimeFormat for correctness across DST.
  try {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(now));
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    // Fallback UTC day key (last-resort).
    const ms = now;
    return new Date(ms).toISOString().slice(0, 10);
  }
}

function thresholdAtRatio(allowance: number, ratio: number): number {
  const raw = allowance * ratio;
  const n = Math.ceil(raw);
  if (!Number.isFinite(n)) return allowance;
  return Math.max(1, Math.min(allowance, n));
}

function ensureBudgetDay(now: number): void {
  const key = getLondonDayKey(now);
  if (!budgetDayKey) budgetDayKey = key;
  if (budgetDayKey === key) return;

  // Reset on London-local day rollover.
  budgetDayKey = key;
  budgetDailyUsedCalls = 0;
  budgetMinuteCallTimesMs.length = 0;
}

function computeBudgetSnapshot(
  now: number,
  projectedAdditionalUpstreamCalls: number,
): FxRibbonBudgetSnapshot {
  ensureBudgetDay(now);

  const windowMs = FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS * 1000;
  pruneTimes(budgetMinuteCallTimesMs, windowMs, now);

  const dailyAllowance = FX_RIBBON_DAILY_ALLOWANCE_CALLS;
  const minuteAllowance = FX_RIBBON_PER_MINUTE_ALLOWANCE_CALLS;

  const dailyWarnAt = thresholdAtRatio(dailyAllowance, FX_RIBBON_BUDGET_WARN_RATIO);
  const dailyBlockAt = thresholdAtRatio(dailyAllowance, FX_RIBBON_BUDGET_BLOCK_RATIO);

  const minuteWarnAt = thresholdAtRatio(minuteAllowance, FX_RIBBON_BUDGET_WARN_RATIO);
  const minuteBlockAt = thresholdAtRatio(minuteAllowance, FX_RIBBON_BUDGET_BLOCK_RATIO);

  const dailyUsed = budgetDailyUsedCalls;
  const minuteUsed = budgetMinuteCallTimesMs.length;

  const projectedDaily = dailyUsed + projectedAdditionalUpstreamCalls;
  const projectedMinute = minuteUsed + projectedAdditionalUpstreamCalls;

  const state: FxRibbonBudgetState =
    projectedDaily >= dailyBlockAt || projectedMinute >= minuteBlockAt
      ? 'blocked'
      : projectedDaily >= dailyWarnAt || projectedMinute >= minuteWarnAt
      ? 'warning'
      : 'ok';

  return {
    state,
    dayKey: budgetDayKey ?? getLondonDayKey(now),
    daily: {
      allowance: dailyAllowance,
      used: dailyUsed,
      warnAt: dailyWarnAt,
      blockAt: dailyBlockAt,
      remaining: Math.max(0, dailyAllowance - dailyUsed),
      pctUsed: dailyAllowance > 0 ? Math.min(1, dailyUsed / dailyAllowance) : 0,
    },
    minute: {
      windowSeconds: FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS,
      allowance: minuteAllowance,
      used: minuteUsed,
      warnAt: minuteWarnAt,
      blockAt: minuteBlockAt,
      remaining: Math.max(0, minuteAllowance - minuteUsed),
      pctUsed: minuteAllowance > 0 ? Math.round((minuteUsed / minuteAllowance) * 1000) / 10 : 0,
    },
  };
}

function recordUpstreamBudgetSpend(now: number): void {
  ensureBudgetDay(now);

  budgetDailyUsedCalls += 1;
  budgetMinuteCallTimesMs.push(now);

  const windowMs = FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS * 1000;
  pruneTimes(budgetMinuteCallTimesMs, windowMs, now);
}

export function getFxRibbonBudgetSnapshot(): FxRibbonBudgetSnapshot {
  // Snapshot is computed for the *next* potential upstream call.
  return computeBudgetSnapshot(nowMs(), 1);
}

export type FxRibbonBudgetIndicator = {
  state: FxRibbonBudgetState;
  emoji: string;
};

const BUDGET_EMOJI_OK = '🛫';
const BUDGET_EMOJI_WARNING = '🏖️';
const BUDGET_EMOJI_BLOCKED = '🧳';

function emojiForBudgetState(state: FxRibbonBudgetState): string {
  switch (state) {
    case 'warning':
      return BUDGET_EMOJI_WARNING;
    case 'blocked':
      return BUDGET_EMOJI_BLOCKED;
    case 'ok':
    default:
      return BUDGET_EMOJI_OK;
  }
}

/**
 * Convenience indicator for UI/trace/headers. This is computed from the same
 * single shared budget snapshot function (SSOT).
 */
export function getFxRibbonBudgetIndicator(): FxRibbonBudgetIndicator {
  const snap = getFxRibbonBudgetSnapshot();
  return { state: snap.state, emoji: emojiForBudgetState(snap.state) };
}

function updateTraffic(now: number): void {
  trafficHitTimesMs.push(now);
  pruneTimes(trafficHitTimesMs, TRAFFIC_WINDOW_MS, now);

  // Observational only: factor is just "how chatty are we vs TTL?"
  // It MUST NOT influence refresh permission.
  const ttlMs = BASE_TTL_SECONDS * 1000;
  const expectedHitsInWindow = ttlMs > 0 ? Math.max(1, Math.round(TRAFFIC_WINDOW_MS / ttlMs)) : 1;
  const actualHits = trafficHitTimesMs.length;
  lastTrafficFactor = expectedHitsInWindow > 0 ? actualHits / expectedHitsInWindow : actualHits;
}

function bumpRateLimit(now: number): void {
  last429AtMs = now;
  rateLimitUntilMs = now + RATE_LIMIT_COOLDOWN_SECONDS * 1000;
  counters.upstream429s += 1;
}

function isRateLimited(now: number): boolean {
  return now < rateLimitUntilMs;
}

function devUpstreamBudgetGuard(now: number): void {
  if (isProd()) return;

  upstreamCallTimesMs.push(now);
  pruneTimes(upstreamCallTimesMs, DEV_UPSTREAM_BUDGET_WINDOW_MS, now);

  if (upstreamCallTimesMs.length <= DEV_UPSTREAM_BUDGET_MAX_CALLS) return;

  if (now - lastBudgetWarnAtMs < DEV_UPSTREAM_BUDGET_WARN_COOLDOWN_MS) return;
  lastBudgetWarnAtMs = now;

  console.warn(
    `[fx/providers] DEV budget guard tripped: ${
      upstreamCallTimesMs.length
    } upstream calls in the last ${Math.round(DEV_UPSTREAM_BUDGET_WINDOW_MS / 1000)}s.`,
  );
}

const counters = {
  ribbonCalls: 0,
  upstreamCalls: 0,
  upstream429s: 0,
};

function parseTwelveDataBulk(json: unknown): Map<string, TwelveDataBulkItem> {
  const map = new Map<string, TwelveDataBulkItem>();
  const j = json as TwelveDataBulkResponse;

  // Common shape: { status, data: [...] }
  if (j && typeof j === 'object' && 'data' in j) {
    const dataMaybe = (j as { data?: unknown }).data;
    if (Array.isArray(dataMaybe)) {
      for (const item of dataMaybe) {
        if (!item || typeof item !== 'object') continue;
        const sym = String((item as TwelveDataBulkItem).symbol ?? '').trim();
        if (!sym) continue;
        map.set(normaliseSymbol(sym), item as TwelveDataBulkItem);
      }
      return map;
    }
  }

  // Older batch shape: data is object keyed by symbol, or whole object is keyed
  const asRecord =
    j && typeof j === 'object' ? (j as Record<string, unknown>) : ({} as Record<string, unknown>);

  for (const [sym, v] of Object.entries(asRecord)) {
    if (!sym) continue;
    if (!v || typeof v !== 'object') continue;
    const item = v as TwelveDataBulkItem;
    if (!item.symbol) item.symbol = sym;
    map.set(normaliseSymbol(sym), item);
  }

  return map;
}

function parseRate(item: TwelveDataBulkItem | undefined): number | null {
  if (!item) return null;
  const raw = item.rate;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function pairsToQuotes(
  pairs: FxRibbonPair[],
  map: Map<string, TwelveDataBulkItem>,
): FxRibbonQuote[] {
  const quotes: FxRibbonQuote[] = [];

  for (const p of pairs) {
    const providerSymbol = `${normaliseSymbol(p.base)}/${normaliseSymbol(p.quote)}`;
    const item = map.get(providerSymbol);
    const rate = parseRate(item);

    quotes.push({
      id: p.id,
      base: p.base,
      quote: p.quote,
      price: rate,
      providerSymbol,
    });
  }

  return quotes;
}

async function fetchTwelveDataBulkExchangeRates(
  symbols: string[],
  requestTag: string,
): Promise<Map<string, TwelveDataBulkItem>> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('Missing TWELVEDATA_API_KEY');

  const baseUrl = 'https://api.twelvedata.com';
  const url = new URL('/exchange_rate', baseUrl);

  // Twelve Data bulk: comma-separated symbols, e.g. "USD/JPY,GBP/USD"
  url.searchParams.set('symbol', symbols.join(','));
  url.searchParams.set('apikey', apiKey);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
    // Never cache in fetch layer; caching is authoritative in this file.
    cache: 'no-store',
  });

  if (res.status === 429) {
    throw new Error('Twelve Data rate-limited (429)');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Twelve Data error: ${res.status} ${res.statusText}${body ? ` – ${body}` : ''}`,
    );
  }

  const json = (await res.json()) as TwelveDataBulkResponse;

  // Some responses include { status: "error", message: ... }
  if (json && typeof json === 'object' && 'status' in json) {
    const status = String((json as { status?: unknown }).status ?? '').toLowerCase();
    if (status === 'error') {
      const message = String((json as { message?: unknown }).message ?? 'unknown error');
      throw new Error(`Twelve Data response not ok: ${message}`);
    }
  }

  counters.upstreamCalls += 1;

  logTrace('upstream fetch', {
    requestTag,
    symbolsCount: symbols.length,
    sample: symbols.slice(0, 6),
    ttlSeconds: BASE_TTL_SECONDS,
    tip: 'Tip: check for multiple client pollers or extra endpoints calling /api/fx.',
  });

  return parseTwelveDataBulk(json);
}

function getProviderName(providerId?: string | null): string {
  const raw = providerId ?? 'twelvedata';
  const id = raw.toLowerCase();

  if (id === 'twelvedata') return 'Twelve Data';
  if (id === 'cache') return 'Cache';
  if (id === 'fallback') return 'Fallback';

  return raw;
}

export type FxProviderSummary = {
  meta: { id: string; name: string };
  modeLabel: string;
  emphasiseFallback: boolean;
};

export function getFxProviderSummary(
  mode: FxRibbonUiApiMode | null,
  providerId: string | null,
): FxProviderSummary {
  const id = providerId ?? 'twelvedata';
  const name = getProviderName(id);

  const modeLabel =
    mode === 'live'
      ? 'Live'
      : mode === 'cached'
      ? 'Cached'
      : mode === 'fallback'
      ? 'Fallback'
      : '—';

  const emphasiseFallback = mode === 'fallback' || id.toLowerCase() === 'fallback';

  return {
    meta: { id, name },
    modeLabel,
    emphasiseFallback,
  };
}

function getPairsFromSsot(): FxRibbonPair[] {
  // IMPORTANT: use the same FX SSOT resolver as the UI.
  // This keeps the ribbon symbols list consistent everywhere.
  assertFxRibbonSsotValid();

  const metas = getFxRibbonPairs({ tier: 'free', order: 'ssot' });

  const pairs: FxRibbonPair[] = [];
  for (const m of metas) {
    const id = String((m as { id?: unknown }).id ?? '').trim();
    const base = String((m as { base?: unknown }).base ?? '').trim();
    const quote = String((m as { quote?: unknown }).quote ?? '').trim();

    if (!id || !base || !quote) continue;
    pairs.push({ id, base, quote });
  }

  return pairs;
}

function ssotKeyFromPairs(pairs: FxRibbonPair[]): string {
  // Deterministic SSOT key: ordered ids + base/quote.
  // Keep stable: any change in SSOT changes the key (forces new caches).
  const parts = pairs.map((p) => `${p.id}:${p.base}/${p.quote}`);
  return parts.join('|');
}

function splitPairsDeterministically(pairs: FxRibbonPair[]): {
  A: FxRibbonPair[];
  B: FxRibbonPair[];
} {
  const A: FxRibbonPair[] = [];
  const B: FxRibbonPair[] = [];

  // Deterministic split: even indices to A, odd to B (stable with ordering).
  for (const [i, pair] of pairs.entries()) {
    if (i % 2 === 0) A.push(pair);
    else B.push(pair);
  }

  return { A, B };
}

function scheduledGroupForCycle(now: number, ssotKey: string): FxRibbonGroupId {
  // Deterministic: alternate based on cycle index, seeded by ssotKey to avoid flipping on restart.
  // lastCycleIndex is process memory; ssotKey changes force a reset path in getFxRibbon().
  // Note: Alternation enforcement is also asserted in refreshGroup.
  const base = ssotKey.length;
  const parity = (lastCycleIndex + base) % 2;
  return parity === 0 ? 'A' : 'B';
}

function isCycleDue(now: number): boolean {
  // Global TTL gate: at most ONE upstream call per policy TTL window (not per request).
  // IMPORTANT: traffic cannot bypass this.
  return now - lastFetchAtMs >= BASE_TTL_SECONDS * 1000;
}

function getGroupRideCache(group: FxRibbonGroupId, ssotKey: string): FxRibbonGroupCache | null {
  const cache = getGroupCache(group);
  if (!cache) return null;
  if (cache.ssotKey !== ssotKey) return null;

  // IMPORTANT: group validity is policy TTL × 2 because A/B alternation means each group refreshes
  // every other cycle. expiresAtMs is the single source of truth for freshness.
  const now = nowMs();
  if (cache.expiresAtMs <= now) return null;
  return cache;
}

function isGroupFresh(group: FxRibbonGroupId, ssotKey: string, now: number): boolean {
  const cache = getGroupCache(group);
  if (!cache) return false;
  if (cache.ssotKey !== ssotKey) return false;
  return cache.expiresAtMs > now;
}

function newestAsOfIso(
  a: FxRibbonGroupCache | null,
  b: FxRibbonGroupCache | null,
): string | undefined {
  const aMs = a?.asOfMs ?? 0;
  const bMs = b?.asOfMs ?? 0;
  const newest = Math.max(aMs, bMs);
  return newest > 0 ? iso(newest) : undefined;
}

function mergeQuotesInSsotOrder(params: {
  ssotPairs: FxRibbonPair[];
  groupA: FxRibbonGroupCache | null;
  groupB: FxRibbonGroupCache | null;
}): FxRibbonQuote[] {
  const { ssotPairs, groupA, groupB } = params;

  // Build a map of id -> quote from each group
  const map = new Map<string, FxRibbonQuote>();

  for (const q of groupA?.quotes ?? []) map.set(q.id, q);
  for (const q of groupB?.quotes ?? []) map.set(q.id, q);

  // Ensure SSOT order
  const out: FxRibbonQuote[] = [];
  for (const p of ssotPairs) {
    const q = map.get(p.id);
    out.push(
      q ?? {
        id: p.id,
        base: p.base,
        quote: p.quote,
        price: null,
        providerSymbol: `${normaliseSymbol(p.base)}/${normaliseSymbol(p.quote)}`,
      },
    );
  }
  return out;
}

function logTrace(message: string, payload?: Record<string, unknown>): void {
  if (process.env.FX_TRACE_LOG !== 'true') return;

  // eslint-disable-next-line no-console
  console.log('[fx/providers]', message, payload ?? {});
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

  // Budget guard is enforced at the leader path, right before creating the upstream call.
  const budget = computeBudgetSnapshot(now, 1);
  if (budget.state === 'blocked') {
    lastDecision = 'budget_blocked';
    logTrace('upstream blocked by budget guard', { group, ssotKey, budget });
    throw new Error(FX_RIBBON_BUDGET_BLOCKED_ERROR);
  }

  const decision: CacheDecision = group === 'A' ? 'cache_miss_refresh_A' : 'cache_miss_refresh_B';
  lastDecision = decision;

  // Enforce alternation: scheduled group must not refresh twice in a row.
  if (lastFetchGroup && lastFetchGroup === group) {
    throw new Error(`A/B alternation violated: attempted to refresh group ${group} twice in a row`);
  }

  // Enforce: only one group refreshes per cycle slot.
  // This is protected by getFxRibbon() selection + TTL gate, but keep a local assertion.
  // If this trips, some caller is bypassing the authority.
  // NOTE: lastCycleIndex increments only when we actually create a leader call.
  lastCycleIndex += 1;

  const promise = (async () => {
    try {
      // Record spend only for actual upstream leader attempts.
      recordUpstreamBudgetSpend(nowMs());

      const map = await fetchTwelveDataBulkExchangeRates(symbols, `fx_ribbon_group_${group}`);

      const asOfMs = nowMs();

      const quotes = pairsToQuotes(pairs, map);

      // Detect missing rates (nulls) for trace only.
      const missingSymbols = quotes
        .filter((q) => q.price === null)
        .map((q) => q.providerSymbol ?? '')
        .filter(Boolean);

      const expectedSymbols = symbols.length;

      // Each group refreshes every other cycle ⇒ hold for TTL × 2.
      const expiresAtMs = asOfMs + BASE_TTL_SECONDS * 2 * 1000;

      const cache: FxRibbonGroupCache = {
        group,
        ssotKey,
        asOfMs,
        expiresAtMs,
        quotes,
        expectedSymbols,
        missingSymbols,
      };

      setGroupCache(group, cache);

      // Update authority state (only on successful upstream fetch)
      lastFetchAtMs = asOfMs;
      lastFetchGroup = group;

      logTrace('refresh ok', {
        group,
        ssotKey,
        expectedSymbols,
        missingCount: missingSymbols.length,
        expiresAt: iso(expiresAtMs),
      });

      return cache;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // If upstream is rate-limited, apply cooldown.
      if (message.includes('429') || message.toLowerCase().includes('rate-limited')) {
        bumpRateLimit(nowMs());
      }

      logTrace('refresh failed', { group, ssotKey, error: message });
      throw err;
    } finally {
      // Clear in-flight only if we're still the leader promise.
      // If callers joined, they are awaiting this promise too.
      setGroupInFlight(group, null);
    }
  })();

  setGroupInFlight(group, promise);
  return promise;
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
    budget: computeBudgetSnapshot(nowMs(), 1),
    budgetIndicator: getFxRibbonBudgetIndicator(),
    cache: {
      hasValue: mergedHasValue,
      asOf: mergedAsOf,
      expiresAt: typeof mergedExpiresAtMs === 'number' ? iso(mergedExpiresAtMs) : undefined,
      key: mergedHasValue ? `fx:ribbon:${lastSsotKey}:merged` : undefined,
    },
    inFlight: Boolean(inFlightA || inFlightB),
    lastDecision,
    lastError,
    counters: {
      ribbonCalls: counters.ribbonCalls,
      upstreamCalls: counters.upstreamCalls,
      upstream429s: counters.upstream429s,
    },
    rateLimit: {
      isLimited: Boolean(rateLimitUntilMs && rateLimitUntilMs > nowMs()),
      until: rateLimitUntilMs ? iso(rateLimitUntilMs) : undefined,
      last429At: last429AtMs ? iso(last429AtMs) : undefined,
    },
    weekendFreeze: {
      isWeekendLondon: lastWeekendFreeze,
      londonWeekday: lastLondonWeekday,
      timezone: LONDON_TIMEZONE,
    },
    traffic: {
      windowSeconds: Math.round(TRAFFIC_WINDOW_MS / 1000),
      hitsInWindow: trafficHitTimesMs.length,
      factor: lastTrafficFactor,
    },
    schedule: {
      cycleIndex: lastCycleIndex,
      scheduledGroup: scheduledGroupForCycle(nowMs(), lastSsotKey),
      cycleLengthSeconds: BASE_TTL_SECONDS,
      cycleDue: isCycleDue(nowMs()),
    },
    groups: {
      A: {
        hasValue: Boolean(rideA),
        asOf: rideA ? iso(rideA.asOfMs) : undefined,
        expiresAt: rideA ? iso(rideA.expiresAtMs) : undefined,
        key: rideA ? groupCacheKey('A', rideA.ssotKey) : undefined,
        inFlight: Boolean(inFlightA),
        expectedSymbols: rideA?.expectedSymbols ?? 0,
        missingCount: rideA?.missingSymbols?.length ?? 0,
        missingSymbols: rideA?.missingSymbols ?? [],
      },
      B: {
        hasValue: Boolean(rideB),
        asOf: rideB ? iso(rideB.asOfMs) : undefined,
        expiresAt: rideB ? iso(rideB.expiresAtMs) : undefined,
        key: rideB ? groupCacheKey('B', rideB.ssotKey) : undefined,
        inFlight: Boolean(inFlightB),
        expectedSymbols: rideB?.expectedSymbols ?? 0,
        missingCount: rideB?.missingSymbols?.length ?? 0,
        missingSymbols: rideB?.missingSymbols ?? [],
      },
    },
    lastFetch: {
      at: lastFetchAtMs ? iso(lastFetchAtMs) : undefined,
      group: lastFetchGroup,
      expectedSymbols: (groupCacheA?.expectedSymbols ?? 0) + (groupCacheB?.expectedSymbols ?? 0),
      missingCount:
        (groupCacheA?.missingSymbols?.length ?? 0) + (groupCacheB?.missingSymbols?.length ?? 0),
      missingSymbols: uniqueStrings([
        ...(groupCacheA?.missingSymbols ?? []),
        ...(groupCacheB?.missingSymbols ?? []),
      ]),
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

function buildResponse(params: {
  mode: FxApiMode;
  sourceProvider: 'twelvedata';
  asOfIso?: string;
  data: FxRibbonQuote[];
  error?: FxApiError;
}): FxApiResponse {
  const { mode, sourceProvider, asOfIso, data, error } = params;

  return {
    meta: {
      mode,
      sourceProvider,
      asOf: asOfIso,
      ttlSeconds: BASE_TTL_SECONDS,
      budget: getFxRibbonBudgetIndicator(),
    },
    data,
    ...(error ? { error } : {}),
  };
}

export async function getFxRibbon(): Promise<FxApiResponse> {
  counters.ribbonCalls += 1;

  const now = nowMs();
  updateTraffic(now);

  lastWeekendFreeze = isWeekendLondon(now);
  lastLondonWeekday = getLondonWeekday(now);

  // Weekend freeze (Europe/London): zero upstream calls. Serve ride-cache only.
  if (lastWeekendFreeze) {
    lastDecision = 'weekend_freeze_ride_cache';

    const pairs = getPairsFromSsot();
    const ssotKey = ssotKeyFromPairs(pairs);
    lastSsotKey = ssotKey;

    const rideA = getGroupRideCache('A', ssotKey);
    const rideB = getGroupRideCache('B', ssotKey);

    const hasAnyCache = Boolean(rideA || rideB);

    if (!hasAnyCache) {
      lastDecision = 'weekend_freeze_no_cache';

      // Return placeholder list with null prices.
      const data = pairs.map((p) => ({
        id: p.id,
        base: p.base,
        quote: p.quote,
        price: null,
        providerSymbol: `${normaliseSymbol(p.base)}/${normaliseSymbol(p.quote)}`,
      }));

      return buildResponse({
        mode: 'cached',
        sourceProvider: 'twelvedata',
        asOfIso: undefined,
        data,
        error: 'Weekend freeze (no cache available)',
      });
    }

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
    });
  }

  // Rate-limited: ride cache only.
  if (isRateLimited(now)) {
    lastDecision = 'rate_limited_ride_cache';

    const pairs = getPairsFromSsot();
    const ssotKey = ssotKeyFromPairs(pairs);
    lastSsotKey = ssotKey;

    const rideA = getGroupRideCache('A', ssotKey);
    const rideB = getGroupRideCache('B', ssotKey);

    const hasAnyCache = Boolean(rideA || rideB);

    if (!hasAnyCache) {
      lastDecision = 'rate_limited_no_cache';

      const data = pairs.map((p) => ({
        id: p.id,
        base: p.base,
        quote: p.quote,
        price: null,
        providerSymbol: `${normaliseSymbol(p.base)}/${normaliseSymbol(p.quote)}`,
      }));

      return buildResponse({
        mode: 'cached',
        sourceProvider: 'twelvedata',
        asOfIso: undefined,
        data,
        error: 'Rate-limited (no cache available)',
      });
    }

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: rideA, groupB: rideB });
    const asOfIso = newestAsOfIso(rideA, rideB);

    return buildResponse({
      mode: 'cached',
      sourceProvider: 'twelvedata',
      asOfIso,
      data,
    });
  }

  // Sanity / dev guard (observational). Does NOT influence permission.
  devUpstreamBudgetGuard(nowMs());

  const pairs = getPairsFromSsot();
  const ssotKey = ssotKeyFromPairs(pairs);

  // Reset refresh authority state so the new SSOT can feed deterministic cache keys.
  if (lastSsotKey !== ssotKey) {
    lastSsotKey = ssotKey;
    lastCycleIndex = 0;
    lastFetchGroup = undefined;
  }

  const split = splitPairsDeterministically(pairs);

  const symbolsA = split.A.map((p) => `${normaliseSymbol(p.base)}/${normaliseSymbol(p.quote)}`);
  const symbolsB = split.B.map((p) => `${normaliseSymbol(p.base)}/${normaliseSymbol(p.quote)}`);

  // Determine scheduled group for this cycle (A/B alternation).
  const scheduled = scheduledGroupForCycle(now, ssotKey);
  const scheduledFresh = isGroupFresh(scheduled, ssotKey, now);

  const rideA = getGroupRideCache('A', ssotKey);
  const rideB = getGroupRideCache('B', ssotKey);

  const hasAnyCache = Boolean(rideA || rideB);

  // Global TTL gate: if not due, always serve cache (merged) if possible.
  const cycleDue = isCycleDue(now);

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

    const newRideA = scheduled === 'A' ? refreshed : getGroupRideCache('A', ssotKey);
    const newRideB = scheduled === 'B' ? refreshed : getGroupRideCache('B', ssotKey);

    const data = mergeQuotesInSsotOrder({ ssotPairs: pairs, groupA: newRideA, groupB: newRideB });
    const asOfIso = newestAsOfIso(newRideA, newRideB);

    return buildResponse({
      mode: 'live',
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

    if (message === FX_RIBBON_BUDGET_BLOCKED_ERROR) {
      lastDecision = hasAnyCache ? 'budget_blocked_ride_cache' : 'budget_blocked_no_cache';
    }

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
