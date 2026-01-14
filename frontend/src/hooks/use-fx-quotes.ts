// frontend/src/hooks/use-fx-quotes.ts
/**
 * Centralised polling for FX quotes.
 *
 * OFFSET SCHEDULE (15 min apart, twice per hour):
 * - FX:          :00, :30 (base - 0 min offset)
 * - Crypto:      :15, :45 (15 min offset from FX)
 * - Commodities: :05, :35 (5 min offset - aligned with Indices)
 * - Indices:     :05, :35 (5 min offset)
 *
 * This prevents all asset types hitting APIs simultaneously.
 * Initial fetch is DELAYED to align with schedule (no immediate fetch on page load).
 *
 * Existing features preserved: Yes
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import type { FxApiQuote, FxApiResponse, FxBudgetState } from '@/types/finance-ribbon';

export type FxQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseFxQuotesOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export type FxWinnerSide = 'base' | 'quote' | 'neutral';
export type FxTickDirection = 'up' | 'down' | 'flat';

export type FxMovement = {
  /**
   * Which side won (single-arrow semantics live in the renderer).
   */
  winnerSide: FxWinnerSide;

  /**
   * Percentage move between the last and current quote (UI-only).
   */
  deltaPct: number;

  /**
   * Micro-motion direction.
   */
  tick: FxTickDirection;

  /**
   * Back-compat "confidence" (0..1) for simple opacity-style UIs.
   * This is purely visual and MUST NOT be used to infer refresh permission.
   */
  confidence: number;
};

/**
 * Back-compat export for any consumer importing BudgetState from this hook.
 * SSOT lives in frontend/src/types/finance-ribbon.ts.
 */
export type BudgetState = FxBudgetState;

/**
 * Type widening only: the server now includes meta.budget, and the hook must preserve it exactly
 * as received from /api/fx (no inference, no normalisation, no extra calls).
 */
export type FxApiResponseWithBudget = FxApiResponse & {
  meta?: FxApiResponse['meta'] & {
    budget?: {
      state?: FxBudgetState;
      emoji?: string;
    };
  };
};

export interface UseFxQuotesResult {
  status: FxQuotesStatus;
  error: unknown;

  /**
   * Payload from /api/fx, preserved exactly as received.
   * Includes optional meta.budget.state ('ok'|'warning'|'blocked') surfaced by server authority.
   */
  payload: FxApiResponseWithBudget | null;

  quotesById: Map<string, FxApiQuote>;
  quotesByProviderSymbol: Map<string, FxApiQuote>;
  movementById: Map<string, FxMovement>;
}

const DEFAULT_INTERVAL_MS = 30 * 60_000;

// Keep the server calm. Centralised polling means "one timer", but we also
// clamp the maximum poll frequency so on a busy page you can't accidentally
// hammer /api/fx. This does NOT control upstream refresh; it's purely client traffic.
const MIN_INTERVAL_MS = 5_000;

// When hidden, back off aggressively. This avoids useless traffic and aligns with
// "calm UI" intent without changing server authority behaviour.
const HIDDEN_VISIBILITY_MULTIPLIER = 6;

// OFFSET: FX refreshes at minutes :00 and :30 (base schedule)
const FX_REFRESH_MINUTE_OFFSET = 0;

const MAJOR_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);

function nowMs(): number {
  return Date.now();
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function normaliseCode(value: string): string {
  return String(value ?? '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function isMajorPair(q: FxApiQuote): boolean {
  // Heuristic: majors tend to include USD/EUR/GBP/JPY/CHF/CAD/AUD/NZD.
  // If your SSOT has an explicit classifier, prefer that upstream.
  const base = normaliseCode(q.base);
  const quote = normaliseCode(q.quote);
  return MAJOR_CURRENCIES.has(base) && MAJOR_CURRENCIES.has(quote);
}

function safeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function computeDeltaPct(prev: FxApiQuote | undefined, next: FxApiQuote): number | null {
  const p = safeNumber(prev?.price);
  const n = safeNumber(next.price);
  if (p === null || n === null) return null;
  if (p === 0) return null;
  return ((n - p) / p) * 100;
}

function confidenceFromAbsDelta(absDeltaPct: number, appearThreshold: number): number {
  // Map abs delta into [0.75..1.0] once it's beyond the appear threshold.
  const t = Math.max(0, Math.min(1, (absDeltaPct - appearThreshold) / appearThreshold));
  return 0.75 + 0.25 * t;
}

function movementFromDelta(deltaPct: number, appearThreshold: number): FxMovement {
  const abs = Math.abs(deltaPct);
  if (abs <= appearThreshold) {
    return { winnerSide: 'neutral', deltaPct, tick: 'flat', confidence: 0 };
  }

  // Sign convention:
  // +delta => base strengthened (left arrow in renderer)
  // -delta => quote strengthened (right arrow in renderer)
  const winnerSide: FxWinnerSide = deltaPct > 0 ? 'base' : 'quote';
  const tick: FxTickDirection = deltaPct > 0 ? 'up' : 'down';
  const confidence = confidenceFromAbsDelta(abs, appearThreshold);

  return { winnerSide, deltaPct, tick, confidence };
}

function getProviderSymbolKey(quote: FxApiQuote): string {
  const maybeProviderSymbol = (quote as unknown as Record<string, unknown>)['providerSymbol'];
  if (typeof maybeProviderSymbol === 'string' && maybeProviderSymbol.trim().length > 0) {
    return maybeProviderSymbol.trim();
  }

  const base = normaliseCode(quote.base);
  const q = normaliseCode(quote.quote);
  if (base && q) return `${base}${q}`;

  return quote.id;
}

function computeMovement(
  payload: FxApiResponseWithBudget,
  prevState: UseFxQuotesResult,
): {
  quotesById: Map<string, FxApiQuote>;
  quotesByProviderSymbol: Map<string, FxApiQuote>;
  movementById: Map<string, FxMovement>;
} {
  const quotesById = new Map<string, FxApiQuote>();
  const quotesByProviderSymbol = new Map<string, FxApiQuote>();
  const movementById = new Map<string, FxMovement>();

  const prevQuotesById = prevState.quotesById;

  // Contract: /api/fx returns { data: FxApiQuote[] }.
  // Back-compat: accept { quotes: FxApiQuote[] } if present from older payloads.
  const anyPayload = payload as unknown as Record<string, unknown>;
  const rawData = anyPayload['data'];
  const rawQuotes = anyPayload['quotes'];
  const quotes = Array.isArray(rawData) ? rawData : Array.isArray(rawQuotes) ? rawQuotes : [];

  for (const q of quotes) {
    if (!q || typeof q !== 'object') continue;
    if (typeof (q as FxApiQuote).id !== 'string') continue;

    const quote = q as FxApiQuote;
    quotesById.set(quote.id, quote);

    const key = getProviderSymbolKey(quote);
    quotesByProviderSymbol.set(key, quote);

    const prev = prevQuotesById.get(quote.id);
    const deltaPct = computeDeltaPct(prev, quote);

    // Pair-class thresholds (visual only; server authority is the real spend governor).
    const appearThreshold = isMajorPair(quote) ? 0.03 : 0.075;

    movementById.set(quote.id, movementFromDelta(deltaPct ?? 0, appearThreshold));
  }

  return { quotesById, quotesByProviderSymbol, movementById };
}

type Store = {
  state: UseFxQuotesResult;
  listeners: Set<() => void>;

  enabledCount: number;

  timer: number | null;
  initialTimer: number | null; // Separate timer for initial delayed fetch

  // Client single-flight.
  inFlight: Promise<void> | null;
  abort: AbortController | null;

  // Per-consumer interval preferences (the effective interval is the minimum).
  consumerIntervals: Map<number, number>;
  nextConsumerId: number;

  // Track if initial fetch has been scheduled/completed
  initialFetchDone: boolean;
};

const emptyState: UseFxQuotesResult = {
  status: 'idle',
  error: null,
  payload: null,
  quotesById: new Map(),
  quotesByProviderSymbol: new Map(),
  movementById: new Map(),
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

function setState(next: Partial<UseFxQuotesResult>) {
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
 * FX uses :00 and :30 minute marks (base schedule).
 */
function getMsUntilNextFxSlot(): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs = now.getMilliseconds();

  // Target minutes: 0 and 30 (FX base schedule)
  const targets = [FX_REFRESH_MINUTE_OFFSET, FX_REFRESH_MINUTE_OFFSET + 30];

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

async function fetchFxOnce(): Promise<void> {
  if (store.inFlight) return store.inFlight;

  store.abort?.abort();
  store.abort = new AbortController();

  store.inFlight = (async () => {
    try {
      setState({ status: store.state.status === 'idle' ? 'loading' : store.state.status });

      const res = await fetch('/api/fx', {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'omit', // calming: cookie-free fetch avoids CDN cache fragmentation
        signal: store.abort?.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`FX API ${res.status} ${res.statusText}${text ? ` – ${text}` : ''}`);
      }

      // IMPORTANT: preserve payload as received (meta.budget included when present).
      const json = (await res.json()) as FxApiResponseWithBudget;

      const derived = computeMovement(json, store.state);

      setState({
        payload: json,
        error: null,
        status: 'ready',
        quotesById: derived.quotesById,
        quotesByProviderSymbol: derived.quotesByProviderSymbol,
        movementById: derived.movementById,
      });
    } catch (err) {
      // Abort is not a real error for UX.
      if (err instanceof DOMException && err.name === 'AbortError') return;

      // If we already have a last-good payload, keep it visible and just record the error.
      // This prevents jittery "error" UI when the gate is doing its job.
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

  const delayMs = getMsUntilNextFxSlot();

  // Log for debugging (use console.debug for filtering)
  if (typeof console !== 'undefined') {
    const nextSlot = new Date(Date.now() + delayMs);
    console.debug(`[use-fx-quotes] Initial fetch scheduled in ${Math.round(delayMs / 1000)}s at ${nextSlot.toISOString()}`);
  }

  store.initialTimer = window.setTimeout(async () => {
    store.initialTimer = null;
    store.initialFetchDone = true;
    await fetchFxOnce();
    scheduleNext();
  }, delayMs);
}

function scheduleNext() {
  clearTimer();

  if (store.enabledCount <= 0) return;

  // Use offset-aligned scheduling
  const delayMs = getMsUntilNextFxSlot();
  const interval = getPollingIntervalForVisibility(delayMs);

  store.timer = window.setTimeout(async () => {
    // One shared heartbeat. Server authority decides whether upstream work is allowed.
    await fetchFxOnce();
    scheduleNext();
  }, interval);
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function ensureVisibilityListener() {
  if (typeof document === 'undefined') return;

  // Only attach once.
  const key = '__fx_quotes_visibility_listener_attached__';
  const anyDoc = document as unknown as Record<string, unknown>;
  if (anyDoc[key]) return;
  anyDoc[key] = true;

  document.addEventListener('visibilitychange', () => {
    if (store.enabledCount <= 0) return;
    // Reschedule to apply hidden/visible multiplier.
    scheduleNext();
  });
}

export function useFxQuotes(options?: UseFxQuotesOptions): UseFxQuotesResult {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const consumerIdRef = useRef<number | null>(null);

  // Local state tick; actual data lives in the module store (centralised polling).
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

    // Register/refresh desired interval for this consumer.
    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));

    // Pause gating: enabled consumers drive the shared timer.
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

  // Update interval without remounting the whole subscription.
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;
    if (!enabled) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
    // Don't reschedule here - let the existing timer run
  }, [enabled, intervalMs]);

  return store.state;
}

// Lightweight helpers for debugging in dev tools.
export function getFxQuotesDebugSnapshot() {
  const s = store.state;
  return {
    at: toIso(nowMs()),
    status: s.status,
    hasPayload: Boolean(s.payload),
    enabledCount: store.enabledCount,
    consumerIntervals: Array.from(store.consumerIntervals.values()),
    effectiveIntervalMs: getEffectiveIntervalMs(),
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    initialFetchDone: store.initialFetchDone,
    msUntilNextSlot: getMsUntilNextFxSlot(),
  };
}
