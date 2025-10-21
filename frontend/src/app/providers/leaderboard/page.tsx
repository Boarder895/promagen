// frontend/src/app/providers/leaderboard/page.tsx
'use client';

import providers from '@/data/providers.json';

type ProviderJson = {
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  website?: string;
  affiliateUrl?: string | null;
};

type Row = {
  rank: number;
  name: string;
  url: string;
  affiliate: 'Yes' | 'No';
  score: number;
};

function toRows(list: unknown, limit = 20): Row[] {
  const arr = Array.isArray(list) ? (list as ProviderJson[]) : [];
  return arr.slice(0, limit).map((p, i) => {
    const name = String(p.name ?? p.displayName ?? 'Unknown');
    const url = String(p.url ?? p.website ?? '#');
    const affiliate: 'Yes' | 'No' = p.affiliateUrl ? 'Yes' : 'No';
    // Score is placeholder until Stage 3 wires real metrics
    const score = 0;
    return { rank: i + 1, name, url, affiliate, score };
  });
}

export default function ProvidersLeaderboardPage() {
  const rows = toRows(providers, 20);

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">AI Image-Generation Platforms — Top 20</h1>

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
          Data source: <code>src/data/providers.json</code>. Scores populate in Stage&nbsp;3.
        </p>
      </div>
    </main>
  );
}




