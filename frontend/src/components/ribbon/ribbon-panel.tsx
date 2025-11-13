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

export default function RibbonPanel({ pairIds, demo }: Props): JSX.Element {
  const [paused, setPaused] = React.useState(false);
  const [prefersReducedMotion, setPRM] = React.useState(false);
  const [now, setNow] = React.useState<Date>(() => new Date());

  // Respect prefers-reduced-motion
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setPRM(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Freshness timestamp tick (lightweight)
  React.useEffect(() => {
    if (paused || prefersReducedMotion) {
      // When paused or PRM, only refresh the clock occasionally
      const t = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(t);
    }
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [paused, prefersReducedMotion]);

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
          demo={demo}
          pairIds={pairIds}
          // When paused or PRM, interval is 0 (no motion/auto-advance)
          intervalMs={intervalMs}
        />
      </div>
    </section>
  );
}
