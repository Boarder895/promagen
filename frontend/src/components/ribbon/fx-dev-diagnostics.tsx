'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFxTrace } from '@/hooks/use-fx-trace';

type Props = {
  /**
   * Hard on/off switch from parent.
   * Defaults to true, but the panel still requires an explicit opt-in (see below).
   */
  enabled?: boolean;
};

/**
 * Dev diagnostics panel (FX).
 *
 * Important behaviours:
 * - Never renders in production.
 * - Does NOT auto-poll by default (prevents terminal spam).
 * - Enable polling explicitly via:
 *   - localStorage flag, OR
 *   - query param ?fxTrace=1, OR
 *   - NEXT_PUBLIC_FX_TRACE=1
 * - Pauses polling when tab is hidden (handled in the hook).
 */
export default function FxDevDiagnostics({ enabled = true }: Props) {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' && enabled;

  const envOptIn = process.env.NEXT_PUBLIC_FX_TRACE === '1';

  const queryOptIn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('fxTrace') === '1';
  }, []);

  const [localOptIn, setLocalOptIn] = useState(false);

  useEffect(() => {
    if (!isDev) return;
    try {
      const raw = window.localStorage.getItem('promagen.fxTrace');
      setLocalOptIn(raw === '1');
    } catch {
      // ignore
    }
  }, [isDev]);

  const shouldPoll = isDev && (envOptIn || queryOptIn || localOptIn);

  // Slow polling to reduce noise: 30s (and pauses when tab hidden).
  const trace = useFxTrace(shouldPoll, 30_000, { pauseWhenHidden: true, minIntervalMs: 15_000 });

  // If not dev, show nothing (production-safe).
  if (!isDev) return null;

  // If not opted in, show nothing by default to avoid clutter and spam.
  if (!shouldPoll) return null;

  if (!trace) return null;

  const missing = trace.lastFetch?.missingSymbols ?? [];
  const missingCount = trace.lastFetch?.missingCount ?? 0;

  return (
    <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-white/90">FX Dev Diagnostics</div>
        <div className="text-white/70">
          Upstream calls:{' '}
          <span className="font-semibold text-white/90">{trace.counters.upstreamCalls}</span> ·
          Ribbon calls:{' '}
          <span className="font-semibold text-white/90">{trace.counters.ribbonCalls}</span> · TTL:{' '}
          <span className="font-semibold text-white/90">{trace.ttlSeconds}s</span>
        </div>
      </div>

      <div className="mt-2 grid gap-1">
        <div>
          Cache:{' '}
          <span className="font-semibold text-white/90">{trace.cache.hasValue ? 'yes' : 'no'}</span>{' '}
          {trace.cache.expiresAt ? (
            <span className="text-white/70"> (expires {trace.cache.expiresAt})</span>
          ) : null}
        </div>

        <div>
          Last decision:{' '}
          <span className="font-semibold text-white/90">{trace.lastDecision ?? '—'}</span>
          {trace.lastError ? (
            <span className="text-red-200"> · Error: {trace.lastError}</span>
          ) : null}
        </div>

        <div>
          Missing symbols:{' '}
          <span
            className={
              missingCount > 0 ? 'font-semibold text-amber-200' : 'font-semibold text-emerald-200'
            }
          >
            {missingCount}
          </span>
          {trace.lastFetch?.at ? (
            <span className="text-white/70"> · Last fetch {trace.lastFetch.at}</span>
          ) : null}
        </div>

        {missingCount > 0 ? (
          <div className="mt-2 max-h-28 overflow-auto rounded bg-black/30 p-2 text-amber-100">
            {missing.map((s) => (
              <div key={s}>{s}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
