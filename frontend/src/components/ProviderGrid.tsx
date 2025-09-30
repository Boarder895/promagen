// src/components/ProviderGrid.tsx
import * as React from "react";
import { providers, type Provider } from "@/lib/providers";

type Mode = "all" | "api" | "affiliate" | "manual";

export type ProviderGridProps = {
  /** New, preferred prop */
  kind?: Mode;
  /** Legacy prop kept for compatibility */
  filter?: Mode;
  className?: string;
};

function byMode(list: Provider[], mode: Mode): Provider[] {
  switch (mode) {
    case "api":
      return list.filter((p) => p.hasApi);
    case "affiliate":
      return list.filter((p) => p.affiliate);
    case "manual":
      return list.filter((p) => !p.hasApi);
    case "all":
    default:
      return list;
  }
}

export default function ProviderGrid({
  kind = "all",
  filter,
  className = "",
}: ProviderGridProps) {
  const mode: Mode = (filter ?? kind) as Mode;
  const list = byMode(providers, mode);

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {list.map((p) => (
        <article key={p.id} className="rounded-xl border p-4 shadow-sm bg-white/50">
          <div className="text-base font-semibold">{p.name}</div>
          <div className="text-xs opacity-70 mt-1">{p.id}</div>
          <div className="mt-3 text-sm flex items-center gap-3">
            <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs">
              API: {p.hasApi ? "Yes" : "No"}
            </span>
            <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs">
              Affiliate: {p.affiliate ? "Yes" : "No"}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
