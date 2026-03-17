// src/hooks/use-indices-quotes.ts
// ============================================================================
// INDICES QUOTES HOOK - Centralised Polling for Stock Market Indices
// ============================================================================
// Transport: always GET /api/indices with credentials: 'same-origin'.
// The server derives tier and exchange selection from the Clerk session cookie.
// The browser never sends tier or exchangeIds — per Exchanges-Indice_paid-Free.md §7.1.
// Polling: immediate on first mount, then every 30 minutes.
// ============================================================================
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

import type { IndexQuote, IndexTick } from '@/types/index-quote';

// ============================================================================
// TYPES
// ============================================================================

export type IndicesQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseIndicesQuotesOptions {
  /** Enable/disable polling. Default: true */
  enabled?: boolean;
  /** Polling interval in ms. Default: 30 minutes */
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
  tick: IndexTick;
  change: number | null;
  percentChange: number | null;
  confidence: number;
}

export interface UseIndicesQuotesResult {
  status: IndicesQuotesStatus;
  error: unknown;
  payload: IndicesApiResponse | null;
  quotesById: Map<string, IndexQuote>;
  movementById: Map<string, IndicesMovement>;
  refresh: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_INTERVAL_MS = 30 * 60_000;
const MIN_INTERVAL_MS = 10_000;
const HIDDEN_VISIBILITY_MULTIPLIER = 3;
const MOVEMENT_APPEAR_THRESHOLD = 0.1;
const DEBUG_INDICES = process.env.NODE_ENV !== 'production';

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
    return { tick: 'flat', change: quote.change, percentChange: quote.percentChange, confidence: 0 };
  }
  return {
    tick: getTickFromChange(quote.change, quote.percentChange),
    change: quote.change,
    percentChange: quote.percentChange,
    confidence: Math.min(1, 0.5 + abs * 0.5),
  };
}

function processPayload(payload: IndicesApiResponse): {
  quotesById: Map<string, IndexQuote>;
  movementById: Map<string, IndicesMovement>;
} {
  const quotesById = new Map<string, IndexQuote>();
  const movementById = new Map<string, IndicesMovement>();
  for (const quote of payload.data ?? []) {
    if (!quote || typeof quote.id !== 'string') continue;
    quotesById.set(quote.id, quote);
    movementById.set(quote.id, computeMovement(quote));
  }
  debugLog('Payload processed', {
    totalQuotes: quotesById.size,
    withPrice: Array.from(quotesById.values()).filter((q) => q.price !== null).length,
    mode: payload.meta?.mode,
  });
  return { quotesById, movementById };
}

// ============================================================================
// STORE (single shared instance — server owns selection)
// ============================================================================

type StoreState = {
  status: IndicesQuotesStatus;
  error: unknown;
  payload: IndicesApiResponse | null;
  quotesById: Map<string, IndexQuote>;
  movementById: Map<string, IndicesMovement>;
};

type StoreEntry = {
  state: StoreState;
  listeners: Set<() => void>;
  enabledCount: number;
  timer: number | null;
  inFlight: Promise<void> | null;
  abort: AbortController | null;
  consumerIntervals: Map<number, number>;
  lastFetchTime: number;
};

const store: StoreEntry = {
  state: {
    status: 'idle',
    error: null,
    payload: null,
    quotesById: new Map(),
    movementById: new Map(),
  },
  listeners: new Set(),
  enabledCount: 0,
  timer: null,
  inFlight: null,
  abort: null,
  consumerIntervals: new Map(),
  lastFetchTime: 0,
};

let nextConsumerId = 1;

function emit() {
  for (const l of store.listeners) l();
}

function setState(next: Partial<StoreState>) {
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
    debugLog('Fetch skipped — already in flight');
    return store.inFlight;
  }

  store.abort?.abort();
  store.abort = new AbortController();

  debugLog('Starting fetch GET /api/indices');

  store.inFlight = (async () => {
    try {
      setState({ status: store.state.status === 'idle' ? 'loading' : store.state.status });

      const startTime = Date.now();

      // Always GET. The /api/indices route reads the Clerk session cookie and
      // derives tier + selection server-side. The browser never sends these.
      const res = await fetch('/api/indices', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: store.abort?.signal,
      });

      debugLog('Fetch response', { status: res.status, ok: res.ok, elapsedMs: Date.now() - startTime });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Indices API ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
      }

      const json = (await res.json()) as IndicesApiResponse;
      const derived = processPayload(json);
      store.lastFetchTime = Date.now();
      setState({ payload: json, error: null, status: 'ready', ...derived });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        debugLog('Fetch aborted');
        return;
      }
      debugLog('Fetch error', { error: err instanceof Error ? err.message : String(err) });
      setState({ error: err, status: store.state.payload ? 'ready' : 'error' });
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

function scheduleNext() {
  clearTimer();
  if (store.enabledCount <= 0) return;
  const intervalMs = getEffectiveIntervalMs();
  const adjusted = getPollingIntervalForVisibility(intervalMs);
  debugLog('Scheduling next fetch', { inMinutes: Math.round(adjusted / 60000) });
  store.timer = window.setTimeout(async () => {
    await fetchIndicesOnce();
    scheduleNext();
  }, adjusted);
}

function startPolling() {
  debugLog('Triggering immediate startup fetch');
  fetchIndicesOnce().then(() => scheduleNext());
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

let visibilityListenerAttached = false;

function ensureVisibilityListener() {
  if (typeof document === 'undefined') return;
  if (visibilityListenerAttached) return;
  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (store.enabledCount <= 0) return;
    debugLog('Visibility changed, rescheduling');
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

  // Mount / unmount
  useEffect(() => {
    ensureVisibilityListener();
    const id = nextConsumerId++;
    consumerIdRef.current = id;
    const unsub = subscribe(() => setTick((v) => v + 1));
    return () => {
      unsub();
      store.consumerIntervals.delete(id);
      consumerIdRef.current = null;
    };
  }, []);

  // Enable / disable polling
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;
    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
    if (enabled) {
      store.enabledCount += 1;
      if (store.enabledCount === 1) startPolling();
    }
    return () => {
      if (enabled) {
        store.enabledCount = Math.max(0, store.enabledCount - 1);
        if (store.enabledCount <= 0) clearTimerAndAbort();
        else scheduleNext();
      }
    };
  }, [enabled, intervalMs]);

  // Update interval when it changes
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null || !enabled) return;
    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
  }, [enabled, intervalMs]);

  const refresh = useMemo(() => async () => {
    debugLog('Manual refresh triggered');
    await fetchIndicesOnce();
  }, []);

  return {
    status: store.state.status,
    error: store.state.error,
    payload: store.state.payload,
    quotesById: store.state.quotesById,
    movementById: store.state.movementById,
    refresh,
  };
}

// ============================================================================
// DEBUG HELPERS (dev only)
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
    effectiveIntervalMs: getEffectiveIntervalMs(),
    lastFetchTime: store.lastFetchTime ? toIso(store.lastFetchTime) : null,
    meta: s.payload?.meta ?? null,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__forceIndicesRefresh = async () => {
    await fetchIndicesOnce();
    return getIndicesQuotesDebugSnapshot();
  };
  (window as unknown as Record<string, unknown>).__getIndicesDebug = () => {
    return getIndicesQuotesDebugSnapshot();
  };
}
