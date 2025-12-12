// C:\Users\Proma\Projects\promagen\frontend\src\hooks\use-fx-quotes.ts
//
// Client hook for FX quotes.
// - Calls /api/fx
// - Default polling: 30 minutes
// - No demo behaviour; tests should mock fetch or mock the hook.
//
// Code Standard:
// - No env access in client code
// - Typed output
// - Narrow effects, clear deps

'use client';

import { useEffect, useMemo, useState } from 'react';

import type { FxApiQuote, FxApiResponse } from '@/types/finance-ribbon';

export type FxQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseFxQuotesOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export interface UseFxQuotesResult {
  status: FxQuotesStatus;
  error: unknown;
  payload: FxApiResponse | null;
  quotesByProviderSymbol: Map<string, FxApiQuote>;
}

const DEFAULT_INTERVAL_MS = 30 * 60_000;

function normaliseCode(value: string): string {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase();
}

export function useFxQuotes(options?: UseFxQuotesOptions): UseFxQuotesResult {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const [status, setStatus] = useState<FxQuotesStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const [payload, setPayload] = useState<FxApiResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Keep Jest deterministic: mock the hook or mock fetch in tests.
    if (process.env.NODE_ENV === 'test') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchOnce() {
      try {
        setStatus((prev) => (prev === 'idle' ? 'loading' : prev));

        const res = await fetch('/api/fx', {
          method: 'GET',
          headers: { accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`FX API responded with HTTP ${res.status}`);
        }

        const json = (await res.json()) as FxApiResponse;

        if (cancelled) return;

        setPayload(json);
        setError(null);
        setStatus('ready');

        timer = setTimeout(fetchOnce, intervalMs);
      } catch (err) {
        if (cancelled) return;

        setError(err);
        setStatus((prev) => (prev === 'ready' ? prev : 'error'));

        // Conservative backoff: at least 60 seconds.
        timer = setTimeout(fetchOnce, Math.max(intervalMs, 60_000));
      }
    }

    void fetchOnce();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs]);

  const quotesByProviderSymbol = useMemo(() => {
    const map = new Map<string, FxApiQuote>();

    const quotes = payload?.data ?? [];
    for (const q of quotes) {
      // FxApiQuote.id is the canonical provider symbol (e.g. "GBPUSD").
      const key = normaliseCode(q.id);
      if (!key) continue;
      map.set(key, q);
    }

    return map;
  }, [payload]);

  return { status, error, payload, quotesByProviderSymbol };
}
