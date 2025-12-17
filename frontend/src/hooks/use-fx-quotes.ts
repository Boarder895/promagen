// frontend/src/hooks/use-fx-quotes.ts
'use client';

import { useEffect, useRef, useState } from 'react';

import type { FxApiQuote, FxApiResponse } from '@/types/finance-ribbon';

export type FxQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseFxQuotesOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export type FxWinnerSide = 'base' | 'quote' | 'neutral';
export type FxTickDirection = 'up' | 'down' | 'flat';

export interface FxMovement {
  /**
   * Canonical winner side for modern ribbon components.
   */
  winnerSide: FxWinnerSide;

  /**
   * Back-compat alias for older components.
   */
  winner: FxWinnerSide;

  /**
   * Percentage move between the last and current quote (UI-only).
   */
  deltaPct: number;

  /**
   * Micro-motion direction.
   */
  tick: FxTickDirection;

  /**
   * Back-compat “confidence” (0..1) for simple opacity-style UIs.
   * This is purely visual and MUST NOT be used to infer refresh permission.
   */
  confidence: number;
}

export interface UseFxQuotesResult {
  status: FxQuotesStatus;
  error: unknown;
  payload: FxApiResponse | null;

  quotesById: Map<string, FxApiQuote>;
  quotesByProviderSymbol: Map<string, FxApiQuote>;
  movementById: Map<string, FxMovement>;

  /**
   * Weekend freeze (London): UI should not change on Sat/Sun.
   * Preserves “this is how the market closed”.
   */
  isWeekendFreeze: boolean;
}

const DEFAULT_INTERVAL_MS = 30 * 60_000;

// Keep the server calm. Centralised polling means “one timer”, but we also
// clamp the maximum poll frequency so one rogue consumer can’t spam the route.
const MIN_INTERVAL_MS = 30_000;

// When the tab is hidden, slow down polling aggressively (reduce server chatter).
const HIDDEN_INTERVAL_MS = 60_000;

// Thresholds (percentage points)
const MAJORS_NEUTRAL = 0.02;
const MAJORS_APPEAR = 0.03; // hysteresis appear
const MAJORS_DISAPPEAR = 0.015; // hysteresis disappear

const VOLATILE_NEUTRAL = 0.05;
const VOLATILE_APPEAR = 0.075;
const VOLATILE_DISAPPEAR = 0.035;

function normaliseCode(value: string): string {
  return String(value ?? '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function nowMs(): number {
  return Date.now();
}

function weekdayInLondon(ms: number): number {
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' });
  const wd = dtf.format(new Date(ms)).toLowerCase();
  if (wd.startsWith('mon')) return 1;
  if (wd.startsWith('tue')) return 2;
  if (wd.startsWith('wed')) return 3;
  if (wd.startsWith('thu')) return 4;
  if (wd.startsWith('fri')) return 5;
  if (wd.startsWith('sat')) return 6;
  return 0; // sun/unknown
}

function isWeekendLondon(ms: number): boolean {
  const d = weekdayInLondon(ms);
  return d === 0 || d === 6;
}

function isMajorPair(q: FxApiQuote): boolean {
  // Heuristic: majors tend to include USD/EUR/GBP/JPY/CHF/CAD/AUD/NZD.
  // If your SSOT has an explicit classifier, prefer that upstream.
  const base = normaliseCode(q.base);
  const quote = normaliseCode(q.quote);
  const majors = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);
  return majors.has(base) && majors.has(quote);
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
  // Map abs delta into [0.75..1.0] once it’s beyond the appear threshold.
  const t = Math.max(0, Math.min(1, (absDeltaPct - appearThreshold) / appearThreshold));
  return 0.75 + 0.25 * t;
}

function movementForQuote(params: {
  quote: FxApiQuote;
  prevQuote?: FxApiQuote;
  prevMovement?: FxMovement;
  freeze: boolean;
}): FxMovement {
  const { quote, prevQuote, prevMovement, freeze } = params;

  // During weekend freeze we never change displayed movement state.
  if (freeze && prevMovement) return prevMovement;

  const deltaPct = computeDeltaPct(prevQuote, quote);
  if (deltaPct === null) {
    return { winnerSide: 'neutral', winner: 'neutral', deltaPct: 0, tick: 'flat', confidence: 0 };
  }

  const major = isMajorPair(quote);
  const neutral = major ? MAJORS_NEUTRAL : VOLATILE_NEUTRAL;
  const appear = major ? MAJORS_APPEAR : VOLATILE_APPEAR;
  const disappear = major ? MAJORS_DISAPPEAR : VOLATILE_DISAPPEAR;

  const abs = Math.abs(deltaPct);

  // Hysteresis:
  // - if currently neutral, require “appear” threshold
  // - if currently non-neutral, allow it to remain until it drops below “disappear”
  const wasNeutral = (prevMovement?.winnerSide ?? 'neutral') === 'neutral';

  const shouldBeNeutral = wasNeutral ? abs < appear : abs < disappear;
  if (shouldBeNeutral || abs < neutral) {
    return { winnerSide: 'neutral', winner: 'neutral', deltaPct, tick: 'flat', confidence: 0 };
  }

  // Winner side: positive delta implies base strengthened (left arrow), negative implies quote strengthened (right arrow)
  const winnerSide: FxWinnerSide = deltaPct > 0 ? 'base' : 'quote';

  // Tick direction for micro motion
  const tick: FxTickDirection = deltaPct > 0 ? 'up' : 'down';

  return {
    winnerSide,
    winner: winnerSide,
    deltaPct,
    tick,
    confidence: confidenceFromAbsDelta(abs, appear),
  };
}

function computeMovement(payload: FxApiResponse, freeze: boolean, prevState: UseFxQuotesResult) {
  const quotesById = new Map<string, FxApiQuote>();
  const quotesByProviderSymbol = new Map<string, FxApiQuote>();

  for (const q of payload.data ?? []) {
    quotesById.set(q.id, q);

    const sym = `${normaliseCode(q.base)}/${normaliseCode(q.quote)}`;
    quotesByProviderSymbol.set(sym, q);
  }

  const movementById = new Map<string, FxMovement>();

  for (const [id, q] of quotesById.entries()) {
    const prevQuote = prevState.quotesById.get(id);
    const prevMovement = prevState.movementById.get(id);
    movementById.set(id, movementForQuote({ quote: q, prevQuote, prevMovement, freeze }));
  }

  return { quotesById, quotesByProviderSymbol, movementById };
}

type Store = {
  state: UseFxQuotesResult;

  listeners: Set<() => void>;

  // Enabled consumer count (for lifetime management)
  enabledCount: number;

  // Single shared timer for all consumers
  timer: number | null;

  // Shared single-flight request
  inFlight: Promise<void> | null;
  abort: AbortController | null;

  // Keep last stable movement so weekend freeze can “hold” visuals.
  lastStableMovementById: Map<string, FxMovement>;

  // Track per-consumer requested intervals. Effective interval is the smallest requested,
  // clamped by MIN_INTERVAL_MS (so it can’t become “too fast”).
  consumerIntervals: Map<number, number>;

  // For monotonic consumer ids.
  nextConsumerId: number;
};

const emptyState: UseFxQuotesResult = {
  status: 'idle',
  error: null,
  payload: null,
  quotesById: new Map(),
  quotesByProviderSymbol: new Map(),
  movementById: new Map(),
  isWeekendFreeze: false,
};

const store: Store = {
  state: emptyState,
  listeners: new Set(),
  enabledCount: 0,
  timer: null,
  inFlight: null,
  abort: null,
  lastStableMovementById: new Map(),
  consumerIntervals: new Map(),
  nextConsumerId: 1,
};

function emit() {
  for (const l of store.listeners) l();
}

function setState(next: Partial<UseFxQuotesResult>) {
  store.state = { ...store.state, ...next };
  emit();
}

function clearTimer() {
  if (store.timer) window.clearTimeout(store.timer);
  store.timer = null;
}

function getEffectiveIntervalMs(): number {
  let min = DEFAULT_INTERVAL_MS;
  for (const v of store.consumerIntervals.values()) {
    if (v < min) min = v;
  }
  return Math.max(MIN_INTERVAL_MS, min);
}

function getPollingIntervalForVisibility(baseIntervalMs: number): number {
  // When hidden, slow down drastically (still centralised).
  if (typeof document === 'undefined') return baseIntervalMs;
  if (document.visibilityState === 'hidden') return Math.max(HIDDEN_INTERVAL_MS, baseIntervalMs);
  return baseIntervalMs;
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
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: store.abort?.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`FX API ${res.status} ${res.statusText}${text ? ` – ${text}` : ''}`);
      }

      const json = (await res.json()) as FxApiResponse;

      const now = nowMs();
      const weekend = isWeekendLondon(now);

      // Weekend freeze rules:
      // - If we already have a payload, do not let weekend traffic change what the user sees.
      // - If we have no payload yet, accept the first payload, then freeze thereafter.
      const shouldFreezeDisplay = weekend && store.state.payload !== null;

      if (shouldFreezeDisplay) {
        setState({
          // Keep existing payload/quotes/movement as-is.
          error: null,
          status: 'ready',
          isWeekendFreeze: true,
        });
        return;
      }

      const derived = computeMovement(json, weekend, store.state);

      // Preserve stable movement map for weekend conditions (first accepted payload on weekend still ok).
      if (!weekend) {
        store.lastStableMovementById = new Map(derived.movementById);
      } else if (store.lastStableMovementById.size > 0) {
        derived.movementById = new Map(store.lastStableMovementById);
      }

      setState({
        payload: json,
        error: null,
        status: 'ready',
        quotesById: derived.quotesById,
        quotesByProviderSymbol: derived.quotesByProviderSymbol,
        movementById: derived.movementById,
        isWeekendFreeze: weekend,
      });
    } catch (err) {
      // Abort is not a real error for UX.
      if (err instanceof DOMException && err.name === 'AbortError') return;

      // If we already have a last-good payload, keep it visible and just record the error.
      // This prevents jittery “error” UI when the gate is doing its job.
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

function scheduleNext() {
  clearTimer();

  if (store.enabledCount <= 0) return;

  const baseInterval = getEffectiveIntervalMs();
  const interval = getPollingIntervalForVisibility(baseInterval);

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
    // Reschedule immediately on visibility change so we switch cadence cleanly.
    scheduleNext();
  });
}

export function useFxQuotes(options?: UseFxQuotesOptions): UseFxQuotesResult {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const [, force] = useState(0);
  const consumerIdRef = useRef<number | null>(null);

  useEffect(() => {
    ensureVisibilityListener();
    const unsub = subscribe(() => force((x) => x + 1));

    // Allocate a stable consumer id.
    if (consumerIdRef.current === null) {
      consumerIdRef.current = store.nextConsumerId++;
    }
    const id = consumerIdRef.current;

    if (enabled) {
      store.enabledCount += 1;
      store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));

      // Bootstrap: fetch once immediately if we have nothing.
      if (store.state.status === 'idle') {
        void fetchFxOnce();
      }

      scheduleNext();
    }

    return () => {
      unsub();

      if (enabled) {
        store.enabledCount -= 1;
      }
      store.consumerIntervals.delete(id);

      if (store.enabledCount <= 0) {
        store.enabledCount = 0;
        clearTimer();
        store.abort?.abort();
        store.abort = null;
      } else {
        // Interval set changed → reschedule using new min interval.
        scheduleNext();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Update interval without remounting the whole subscription.
  useEffect(() => {
    const id = consumerIdRef.current;
    if (id === null) return;
    if (!enabled) return;

    store.consumerIntervals.set(id, Math.max(MIN_INTERVAL_MS, intervalMs));
    scheduleNext();
  }, [enabled, intervalMs]);

  return store.state;
}
