// app/leaderboard/page.tsx
import React from 'react';
import { PROVIDERS, type ProviderMeta } from '@/lib/providers';

type Row = {
  id: string;
  name: string;
  apiEnabled: boolean;
  score: number;
};

const toScore = (_meta?: ProviderMeta): number => {
  // Simple demo scoring; use the one field we actually typed
  const base = _meta?.criteria1 ?? 0;
  return Math.max(0, Math.min(10, base));
};

export default function LeaderboardPage() {
  const rows: Row[] = PROVIDERS.map((p) => {
    const meta: ProviderMeta | undefined = (p as any).meta ?? undefined;
    return {
      id: p.id,
      name: p.name,
      apiEnabled: (p as any).apiEnabled === true,
      score: toScore(meta),
    };
  });

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Provider Leaderboard (Demo)</h1>
      <table className="min-w-[480px] w-full border rounded-xl">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2">Provider</th>
            <th className="text-left px-3 py-2">API</th>
            <th className="text-left px-3 py-2">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2">{r.apiEnabled ? 'Yes' : 'No'}</td>
              <td className="px-3 py-2">{r.score.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">
        Demo scoring only; we’ll swap in the weighted multi-criteria scorer later.
      </p>
    </main>
  );
}





