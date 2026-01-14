// src/hooks/use-commodities-quotes.ts
/**
 * Centralised polling for Commodities quotes.
 *
 * OFFSET SCHEDULE (20 min apart, twice per hour):
 * - FX:          :00, :30 (base - 0 min offset)
 * - Commodities: :10, :40 (10 min offset)
 * - Crypto:      :20, :50 (20 min offset)
 *
 * This prevents all three asset types hitting TwelveData simultaneously.
 * Initial fetch is DELAYED to align with schedule (no immediate fetch on page load).
 *
 * Existing features preserved: Yes
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  CommoditiesApiQuote,
  CommoditiesApiResponse,
  CommoditiesBudgetState,
} from '@/types/commodities-ribbon';

export type CommoditiesQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseCommoditiesQuotesOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export type CommodityTickDirection = 'up' | 'down' | 'flat';

export type CommodityMovement = {
  tick: CommodityTickDirection;
  deltaPct: number | null;
};

export type CommodityMovementMap = Record<string, CommodityMovement>;

/**
 * Back-compat export for any consumer importing BudgetState from this hook.
 */
export type BudgetState = CommoditiesBudgetState;

export type CommoditiesApiResponseWithBudget = CommoditiesApiResponse & {
  meta?: CommoditiesApiResponse['meta'] & {
    budget?: {
      state?: CommoditiesBudgetState;
      emoji?: string;
    };
  };
};

export interface UseCommoditiesQuotesResult {
  status: CommoditiesQuotesStatus;
  error: unknown;
  response: CommoditiesApiResponseWithBudget | null;
  quotes: CommoditiesApiQuote[];
  movementById: CommodityMovementMap;
}

// 30-minute default interval (matches FX)
const DEFAULT_INTERVAL_MS = 30 * 60_000;

// Minimum poll frequency clamp (matches FX)
const MIN_INTERVAL_MS = 5_000;

// Hidden tab multiplier (matches FX)
const HIDDEN_VISIBILITY_MULTIPLIER = 6;

// OFFSET: Commodities refreshes at minutes :10 and :40 (10 min offset from FX's :00/:30)
const COMMODITIES_REFRESH_MINUTE_OFFSET = 10;

function safeFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function computeMovement(
  value: number,
  prevClose: number,
): CommodityMovement {
  const delta = value - prevClose;
  const tick: CommodityTickDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const deltaPct = prevClose !== 0 ? (delta / prevClose) * 100 : null;
  return { tick, deltaPct };
}

function computeMovementMap(quotes: CommoditiesApiQuote[]): CommodityMovementMap {
  const movementById: CommodityMovementMap = {};
  for (const q of quotes) {
    const v = safeFiniteNumber(q.value);
    const p = safeFiniteNumber(q.prevClose);
    if (v == null || p == null) continue;
    movementById[q.id] = computeMovement(v, p);
  }
  return movementById;
}

// =============================================================================
// CENTRALISED STORE (matches FX pattern)
// =============================================================================

type Store = {
  state: UseCommoditiesQuotesResult;
  listeners: Set<() => void>;

  enabledCount: number;

  timer: number | null;
  initialTimer: number | null; // Separate timer for initial delayed fetch

  // Client single-flight
  inFlight: Promise<void> | null;
  abort: AbortController | null;

  // Per-consumer interval preferences (the effective interval is the minimum)
  consumerIntervals: Map<number, number>;
  nextConsumerId: number;

  // Track if initial fetch has been scheduled/completed
  initialFetchDone: boolean;
};

const emptyState: UseCommoditiesQuotesResult = {
  status: 'idle',
  error: null,
  response: null,
  quotes: [],
  movementById: {},
};

const store: Store = {
  state: emptyState,
  listeners: new Set(),
  enabledCount: 0,
  timer: null,
  initialTimer: null,
  inFlight: null,
  abort: null,
  consumerIntervals: new Map(),
  nextConsumerId: 1,
  initialFetchDone: false,
};

function emit() {
  for (const l of store.listeners) l();
}

function setState(next: Partial<UseCommoditiesQuotesResult>) {
  store.state = { ...store.state, ...next };
  emit();
}

function clearTimer() {
  if (store.timer !== null) {
    window.clearTimeout(store.timer);
    store.timer = null;
  }
}

function clearInitialTimer() {
  if (store.initialTimer !== null) {
    window.clearTimeout(store.initialTimer);
    store.initialTimer = null;
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

/**
 * Calculate ms until the next offset-aligned refresh slot.
 * Commodities uses :10 and :40 minute marks (10 min offset from FX's :00/:30).
 */
function getMsUntilNextCommoditiesSlot(): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs = now.getMilliseconds();

  // Target minutes: 10 and 40 (offset by 10 from FX's 0 and 30)
  const targets = [COMMODITIES_REFRESH_MINUTE_OFFSET, COMMODITIES_REFRESH_MINUTE_OFFSET + 30];

  const nowMsIntoHour = (currentMinute * 60 + currentSecond) * 1000 + currentMs;

  let bestDelta = 60 * 60 * 1000; // 1 hour max
  for (const m of targets) {
    let targetMsIntoHour = m * 60 * 1000;
    if (targetMsIntoHour <= nowMsIntoHour) {
      targetMsIntoHour += 60 * 60 * 1000; // next hour
    }
    const delta = targetMsIntoHour - nowMsIntoHour;
    if (delta < bestDelta) bestDelta = delta;
  }

  // Avoid immediate run races; minimum 1 second
  return Math.max(1000, bestDelta);
}

async function fetchCommoditiesOnce(): Promise<void> {
  if (store.inFlight) return store.inFlight;

  store.abort?.abort();
  store.abort = new AbortController();

  store.inFlight = (async () => {
    try {
      setState({ status: store.state.status === 'idle' ? 'loading' : store.state.status });

      const res = await fetch('/api/commodities', {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'omit', // calming: cookie-free fetch avoids CDN cache fragmentation
        signal: store.abort?.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Commodities API ${res.status} ${res.statusText}${text ? ` – ${text}` : ''}`);
      }

      const json = (await res.json()) as CommoditiesApiResponseWithBudget;

      // Extract quotes from response
      const quotes: CommoditiesApiQuote[] = json?.data?.quotes ?? [];
      const movementById = computeMovementMap(quotes);

      setState({
        response: json,
        quotes,
        movementById,
        error: null,
        status: 'ready',
      });
    } catch (err) {
      // Abort is not a real error for UX
      if (err instanceof DOMException && err.name === 'AbortError') return;

      // If we already have a last-good response, keep it visible and just record the error
      setState({
        error: err,
        status: store.state.response ? 'ready' : 'error',
      });
    } finally {
      store.inFlight = null;
    }
  })();

  return store.inFlight;
}

function clearTimerAndAbort() {
  clearTimer();
  clearInitialTimer();
  store.abort?.abort();
  store.abort = null;
  store.inFlight = null;
}

/**
 * Schedule the initial fetch to align with the offset schedule.
 * This prevents all asset types from fetching simultaneously on page load.
 */
function scheduleInitialFetch() {
  if (store.initialFetchDone) return;
  if (store.initialTimer !== null) return; // Already scheduled

  const delayMs = getMsUntilNextCommoditiesSlot();

  // Log for debugging (use console.debug for filtering)
  if (typeof console !== 'undefined') {
    const nextSlot = new Date(Date.now() + delayMs);
    console.debug(`[use-commodities-quotes] Initial fetch scheduled in ${Math.round(delayMs / 1000)}s at ${nextSlot.toISOString()}`);
  }

  store.initialTimer = window.setTimeout(async () => {
    store.initialTimer = null;
    store.initialFetchDone = true;
    await fetchCommoditiesOnce();
    scheduleNext();
  }, delayMs);
}

function scheduleNext() {
  clearTimer();

  if (store.enabledCount <= 0) return;

  // Use offset-aligned scheduling
  const delayMs = getMsUntilNextCommoditiesSlot();
  const interval = getPollingIntervalForVisibility(delayMs);

  store.timer = window.setTimeout(async () => {
    await fetchCommoditiesOnce();
    scheduleNext();
  }, interval);
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function ensureVisibilityListener() {
  if (typeof document === 'undefined') return;

  const key = '__commodities_quotes_visibility_listener_attached__';
  const anyDoc = document as unknown as Record<string, unknown>;
  if (anyDoc[key]) return;
  anyDoc[key] = true;

  document.addEventListener('visibilitychange', () => {
    if (store.enabledCount <= 0) return;
    scheduleNext();
  });
}

// =============================================================================
// PUBLIC HOOK
// =============================================================================

/**
 * Centralised polling for commodities quotes.
 * One hook instance is enough; consumers should not add custom polling.
 */
export function useCommoditiesQuotes(options?: UseCommoditiesQuotesOptions): UseCommoditiesQuotesResult {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const consumerIdRef = useRef<number | null>(null);

  // Local state tick; actual data lives in the module store (centralised polling)
  const [, setTick] = useState(0);

  useEffect(() => {
    ensureVisibilityListener();

    const id = store.nextConsumerId++;
    consumerIdRef.current = id;

    const unsub = subscribe(() => setTick((v) => v + 1));

    return () => {
      unsub();
      store.consumerIntervals.delete(id);
      consumerIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;

    // Register/refresh desired interval for this consumer
    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));

    // Pause gating: enabled consumers drive the shared timer
    if (enabled) {
      store.enabledCount += 1;

      // First enable schedules a DELAYED fetch aligned to offset schedule
      // (no immediate fetch - prevents simultaneous API calls on page load)
      if (store.enabledCount === 1) {
        scheduleInitialFetch();
      }
    }

    return () => {
      if (enabled) {
        store.enabledCount = Math.max(0, store.enabledCount - 1);
        if (store.enabledCount <= 0) {
          clearTimerAndAbort();
        } else {
          scheduleNext();
        }
      }
    };
  }, [enabled, intervalMs]);

  // Update interval without remounting the whole subscription
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;
    if (!enabled) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
    // Don't reschedule here - let the existing timer run
  }, [enabled, intervalMs]);

  return store.state;
}

// =============================================================================
// DEBUG HELPERS
// =============================================================================

export function getCommoditiesQuotesDebugSnapshot() {
  const s = store.state;
  return {
    at: new Date().toISOString(),
    status: s.status,
    hasResponse: Boolean(s.response),
    quoteCount: s.quotes.length,
    enabledCount: store.enabledCount,
    consumerIntervals: Array.from(store.consumerIntervals.values()),
    effectiveIntervalMs: getEffectiveIntervalMs(),
    msUntilNextSlot: getMsUntilNextCommoditiesSlot(),
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    initialFetchDone: store.initialFetchDone,
  };
}
