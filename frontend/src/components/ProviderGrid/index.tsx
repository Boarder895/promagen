"use client";

import React, { useMemo, useState } from "react";
import { PROVIDERS } from "@/lib/providers";
import type { Provider } from "@/lib/providers";

type Filter = "all" | "api" | "affiliate" | "manual";

export default function ProviderGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const providers = useMemo<Provider[]>(() => [...PROVIDERS], []);

  const list = useMemo(() => {
    switch (filter) {
      case "api":
        return providers.filter((p) => p.hasApi);
      case "affiliate":
        // tolerant: some Provider objects may not have affiliate
        return providers.filter((p) => "affiliate" in (p as any) && Boolean((p as any).affiliate));
      case "manual":
        return providers.filter((p) => !p.hasApi);
      default:
        return providers;
    }
  }, [providers, filter]);

  return (
    <section className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm">Filter:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All</option>
          <option value="api">API</option>
          <option value="affiliate">Affiliate</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((p) => (
          <li key={p.id} className="border rounded-lg p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs opacity-70">
              API: {p.hasApi ? "Yes" : "No"}
              {"affiliate" in (p as any) && (p as any).affiliate
                ? ` • Affiliate: ${(p as any).affiliate}`
                : ""}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

