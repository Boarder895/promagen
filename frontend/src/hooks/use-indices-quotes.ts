// src/hooks/use-indices-quotes.ts
// ============================================================================
// INDICES QUOTES HOOK - Centralized Polling for Stock Market Indices
// ============================================================================
// Fetches index data from /api/indices.
//
// UPDATED (2026-01-17): Now tier-aware!
// - FREE users: GET /api/indices (uses SSOT defaults)
// - PAID users: POST /api/indices with custom exchangeIds
//
// When exchangeIds changes (e.g., user customizes selection), the hook
// automatically re-fetches with the new selection.
//
// FIXED (2026-01-13): Removed delayed initial fetch - now fetches IMMEDIATELY
// on first consumer mount. Users shouldn't wait 30+ minutes to see data.
//
// Polling continues at 30-minute intervals after initial fetch.
//
// Existing features preserved: Yes
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
  /** Polling interval in ms. Default: 30 minutes (indices update slowly) */
  intervalMs?: number;
  /**
   * Custom exchange IDs to fetch (for paid users).
   * If provided, uses POST /api/indices with these IDs.
   * If undefined/empty, uses GET /api/indices (SSOT defaults).
   */
  exchangeIds?: string[];
  /**
   * User tier for authorization. Required when exchangeIds is provided.
   * Default: 'free'
   */
  userTier?: 'free' | 'paid';
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
  /** Currently requested exchange IDs */
  requestedExchangeIds: string[];
  /** Trigger immediate refresh */
  refresh: () => Promise<void>;
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

/**
 * Generate a cache key for the current exchange selection.
 * Different selections should not share cache entries.
 */
function getSelectionKey(exchangeIds: string[] | undefined): string {
  if (!exchangeIds || exchangeIds.length === 0) return 'default';
  // Sort for consistent key regardless of order
  return [...exchangeIds].sort().join(',');
}

// ============================================================================
// STORE (Centralized polling - keyed by selection)
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
  exchangeIds: string[] | undefined;
  userTier: 'free' | 'paid';
};

const emptyState: StoreState = {
  status: 'idle',
  error: null,
  payload: null,
  quotesById: new Map(),
  movementById: new Map(),
};

// Map of selection key → store entry (supports multiple independent selections)
const stores = new Map<string, StoreEntry>();

let nextConsumerId = 1;

function getOrCreateStore(
  selectionKey: string,
  exchangeIds: string[] | undefined,
  userTier: 'free' | 'paid',
): StoreEntry {
  let entry = stores.get(selectionKey);
  if (!entry) {
    entry = {
      state: { ...emptyState, quotesById: new Map(), movementById: new Map() },
      listeners: new Set(),
      enabledCount: 0,
      timer: null,
      inFlight: null,
      abort: null,
      consumerIntervals: new Map(),
      lastFetchTime: 0,
      exchangeIds,
      userTier,
    };
    stores.set(selectionKey, entry);
    debugLog('Created new store entry', { selectionKey, exchangeCount: exchangeIds?.length ?? 0 });
  }
  // Update tier in case it changed
  entry.userTier = userTier;
  return entry;
}

function emit(store: StoreEntry) {
  for (const l of store.listeners) l();
}

function setState(store: StoreEntry, next: Partial<StoreState>) {
  store.state = { ...store.state, ...next };
  emit(store);
}

function clearTimer(store: StoreEntry) {
  if (store.timer !== null) {
    window.clearTimeout(store.timer);
    store.timer = null;
  }
}

function getEffectiveIntervalMs(store: StoreEntry): number {
  const values = Array.from(store.consumerIntervals.values());
  const want = values.length ? Math.min(...values) : DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, want);
}

function getPollingIntervalForVisibility(baseMs: number): number {
  if (typeof document === 'undefined') return baseMs;
  if (document.visibilityState === 'hidden') return baseMs * HIDDEN_VISIBILITY_MULTIPLIER;
  return baseMs;
}

async function fetchIndicesOnce(store: StoreEntry): Promise<void> {
  if (store.inFlight) {
    debugLog('Fetch skipped - already in flight');
    return store.inFlight;
  }

  store.abort?.abort();
  store.abort = new AbortController();

  const exchangeIds = store.exchangeIds;
  const userTier = store.userTier;
  const usePost = userTier === 'paid' && exchangeIds && exchangeIds.length > 0;

  debugLog('Starting fetch...', {
    currentStatus: store.state.status,
    method: usePost ? 'POST' : 'GET',
    exchangeCount: exchangeIds?.length ?? 'default',
    userTier,
  });

  store.inFlight = (async () => {
    try {
      setState(store, { status: store.state.status === 'idle' ? 'loading' : store.state.status });

      const startTime = Date.now();

      let res: Response;

      if (usePost) {
        // POST request for paid users with custom selection
        res = await fetch('/api/indices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin', // Include auth cookies
          signal: store.abort?.signal,
          body: JSON.stringify({
            exchangeIds,
            tier: userTier,
          }),
        });
      } else {
        // GET request for free users (SSOT defaults)
        res = await fetch('/api/indices', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'omit', // Cookie-free for CDN caching
          signal: store.abort?.signal,
        });
      }

      const elapsed = Date.now() - startTime;
      debugLog('Fetch response', {
        status: res.status,
        ok: res.ok,
        elapsedMs: elapsed,
        method: usePost ? 'POST' : 'GET',
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

      store.lastFetchTime = Date.now();

      setState(store, {
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

      setState(store, {
        error: err,
        status: store.state.payload ? 'ready' : 'error',
      });
    } finally {
      store.inFlight = null;
    }
  })();

  return store.inFlight;
}

function clearTimerAndAbort(store: StoreEntry) {
  clearTimer(store);
  store.abort?.abort();
  store.abort = null;
  store.inFlight = null;
}

function scheduleNext(store: StoreEntry) {
  clearTimer(store);

  if (store.enabledCount <= 0) {
    debugLog('scheduleNext: no enabled consumers, not scheduling');
    return;
  }

  const intervalMs = getEffectiveIntervalMs(store);
  const adjustedInterval = getPollingIntervalForVisibility(intervalMs);

  debugLog('Scheduling next fetch', {
    intervalMs,
    adjustedInterval,
    inMinutes: Math.round(adjustedInterval / 60000),
  });

  store.timer = window.setTimeout(async () => {
    debugLog('Timer fired, fetching...');
    await fetchIndicesOnce(store);
    scheduleNext(store);
  }, adjustedInterval);
}

function startPolling(store: StoreEntry) {
  debugLog('startPolling called', {
    enabledCount: store.enabledCount,
    lastFetchTime: store.lastFetchTime,
  });

  // Always trigger one immediate fetch when polling starts
  debugLog('Triggering IMMEDIATE startup fetch');
  fetchIndicesOnce(store).then(() => {
    scheduleNext(store);
  });
}

function subscribe(store: StoreEntry, listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

// Global visibility listener (shared across all stores)
let visibilityListenerAttached = false;

function ensureVisibilityListener() {
  if (typeof document === 'undefined') return;
  if (visibilityListenerAttached) return;
  visibilityListenerAttached = true;

  document.addEventListener('visibilitychange', () => {
    // Reschedule all active stores
    for (const store of stores.values()) {
      if (store.enabledCount <= 0) continue;
      debugLog('Visibility changed, rescheduling', { state: document.visibilityState });
      scheduleNext(store);
    }
  });
}

// ============================================================================
// HOOK
// ============================================================================

export function useIndicesQuotes(options?: UseIndicesQuotesOptions): UseIndicesQuotesResult {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const exchangeIds = options?.exchangeIds;
  const userTier = options?.userTier ?? 'free';

  // Memoize the selection key to prevent unnecessary re-renders
  const selectionKey = useMemo(() => getSelectionKey(exchangeIds), [exchangeIds]);

  const consumerIdRef = useRef<number | null>(null);
  const storeRef = useRef<StoreEntry | null>(null);
  const [, setTick] = useState(0);

  // Get or create the store for this selection
  const store = useMemo(() => {
    const s = getOrCreateStore(selectionKey, exchangeIds, userTier);
    storeRef.current = s;
    return s;
  }, [selectionKey, exchangeIds, userTier]);

  // Setup: runs once on mount, cleanup on unmount
  useEffect(() => {
    ensureVisibilityListener();

    const id = nextConsumerId++;
    consumerIdRef.current = id;

    debugLog('Consumer mounted', { id, selectionKey });

    const unsub = subscribe(store, () => setTick((v) => v + 1));

    return () => {
      debugLog('Consumer unmounting', { id });
      unsub();
      store.consumerIntervals.delete(id);
      consumerIdRef.current = null;
    };
  }, [store, selectionKey]);

  // Enable/disable polling based on options
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));

    if (enabled) {
      store.enabledCount += 1;
      debugLog('Consumer enabled', { id, enabledCount: store.enabledCount });

      if (store.enabledCount === 1) {
        startPolling(store);
      }
    }

    return () => {
      if (enabled) {
        store.enabledCount = Math.max(0, store.enabledCount - 1);
        debugLog('Consumer disabled', { id, enabledCount: store.enabledCount });

        if (store.enabledCount <= 0) {
          clearTimerAndAbort(store);
        } else {
          scheduleNext(store);
        }
      }
    };
  }, [enabled, intervalMs, store]);

  // Update interval when it changes
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;
    if (!enabled) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
  }, [enabled, intervalMs, store]);

  // Re-fetch when selection changes (for paid users)
  useEffect(() => {
    if (!enabled) return;
    if (store.enabledCount <= 0) return;

    // If we already have data and selection changed, trigger a new fetch
    if (store.state.status === 'ready' || store.state.status === 'error') {
      debugLog('Selection changed, triggering re-fetch', { selectionKey });
      fetchIndicesOnce(store);
    }
  }, [selectionKey, enabled, store]);

  // Manual refresh function
  const refresh = useMemo(
    () => async () => {
      debugLog('Manual refresh triggered');
      await fetchIndicesOnce(store);
    },
    [store],
  );

  return {
    status: store.state.status,
    error: store.state.error,
    payload: store.state.payload,
    quotesById: store.state.quotesById,
    movementById: store.state.movementById,
    requestedExchangeIds: exchangeIds ?? [],
    refresh,
  };
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

export function getIndicesQuotesDebugSnapshot(selectionKey?: string) {
  const targetKey = selectionKey ?? 'default';
  const store = stores.get(targetKey);

  if (!store) {
    return {
      error: `No store found for key: ${targetKey}`,
      availableKeys: Array.from(stores.keys()),
    };
  }

  const s = store.state;
  return {
    at: toIso(nowMs()),
    selectionKey: targetKey,
    status: s.status,
    hasPayload: Boolean(s.payload),
    quoteCount: s.quotesById.size,
    quotesWithPrice: Array.from(s.quotesById.values()).filter((q) => q.price !== null).length,
    enabledCount: store.enabledCount,
    consumerIntervals: Array.from(store.consumerIntervals.values()),
    effectiveIntervalMs: getEffectiveIntervalMs(store),
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    lastFetchTime: store.lastFetchTime ? toIso(store.lastFetchTime) : null,
    exchangeIds: store.exchangeIds,
    userTier: store.userTier,
    meta: s.payload?.meta ?? null,
  };
}

/**
 * Force a refresh - useful for debugging.
 * Call from browser console: window.__forceIndicesRefresh()
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__forceIndicesRefresh = async (
    selectionKey?: string,
  ) => {
    const targetKey = selectionKey ?? 'default';
    const store = stores.get(targetKey);
    if (!store) {
      console.error(`No store found for key: ${targetKey}`);
      return null;
    }
    debugLog('MANUAL REFRESH TRIGGERED');
    await fetchIndicesOnce(store);
    return getIndicesQuotesDebugSnapshot(targetKey);
  };

  (window as unknown as Record<string, unknown>).__getIndicesDebug = (selectionKey?: string) => {
    return getIndicesQuotesDebugSnapshot(selectionKey);
  };

  (window as unknown as Record<string, unknown>).__listIndicesStores = () => {
    return Array.from(stores.entries()).map(([key, store]) => ({
      key,
      status: store.state.status,
      enabledCount: store.enabledCount,
      exchangeCount: store.exchangeIds?.length ?? 'default',
    }));
  };
}
