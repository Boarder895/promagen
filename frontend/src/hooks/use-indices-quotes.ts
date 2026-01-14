// src/hooks/use-indices-quotes.ts
// ============================================================================
// INDICES QUOTES HOOK - Centralized Polling for Stock Market Indices
// ============================================================================
// Fetches index data from /api/indices.
//
// FIXED (2026-01-13): Removed delayed initial fetch - now fetches IMMEDIATELY
// on first consumer mount. Users shouldn't wait 30+ minutes to see data.
//
// Polling continues at 30-minute intervals after initial fetch.
//
// Existing features preserved: Yes
// ============================================================================
'use client';

import { useEffect, useRef, useState } from 'react';

import type { IndexQuote, IndexTick } from '@/types/index-quote';

// ============================================================================
// TYPES
// ============================================================================

export type IndicesQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseIndicesQuotesOptions {
  /** Enable/disable polling. Default: true */
  enabled?: boolean;
  /** Polling interval in ms. Default: 30 minutes (indices update slowly) */
  intervalMs?: number;
}

export type IndicesBudgetState = 'ok' | 'warning' | 'blocked';

export interface IndicesApiResponse {
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'error';
    cachedAt?: string;
    expiresAt?: string;
    provider: string;
    ssotSource: 'frontend' | 'fallback';
    budget?: {
      state?: IndicesBudgetState;
      dailyUsed?: number;
      dailyLimit?: number;
      minuteUsed?: number;
      minuteLimit?: number;
    };
    requestedExchanges?: string[];
  };
  data: IndexQuote[];
}

export interface IndicesMovement {
  /** Direction of price movement */
  tick: IndexTick;
  /** Absolute change value */
  change: number | null;
  /** Percentage change */
  percentChange: number | null;
  /** Visual confidence (0-1) for UI opacity */
  confidence: number;
}

export interface UseIndicesQuotesResult {
  status: IndicesQuotesStatus;
  error: unknown;
  /** Full API response payload */
  payload: IndicesApiResponse | null;
  /** Quick lookup by exchange ID */
  quotesById: Map<string, IndexQuote>;
  /** Movement data by exchange ID */
  movementById: Map<string, IndicesMovement>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Default polling interval: 30 minutes (indices don't change as fast)
const DEFAULT_INTERVAL_MS = 30 * 60_000;

// Minimum interval to prevent hammering
const MIN_INTERVAL_MS = 10_000;

// Hidden tab multiplier
const HIDDEN_VISIBILITY_MULTIPLIER = 6;

// Threshold for showing movement indicator (percentage)
const MOVEMENT_APPEAR_THRESHOLD = 0.1; // 0.1% change

// Debug flag - set to true to see all console logs
const DEBUG_INDICES = true;

// ============================================================================
// DEBUG LOGGER
// ============================================================================

function debugLog(message: string, data?: Record<string, unknown>): void {
  if (!DEBUG_INDICES) return;
  const timestamp = new Date().toISOString().slice(11, 23);
  if (data) {
    // eslint-disable-next-line no-console
    console.log(`[INDICES ${timestamp}] ${message}`, data);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[INDICES ${timestamp}] ${message}`);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function nowMs(): number {
  return Date.now();
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function getTickFromChange(change: number | null, percentChange: number | null): IndexTick {
  if (change === null && percentChange === null) return 'flat';
  const pct = percentChange ?? 0;
  if (Math.abs(pct) < MOVEMENT_APPEAR_THRESHOLD) return 'flat';
  return pct > 0 ? 'up' : 'down';
}

function computeMovement(quote: IndexQuote): IndicesMovement {
  const pct = quote.percentChange ?? 0;
  const abs = Math.abs(pct);

  if (abs < MOVEMENT_APPEAR_THRESHOLD) {
    return {
      tick: 'flat',
      change: quote.change,
      percentChange: quote.percentChange,
      confidence: 0,
    };
  }

  // Map percentage to confidence (0.5-1.0 range)
  const confidence = Math.min(1, 0.5 + abs * 0.5);

  return {
    tick: getTickFromChange(quote.change, quote.percentChange),
    change: quote.change,
    percentChange: quote.percentChange,
    confidence,
  };
}

function processPayload(payload: IndicesApiResponse): {
  quotesById: Map<string, IndexQuote>;
  movementById: Map<string, IndicesMovement>;
} {
  const quotesById = new Map<string, IndexQuote>();
  const movementById = new Map<string, IndicesMovement>();

  const quotes = payload.data ?? [];

  debugLog('Processing payload', {
    quoteCount: quotes.length,
    mode: payload.meta?.mode,
    provider: payload.meta?.provider,
    ssotSource: payload.meta?.ssotSource,
  });

  for (const quote of quotes) {
    if (!quote || typeof quote.id !== 'string') continue;

    quotesById.set(quote.id, quote);
    movementById.set(quote.id, computeMovement(quote));

    // Log first few quotes for debugging
    if (quotesById.size <= 3) {
      debugLog(`Quote: ${quote.id}`, {
        indexName: quote.indexName,
        price: quote.price,
        change: quote.change,
        percentChange: quote.percentChange,
      });
    }
  }

  debugLog('Payload processed', {
    totalQuotes: quotesById.size,
    withPrice: Array.from(quotesById.values()).filter((q) => q.price !== null).length,
  });

  return { quotesById, movementById };
}

// ============================================================================
// STORE (Centralized polling - single timer for all consumers)
// ============================================================================

type Store = {
  state: UseIndicesQuotesResult;
  listeners: Set<() => void>;

  enabledCount: number;

  timer: number | null;

  inFlight: Promise<void> | null;
  abort: AbortController | null;

  consumerIntervals: Map<number, number>;
  nextConsumerId: number;

  initialFetchDone: boolean;
};

const emptyState: UseIndicesQuotesResult = {
  status: 'idle',
  error: null,
  payload: null,
  quotesById: new Map(),
  movementById: new Map(),
};

const store: Store = {
  state: emptyState,
  listeners: new Set(),
  enabledCount: 0,
  timer: null,
  inFlight: null,
  abort: null,
  consumerIntervals: new Map(),
  nextConsumerId: 1,
  initialFetchDone: false,
};

function emit() {
  for (const l of store.listeners) l();
}

function setState(next: Partial<UseIndicesQuotesResult>) {
  store.state = { ...store.state, ...next };
  emit();
}

function clearTimer() {
  if (store.timer !== null) {
    window.clearTimeout(store.timer);
    store.timer = null;
  }
}

function getEffectiveIntervalMs(): number {
  const values = Array.from(store.consumerIntervals.values());
  const want = values.length ? Math.min(...values) : DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, want);
}

function getPollingIntervalForVisibility(baseMs: number): number {
  if (typeof document === 'undefined') return baseMs;
  if (document.visibilityState === 'hidden') return baseMs * HIDDEN_VISIBILITY_MULTIPLIER;
  return baseMs;
}

async function fetchIndicesOnce(): Promise<void> {
  if (store.inFlight) {
    debugLog('Fetch skipped - already in flight');
    return store.inFlight;
  }

  store.abort?.abort();
  store.abort = new AbortController();

  debugLog('Starting fetch...', { currentStatus: store.state.status });

  store.inFlight = (async () => {
    try {
      setState({ status: store.state.status === 'idle' ? 'loading' : store.state.status });

      const startTime = Date.now();
      const res = await fetch('/api/indices', {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'omit', // Cookie-free for CDN caching
        signal: store.abort?.signal,
      });

      const elapsed = Date.now() - startTime;
      debugLog('Fetch response', {
        status: res.status,
        ok: res.ok,
        elapsedMs: elapsed,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        debugLog('Fetch failed', { status: res.status, body: text.slice(0, 200) });
        throw new Error(`Indices API ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
      }

      const json = (await res.json()) as IndicesApiResponse;

      debugLog('JSON received', {
        hasData: Array.isArray(json?.data),
        dataLength: json?.data?.length ?? 0,
        meta: json?.meta,
      });

      const derived = processPayload(json);

      setState({
        payload: json,
        error: null,
        status: 'ready',
        quotesById: derived.quotesById,
        movementById: derived.movementById,
      });

      debugLog('State updated to ready', { quoteCount: derived.quotesById.size });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        debugLog('Fetch aborted');
        return;
      }

      debugLog('Fetch error', {
        error: err instanceof Error ? err.message : String(err),
      });

      setState({
        error: err,
        status: store.state.payload ? 'ready' : 'error',
      });
    } finally {
      store.inFlight = null;
    }
  })();

  return store.inFlight;
}

function clearTimerAndAbort() {
  clearTimer();
  store.abort?.abort();
  store.abort = null;
  store.inFlight = null;
}

/**
 * FIXED: Fetch immediately on first consumer mount.
 * No more waiting for schedule alignment.
 */
function startPolling() {
  debugLog('startPolling called', {
    initialFetchDone: store.initialFetchDone,
    enabledCount: store.enabledCount,
  });

  // Fetch immediately if not done yet
  if (!store.initialFetchDone) {
    store.initialFetchDone = true;
    debugLog('Triggering IMMEDIATE initial fetch');
    fetchIndicesOnce().then(() => {
      scheduleNext();
    });
  } else {
    scheduleNext();
  }
}

function scheduleNext() {
  clearTimer();

  if (store.enabledCount <= 0) {
    debugLog('scheduleNext: no enabled consumers, not scheduling');
    return;
  }

  const intervalMs = getEffectiveIntervalMs();
  const adjustedInterval = getPollingIntervalForVisibility(intervalMs);

  debugLog('Scheduling next fetch', {
    intervalMs,
    adjustedInterval,
    inMinutes: Math.round(adjustedInterval / 60000),
  });

  store.timer = window.setTimeout(async () => {
    debugLog('Timer fired, fetching...');
    await fetchIndicesOnce();
    scheduleNext();
  }, adjustedInterval);
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function ensureVisibilityListener() {
  if (typeof document === 'undefined') return;

  const key = '__indices_quotes_visibility_listener_attached__';
  const anyDoc = document as unknown as Record<string, unknown>;
  if (anyDoc[key]) return;
  anyDoc[key] = true;

  document.addEventListener('visibilitychange', () => {
    if (store.enabledCount <= 0) return;
    debugLog('Visibility changed', { state: document.visibilityState });
    scheduleNext();
  });
}

// ============================================================================
// HOOK
// ============================================================================

export function useIndicesQuotes(options?: UseIndicesQuotesOptions): UseIndicesQuotesResult {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const consumerIdRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  // Setup: runs once on mount, cleanup on unmount
  useEffect(() => {
    ensureVisibilityListener();

    const id = store.nextConsumerId++;
    consumerIdRef.current = id;

    debugLog('Consumer mounted', { id });

    const unsub = subscribe(() => setTick((v) => v + 1));

    return () => {
      debugLog('Consumer unmounting', { id });
      unsub();
      store.consumerIntervals.delete(id);
      consumerIdRef.current = null;
    };
  }, []);

  // Enable/disable polling based on options
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));

    if (enabled) {
      store.enabledCount += 1;
      debugLog('Consumer enabled', { id, enabledCount: store.enabledCount });

      if (store.enabledCount === 1) {
        startPolling();
      }
    }

    return () => {
      if (enabled) {
        store.enabledCount = Math.max(0, store.enabledCount - 1);
        debugLog('Consumer disabled', { id, enabledCount: store.enabledCount });

        if (store.enabledCount <= 0) {
          clearTimerAndAbort();
        } else {
          scheduleNext();
        }
      }
    };
  }, [enabled, intervalMs]);

  // Update interval when it changes
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;
    if (!enabled) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
  }, [enabled, intervalMs]);

  return store.state;
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

export function getIndicesQuotesDebugSnapshot() {
  const s = store.state;
  return {
    at: toIso(nowMs()),
    status: s.status,
    hasPayload: Boolean(s.payload),
    quoteCount: s.quotesById.size,
    quotesWithPrice: Array.from(s.quotesById.values()).filter((q) => q.price !== null).length,
    enabledCount: store.enabledCount,
    consumerIntervals: Array.from(store.consumerIntervals.values()),
    effectiveIntervalMs: getEffectiveIntervalMs(),
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    initialFetchDone: store.initialFetchDone,
    meta: s.payload?.meta ?? null,
  };
}

/**
 * Force a refresh - useful for debugging.
 * Call from browser console: window.__forceIndicesRefresh()
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__forceIndicesRefresh = async () => {
    debugLog('MANUAL REFRESH TRIGGERED');
    store.initialFetchDone = true;
    await fetchIndicesOnce();
    return getIndicesQuotesDebugSnapshot();
  };

  (window as unknown as Record<string, unknown>).__getIndicesDebug = () => {
    return getIndicesQuotesDebugSnapshot();
  };
}
