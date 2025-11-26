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
  /**
   * When false, the hook stays completely inert – no network calls,
   * no timers. Used for demo mode where we rely entirely on static
   * JSON demo values.
   */
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
  /**
   * Map of FX quotes keyed by **code**, e.g. "GBPUSD", "EURUSD".
   *
   * Internally we accept either:
   *   - slugs like "gbp-usd" from the API and convert to "GBPUSD"
   *   - or codes already shaped as "GBPUSD"
   *
   * This matches how the ribbon & mini widget look things up:
   *   const code = buildPairCode(pair.base, pair.quote); // "GBPUSD"
   *   const quote = quotesByPairId.get(code);
   */
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
            accept: 'application/json',
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

          if (Number.isFinite(next) && next > now) {
            delay = next - now;
          }
        }

        if (!cancelled) {
          timer = setTimeout(fetchOnce, delay);
        }
      } catch (err) {
        if (cancelled) return;

        // Keep any existing payload (so UI can still show last known values),
        // but surface the error if we don't have anything yet.
        setError(err);
        setStatus((prev) => (prev === 'ready' ? prev : 'error'));

        // Conservative backoff – at least 60s, or the configured interval.
        const RETRY_MS = Math.max(intervalMs, 60_000);
        if (!cancelled) {
          timer = setTimeout(fetchOnce, RETRY_MS);
        }
      }
    }

    void fetchOnce();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [enabled, intervalMs]);

  const quotesByPairId = useMemo(() => {
    const map = new Map<string, FxQuote>();
    if (!payload?.quotes) return map;

    for (const q of payload.quotes) {
      const rawId = q.pairId ?? '';

      // If the API sends slugs like "gbp-usd", convert to "GBPUSD".
      // If it already sends "GBPUSD", keep it as-is (uppercased).
      let key: string;

      if (rawId.includes('-')) {
        const parts = rawId
          .split('-')
          .map((part) => part.trim())
          .filter(Boolean);

        if (parts.length >= 2) {
          key = parts.map((part) => part.toUpperCase()).join('');
        } else {
          // Fallback: just strip hyphens and uppercase.
          key = rawId.replace(/-/g, '').toUpperCase();
        }
      } else {
        key = rawId.toUpperCase();
      }

      map.set(key, q);
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
