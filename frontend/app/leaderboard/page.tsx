import React from "react";
import { PROVIDERS, type Provider } from "@/lib/providers";

export const revalidate = 60;

type Scored = Provider & { apiWeight: number; affiliateWeight: number };

export default function LeaderboardPage() {
  const items: Scored[] = [...PROVIDERS].map((p) => ({
    ...p,
    apiWeight: p.hasApi ? 1 : 0,
    affiliateWeight: "affiliate" in (p as any) ? Number((p as any).affiliate) || 0 : 0,
  }));

  items.sort(
    (a, b) =>
      b.apiWeight - a.apiWeight ||
      b.affiliateWeight - a.affiliateWeight ||
      a.name.localeCompare(b.name)
  );

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Provider Leaderboard</h1>
      <ol className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="border rounded-lg p-3 flex items-center justify-between">
            <span className="font-medium">{p.name}</span>
            <span className="text-sm opacity-80">
              API: {p.hasApi ? "Yes" : "No"} • Affiliate: {p.affiliateWeight}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
