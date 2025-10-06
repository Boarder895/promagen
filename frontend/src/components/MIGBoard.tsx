// @/components/MIGBoard.tsx
"use client";

import * as React from "react";
import type { ProviderScore } from "@/lib/types";
import { getIcon } from "@/lib/icons";
import { buildAffiliateUrl } from "@/lib/aff";

type Props = {
  data: ProviderScore[];
  compact?: boolean;
};

function TrendBadge({ trend }: { trend: "hot" | "warm" | "cool" }) {
  const tone =
    trend === "hot"
      ? "bg-red-500/15 text-red-600"
      : trend === "warm"
      ? "bg-orange-500/15 text-orange-600"
      : "bg-blue-500/15 text-blue-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tone}`}>
      {getIcon("flame")} {trend}
    </span>
  );
}

function OfferBadge({ label, expiresAt }: { label: string; expiresAt?: string }) {
  const expires = expiresAt ? ` Ã‚Â· ends ${new Date(expiresAt).toLocaleDateString()}` : "";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-600 animate-pulse">
      {getIcon("tag")} {label}
      {expires && <span className="opacity-70">{expires}</span>}
    </span>
  );
}

export function MIGBoard({ data, compact = true }: Props): JSX.Element {
  const left = data.slice(0, 10);
  const right = data.slice(10, 20);
  const rowH = compact ? "h-12" : "h-14";

  const Row = ({ p }: { p: ProviderScore }) => {
    // Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ Safe, type-agnostic reads (no TS gripes, no runtime NaNs)
    const d = (p.deltas ?? {}) as Record<string, number>;

    const pointsDelta = Number.isFinite(d.points) ? Number(d.points) : 0;
    const rankDelta = Number.isFinite(d.rank) ? Number(d.rank) : 0;
    const upCount = Number.isFinite(d.up) ? Number(d.up) : 0;
    const downCount = Number.isFinite(d.down) ? Number(d.down) : 0;

    const total = typeof (p as any).total === "number" ? (p as any).total : 0;
    const chatterScore = (p as any).chatter?.score ?? 0;
    const chatterDelta = (p as any).chatter?.delta ?? 0;

    const iconKey: string = ((p as any).iconKey ?? p.id ?? "").toString();
    const trend = (p as any).trend as "hot" | "warm" | "cool" | undefined;

    const isUp = pointsDelta > 0 || upCount > downCount;
    const isDown = pointsDelta < 0 || downCount > upCount;

    const tint = isUp ? "from-emerald-500/10" : isDown ? "from-rose-500/10" : "from-zinc-500/10";
    const arrow = isUp ? "arrow-up" : isDown ? "arrow-down" : "minus";

    const baseUrl = (p as any).affiliate?.url || "#";
    const utm = (p as any).affiliate?.utm;
    const url = buildAffiliateUrl(baseUrl, utm);

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group ${rowH} w-full grid grid-cols-[auto,2rem,1fr,auto,auto] items-center gap-3 rounded-xl
                    bg-gradient-to-r ${tint} to-transparent px-3 ring-1 ring-black/5 hover:ring-black/10
                    transition-all hover:scale-[1.01]`}
        aria-label={`${(p as any).name ?? p.id} Ã¢â‚¬â€œ affiliate link`}
        title={(p as any).affiliate?.disclosureFull ?? "Affiliate link"}
      >
        <span className="text-xs font-semibold w-6 text-center rounded-md bg-black/5">
          {(p as any).rank ?? "Ã¢â‚¬â€"}
        </span>

        {/* Icon / monogram */}
        <span className="w-6 h-6 grid place-items-center rounded-md bg-black/5">
          <span className="text-[10px] font-bold">{iconKey.slice(0, 2).toUpperCase()}</span>
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{(p as any).name ?? p.id}</span>
            {trend && <TrendBadge trend={trend} />}
            {(p as any).specialOffer?.active && (p as any).specialOffer?.label && (
              <OfferBadge label={(p as any).specialOffer.label} expiresAt={(p as any).specialOffer.expiresAt} />
            )}
            {(p as any).affiliate?.label && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                {(p as any).affiliate.label}
              </span>
            )}
          </div>

          {/* chatter spark (compact) */}
          <div className="mt-0.5 text-[11px] text-zinc-600">
            Buzz {chatterScore} ({chatterDelta >= 0 ? "+" : ""}
            {chatterDelta})
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold">
            {Number.isFinite(total) ? total.toFixed(1) : "Ã¢â‚¬â€"}
          </div>
          <div className={`text-xs ${isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-zinc-600"}`}>
            <span className="inline-flex items-center gap-1">
              {getIcon(arrow)} {pointsDelta >= 0 ? "+" : ""}
              {pointsDelta.toFixed(1)}
            </span>
          </div>
        </div>

        {/* rank delta chip */}
        <div className="text-xs text-zinc-600">
          {rankDelta === 0 ? "Ã¢â‚¬â€œ" : rankDelta > 0 ? `Ã¢â€“Â² ${rankDelta}` : `Ã¢â€“Â¼ ${Math.abs(rankDelta)}`}
        </div>
      </a>
    );
  };

  return (
    <section aria-label="Top 20 MIG Platforms" className="w-full">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-semibold tracking-tight">Top 20 MIG Platforms</h2>
        <div className="text-xs text-zinc-600">
          Affiliate disclosure: We may earn a commission if you purchase via links on this page.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">{left.map((p) => <Row key={p.id} p={p} />)}</div>
        <div className="space-y-2">{right.map((p) => <Row key={p.id} p={p} />)}</div>
      </div>
    </section>
  );
}


