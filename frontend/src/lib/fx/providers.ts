// frontend/src/lib/fx/providers.ts
/**
 * FX providers - Gateway Client
 * =============================
 *
 * This module now calls the Fly.io gateway for all FX data.
 * The gateway handles: caching, budget tracking, rate limiting, circuit breaking.
 *
 * Change List:
 * - REPLACE: Direct TwelveData calls → Fly.io gateway calls
 * - REPLACE: Local caching/budget logic → Gateway handles this
 * - PRESERVE: All exported types and functions (API surface unchanged)
 * - PRESERVE: normaliseSymbol export
 * - PRESERVE: getFxProviderSummary(mode, sourceProvider) signature
 * - PRESERVE: Trace snapshot for diagnostics
 * - ADD: Fallback to direct TwelveData if gateway unreachable
 *
 * Existing features preserved: Yes (API surface unchanged)
 */

import { unstable_noStore } from 'next/cache';

import { assertFxRibbonSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';
import { env } from '@/lib/env';
import { getBudgetGuardEmoji } from '@/data/emoji/emoji';

// ─────────────────────────────────────────────────────────────────────────────
// Exported Types (unchanged for compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export type FxRibbonGroupId = 'A' | 'B';

export type FxRibbonUiApiMode = 'live' | 'cached' | 'fallback';

export type FxRibbonBudgetState = 'ok' | 'warning' | 'blocked';

export type FxRibbonBudgetIndicator = {
  state: FxRibbonBudgetState;
  emoji?: string;
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
  ttlSeconds: number;
  ssotKey: string;
  inFlight: boolean;
  budget: FxRibbonBudgetSnapshot;
  budgetIndicator: FxRibbonBudgetIndicator;
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
    cycleDue?: boolean;
  };
  groups: {
    A: FxRibbonGroupTrace;
    B: FxRibbonGroupTrace;
  };
};

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
    sourceProvider: string;
    asOf: string;
    cached: boolean;
    ttlSeconds: number;
    ssotKey: string;
    budget: FxRibbonBudgetIndicator;
  };
  data: FxRibbonQuote[];
};

type FxMode = 'live' | 'cached' | 'fallback';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Gateway URL (Fly.io) – resolves whichever env var is set (dev or prod)
const GATEWAY_URL =
  process.env['GATEWAY_URL'] ??
  process.env['NEXT_PUBLIC_GATEWAY_URL'] ??
  process.env['FX_GATEWAY_URL'] ??
  'https://promagen-api.fly.dev';

// Fallback: Direct TwelveData (only if gateway fails)
const TWELVEDATA_API_KEY = (env.providers.twelveDataApiKey ?? '').trim();
const TWELVEDATA_DISABLED = env.safeMode.disableTwelveData;
const SAFE_MODE_ENABLED = env.safeMode.enabled;

// TTL (in seconds) – matches gateway default
const BASE_TTL_SECONDS = readEnvInt('FX_RIBBON_TTL_SECONDS', 300);

// Budget limits (for trace display)
const BUDGET_DAILY_ALLOWANCE = readEnvInt('FX_RIBBON_BUDGET_DAILY_ALLOWANCE', 800);
const BUDGET_MINUTE_ALLOWANCE = readEnvInt('FX_RIBBON_BUDGET_MINUTE_ALLOWANCE', 8);

// ─────────────────────────────────────────────────────────────────────────────
// Gateway Response Types
// ─────────────────────────────────────────────────────────────────────────────

type GatewayResponse = {
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'error';
    cachedAt?: string;
    expiresAt?: string;
    provider: string;
    budget: {
      state: 'ok' | 'warning' | 'blocked';
      dailyUsed: number;
      dailyLimit: number;
      minuteUsed: number;
      minuteLimit: number;
    };
  };
  data: Array<{
    id: string;
    base: string;
    quote: string;
    price: number | null;
    symbol: string;
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory State (for trace compatibility)
// ─────────────────────────────────────────────────────────────────────────────

let inFlight = false;
let ribbonCalls = 0;
let upstreamCalls = 0;
let upstream429s = 0;
let lastDecision: string | undefined;
let lastError: string | undefined;
let lastGatewayResponse: GatewayResponse | undefined;
let lastFetchAt: string | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Exported: normaliseSymbol (required by tests)
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

// ─────────────────────────────────────────────────────────────────────────────
// Exported: getFxProviderSummary (required by UI components and tests)
// Signature: (mode, sourceProvider) -> { meta: { id, name }, modeLabel, emphasiseFallback }
// ─────────────────────────────────────────────────────────────────────────────

export function getFxProviderSummary(
  mode: FxRibbonUiApiMode | null,
  sourceProvider: string | null,
) {
  const id = (sourceProvider ?? 'twelvedata').trim() || 'twelvedata';
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

// ─────────────────────────────────────────────────────────────────────────────
// SSOT Key Generation
// ─────────────────────────────────────────────────────────────────────────────

function getSsotKey(): string {
  try {
    assertFxRibbonSsotValid();
    const pairs = getFxRibbonPairs();
    const ids = pairs
      .map((p) => p.id)
      .sort()
      .join(',');
    const hash = simpleHash(ids);
    return `fx:ribbon:${hash}`;
  } catch {
    return 'fx:ribbon:invalid';
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget Emoji (from SSOT)
// ─────────────────────────────────────────────────────────────────────────────

function mustBudgetEmoji(state: FxRibbonBudgetState): string {
  const emoji = getBudgetGuardEmoji(state);
  return typeof emoji === 'string' ? emoji : '🟢';
}

function toBudgetIndicator(state: FxRibbonBudgetState): FxRibbonBudgetIndicator {
  return {
    state,
    emoji: mustBudgetEmoji(state),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway Fetch
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFromGateway(): Promise<GatewayResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${GATEWAY_URL}/fx`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      lastError = `Gateway ${res.status} ${res.statusText}`;
      return null;
    }

    const json = (await res.json()) as GatewayResponse;
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    lastError = err instanceof Error ? err.message : 'Gateway fetch failed';
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct TwelveData Fallback (if gateway unreachable)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDirectFallback(ssotKey: string): Promise<FxRibbonPayload> {
  const now = Date.now();

  if (TWELVEDATA_DISABLED || !TWELVEDATA_API_KEY) {
    return buildFallbackPayload(ssotKey, 'twelvedata_disabled');
  }

  try {
    const pairs = getFxRibbonPairs();
    const symbols = pairs.map((p) => `${p.base}/${p.quote}`).join(',');

    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(
      symbols,
    )}&apikey=${encodeURIComponent(TWELVEDATA_API_KEY)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 429) {
      upstream429s += 1;
      return buildFallbackPayload(ssotKey, 'direct_429');
    }

    if (!res.ok) {
      return buildFallbackPayload(ssotKey, 'direct_error');
    }

    const json = (await res.json()) as Record<string, unknown>;
    upstreamCalls += 1;

    const quotes: FxRibbonQuote[] = pairs.map((pair) => {
      const symbol = `${pair.base}/${pair.quote}`;
      const entry = json[symbol] as Record<string, unknown> | undefined;
      let price: number | null = null;

      if (entry && typeof entry['price'] === 'string') {
        const parsed = parseFloat(entry['price']);
        if (Number.isFinite(parsed) && parsed > 0) {
          price = parsed;
        }
      }

      return {
        id: pair.id,
        base: pair.base,
        quote: pair.quote,
        price,
        providerSymbol: symbol,
      };
    });

    lastDecision = 'direct_fallback_live';
    lastFetchAt = new Date(now).toISOString();

    return {
      meta: {
        mode: 'live',
        buildId: 'direct-fallback',
        sourceProvider: 'twelvedata',
        asOf: new Date(now).toISOString(),
        cached: false,
        ttlSeconds: BASE_TTL_SECONDS,
        ssotKey,
        budget: toBudgetIndicator('warning'), // Direct calls bypass gateway budget
      },
      data: quotes,
    };
  } catch {
    return buildFallbackPayload(ssotKey, 'direct_fetch_failed');
  }
}

function buildFallbackPayload(ssotKey: string, reason: string): FxRibbonPayload {
  lastDecision = reason;

  const pairs = getFxRibbonPairs();
  const quotes: FxRibbonQuote[] = pairs.map((pair) => ({
    id: pair.id,
    base: pair.base,
    quote: pair.quote,
    price: null,
    providerSymbol: `${pair.base}/${pair.quote}`,
  }));

  return {
    meta: {
      mode: 'fallback',
      buildId: 'fallback',
      sourceProvider: 'none',
      asOf: new Date().toISOString(),
      cached: false,
      ttlSeconds: BASE_TTL_SECONDS,
      ssotKey,
      budget: toBudgetIndicator('blocked'),
    },
    data: quotes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export: getFxRibbon
// ─────────────────────────────────────────────────────────────────────────────

export async function getFxRibbon(): Promise<FxRibbonPayload> {
  unstable_noStore();

  ribbonCalls += 1;
  const ssotKey = getSsotKey();

  // Safe mode: return fallback
  if (SAFE_MODE_ENABLED) {
    lastDecision = 'safe_mode';
    return buildFallbackPayload(ssotKey, 'safe_mode');
  }

  // Prevent concurrent requests
  if (inFlight) {
    await sleep(50);
    if (lastGatewayResponse) {
      return mapGatewayResponse(lastGatewayResponse, ssotKey);
    }
    return buildFallbackPayload(ssotKey, 'in_flight_no_cache');
  }

  inFlight = true;

  try {
    // Try gateway first
    const gatewayResponse = await fetchFromGateway();

    if (gatewayResponse) {
      lastGatewayResponse = gatewayResponse;
      lastDecision = `gateway_${gatewayResponse.meta.mode}`;
      lastFetchAt = gatewayResponse.meta.cachedAt ?? new Date().toISOString();
      upstreamCalls += 1;

      return mapGatewayResponse(gatewayResponse, ssotKey);
    }

    // Gateway failed - try direct TwelveData as fallback
    lastDecision = 'gateway_failed_trying_direct';
    return await fetchDirectFallback(ssotKey);
  } finally {
    inFlight = false;
  }
}

function mapGatewayResponse(gw: GatewayResponse, ssotKey: string): FxRibbonPayload {
  // Map gateway mode to frontend mode
  let mode: FxMode;
  switch (gw.meta.mode) {
    case 'live':
      mode = 'live';
      break;
    case 'cached':
    case 'stale':
      mode = 'cached';
      break;
    case 'error':
    default:
      mode = 'fallback';
  }

  // Map gateway data to frontend format
  const quotes: FxRibbonQuote[] = gw.data.map((item) => ({
    id: item.id,
    base: item.base,
    quote: item.quote,
    price: item.price,
    providerSymbol: item.symbol,
  }));

  return {
    meta: {
      mode,
      buildId: 'gateway',
      sourceProvider: gw.meta.provider,
      asOf: gw.meta.cachedAt ?? new Date().toISOString(),
      cached: mode === 'cached',
      ttlSeconds: BASE_TTL_SECONDS,
      ssotKey,
      budget: toBudgetIndicator(gw.meta.budget.state),
    },
    data: quotes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trace Exports (for diagnostics)
// ─────────────────────────────────────────────────────────────────────────────

export function getFxRibbonTraceSnapshot(): FxRibbonTraceSnapshot {
  const ssotKey = getSsotKey();

  const gwBudget = lastGatewayResponse?.meta.budget;

  const budgetSnapshot: FxRibbonBudgetSnapshot = {
    state: gwBudget?.state ?? 'ok',
    dayKey: new Date().toISOString().slice(0, 10),
    daily: {
      allowance: gwBudget?.dailyLimit ?? BUDGET_DAILY_ALLOWANCE,
      used: gwBudget?.dailyUsed ?? 0,
      warnAt: Math.floor((gwBudget?.dailyLimit ?? BUDGET_DAILY_ALLOWANCE) * 0.7),
      blockAt: Math.floor((gwBudget?.dailyLimit ?? BUDGET_DAILY_ALLOWANCE) * 0.95),
      remaining: (gwBudget?.dailyLimit ?? BUDGET_DAILY_ALLOWANCE) - (gwBudget?.dailyUsed ?? 0),
      pctUsed: gwBudget ? gwBudget.dailyUsed / gwBudget.dailyLimit : 0,
    },
    minute: {
      windowSeconds: 60,
      allowance: gwBudget?.minuteLimit ?? BUDGET_MINUTE_ALLOWANCE,
      used: gwBudget?.minuteUsed ?? 0,
      warnAt: Math.floor((gwBudget?.minuteLimit ?? BUDGET_MINUTE_ALLOWANCE) * 0.7),
      blockAt: gwBudget?.minuteLimit ?? BUDGET_MINUTE_ALLOWANCE,
      remaining: (gwBudget?.minuteLimit ?? BUDGET_MINUTE_ALLOWANCE) - (gwBudget?.minuteUsed ?? 0),
      pctUsed: gwBudget ? gwBudget.minuteUsed / gwBudget.minuteLimit : 0,
    },
  };

  const emptyGroupTrace: FxRibbonGroupTrace = {
    hasValue: false,
    inFlight: false,
    expectedSymbols: 0,
    missingCount: 0,
    missingSymbols: [],
  };

  const hasCache = !!lastGatewayResponse;
  const cacheAsOf = lastGatewayResponse?.meta.cachedAt;
  const cacheExpiresAt = lastGatewayResponse?.meta.expiresAt;

  return {
    ttlSeconds: BASE_TTL_SECONDS,
    ssotKey,
    inFlight,
    budget: budgetSnapshot,
    budgetIndicator: toBudgetIndicator(budgetSnapshot.state),
    cache: {
      hasValue: hasCache,
      asOf: cacheAsOf,
      expiresAt: cacheExpiresAt,
      key: hasCache ? 'gateway' : undefined,
    },
    lastFetch: {
      at: lastFetchAt,
      expectedSymbols: lastGatewayResponse?.data.length ?? 0,
      missingCount: lastGatewayResponse?.data.filter((q) => q.price === null).length ?? 0,
      missingSymbols:
        lastGatewayResponse?.data.filter((q) => q.price === null).map((q) => q.symbol) ?? [],
    },
    lastDecision,
    lastError,
    counters: {
      ribbonCalls,
      upstreamCalls,
      upstream429s,
    },
    rateLimit: {
      until: undefined,
      reason: undefined,
    },
    traffic: {
      windowSeconds: 60,
      hitsInWindow: ribbonCalls,
      factor: 1,
    },
    schedule: {
      cycleIndex: 0,
      scheduledGroup: 'A',
      cycleLengthSeconds: 60,
      cycleDue: false,
    },
    groups: {
      A: emptyGroupTrace,
      B: emptyGroupTrace,
    },
  };
}

export function getFxRibbonBudgetSnapshot(): FxRibbonBudgetSnapshot {
  const trace = getFxRibbonTraceSnapshot();
  return trace.budget;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Mode Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function toUiApiMode(payload: FxRibbonPayload): FxRibbonUiApiMode {
  if (payload.meta.mode === 'live') return 'live';
  if (payload.meta.mode === 'cached') return 'cached';
  return 'fallback';
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function readEnvInt(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// END
// ─────────────────────────────────────────────────────────────────────────────
