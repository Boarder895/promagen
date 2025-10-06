"use client";
import { useEffect, useMemo } from 'react';
import { useSWRCache } from "@/lib/swrcache";
import { getExchangesStatus, type ExchangeStatus } from "@/lib/dataGateway";
import { Skeleton } from "@/components/Skeleton";
import { useMarketChime } from "@/hooks/useMarketChime";
import { useSound } from "@/hooks/useSound";

// NEW UI bits
import { DualTimeTooltip } from "@/components/DualTimeTooltip";
import { PoweredByTooltip } from "@/components/PoweredByTooltip";
import { OpenWindowBanner } from "@/components/OpenWindowBanner";
import { Sparkline } from "@/components/Sparkline";
import { getMarketMoodTint } from "@/lib/marketMood";
import { useBackoff } from "@/hooks/useBackoff";
import { OfflineBadge } from "@/components/OfflineBadge";

const EXCH_REFRESH = Number(process.env.NEXT_PUBLIC_EXCH_REFRESH_MS ?? "20000") || 20000;

// Canonical 16 exchanges in east?west order (stable IDs)
const ORDER: string[] = [
  "asx",
  "tse",
  "sse",
  "hkex",
  "sgx",
  "dfm",
  "moex",
  "jse",
  "epa",
  "xetra",
  "lse",
  "nyse",
  "nasdaq",
  "buenosaires",
  "tsx",
  "b3",
];

// Minimal region map for banner chips
const REGION_MAP: Record<string, "asia" | "emea" | "amer"> = {
  asx: "asia",
  tse: "asia",
  sse: "asia",
  hkex: "asia",
  sgx: "asia",
  dfm: "emea",
  moex: "emea",
  jse: "emea",
  epa: "emea",
  xetra: "emea",
  lse: "emea",
  nyse: "amer",
  nasdaq: "amer",
  buenosaires: "amer",
  tsx: "amer",
  b3: "amer",
};

type Row = {
  id: string;
  name: string;
  last?: number;
  deltaPts?: number;
  deltaPct?: number;
  isOpen?: boolean;
  lastUpdateIso: string;
  openIso?: string;
  closeIso?: string;
  nextFlipIso?: string;
  spark?: Array<{ t: number; v: number }>;
  sources?: Array<{ name: string; weight?: number; note?: string }>;
};

function fmt(n?: number, opts: Intl.NumberFormatOptions = {}): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...opts }).format(n);
}

export function ExchangeBoard() {
  const { enabled } = useSound();

  // Poll status; revalidate on focus
  const { data, isLoading, error } = useSWRCache<ExchangeStatus[]>(
    "exchanges/status",
    getExchangesStatus,
    { refreshMs: EXCH_REFRESH, revalidateOnFocus: true }
  );

  // Offlining badge with simple visual backoff (SWR will still retry on its own schedule)
  const { delay, tick, reset } = useBackoff(1000, 30000);
  useEffect(() => {
    if (error) tick();
    else reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!error]);

  // Normalize to the canonical order with safe fallbacks
  const rows: Row[] = useMemo(() => {
    const byId = new Map<string, any>();
    (Array.isArray(data) ? data : []).forEach((d: any) => {
      if (d && typeof d.id === "string") byId.set(d.id, d);
    });

    return ORDER.map((id) => {
      const s = byId.get(id) ?? {};
      return {
        id,
        name: s.displayName ?? s.name ?? id,
        last: typeof s.last === "number" ? s.last : undefined,
        deltaPts: typeof s.delta_points === "number" ? s.delta_points : undefined,
        deltaPct: typeof s.delta_pct === "number" ? s.delta_pct : undefined,
        isOpen: typeof s.isOpen === "boolean" ? s.isOpen : undefined,

        // Optional fields from API; fallbacks so tooltips never break
        lastUpdateIso: typeof s.lastUpdateIso === "string" ? s.lastUpdateIso : new Date().toISOString(),
        openIso: typeof s.openIso === "string" ? s.openIso : undefined,
        closeIso: typeof s.closeIso === "string" ? s.closeIso : undefined,
        nextFlipIso: typeof s.nextFlipIso === "string" ? s.nextFlipIso : undefined,
        spark: Array.isArray(s.spark) ? s.spark : undefined,
        sources: Array.isArray(s.influences) ? s.influences : undefined,
      };
    });
  }, [data]);

  // ?? One chime per open/close wave (env-tuned debounce inside hook)
  useMarketChime(
    rows.map((r) => ({ id: r.id, isOpen: r.isOpen })),
    enabled
  );

  // Region banner inputs
  const regionWindows = useMemo(() => {
    const regions = ["asia", "emea", "amer"] as const;
    return regions.map((rg) => {
      const exInRegion = rows.filter((r) => REGION_MAP[r.id] === rg);
      const isOpen = exInRegion.some((r) => r.isOpen);
      // pick the earliest nextFlip in region (if provided)
      const nextFlipIso =
        exInRegion
          .map((r) => r.nextFlipIso)
          .filter((x): x is string => !!x)
          .sort()[0] ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(); // fallback +1h
      return { regionId: rg, isOpen, nextFlipIso };
    });
  }, [rows]);

  const regionChips = [
    { id: "asia", name: "Asia", tint: "border-emerald-300" },
    { id: "emea", name: "EMEA", tint: "border-sky-300" },
    { id: "amer", name: "amer", tint: "border-amber-300" },
  ];

  // Optional breadcrumb
  useEffect(() => {
    if (Array.isArray(data)) {
      console.debug("[ExchangeBoard] received", data.length, "exchanges");
    }
  }, [data]);

  if (isLoading && (!data || data.length === 0)) {
    return (
      <div role="status" aria-live="polite">
        <OpenWindowBanner regions={regionChips} windows={regionWindows} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white/60 p-3">
              <Skeleton lines={1} />
              <div className="mt-2 text-xs text-gray-500">loading</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && (!data || data.length === 0)) {
    return (
      <div role="status" aria-live="polite" className="rounded-xl border bg-white/60 p-3 text-sm text-gray-600">
        <OpenWindowBanner regions={regionChips} windows={regionWindows} />
        No exchange data yet. Start the API at{" "}
        <code className="font-mono">/api/v1/exchanges/status</code> or check{" "}
        <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code>.
      </div>
    );
  }

  return (
    <div>
      {/* Region status + next flip */}
      <OpenWindowBanner regions={regionChips} windows={regionWindows} />

      {/* If offline, show backoff chip */}
      {error ? (
        <div className="mb-2">
          <OfflineBadge retryInMs={delay} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => {
          const tint =
            r.deltaPct == null ? "bg-gray-50" : r.deltaPct > 0 ? "bg-green-50" : r.deltaPct < 0 ? "bg-red-50" : "bg-gray-50";
          const mood = r.openIso && r.closeIso ? getMarketMoodTint({ openIso: r.openIso, closeIso: r.closeIso }) : "bg-white";

          return (
            <div key={r.id} className={`flex items-center justify-between rounded-xl border p-3 ${tint} ${mood}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{r.name}</div>

                  {/* Dual-time tooltip with last update */}
                  <DualTimeTooltip isoLastUpdate={r.lastUpdateIso} label={r.name}>
                    <span className="cursor-help select-none text-xs underline decoration-dotted opacity-70">details</span>
                  </DualTimeTooltip>

                  {/* Powered by (if influences present) */}
                  {Array.isArray(r.sources) && r.sources.length > 0 ? (
                    <PoweredByTooltip sources={r.sources}>
                      <span className="cursor-help select-none text-xs opacity-70">powered</span>
                    </PoweredByTooltip>
                  ) : null}
                </div>

                <div className="text-xs text-gray-500">{r.isOpen === true ? "open" : r.isOpen === false ? "closed" : "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}</div>

                {/* Mini trend sparkline if provided */}
                {Array.isArray(r.spark) ? <div className="mt-2 w-36"><Sparkline data={r.spark} /></div> : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="tabular-nums font-semibold">{fmt(r.last)}</div>
                  <div
                    className={`tabular-nums text-xs ${
                      r.deltaPct == null
                        ? "text-gray-500"
                        : r.deltaPct > 0
                        ? "text-green-700"
                        : r.deltaPct < 0
                        ? "text-red-700"
                        : "text-gray-600"
                    }`}
                  >
                    {r.deltaPts != null ? fmt(r.deltaPts) : "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"} ({r.deltaPct != null ? fmt(r.deltaPct) + "%" : "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"})
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


