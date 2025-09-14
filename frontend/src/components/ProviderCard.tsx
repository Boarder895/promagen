"use client";

import { type ProviderScore } from "@/lib/types";
import cn from "classnames";

export default function ProviderCard({ p }: { p: ProviderScore }) {
  const up = (p.delta ?? 0) > 0;
  const down = (p.delta ?? 0) < 0;

  return (
    <div className="flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt={`${p.name} logo`} className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
        )}
        <div className="flex flex-col">
          <span className="font-semibold">{p.name}</span>
          <span className="text-xs text-gray-500">#{p.rank ?? "—"}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-lg font-semibold tabular-nums">{Math.round(p.score)}</div>
        <div
          className={cn(
            "rounded-full px-2 py-0.5 text-sm tabular-nums",
            up && "bg-green-50 text-green-700",
            down && "bg-red-50 text-red-700",
            !up && !down && "bg-gray-50 text-gray-700"
          )}
          title="Change since last snapshot"
        >
          {p.delta ? (p.delta > 0 ? `▲ ${p.delta.toFixed(1)}` : `▼ ${Math.abs(p.delta).toFixed(1)}`) : "• 0.0"}
        </div>
      </div>
    </div>
  );
}
