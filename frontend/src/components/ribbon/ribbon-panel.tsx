"use client";

import React from "react";
import dynamic from "next/dynamic";

// FinanceRibbon renders client-side only to avoid SSR animation/state mismatches.
const FinanceRibbon = dynamic(
  () => import("@/components/ribbon/finance-ribbon"),
  { ssr: false }
);

type Props = {
  pairIds: string[];
  demo?: boolean;
};

/**
 * Shape returned by /api/fx
 * See: src/app/api/fx/route.ts
 */
type FxQuote = {
  id: string;
  value: number;
  prevClose: number;
};

type FxApiResponse = {
  ok: boolean;
  quotes?: FxQuote[];
  nextUpdateAt?: string;
  buildId?: string;
  mode?: "demo" | "live";
};

export default function RibbonPanel({ pairIds, demo }: Props): JSX.Element {
  const [paused, setPaused] = React.useState(false);
  const [prefersReducedMotion, setPRM] = React.useState(false);
  const [now, setNow] = React.useState<Date>(() => new Date());

  const [quotes, setQuotes] = React.useState<FxQuote[] | null>(null);
  const [fxMode, setFxMode] = React.useState<"idle" | "demo" | "live">("idle");

  // Respect prefers-reduced-motion
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setPRM(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Freshness timestamp tick (lightweight, independent of FX polling)
  React.useEffect(() => {
    if (paused || prefersReducedMotion) {
      // When paused or PRM, only refresh the clock occasionally
      const t = window.setInterval(() => setNow(new Date()), 60_000);
      return () => window.clearInterval(t);
    }
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, [paused, prefersReducedMotion]);

  /**
   * FX API polling:
   *  - Calls /api/fx (which itself may be demo or live).
   *  - Uses nextUpdateAt from the payload when present.
   *  - Falls back to a safe 60s interval, with guards.
   *  - Never spams the endpoint on errors (5-minute backoff).
   */
  React.useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const clampDelay = (requestedMs: number | null | undefined): number => {
      // Minimum 30s, maximum 15 minutes.
      const MIN = 30_000;
      const MAX = 15 * 60_000;
      if (!Number.isFinite(requestedMs ?? NaN)) return 60_000;
      const ms = requestedMs as number;
      return Math.min(Math.max(ms, MIN), MAX);
    };

    const scheduleNext = (nextUpdateAt?: string) => {
      const nextMs =
        nextUpdateAt != null
          ? Date.parse(nextUpdateAt) - Date.now()
          : 60_000;

      const delay = clampDelay(nextMs);
      timer = window.setTimeout(load, delay);
    };

    const load = async () => {
      try {
        const res = await fetch("/api/fx", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as FxApiResponse;

        if (!alive) return;

        if (json.ok && Array.isArray(json.quotes)) {
          setQuotes(json.quotes);
          setFxMode(json.mode === "live" ? "live" : "demo");
        } else {
          // Keep previous quotes, but mark as demo/error-safe.
          setFxMode("demo");
        }

        scheduleNext(json.nextUpdateAt);
      } catch {
        if (!alive) return;
        // On error, back off to 5 minutes to avoid hammering anything.
        timer = window.setTimeout(load, 5 * 60_000);
      }
    };

    load();

    return () => {
      alive = false;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  // When paused or PRM, interval is 0 (no motion/auto-advance)
  const intervalMs = paused || prefersReducedMotion ? 0 : 4000;

  // Accessible status line mirrors changing data
  const timeLabel = React.useMemo(() => {
    try {
      return now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return now.toISOString().slice(11, 16);
    }
  }, [now]);

  /**
   * Effective list of FX pairs to show:
   *  - If /api/fx provides quotes, we mirror that list (by id).
   *  - Otherwise we fall back to the pairIds passed in from the page.
   *
   * This keeps existing behaviour for tests and demo mode,
   * while making it trivial to flip /api/fx to “live” later.
   */
  const effectivePairIds = React.useMemo(() => {
    if (quotes && quotes.length > 0) {
      return quotes.map((q) => q.id);
    }
    return pairIds;
  }, [quotes, pairIds]);

  const effectiveDemoFlag =
    demo ?? (fxMode !== "live" /* treat unknown/idle as demo-safe */);

  return (
    <section
      aria-label="Finance ribbon controls and status"
      className="rounded-2xl bg-white/70 ring-1 ring-slate-200 shadow-sm p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          <span className="font-medium">Finance Ribbon</span>
          <span className="ml-2">As of {timeLabel} (local)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 active:scale-[0.99]"
            aria-pressed={paused}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          {prefersReducedMotion && (
            <span
              className="text-xs text-slate-500"
              aria-label="Reduced motion is enabled"
              title="Reduced motion is enabled"
            >
              PRM on
            </span>
          )}
        </div>
      </div>

      {/* Live region communicates updates politely without noise */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Market data updated. As of {timeLabel}.
      </p>

      <div className="mt-3">
        <FinanceRibbon
          demo={effectiveDemoFlag}
          pairIds={effectivePairIds}
          intervalMs={intervalMs}
        />
      </div>
    </section>
  );
}
