"use client";

import data from "@/data/providers.json"; // ← your Excel-driven JSON

type Row = {
  rank: number;
  name: string;
  affiliate: "Yes" | "No";
  score: number;
  url: string;
};

export default function LeaderboardPage() {
  const rows: Row[] = (data as any[]).slice(0, 20).map((p, i) => ({
    rank: i + 1,
    name: String(p.name ?? p.displayName ?? "Unknown"),
    url: String(p.url ?? p.website ?? "#"),
    affiliate: p.affiliateUrl ? "Yes" : "No",
    score: 0.0, // Stage 3 will populate
  }));

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">AI Image-Generation Platforms — Top 20</h1>

        {/* table */}
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/60 text-neutral-300">
              <tr>
                <th className="px-4 py-3 text-left w-[70px]">#</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left w-[90px]">Aff</th>
                <th className="px-4 py-3 text-right w-[110px]">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="px-4 py-3">{r.rank}</td>
                  <td className="px-4 py-3">
                    <a className="hover:underline" href={r.url} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                  </td>
                  <td className="px-4 py-3">{r.affiliate}</td>
                  <td className="px-4 py-3 text-right">{r.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-neutral-400">
          Data source: <code>src/data/providers.json</code>. Scores will fill in automatically in Stage 3.
        </p>
      </div>
    </main>
  );
}














