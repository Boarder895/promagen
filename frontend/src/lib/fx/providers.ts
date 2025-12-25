// frontend/src/lib/fx/providers.ts
/**
 * FX providers + caching + Refresh Authority (server-side policy brain).
 *
 * Non-negotiable rule:
 * - Anything that controls whether upstream is called MUST live here.
 * - Trace must be observer-only: it must never trigger upstream.
 *
 * Weekend-freeze has been fully removed:
 * - No weekend detection
 * - No cache-only weekend gate
 * - No "Weekend freeze (no cache available)" error path
 * - No weekend-freeze fields in trace snapshot types/payload
 *
 * Change List (ADD / REPLACE / REMOVE):
 * - ADD: SSOT-fingerprint-aware cache keys + SSOT change invalidation.
 * - ADD: cold-start priming (prime both groups in one bulk call) with single-flight.
 * - ADD: request symbol de-duplication (no duplicate spend).
 * - REPLACE: TTL spend marker now records only real upstream attempts (not missing-key failures).
 * - REPLACE: strict-indexing guards for noUncheckedIndexedAccess (TypeScript).
 * - REPLACE: normaliseSymbol now treats \\ and other common delimiters as input variants, but always outputs ASCII '/'.
 * - REPLACE: getFxProviderSummary now returns structured summary (meta + modeLabel + emphasiseFallback) expected by UI/tests.
 * Existing features preserved: Yes.
 */

import { unstable_noStore } from 'next/cache';

import { assertFxRibbonSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';
import { env } from '@/lib/env';

export type FxRibbonGroupId = 'A' | 'B';

export type FxRibbonUiApiMode = 'live' | 'cached' | 'fallback';

export type FxRibbonBudgetState = 'ok' | 'warning' | 'blocked';

export type FxRibbonBudgetIndicator = {
  state: FxRibbonBudgetState;
  emoji: string;
};

export type FxRibbonBudgetSnapshot = {
  state: FxRibbonBudgetState;
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
    pctUsed: number;
  };
};

export type FxRibbonGroupTrace = {
  hasValue: boolean;
  asOf?: string;
  expiresAt?: string;
  key?: string;
  inFlight: boolean;
  expectedSymbols: number;
  missingCount: number;
  missingSymbols: string[];
  seeded?: boolean;
};

export type FxRibbonLastFetchSnapshot = {
  at?: string;
  expectedSymbols: number;
  missingCount: number;
  missingSymbols: string[];
};

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

  lastFetch: FxRibbonLastFetchSnapshot;

  lastDecision?: string;
  lastError?: string;

  counters: {
    ribbonCalls: number;
    upstreamCalls: number;
    upstream429s: number;
  };

  rateLimit: {
    until?: string;
    reason?: string;
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
    // Optional for backwards-compat with older callers' empty snapshots.
    cycleDue?: boolean;
  };

  // Group snapshots (ride cache)
  groups: {
    A: FxRibbonGroupTrace;
    B: FxRibbonGroupTrace;
  };
};

type TwelveDataErrorResponse = {
  status?: string;
  message?: string;
  code?: number;
};

type TwelveDataBatchResponse = Record<string, unknown> & TwelveDataErrorResponse;
type FxRibbonQuote = {
  id: string;
  base: string;
  quote: string;
  price: number | null;
  providerSymbol: string;
};

type FxRibbonPayload = {
  meta: {
    mode: FxMode;
    buildId: string;
    providerId: string;
    cached: boolean;
    ttlSeconds: number;
    ssotKey: string;
    budget: FxRibbonBudgetIndicator;
  };
  data: FxRibbonQuote[];
};

type FxMode = 'live' | 'demo' | 'stale';

// ─────────────────────────────────────────────────────────────────────────────
// Provider wiring (FX: TwelveData only for now, with robust cache+trace)
// ─────────────────────────────────────────────────────────────────────────────

const BUDGET_EMOJI_OK = '🛫';
const BUDGET_EMOJI_WARNING = '🏖️';
const BUDGET_EMOJI_BLOCKED = '🧳';
const BUDGET_EMOJI_UNKNOWN = '❓';

const TWELVEDATA_API_KEY = (env.providers.twelveDataApiKey ?? '').trim();
const TWELVEDATA_DISABLED = env.safeMode.disableTwelveData;
const SAFE_MODE_ENABLED = env.safeMode.enabled;

// IMPORTANT: TwelveData supports “batch calls” by providing multiple symbols in `symbol=`.
// We use /price to align with providers.registry.json, and we parse defensively because
// TwelveData can return varying shapes (and can return 200 with {status:"error"}).
const TWELVEDATA_BULK_ENDPOINT = 'https://api.twelvedata.com/price';

// TTL (in seconds) – default 30 min, but allow env override
const BASE_TTL_SECONDS = readEnvInt('FX_RIBBON_TTL_SECONDS', 1800);

// Traffic window for light "factor" indicator (used in trace only)
const TRAFFIC_WINDOW_SECONDS = readEnvInt('FX_RIBBON_TRAFFIC_WINDOW_SECONDS', 60);

// Cycle length for group refresh scheduling (seconds)
const SCHEDULE_CYCLE_SECONDS = readEnvInt('FX_RIBBON_SCHEDULE_CYCLE_SECONDS', 60);

// Hard caps (do not exceed; budget/limit policy uses these)
const MAX_BATCH_SYMBOLS = 120;

// Budget policy: Warning at ~70%, Block at ~95%
const BUDGET_WARN_PCT = 0.7;
const BUDGET_BLOCK_PCT = 0.95;

// Budget allowances (estimates; you can wire real vendor budget later)
const BUDGET_DAILY_ALLOWANCE = readEnvInt('FX_RIBBON_BUDGET_DAILY_ALLOWANCE', 800);
const BUDGET_MINUTE_ALLOWANCE = readEnvInt('FX_RIBBON_BUDGET_MINUTE_ALLOWANCE', 60);
const BUDGET_MINUTE_WINDOW_SECONDS = readEnvInt('FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS', 60);

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache (per-runtime; serverless cold starts reset this)
// ─────────────────────────────────────────────────────────────────────────────

type FxRibbonGroupCache = {
  key: string; // includes SSOT fingerprint
  ssotFingerprint: string;

  asOf: string;
  asOfMs: number;

  expiresAt: string;
  expiresAtMs: number;

  quotesById: Map<string, FxRibbonQuote>;
  expectedSymbols: number;
  missingSymbols: string[];
  seeded: boolean;
};

type FxRibbonMerged = {
  merged: FxRibbonQuote[];
  asOf?: string;
  expiresAt?: string;
  key?: string;
  hasValue: boolean;
};

let cacheA: FxRibbonGroupCache | undefined;
let cacheB: FxRibbonGroupCache | undefined;

// single-flight for cold-start priming / refresh
let inFlight = false;

// counters/trace state
let ribbonCalls = 0;
let upstreamCalls = 0;
let upstream429s = 0;

// last decision/error for trace
let lastDecision: string | undefined;
let lastError: string | undefined;

// rate-limit gate
let rateLimitedUntilMs = 0;
let rateLimitReason: string | undefined;

// traffic window
let trafficWindowStartMs = 0;
let trafficHitsInWindow = 0;

// schedule state
let lastCycleIndex = 0;
let lastFetchAtMs = 0;

// last upstream attempt summary (for dev diagnostics; observer-only)
type LastFetchSummaryInternal = FxRibbonLastFetchSnapshot & { ssotFingerprint?: string };

let lastFetchSummary: LastFetchSummaryInternal = {
  expectedSymbols: 0,
  missingCount: 0,
  missingSymbols: [],
};

// budget state snapshots (computed; persisted per-runtime)
type BudgetSnapshotInternal = FxRibbonBudgetSnapshot & {
  // convenience: store raw limits
  _dailyLimit: number;
  _minuteLimit: number;
};

let budgetSnapshot: BudgetSnapshotInternal | undefined;
let budgetMinuteWindowStartMs = 0;
let budgetMinuteUsedInWindow = 0;

// cached indicator for last payload
let lastBudgetIndicator: FxRibbonBudgetIndicator = { state: 'ok', emoji: BUDGET_EMOJI_OK };

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseSymbol(input: string): string {
  // Accept already-slash symbols or various formats and normalise.
  // Canonical output is always ASCII forward slash (U+002F) with no spaces.
  // Examples:
  // - "EURUSD"     -> "EUR/USD"
  // - "EUR-USD"    -> "EUR/USD"
  // - "eur_usd"    -> "EUR/USD"
  // - "eur\\usd"   -> "EUR/USD"
  // - " eur / usd " -> "EUR/USD"
  const raw = input.trim().toUpperCase();
  if (!raw) return '';

  // Remove all whitespace first, then normalise common delimiter variants.
  // NOTE: we intentionally accept backslash as an *input* delimiter but we
  // never emit it; output is always BASE/QUOTE.
  const noSpaces = raw.replace(/\s+/g, '');

  // Convert slash lookalikes to plain ASCII '/'.
  // (fraction slash ⁄ U+2044, division slash ∕ U+2215)
  const asciiSlashes = noSpaces.replace(/[⁄∕]/g, '/');

  // Treat other common delimiters as '/'.
  const delimited = asciiSlashes.replace(/[\\:_-]/g, '/');

  if (delimited.includes('/')) {
    // Collapse accidental repeats (e.g. "EUR//USD").
    return delimited.replace(/\/+/g, '/');
  }

  if (delimited.length === 6) return `${delimited.slice(0, 3)}/${delimited.slice(3)}`;
  return delimited;
}

export function getFxProviderSummary(mode: FxRibbonUiApiMode | null, providerId: string | null) {
  const id = (providerId ?? 'twelvedata').trim() || 'twelvedata';
  const name =
    id === 'twelvedata'
      ? 'Twelve Data'
      : id === 'cache'
      ? 'Cache'
      : id === 'fallback'
      ? 'Fallback'
      : id;

  const modeLabel =
    mode === 'live'
      ? 'Live'
      : mode === 'cached'
      ? 'Cached'
      : mode === 'fallback'
      ? 'Fallback'
      : '—';

  return {
    meta: {
      id,
      name,
    },
    modeLabel,
    emphasiseFallback: mode === 'fallback',
  };
}

export function getFxRibbonTraceSnapshot(): FxRibbonTraceSnapshot {
  // Trace must be observer-only: do not trigger upstream.
  const now = Date.now();
  const ssotKey = getSsotKey();

  const budget = ensureBudgetSnapshot(now);
  const budgetIndicator = lastBudgetIndicator;

  const merged = mergeCaches(now, ssotKey);

  const cycleDue = isCycleDue(now);

  const lastFetch = readLastFetchSnapshot(ssotKey);

  return {
    ttlSeconds: BASE_TTL_SECONDS,
    ssotKey,

    inFlight,
    budget,
    budgetIndicator,

    cache: {
      hasValue: merged.hasValue,
      asOf: merged.asOf,
      expiresAt: merged.expiresAt,
      key: merged.key,
    },

    lastFetch,

    lastDecision,
    lastError,

    counters: {
      ribbonCalls,
      upstreamCalls,
      upstream429s,
    },

    rateLimit: {
      until: rateLimitedUntilMs > now ? toIso(rateLimitedUntilMs) : undefined,
      reason: rateLimitedUntilMs > now ? rateLimitReason : undefined,
    },

    traffic: currentTraffic(now),

    schedule: {
      cycleIndex: lastCycleIndex,
      scheduledGroup: scheduledGroup(lastCycleIndex),
      cycleLengthSeconds: SCHEDULE_CYCLE_SECONDS,
      cycleDue,
    },

    groups: {
      A: groupTrace(cacheA, now),
      B: groupTrace(cacheB, now),
    },
  };
}

export function getFxRibbonBudgetSnapshot(): FxRibbonBudgetSnapshot {
  // Observer-only: budget is computed locally; no upstream effects.
  const now = Date.now();
  return ensureBudgetSnapshot(now);
}

export async function getFxRibbon(): Promise<FxRibbonPayload> {
  // NOTE: This function is the *only* place allowed to trigger upstream.
  ribbonCalls += 1;

  // In Next.js server components, avoid caching across requests.

  unstable_noStore();

  const now = Date.now();
  const ssotKey = getSsotKey();

  // Traffic
  tickTraffic(now);

  // Budget block: forbid upstream when blocked.
  const budget = ensureBudgetSnapshot(now);
  lastBudgetIndicator = toBudgetIndicator(budget);

  // Pro safety switch: safe mode forces cache/demo only (no upstream), even if budget is otherwise OK.
  if (SAFE_MODE_ENABLED) {
    const merged = mergeCaches(now, ssotKey);
    if (merged.hasValue) {
      lastDecision = 'safe_mode_cache';
      lastError = undefined;

      return {
        meta: {
          mode: 'stale',
          buildId: 'local-dev',
          providerId: 'twelvedata',
          cached: true,
          ttlSeconds: BASE_TTL_SECONDS,
          ssotKey,
          budget: lastBudgetIndicator,
        },
        data: merged.merged,
      };
    }

    lastDecision = 'safe_mode_demo';
    lastError = undefined;

    return {
      meta: {
        mode: 'demo',
        buildId: 'local-dev',
        providerId: 'twelvedata',
        cached: false,
        ttlSeconds: BASE_TTL_SECONDS,
        ssotKey,
        budget: lastBudgetIndicator,
      },
      data: buildDemoQuotes(ssotKey),
    };
  }

  if (budget.state === 'blocked') {
    lastDecision = 'blocked_budget_demo';
    lastError = undefined;

    return {
      meta: {
        mode: 'demo',
        buildId: 'local-dev',
        providerId: 'twelvedata',
        cached: false,
        ttlSeconds: BASE_TTL_SECONDS,
        ssotKey,
        budget: lastBudgetIndicator,
      },
      data: buildDemoQuotes(ssotKey),
    };
  }

  // If rate-limited, serve cache-only or demo.
  if (isRateLimited(now)) {
    const merged = mergeCaches(now, ssotKey);
    if (merged.hasValue) {
      lastDecision = 'rate_limited_cache';
      lastError = undefined;
      return {
        meta: {
          mode: 'stale',
          buildId: 'local-dev',
          providerId: 'twelvedata',
          cached: true,
          ttlSeconds: BASE_TTL_SECONDS,
          ssotKey,
          budget: lastBudgetIndicator,
        },
        data: merged.merged,
      };
    }

    lastDecision = 'rate_limited_demo';
    lastError = undefined;

    return {
      meta: {
        mode: 'demo',
        buildId: 'local-dev',
        providerId: 'twelvedata',
        cached: false,
        ttlSeconds: BASE_TTL_SECONDS,
        ssotKey,
        budget: lastBudgetIndicator,
      },
      data: buildDemoQuotes(ssotKey),
    };
  }

  // Cold start priming: if both caches missing, do one bulk call (single-flight).
  const haveA = cacheA && isCacheValidForSsot(cacheA, ssotKey);
  const haveB = cacheB && isCacheValidForSsot(cacheB, ssotKey);

  if (!haveA && !haveB) {
    const primed = await primeBothGroups(now, ssotKey);
    if (primed) {
      const merged = mergeCaches(now, ssotKey);
      lastDecision = 'cold_start_primed';
      lastError = undefined;
      return {
        meta: {
          mode: 'live',
          buildId: 'local-dev',
          providerId: 'twelvedata',
          cached: false,
          ttlSeconds: BASE_TTL_SECONDS,
          ssotKey,
          budget: lastBudgetIndicator,
        },
        data: merged.merged,
      };
    }

    // Priming failed – fall back to any cache (none) -> demo
    lastDecision = 'cold_start_prime_failed_demo';
    return {
      meta: {
        mode: 'demo',
        buildId: 'local-dev',
        providerId: 'twelvedata',
        cached: false,
        ttlSeconds: BASE_TTL_SECONDS,
        ssotKey,
        budget: lastBudgetIndicator,
      },
      data: buildDemoQuotes(ssotKey),
    };
  }

  // Schedule refresh: refresh one group per cycle (single upstream attempt per TTL window).
  const cycleDue = isCycleDue(now);
  if (cycleDue && canSpendTtlWindow(now)) {
    const groupToRefresh = scheduledGroup(lastCycleIndex + 1);
    const refreshed = await refreshOneGroup(now, ssotKey, groupToRefresh);
    if (refreshed) {
      const merged = mergeCaches(now, ssotKey);
      lastDecision = 'scheduled_refresh';
      lastError = undefined;
      return {
        meta: {
          mode: 'live',
          buildId: 'local-dev',
          providerId: 'twelvedata',
          cached: false,
          ttlSeconds: BASE_TTL_SECONDS,
          ssotKey,
          budget: lastBudgetIndicator,
        },
        data: merged.merged,
      };
    }
  }

  // Default: serve merged caches if present; else demo.
  const merged = mergeCaches(now, ssotKey);
  if (merged.hasValue) {
    lastDecision = 'serve_cache';
    lastError = undefined;

    return {
      meta: {
        mode: 'stale',
        buildId: 'local-dev',
        providerId: 'twelvedata',
        cached: true,
        ttlSeconds: BASE_TTL_SECONDS,
        ssotKey,
        budget: lastBudgetIndicator,
      },
      data: merged.merged,
    };
  }

  lastDecision = 'no_cache_demo';
  lastError = undefined;

  return {
    meta: {
      mode: 'demo',
      buildId: 'local-dev',
      providerId: 'twelvedata',
      cached: false,
      ttlSeconds: BASE_TTL_SECONDS,
      ssotKey,
      budget: lastBudgetIndicator,
    },
    data: buildDemoQuotes(ssotKey),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: SSOT + caching
// ─────────────────────────────────────────────────────────────────────────────

function getSsotKey(): string {
  const pairs = getFxRibbonPairs();
  assertFxRibbonSsotValid();

  const fp = computeSsotFingerprint(pairs);

  // Keep a short key for trace/readability; includes fingerprint.
  return `fx-ribbon-ssot:${fp}`;
}

function computeSsotFingerprint(pairs: ReturnType<typeof getFxRibbonPairs>): string {
  // Very stable fingerprint: list of ids + providerSymbols + groups.
  const canonical = pairs
    .map((p, i) => `${p.id}:${p.base}/${p.quote}:${i % 2 === 0 ? 'A' : 'B'}`)
    .join('|');

  // small deterministic hash (non-crypto) for cache keys
  let h = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(16);
}

function groupCacheKey(group: FxRibbonGroupId, ssotFingerprint: string): string {
  return `fx-ribbon:${group}:v2:${ssotFingerprint}`;
}

function isCacheValidForSsot(cache: FxRibbonGroupCache, ssotKey: string): boolean {
  const fp = ssotKey.split(':').pop();
  if (!fp) return false;
  return cache.ssotFingerprint === fp;
}

function groupTrace(cache: FxRibbonGroupCache | undefined, now: number): FxRibbonGroupTrace {
  if (!cache) {
    return {
      hasValue: false,
      inFlight,
      expectedSymbols: 0,
      missingCount: 0,
      missingSymbols: [],
    };
  }

  const hasValue = cache.quotesById.size > 0;
  const missingSymbols = cache.missingSymbols ?? [];
  const missingCount = missingSymbols.length;

  const expired = now > cache.expiresAtMs;

  return {
    hasValue,
    asOf: cache.asOf,
    expiresAt: cache.expiresAt,
    key: cache.key,
    inFlight,
    expectedSymbols: cache.expectedSymbols,
    missingCount,
    missingSymbols,
    seeded: cache.seeded,
    ...(expired ? {} : {}),
  };
}

function readLastFetchSnapshot(ssotKey: string): FxRibbonLastFetchSnapshot {
  const fp = ssotKey.split(':').pop();

  if (!fp || lastFetchSummary.ssotFingerprint !== fp) {
    return { expectedSymbols: 0, missingCount: 0, missingSymbols: [] };
  }

  return {
    at: lastFetchSummary.at,
    expectedSymbols: lastFetchSummary.expectedSymbols,
    missingCount: lastFetchSummary.missingCount,
    missingSymbols: lastFetchSummary.missingSymbols,
  };
}

function recomputeLastFetchSummary(now: number, ssotFingerprint: string): void {
  const missing = new Set<string>();
  let expectedSymbols = 0;

  const absorb = (cache: FxRibbonGroupCache | undefined) => {
    if (!cache || cache.ssotFingerprint !== ssotFingerprint) return;
    expectedSymbols += cache.expectedSymbols;
    for (const sym of cache.missingSymbols ?? []) missing.add(sym);
  };

  absorb(cacheA);
  absorb(cacheB);

  const missingSymbols = Array.from(missing);
  missingSymbols.sort();

  lastFetchSummary = {
    ssotFingerprint,
    at: toIso(now),
    expectedSymbols,
    missingCount: missingSymbols.length,
    missingSymbols,
  };
}

function mergeCaches(now: number, ssotKey: string): FxRibbonMerged {
  // Merged view is backwards-compatible with older UI: single list of quotes.
  // Strategy:
  // - If both caches exist and valid for SSOT, merge by quote id.
  // - If only one exists, use that.
  // - If neither exists, no value.
  const pairs = getFxRibbonPairs();
  assertFxRibbonSsotValid();

  const fp = ssotKey.split(':').pop();
  if (!fp) return { merged: [], hasValue: false };

  const a = cacheA && cacheA.ssotFingerprint === fp ? cacheA : undefined;
  const b = cacheB && cacheB.ssotFingerprint === fp ? cacheB : undefined;

  const all = new Map<string, FxRibbonQuote>();

  const pickMeta = (c: FxRibbonGroupCache | undefined) => ({
    asOf: c?.asOf,
    expiresAt: c?.expiresAt,
    key: c?.key,
  });

  if (a) {
    for (const [id, q] of a.quotesById.entries()) all.set(id, q);
  }
  if (b) {
    for (const [id, q] of b.quotesById.entries()) all.set(id, q);
  }

  // Fill gaps from SSOT (null prices) to preserve stable UI ordering
  for (const p of pairs) {
    if (all.has(p.id)) continue;
    all.set(p.id, {
      id: p.id,
      base: p.base,
      quote: p.quote,
      price: null,
      providerSymbol: `${p.base}/${p.quote}`,
    });
  }

  // Determine if we have any real values
  const merged = pairs.map(
    (p) =>
      all.get(p.id) ?? {
        id: p.id,
        base: p.base,
        quote: p.quote,
        price: null,
        providerSymbol: `${p.base}/${p.quote}`,
      },
  );

  const hasValue = merged.some((q) => q.price !== null);

  // choose meta: newest cache wins for merged meta
  let meta = pickMeta(a);
  if (b && (!a || b.asOfMs >= a.asOfMs)) meta = pickMeta(b);

  // Determine merged validity: if both missing, return none
  if (!a && !b) {
    return { merged, hasValue: false };
  }

  // If both expired, still return stale (hasValue may still be true)
  return {
    merged,
    hasValue,
    asOf: meta.asOf,
    expiresAt: meta.expiresAt,
    key: meta.key,
  };
}

function buildDemoQuotes(ssotKey: string): FxRibbonQuote[] {
  // Demo mode is honest: we return SSOT list with null prices (no fake numbers).
  const pairs = getFxRibbonPairs();
  assertFxRibbonSsotValid();

  // The SSOT key is included to prevent unused warnings (and for future).
  void ssotKey;

  return pairs.map((p) => ({
    id: p.id,
    base: p.base,
    quote: p.quote,
    price: null,
    providerSymbol: `${p.base}/${p.quote}`,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: schedule + traffic + rate-limit
// ─────────────────────────────────────────────────────────────────────────────

function tickTraffic(now: number): void {
  const windowMs = TRAFFIC_WINDOW_SECONDS * 1000;

  if (trafficWindowStartMs === 0 || now - trafficWindowStartMs >= windowMs) {
    trafficWindowStartMs = now;
    trafficHitsInWindow = 0;
  }

  trafficHitsInWindow += 1;
}

function currentTraffic(now: number): FxRibbonTraceSnapshot['traffic'] {
  const windowMs = TRAFFIC_WINDOW_SECONDS * 1000;

  if (trafficWindowStartMs === 0 || now - trafficWindowStartMs >= windowMs) {
    return {
      windowSeconds: TRAFFIC_WINDOW_SECONDS,
      hitsInWindow: 0,
      factor: 1,
    };
  }

  // factor: 1..5 simple heuristic (trace only)
  const hits = trafficHitsInWindow;
  let factor = 1;
  if (hits >= 10) factor = 2;
  if (hits >= 25) factor = 3;
  if (hits >= 50) factor = 4;
  if (hits >= 100) factor = 5;

  return {
    windowSeconds: TRAFFIC_WINDOW_SECONDS,
    hitsInWindow: hits,
    factor,
  };
}

function scheduledGroup(cycleIndex: number): FxRibbonGroupId {
  // Alternate A/B
  return cycleIndex % 2 === 0 ? 'A' : 'B';
}

function isCycleDue(now: number): boolean {
  if (lastFetchAtMs === 0) return true;
  const elapsed = now - lastFetchAtMs;
  return elapsed >= SCHEDULE_CYCLE_SECONDS * 1000;
}

function canSpendTtlWindow(now: number): boolean {
  // Spend governor: at most ONE upstream attempt per TTL window.
  if (lastFetchAtMs === 0) return true;
  const elapsed = now - lastFetchAtMs;
  return elapsed >= BASE_TTL_SECONDS * 1000;
}

function spendCycle(now: number, costUnits: number): void {
  // Called ONLY when we are about to do a real upstream fetch.
  lastFetchAtMs = now;
  lastCycleIndex += 1;
  upstreamCalls += 1;
  recordBudgetUpstreamAttempt(now, costUnits);
}

function setRateLimit(now: number, seconds: number, reason: string): void {
  rateLimitedUntilMs = now + seconds * 1000;
  rateLimitReason = reason;
}

function clearRateLimit(): void {
  rateLimitedUntilMs = 0;
  rateLimitReason = undefined;
}

function isRateLimited(now: number): boolean {
  return rateLimitedUntilMs > now;
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget: estimated spend tracking + warning/block thresholds
// ─────────────────────────────────────────────────────────────────────────────

function ensureBudgetSnapshot(now: number): BudgetSnapshotInternal {
  const dayKey = dayKeyFromMs(now);

  if (!budgetSnapshot || budgetSnapshot.dayKey !== dayKey) {
    budgetSnapshot = {
      state: 'ok',
      dayKey,
      daily: {
        allowance: BUDGET_DAILY_ALLOWANCE,
        used: 0,
        warnAt: 0,
        blockAt: 0,
        remaining: BUDGET_DAILY_ALLOWANCE,
        pctUsed: 0,
      },
      minute: {
        windowSeconds: BUDGET_MINUTE_WINDOW_SECONDS,
        allowance: BUDGET_MINUTE_ALLOWANCE,
        used: 0,
        warnAt: 0,
        blockAt: 0,
        remaining: BUDGET_MINUTE_ALLOWANCE,
        pctUsed: 0,
      },
      _dailyLimit: BUDGET_DAILY_ALLOWANCE,
      _minuteLimit: BUDGET_MINUTE_ALLOWANCE,
    };

    budgetMinuteWindowStartMs = 0;
    budgetMinuteUsedInWindow = 0;

    recomputeBudgetDerivedFields(budgetSnapshot);
  } else {
    // Update minute window with time
    const snap = budgetSnapshot;
    const windowMs = Math.max(1, snap.minute.windowSeconds) * 1000;

    if (budgetMinuteWindowStartMs === 0 || now - budgetMinuteWindowStartMs >= windowMs) {
      budgetMinuteWindowStartMs = now;
      budgetMinuteUsedInWindow = 0;
    }

    snap.minute.used = budgetMinuteUsedInWindow;
    recomputeBudgetDerivedFields(snap);
  }

  return budgetSnapshot;
}

function recordBudgetUpstreamAttempt(now: number, costUnits: number): void {
  const units = Number.isFinite(costUnits) ? Math.max(0, Math.floor(costUnits)) : 0;
  if (units <= 0) return;

  const snap = ensureBudgetSnapshot(now);

  snap.daily.used += units;

  const windowMs = Math.max(1, snap.minute.windowSeconds) * 1000;
  if (budgetMinuteWindowStartMs === 0 || now - budgetMinuteWindowStartMs >= windowMs) {
    budgetMinuteWindowStartMs = now;
    budgetMinuteUsedInWindow = 0;
  }

  budgetMinuteUsedInWindow += units;
  snap.minute.used = budgetMinuteUsedInWindow;

  recomputeBudgetDerivedFields(snap);
}

function recomputeBudgetDerivedFields(snap: BudgetSnapshotInternal): void {
  const dailyLimit = snap._dailyLimit;
  const minuteLimit = snap._minuteLimit;

  snap.daily.allowance = dailyLimit;
  snap.minute.allowance = minuteLimit;

  snap.daily.warnAt = Math.floor(dailyLimit * BUDGET_WARN_PCT);
  snap.daily.blockAt = Math.floor(dailyLimit * BUDGET_BLOCK_PCT);

  snap.minute.warnAt = Math.floor(minuteLimit * BUDGET_WARN_PCT);
  snap.minute.blockAt = Math.floor(minuteLimit * BUDGET_BLOCK_PCT);

  snap.daily.remaining = Math.max(0, dailyLimit - snap.daily.used);
  snap.minute.remaining = Math.max(0, minuteLimit - snap.minute.used);

  snap.daily.pctUsed = dailyLimit <= 0 ? 0 : clamp01(snap.daily.used / dailyLimit);
  snap.minute.pctUsed = minuteLimit <= 0 ? 0 : clamp01(snap.minute.used / minuteLimit);

  // State: block if either bucket blocks; warn if either warns.
  const blocked = snap.daily.used >= snap.daily.blockAt || snap.minute.used >= snap.minute.blockAt;
  const warned = snap.daily.used >= snap.daily.warnAt || snap.minute.used >= snap.minute.warnAt;

  snap.state = blocked ? 'blocked' : warned ? 'warning' : 'ok';
}

function toBudgetIndicator(snap: FxRibbonBudgetSnapshot): FxRibbonBudgetIndicator {
  if (snap.state === 'ok') return { state: 'ok', emoji: BUDGET_EMOJI_OK };
  if (snap.state === 'warning') return { state: 'warning', emoji: BUDGET_EMOJI_WARNING };
  if (snap.state === 'blocked') return { state: 'blocked', emoji: BUDGET_EMOJI_BLOCKED };
  return { state: 'ok', emoji: BUDGET_EMOJI_UNKNOWN };
}

function dayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upstream fetch + cache building
// ─────────────────────────────────────────────────────────────────────────────

type SsotItem = {
  id: string;
  base: string;
  quote: string;
  providerSymbol: string;
  group: FxRibbonGroupId;
};

function makeSsotItems(_ssotKey: string): { items: SsotItem[]; requestSymbols: string[] } {
  const pairs = getFxRibbonPairs();
  assertFxRibbonSsotValid();

  const items: SsotItem[] = [];

  for (let i = 0; i < pairs.length; i += 1) {
    const p = pairs[i];
    if (!p) continue;

    const group: FxRibbonGroupId = i % 2 === 0 ? 'A' : 'B';
    items.push({
      id: p.id,
      base: p.base,
      quote: p.quote,
      providerSymbol: `${p.base}/${p.quote}`,
      group,
    });
  }

  const requestSymbols = dedupeSymbols(items.map((x) => x.providerSymbol));

  return { items, requestSymbols };
}

function dedupeSymbols(symbols: string[]): string[] {
  const set = new Set<string>();
  const out: string[] = [];

  for (const sym of symbols) {
    const n = normaliseSymbol(sym);
    if (set.has(n)) continue;
    set.add(n);
    out.push(n);
  }

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readStatus(value: unknown): string | null {
  const s = readString(value);
  return s ? s.trim().toLowerCase() : null;
}

function extractNumericFromTwelveData(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return safeNumber(value);

  if (!isRecord(value)) return null;

  // Per-symbol error objects.
  const status = readStatus(value.status);
  if (status && status !== 'ok') return null;

  if ('price' in value) return safeNumber((value as Record<string, unknown>).price);
  if ('rate' in value) return safeNumber((value as Record<string, unknown>).rate);
  if ('close' in value) return safeNumber((value as Record<string, unknown>).close);
  // Common "values" format (e.g. quote/time_series)
  const values = (value as Record<string, unknown>).values;
  if (Array.isArray(values) && values.length > 0) {
    const first = values[0];
    if (isRecord(first)) {
      if ('close' in first) return safeNumber((first as Record<string, unknown>).close);
      if ('price' in first) return safeNumber((first as Record<string, unknown>).price);
    }
  }

  // Nested data objects.
  if ('data' in value) {
    return extractNumericFromTwelveData((value as Record<string, unknown>).data);
  }

  return null;
}

function parseTwelveDataBulk(
  json: unknown,
  requestSymbols: string[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};

  if (!isRecord(json)) return out;

  // Single-symbol response: { price: "1.234" } or { rate: "..." }
  if ('price' in json || 'rate' in json || 'close' in json || 'values' in json) {
    const only = requestSymbols.length === 1 ? requestSymbols[0] : undefined;
    const sym = readString((json as Record<string, unknown>).symbol) ?? only;
    if (sym) {
      out[normaliseSymbol(sym)] = extractNumericFromTwelveData(json);
    }
    return out;
  }

  // Array data response: { data: [{ symbol, price/rate/close }, ...] }
  const data = (json as Record<string, unknown>).data;
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!isRecord(item)) continue;
      const sym = readString((item as Record<string, unknown>).symbol);
      if (!sym) continue;
      out[normaliseSymbol(sym)] = extractNumericFromTwelveData(item);
    }
    return out;
  }

  // Object data response: { data: { "EUR/USD": { price: "..." }, ... } }
  if (isRecord(data)) {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'status' || k === 'message' || k === 'code') continue;
      out[normaliseSymbol(k)] = extractNumericFromTwelveData(v);
    }
    return out;
  }

  // Batch-like response at top-level: { "EUR/USD": {price:...}, "GBP/USD": {...}, ... }
  for (const [k, v] of Object.entries(json)) {
    if (k === 'status' || k === 'message' || k === 'code') continue;
    out[normaliseSymbol(k)] = extractNumericFromTwelveData(v);
  }

  return out;
}

async function fetchTwelveDataBulk(
  now: number,
  requestSymbols: string[],
): Promise<
  { ok: true; ratesBySymbol: Record<string, number | null> } | { ok: false; error: string }
> {
  if (TWELVEDATA_DISABLED) return { ok: false, error: 'TwelveData disabled via env' };
  if (!TWELVEDATA_API_KEY) return { ok: false, error: 'Missing TWELVEDATA_API_KEY' };

  const costUnits = Math.max(1, requestSymbols.length);
  spendCycle(now, costUnits);

  const url = new URL(TWELVEDATA_BULK_ENDPOINT);
  url.searchParams.set('symbol', requestSymbols.join(','));
  url.searchParams.set('apikey', TWELVEDATA_API_KEY);
  url.searchParams.set('format', 'JSON');

  const controller = new AbortController();
  const timeoutMs = 4_500;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (res.status === 429) {
      upstream429s += 1;
      setRateLimit(now, 60, '429');
      return { ok: false, error: 'Upstream 429' };
    }

    if (res.status >= 500) {
      setRateLimit(now, 30, '5xx');
      return { ok: false, error: `Upstream ${res.status} ${res.statusText}` };
    }

    if (!res.ok) {
      return { ok: false, error: `Upstream ${res.status} ${res.statusText}` };
    }

    clearRateLimit();

    const json = (await res.json()) as unknown;

    // Twelve Data frequently returns 200 with { status: "error", message: "..." }.
    if (isRecord(json)) {
      const status = readStatus((json as TwelveDataBatchResponse).status);
      if (status && status !== 'ok') {
        const message = readString((json as TwelveDataBatchResponse).message) ?? 'Upstream error';
        return { ok: false, error: `${status}: ${message}` };
      }
    }

    const ratesBySymbol = parseTwelveDataBulk(json, requestSymbols);

    return { ok: true, ratesBySymbol };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      setRateLimit(now, 15, 'timeout');
      return { ok: false, error: 'Upstream timeout' };
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Upstream fetch failed: ${message}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildGroupCacheFromRates(args: {
  now: number;
  group: FxRibbonGroupId;
  ssotFingerprint: string;
  entries: Array<{ id: string; base: string; quote: string; providerSymbol: string }>;
  ratesBySymbol: Record<string, number | null>;
  seeded: boolean;
}): FxRibbonGroupCache {
  const { now, group, ssotFingerprint, entries, ratesBySymbol, seeded } = args;

  const quotesById = new Map<string, FxRibbonQuote>();
  const missingSymbols: string[] = [];

  for (const e of entries) {
    const rate = ratesBySymbol[e.providerSymbol];

    if (typeof rate !== 'number') {
      missingSymbols.push(e.providerSymbol);
      quotesById.set(e.id, {
        id: e.id,
        base: e.base,
        quote: e.quote,
        price: null,
        providerSymbol: e.providerSymbol,
      });
      continue;
    }

    quotesById.set(e.id, {
      id: e.id,
      base: e.base,
      quote: e.quote,
      price: rate,
      providerSymbol: e.providerSymbol,
    });
  }

  const ttlMs = BASE_TTL_SECONDS * 1000;

  return {
    key: groupCacheKey(group, ssotFingerprint),
    ssotFingerprint,
    asOf: toIso(now),
    asOfMs: now,
    expiresAt: toIso(now + ttlMs),
    expiresAtMs: now + ttlMs,
    quotesById,
    expectedSymbols: entries.length,
    missingSymbols,
    seeded,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cold-start priming + scheduled refresh (single-flight)
// ─────────────────────────────────────────────────────────────────────────────

async function primeBothGroups(now: number, ssotKey: string): Promise<boolean> {
  // If already in flight, just wait (cheap) and then return whether caches exist.
  if (inFlight) {
    await sleep(25);
    const merged = mergeCaches(Date.now(), ssotKey);
    return merged.hasValue;
  }

  inFlight = true;

  try {
    assertFxRibbonSsotValid();

    const ssotFingerprint = ssotKey.split(':').pop();
    if (!ssotFingerprint) return false;

    const { items, requestSymbols } = makeSsotItems(ssotKey);

    if (requestSymbols.length === 0) return false;

    const clipped = requestSymbols.slice(0, Math.min(MAX_BATCH_SYMBOLS, requestSymbols.length));

    const bulk = await fetchTwelveDataBulk(now, clipped);
    if (!bulk.ok) {
      lastError = bulk.error;
      lastDecision = 'cold_start_prime_failed';
      return false;
    }

    // split by group
    const aEntries = items
      .filter((x) => x.group === 'A')
      .map((x) => ({ id: x.id, base: x.base, quote: x.quote, providerSymbol: x.providerSymbol }));

    const bEntries = items
      .filter((x) => x.group === 'B')
      .map((x) => ({ id: x.id, base: x.base, quote: x.quote, providerSymbol: x.providerSymbol }));

    const aCache = buildGroupCacheFromRates({
      now,
      group: 'A',
      ssotFingerprint,
      entries: aEntries,
      ratesBySymbol: bulk.ratesBySymbol,
      seeded: true,
    });

    const bCache = buildGroupCacheFromRates({
      now,
      group: 'B',
      ssotFingerprint,
      entries: bEntries,
      ratesBySymbol: bulk.ratesBySymbol,
      seeded: true,
    });

    cacheA = aCache;
    cacheB = bCache;

    recomputeLastFetchSummary(now, ssotFingerprint);

    lastDecision = 'cold_start_primed';
    lastError = undefined;

    return true;
  } finally {
    inFlight = false;
  }
}

async function refreshOneGroup(
  now: number,
  ssotKey: string,
  group: FxRibbonGroupId,
): Promise<boolean> {
  if (inFlight) return false;

  const ssotFingerprint = ssotKey.split(':').pop();
  if (!ssotFingerprint) return false;

  inFlight = true;

  try {
    assertFxRibbonSsotValid();

    const { items } = makeSsotItems(ssotKey);

    const groupEntries = items
      .filter((x) => x.group === group)
      .map((x) => ({ id: x.id, base: x.base, quote: x.quote, providerSymbol: x.providerSymbol }));

    const requestSymbols = dedupeSymbols(groupEntries.map((x) => x.providerSymbol));

    if (requestSymbols.length === 0) return false;

    const clipped = requestSymbols.slice(0, Math.min(MAX_BATCH_SYMBOLS, requestSymbols.length));

    const bulk = await fetchTwelveDataBulk(now, clipped);
    if (!bulk.ok) {
      lastError = bulk.error;
      lastDecision = 'scheduled_refresh_failed';
      return false;
    }

    const nextCache = buildGroupCacheFromRates({
      now,
      group,
      ssotFingerprint,
      entries: groupEntries,
      ratesBySymbol: bulk.ratesBySymbol,
      seeded: false,
    });

    if (group === 'A') cacheA = nextCache;
    if (group === 'B') cacheB = nextCache;

    recomputeLastFetchSummary(now, ssotFingerprint);

    lastDecision = 'scheduled_refresh_ok';
    lastError = undefined;

    return true;
  } finally {
    inFlight = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function readEnvInt(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy compatibility: merged “cache mode” mapping used by UI
// ─────────────────────────────────────────────────────────────────────────────

export function toUiApiMode(payload: FxRibbonPayload): FxRibbonUiApiMode {
  // Keep UI mapping stable
  if (payload.meta.mode === 'live') return 'live';
  if (payload.meta.mode === 'stale') return 'cached';
  return 'fallback';
}

// ─────────────────────────────────────────────────────────────────────────────
// END
// ─────────────────────────────────────────────────────────────────────────────
