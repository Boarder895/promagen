// FRONTEND ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Provider leaderboard (NEW) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· named exports only
"use client";

import { useEffect, useState } from "react";

type Row = {
  slug: string;
  name: string;
  total: number;
  hasApi: boolean;
  hasAffiliate: boolean;
  criteria?: Record<string, number>;
};

type Payload = {
  asOf: string;
  providers: Row[];
};

const Icon = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-neutral-100 text-neutral-700 text-[12px]" title={title} aria-label={title}>
    {children}
  </span>
);

export const ProviderLeaderboard = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001"}/api/v1/providers/leaderboard`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Payload;
        setData(j);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      }
    };
    run();
  }, []);

  if (err) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">Failed to load leaderboard: {err}</div>;
  }
  if (!data) {
    return <div className="rounded-lg border border-neutral-200 bg-white p-4 text-neutral-600">Loading leaderboardÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</div>;
  }

  return (
    <section className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Image Generation Platforms</h2>
        <span className="text-xs text-neutral-500">As of {new Date(data.asOf).toLocaleString()}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Image Generation Platform</th>
              <th className="px-4 py-3 text-right font-medium">TOTAL (/100)</th>
              <th className="px-4 py-3 text-right font-medium">Badges</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.providers.map((p) => (
              <tr key={p.slug} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center rounded-lg border border-neutral-200 px-2 py-1 font-semibold tabular-nums">
                    {p.total.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {p.hasApi ? <Icon title="Public API available">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬â„¢</Icon> : null}
                    {p.hasAffiliate ? <Icon title="Affiliate programme">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â</Icon> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
          Legend: ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬â„¢ API ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â Affiliate
        </div>
      </div>
    </section>
  );
};


