// Finance Ribbon (keeps your pairIds API) with:
// - PRM guard + optional intervalMs jiggle
// - LIVE/DELAYED/DEMO chip
// - Visible "as of HH:mm" timestamp
// - Stable data-testid for each pair
// - Consistent formatting via lib/format.number
//
// DOM remains stable between demo/live; only chip/timestamp text differs.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { asOfLabel, formatNumber } from "@/lib/format.number";

type Props = {
  /** Explicit pair ids to show; defaults to the classic free trio */
  pairIds?: string[];
  /** Polling/animation interval in ms; 0 disables (default 0) */
  intervalMs?: number;
  /** Demo mode chip; DOM structure stays identical */
  demo?: boolean;
  /** If data is delayed (e.g., free tier live feed disabled) */
  delayed?: boolean;
};

const DEFAULT_FREE = ["EURUSD", "GBPUSD", "EURGBP"];

type DemoQuote = { value: number; prevClose: number; precision: number; label: string };

function seed(id: string): DemoQuote {
  const map: Record<string, DemoQuote> = {
    EURUSD: { value: 1.1023, prevClose: 1.0899, precision: 5, label: "EUR/USD" },
    GBPUSD: { value: 1.2712, prevClose: 1.2631, precision: 5, label: "GBP/USD" },
    EURGBP: { value: 0.8674, prevClose: 0.8651, precision: 5, label: "EUR/GBP" },
    USDJPY: { value: 151.24, prevClose: 150.88, precision: 3, label: "USD/JPY" },
    AUDUSD: { value: 0.6521, prevClose: 0.6475, precision: 5, label: "AUD/USD" },
  };
  return map[id] ?? { value: 1, prevClose: 1, precision: 5, label: id };
}

function pctDelta(v: number, p: number): number {
  if (!p) return 0;
  return ((v - p) / p) * 100;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function FinanceRibbon({ pairIds, intervalMs = 0, demo = false, delayed = false }: Props) {
  const ids = pairIds?.length ? pairIds : DEFAULT_FREE;
  const [quotes, setQuotes] = useState(() =>
    ids.map((id) => ({ id, ...seed(id) }))
  );
  const [asOf, setAsOf] = useState<Date>(new Date());
  const reduced = prefersReducedMotion();

  // Keep list stable if ids change
  useEffect(() => {
    setQuotes(ids.map((id) => ({ id, ...seed(id) })));
    setAsOf(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")]);

  // Optional timer to jiggle demo quotes slightly
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!intervalMs || reduced) return;
    timer.current && window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setQuotes((q) =>
        q.map((x) => ({
          ...x,
          value: +(x.value * (1 + (Math.random() - 0.5) * 0.0008)).toFixed(x.precision),
        }))
      );
      setAsOf(new Date());
    }, intervalMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs, reduced]);

  const items = useMemo(() => quotes, [quotes]);

  const chip = demo ? "DEMO" : delayed ? "DELAYED" : "LIVE";

  return (
    <section
      role="region"
      aria-label="Finance ribbon"
      className="relative w-full overflow-hidden border-y border-gray-200 bg-white/70"
      data-testid="finance-ribbon"
    >
      {/* SR note only; DOM kept stable */}
      {demo && <p className="sr-only">Illustrative data only</p>}

      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100" aria-live="polite">
          {chip}
        </span>
        <span className="text-xs text-gray-600" data-testid="fx-asof">
          {asOfLabel(asOf)}
        </span>
      </div>

      <ul role="list" className="flex gap-6 px-4 pb-2 pt-1" aria-live="polite">
        {items.map((p) => {
          const d = pctDelta(p.value, p.prevClose);
          const sign = d > 0 ? "+" : d < 0 ? "–" : "±";
          const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "▶";
          const abs = Math.abs(d);

          return (
            <li
              key={p.id}
              role="listitem"
              data-testid={`fx-${p.id}`}
              className="min-w-[12rem] flex items-center gap-2"
              style={{
                transition: reduced ? "none" : "transform 150ms ease, opacity 150ms ease",
              }}
            >
              <span className="font-medium">{p.label}</span>
              <span className="ml-auto tabular-nums" aria-label={`value ${formatNumber(p.value, { digits: p.precision })}`}>
                {formatNumber(p.value, { digits: p.precision })}
              </span>
              <span
                aria-label={`change ${sign}${formatNumber(abs, { style: "percent", digits: 2 })}`}
                className={`text-sm tabular-nums ${d > 0 ? "text-emerald-600" : d < 0 ? "text-rose-600" : "text-gray-500"}`}
                title={`${sign}${formatNumber(abs, { style: "percent", digits: 2 })}`}
              >
                {arrow} {sign}
                {formatNumber(abs / 100, { style: "percent", digits: 2 })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
