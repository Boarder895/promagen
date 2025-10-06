// @/components/ExchangeGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExchangeStatus } from "@/lib/exchangeStatus";
import type { Region } from "@/lib/markets";

type RegionFilter = "ALL" | "amer" | "EMEA" | "APAC";
const AUTO_REFRESH_MS = 30_000;

// tiny embedded chime for CLOSED -> OPEN
const BELL_MP3 =
  "data:audio/mpeg;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGlinZwAAAA8AAAACAAACcQAAACAAACACAAACcQAAACAAACACAAACcQAAAAAAAACQAAACQAAACQAAACQAAACQAAACQAAACQAAA//uQZAAAAAADLQAAAgAAAAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA";

function Sparkline({ values, w = 96, h = 20 }: { values: number[]; w?: number; h?: number }) {
  if (!values?.length) return <svg width={w} height={h} aria-hidden="true" />;
  const step = w / Math.max(values.length - 1, 1);
  const d = values
    .map((v, i) => {
      const x = i * step;
      const y = (1 - v) * (h - 2) + 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

type Item = ExchangeStatus & { history: number[]; region?: Region };
type ApiPayload = { data: ExchangeStatus[]; generatedAt: string };

function fmtMins(n: number | null | undefined): string {
  if (n == null) return "";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h ? `${h}h ` : ""}${m}m`;
}

// Map data regions → UI filter buckets
const toFilterBucket = (r?: Region): RegionFilter => {
  switch (r) {
    case "americas":
      return "amer";
    case "asia":
      return "APAC";
    case "europe":
    case "middle_east":
    case "africa":
      return "EMEA";
    default:
      return "ALL";
  }
};

export const ExchangeGrid = ({ initialRegion = "ALL" as RegionFilter }) => {
  const [rows, setRows] = useState<ExchangeStatus[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [region, setRegion] = useState<RegionFilter>(initialRegion);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOpen = useRef<Record<string, boolean>>({});
  const history = useRef<Record<string, number[]>>({});

  useEffect(() => {
    const abort = new AbortController();

    async function load() {
      try {
        const r = await fetch("/api/v1/exchanges/status", { cache: "no-store", signal: abort.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json: ApiPayload = await r.json();

        json.data.forEach((row) => {
          // chime once when a market flips from closed -> open
          const was = prevOpen.current[row.id];
          if (was === false && row.open === true) {
            audioRef.current?.play().catch(() => void 0);
          }
          prevOpen.current[row.id] = row.open;

          const arr = history.current[row.id] ?? [];
          arr.push(row.open ? 1 : 0);
          if (arr.length > 60) arr.shift(); // ~30m at 30s refresh
          history.current[row.id] = arr;
        });

        setRows(json.data);
        setGeneratedAt(json.generatedAt);
      } catch (e) {
        console.warn("[ExchangeGrid] refresh failed:", e);
      }
    }

    load();
    const t = setInterval(load, AUTO_REFRESH_MS);
    return () => {
      abort.abort();
      clearInterval(t);
    };
  }, []);

  const items: Item[] = useMemo(
    () => rows.map((r) => ({ ...r, history: history.current[r.id] ?? [r.open ? 1 : 0] })),
    [rows]
  );

  const filtered = useMemo(
    () => items.filter((i) => region === "ALL" || toFilterBucket(i.region as Region) === region),
    [items, region]
  );

  const Filter = ({ val, label }: { val: RegionFilter; label: string }) => (
    <button
      onClick={() => setRegion(val)}
      className={[
        "text-[10px] px-2.5 py-1 rounded-full border transition-colors",
        region === val
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900/10 dark:border-white/10"
          : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800 dark:hover:bg-neutral-800",
      ].join(" ")}
      aria-pressed={region === val}
    >
      {label}
    </button>
  );

  return (
    <section className="mt-8">
      <audio ref={audioRef} src={BELL_MP3} preload="auto" />
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          Exchange Board
          {generatedAt && (
            <span className="ml-2 text-[10px] font-normal text-neutral-500">
              (refreshed {new Date(generatedAt).toLocaleTimeString()})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          <Filter val="ALL" label="All" />
          <Filter val="amer" label="Amer" />
          <Filter val="EMEA" label="EMEA" />
          <Filter val="APAC" label="APAC" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {filtered.map((i) => (
          <article
            key={i.id}
            className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 p-3 shadow-sm bg-white/60 dark:bg-neutral-900/40 hover:shadow transition-shadow"
            title={`${i.name} • Hours ${i.hours} (${i.tz})`}
          >
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-widest text-neutral-500">{i.symbol}</span>
                <span className="text-xs text-neutral-400">{i.localTime}</span>
              </div>
              <div className="flex items-center gap-1">
                {i.holiday && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                    Holiday
                  </span>
                )}
                <span
                  className={[
                    "text-[10px] px-2 py-0.5 rounded-full border",
                    i.open
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-neutral-50 text-neutral-600 border-neutral-200",
                  ].join(" ")}
                >
                  {i.open ? "Open" : "Closed"}
                </span>
              </div>
            </header>

            <div className="mt-2 text-[11px] text-neutral-600 dark:text-neutral-400">
              <div className="font-medium">{i.name}</div>
              <div className="opacity-80">Hours {i.hours}</div>
              <div className="opacity-60">{i.tz}</div>
              {!i.open && i.nextOpenMinutes != null && (
                <div className="mt-1 text-[10px] text-neutral-500">
                  Opens in <span className="font-medium">{fmtMins(i.nextOpenMinutes)}</span>
                </div>
              )}
            </div>

            <div className="mt-2 text-neutral-400">
              <Sparkline values={i.history} />
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-neutral-500">
        Times shown are local to each exchange’s time zone. Split sessions/holidays simplified; refine calendars in
        <code className="mx-1">src/lib/markets.ts</code>.
      </p>
    </section>
  );
};



