// src/hooks/use-crypto-quotes.ts
/**
 * Centralised polling for Crypto quotes.
 *
 * OFFSET SCHEDULE (15 min apart, twice per hour):
 * - FX:          :00, :30 (base - 0 min offset)
 * - Crypto:      :15, :45 (15 min offset from FX)
 * - Commodities: :05, :35 (5 min offset - aligned with Indices)
 * - Indices:     :05, :35 (5 min offset)
 *
 * This prevents all asset types hitting APIs simultaneously.
 * Initial fetch is IMMEDIATE on first mount (so the UI isn't blank), then
 * subsequent polling is offset-aligned to the schedule.
 *
 * Existing features preserved: Yes
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import type { CryptoApiQuote, CryptoApiResponse, CryptoBudgetState } from '@/types/crypto-ribbon';

export type CryptoQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseCryptoQuotesOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export type CryptoTickDirection = 'up' | 'down' | 'flat';

export type CryptoMovement = {
  tick: CryptoTickDirection;
  deltaPct: number | null;
};

export type CryptoMovementMap = Record<string, CryptoMovement>;

/**
 * Back-compat export for any consumer importing BudgetState from this hook.
 */
export type BudgetState = CryptoBudgetState;

export type CryptoApiResponseWithBudget = CryptoApiResponse & {
  meta?: CryptoApiResponse['meta'] & {
    budget?: {
      state?: CryptoBudgetState;
      emoji?: string;
    };
  };
};

export interface UseCryptoQuotesResult {
  status: CryptoQuotesStatus;
  error: unknown;
  response: CryptoApiResponseWithBudget | null;
  quotes: CryptoApiQuote[];
  movementById: CryptoMovementMap;
}

// 30-minute default interval (matches FX)
const DEFAULT_INTERVAL_MS = 30 * 60_000;

// Minimum poll frequency clamp (matches FX)
const MIN_INTERVAL_MS = 5_000;

// Hidden tab multiplier (matches FX)
const HIDDEN_VISIBILITY_MULTIPLIER = 6;

// OFFSET: Crypto refreshes at minutes :15 and :45 (15 min offset from FX's :00/:30)
const CRYPTO_REFRESH_MINUTE_OFFSET = 15;

function safeFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function computeMovement(
  value: number,
  prevClose: number,
): CryptoMovement {
  const delta = value - prevClose;
  const tick: CryptoTickDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const deltaPct = prevClose !== 0 ? (delta / prevClose) * 100 : null;
  return { tick, deltaPct };
}

function computeMovementMap(quotes: CryptoApiQuote[]): CryptoMovementMap {
  const movementById: CryptoMovementMap = {};
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
  state: UseCryptoQuotesResult;
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

const emptyState: UseCryptoQuotesResult = {
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

function setState(next: Partial<UseCryptoQuotesResult>) {
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
 * Crypto uses :15 and :45 minute marks (15 min offset from FX's :00/:30).
 */
function getMsUntilNextCryptoSlot(): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs = now.getMilliseconds();

  // Target minutes: 15 and 45 (offset by 15 from FX's 0 and 30)
  const targets = [CRYPTO_REFRESH_MINUTE_OFFSET, CRYPTO_REFRESH_MINUTE_OFFSET + 30];

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

async function fetchCryptoOnce(): Promise<void> {
  if (store.inFlight) return store.inFlight;

  store.abort?.abort();
  store.abort = new AbortController();

  store.inFlight = (async () => {
    try {
      setState({ status: store.state.status === 'idle' ? 'loading' : store.state.status });

      const res = await fetch('/api/crypto', {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'omit', // calming: cookie-free fetch avoids CDN cache fragmentation
        signal: store.abort?.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Crypto API ${res.status} ${res.statusText}${text ? ` – ${text}` : ''}`);
      }

      const json = (await res.json()) as CryptoApiResponseWithBudget;

      // Extract quotes from response
      const quotes: CryptoApiQuote[] = json?.data?.quotes ?? [];
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
  store.initialFetchDone = false;
}

/**
 * Run an immediate first fetch so the ribbon has data on load, then switch to
 * offset-aligned polling for the calm, staggered schedule.
 */
function runImmediateFirstFetchAndSchedule(): void {
  if (store.initialFetchDone) return;

  clearInitialTimer();
  store.initialFetchDone = true;

  void fetchCryptoOnce().finally(() => {
    if (store.enabledCount > 0) scheduleNext();
  });
}

function scheduleNext() {
  clearTimer();

  if (store.enabledCount <= 0) return;

  // Use offset-aligned scheduling
  const delayMs = getMsUntilNextCryptoSlot();
  const interval = getPollingIntervalForVisibility(delayMs);

  store.timer = window.setTimeout(async () => {
    await fetchCryptoOnce();
    scheduleNext();
  }, interval);
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function ensureVisibilityListener() {
  if (typeof document === 'undefined') return;

  const key = '__crypto_quotes_visibility_listener_attached__';
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
 * Centralised polling for crypto quotes.
 * One hook instance is enough; consumers should not add custom polling.
 */
export function useCryptoQuotes(options?: UseCryptoQuotesOptions): UseCryptoQuotesResult {
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

      // First enable runs an IMMEDIATE fetch so the ribbon is populated on load,
      // then switches to the offset-aligned schedule for calm polling.
      if (store.enabledCount === 1) {
        runImmediateFirstFetchAndSchedule();
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

export function getCryptoQuotesDebugSnapshot() {
  const s = store.state;
  return {
    at: new Date().toISOString(),
    status: s.status,
    hasResponse: Boolean(s.response),
    quoteCount: s.quotes.length,
    enabledCount: store.enabledCount,
    consumerIntervals: Array.from(store.consumerIntervals.values()),
    effectiveIntervalMs: getEffectiveIntervalMs(),
    msUntilNextSlot: getMsUntilNextCryptoSlot(),
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    initialFetchDone: store.initialFetchDone,
  };
}
