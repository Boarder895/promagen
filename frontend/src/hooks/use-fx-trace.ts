// frontend/src/hooks/use-fx-trace.ts
'use client';

/**
 * FX Trace Hook — OBSERVER ONLY (no authority).
 *
 * Hard rules (Brain / no-bypass):
 * - This hook must NEVER call providers.
 * - This hook must NEVER influence refresh timing.
 * - This hook must ONLY call /api/fx/trace (read-only).
 * - Polling here must not create “cost pressure” or side effects.
 *
 * Implementation notes:
 * - Centralised polling: multiple panels/components share one poller.
 * - Single-flight fetch: only one in-flight request at a time.
 * - Pause when hidden: avoids noisy diagnostics spam.
 */

import { useEffect, useState } from 'react';
import { getBudgetGuardEmoji } from '@/data/emoji/emoji';

import type { FxRibbonTraceSnapshot } from '@/lib/fx/providers';

type UseFxTraceOptions = {
  endpoint?: string;
  pauseWhenHidden?: boolean;
  minIntervalMs?: number;
};

const DEFAULT_POLL_MS = 30_000;
const DEFAULT_MIN_INTERVAL_MS = 15_000;

function nowMs(): number {
  return Date.now();
}

function isHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden';
}

function buildEmptySnapshot(): FxRibbonTraceSnapshot {
  return {
    ttlSeconds: 0,
    ssotKey: 'unknown',

    inFlight: false,

    budget: {
      state: 'ok',
      dayKey: '1970-01-01',
      daily: {
        allowance: 0,
        used: 0,
        warnAt: 0,
        blockAt: 0,
        remaining: 0,
        pctUsed: 0,
      },
      minute: {
        windowSeconds: 0,
        allowance: 0,
        used: 0,
        warnAt: 0,
        blockAt: 0,
        remaining: 0,
        pctUsed: 0,
      },
    },

    budgetIndicator: {
      state: 'ok',
      emoji: getBudgetGuardEmoji('ok'),
    },

    cache: { hasValue: false },
    lastDecision: undefined,
    lastError: undefined,
    counters: { ribbonCalls: 0, upstreamCalls: 0, upstream429s: 0 },
    rateLimit: {},
    traffic: { windowSeconds: 0, hitsInWindow: 0, factor: 1 },
    schedule: { cycleIndex: 0, scheduledGroup: 'A', cycleLengthSeconds: 0 },
    groups: {
      A: {
        hasValue: false,
        inFlight: false,
        expectedSymbols: 0,
        missingCount: 0,
        missingSymbols: [],
      },
      B: {
        hasValue: false,
        inFlight: false,
        expectedSymbols: 0,
        missingCount: 0,
        missingSymbols: [],
      },
    },
    lastFetch: {
      expectedSymbols: 0,
      missingCount: 0,
      missingSymbols: [],
    },
  };
}

/**
 * Internal shared store so multiple components do not multiply polling.
 * This is a diagnostics observer; it must be calm.
 */
const store = {
  listeners: new Set<() => void>(),
  enabledCount: 0,

  endpoint: '/api/fx/trace',
  pauseWhenHidden: true,
  minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
  pollMs: DEFAULT_POLL_MS,

  timer: null as number | null,
  inFlight: null as Promise<void> | null,
  abort: null as AbortController | null,

  lastUpdatedAtMs: 0,
  data: buildEmptySnapshot(),
};

function emit() {
  for (const l of store.listeners) l();
}

function clearTimer() {
  if (store.timer !== null) {
    window.clearTimeout(store.timer);
    store.timer = null;
  }
}

function scheduleNext() {
  clearTimer();
  if (store.enabledCount <= 0) return;

  const pollMs = Math.max(store.minIntervalMs, store.pollMs);

  store.timer = window.setTimeout(async () => {
    await tick();
    scheduleNext();
  }, pollMs);
}

async function tick(): Promise<void> {
  if (store.enabledCount <= 0) return;

  if (store.pauseWhenHidden && isHidden()) {
    // Stay calm when hidden: no fetch, just reschedule.
    return;
  }

  if (store.inFlight) return store.inFlight;

  // Abort any previous request (should be rare, but keeps it strict).
  store.abort?.abort();
  store.abort = new AbortController();

  store.inFlight = (async () => {
    try {
      const res = await fetch(store.endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: store.abort?.signal,
      });

      if (!res.ok) {
        // Trace should be safe; we don’t throw hard. Just keep last good snapshot.
        store.data = {
          ...store.data,
          lastError: `FX trace ${res.status} ${res.statusText}`,
        };
        emit();
        return;
      }

      const json = (await res.json()) as FxRibbonTraceSnapshot;

      store.data = json;
      store.lastUpdatedAtMs = nowMs();
      emit();
    } catch (err) {
      // Abort is normal during unmount/rehydration.
      if (err instanceof DOMException && err.name === 'AbortError') return;

      store.data = {
        ...store.data,
        lastError: err instanceof Error ? err.message : String(err),
      };
      emit();
    } finally {
      store.inFlight = null;
    }
  })();

  return store.inFlight;
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

/**
 * useFxTrace
 * Signature preserved to match existing callers:
 * useFxTrace(enabled, pollMs, options)
 */
export function useFxTrace(
  enabled: boolean,
  pollMs: number = DEFAULT_POLL_MS,
  options?: UseFxTraceOptions,
): FxRibbonTraceSnapshot {
  const [, force] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => force((x) => x + 1));

    // Update store settings (shared across consumers).
    store.endpoint = options?.endpoint ?? store.endpoint;
    store.pauseWhenHidden = options?.pauseWhenHidden ?? true;

    const minInterval = options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    store.minIntervalMs = Math.max(1_000, minInterval);

    store.pollMs = Math.max(store.minIntervalMs, pollMs);

    if (enabled) {
      store.enabledCount += 1;

      // Bootstrap immediately (but still observer-only).
      void tick();
      scheduleNext();
    }

    const onVis = () => {
      if (store.enabledCount <= 0) return;
      // When visibility changes, reschedule cleanly.
      scheduleNext();
      // If tab became visible again, fetch once promptly.
      if (!isHidden()) void tick();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      unsub();

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }

      if (enabled) {
        store.enabledCount -= 1;
        if (store.enabledCount <= 0) {
          store.enabledCount = 0;
          clearTimer();
          store.abort?.abort();
          store.abort = null;
        } else {
          scheduleNext();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // If pollMs changes while enabled, update and reschedule.
  useEffect(() => {
    if (!enabled) return;
    store.pollMs = Math.max(store.minIntervalMs, pollMs);
    scheduleNext();
  }, [enabled, pollMs]);

  return store.data;
}