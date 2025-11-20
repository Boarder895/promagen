// src/hooks/use-fx-quotes.ts
// -----------------------------------------------------------------------------
// Client hook for FX quotes.
// - Talks to /api/fx
// - Respects nextUpdateAt from the payload when present
// - Falls back to a fixed interval otherwise
// - Stays completely idle in Jest tests (NODE_ENV === "test")
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FxQuote, FxQuotesPayload } from '@/types/finance-ribbon';

export type FxQuotesStatus = 'idle' | 'loading' | 'ready' | 'error';

type UseFxQuotesOptions = {
  enabled?: boolean;
  /**
   * Fallback polling interval in milliseconds if the server
   * does not supply a nextUpdateAt hint.
   */
  intervalMs?: number;
};

export function useFxQuotes(options?: UseFxQuotesOptions): {
  status: FxQuotesStatus;
  error: unknown;
  payload: FxQuotesPayload | null;
  quotesByPairId: Map<string, FxQuote>;
} {
  const { enabled = true, intervalMs = 5 * 60_000 } = options ?? {};

  const [status, setStatus] = useState<FxQuotesStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const [payload, setPayload] = useState<FxQuotesPayload | null>(null);

  useEffect(() => {
    // If the widget is explicitly in demo mode (enabled = false), stay inert.
    if (!enabled) {
      return;
    }

    // In tests we deliberately avoid network calls and timers to
    // keep Jest output clean and deterministic.
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchOnce() {
      try {
        setStatus((prev) => (prev === 'idle' ? 'loading' : prev));

        const res = await fetch('/api/fx', {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error(`FX route HTTP ${res.status}`);
        }

        const json = (await res.json()) as FxQuotesPayload;
        if (cancelled) return;

        setPayload(json);
        setStatus('ready');
        setError(null);

        // Prefer the server's suggestion for the next refresh.
        let delay = intervalMs;

        if (json.nextUpdateAt) {
          const next = new Date(json.nextUpdateAt).getTime();
          const now = Date.now();
          const delta = next - now;

          if (Number.isFinite(delta) && delta > 0) {
            delay = delta;
          }
        }

        if (delay > 0) {
          timer = setTimeout(fetchOnce, delay);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      }
    }

    fetchOnce();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs]);

  const quotesByPairId = useMemo(() => {
    const map = new Map<string, FxQuote>();
    if (!payload?.quotes) return map;

    for (const q of payload.quotes) {
      map.set(q.pairId, q);
    }

    return map;
  }, [payload]);

  return {
    status,
    error,
    payload,
    quotesByPairId,
  };
}
