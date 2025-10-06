// @/components/TickerTape.tsx
"use client";

import { useEffect, useState } from "react";
import type { ExchangeStatus } from "@/lib/exchangeStatus";

function fmt(mins?: number | null) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h ? `${h}h ` : ""}${m}m`;
}

export const TickerTape = () => {
  const [rows, setRows] = useState<ExchangeStatus[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetch("/api/v1/exchanges/status", { cache: "no-store" });
      if (!r.ok) return;
      const json = await r.json();
      if (alive) setRows(json.data as ExchangeStatus[]);
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // duplicate the list to create a seamless marquee
  const tape = [...rows, ...rows];

  return (
    <div className="relative overflow-hidden border-t border-b border-neutral-200/70 dark:border-neutral-800 py-2">
      <div
        className="whitespace-nowrap will-change-transform"
        style={{ animation: "pm-marquee 30s linear infinite" }}
      >
        {tape.map((r, i) => (
          <span
            key={`${r.id}-${i}`}
            className="mx-6 inline-flex items-center text-xs text-neutral-700 dark:text-neutral-300"
            title={`${r.name} Ã¢â‚¬Â¢ ${r.tz}`}
          >
            <span
              className={[
                "inline-block h-2 w-2 rounded-full",
                r.open ? "bg-emerald-500" : "bg-neutral-400",
              ].join(" ")}
            />
            <span className="ml-2 font-medium">{r.symbol}</span>
            <span className="ml-2 opacity-60">
              {r.open ? "Open" : `Opens in ${fmt(r.nextOpenMinutes)}`}
            </span>
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes pm-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
};


