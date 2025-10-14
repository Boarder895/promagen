'use client';

import React from 'react';
import {
  PROVIDERS,
  type Provider,
  type ProviderMeta,
  getProviderMeta,
} from '@/lib/providers';

// Row = Provider data + computed score + a couple of derived flags
type Row = Provider & {
  score: number;
  uiOnly: boolean;
  supportsAutomation?: boolean;
  hasAffiliate?: boolean;
};

// Score from meta (stub logic; replace with your 7-criteria calc later)
function toScore(meta?: ProviderMeta): number {
  const supports = meta?.criteria?.automation && meta.criteria.automation > 0 ? 1 : 0;
  const hasAff = 0; // no affiliate signal yet; keep as 0 until we add one
  return Math.max(0, supports * 1.0 + hasAff * 0.1);
}

export default function LeaderboardPage() {
  const rows: Row[] = PROVIDERS
    .map((p) => {
      const meta = getProviderMeta(p.id);
      const hasApi = p.apiEnabled === true;
      const supportsAutomation = (meta?.criteria?.automation ?? 0) > 0;

      return {
        ...p,
        uiOnly: hasApi === false,
        supportsAutomation,
        hasAffiliate: false, // placeholder until we have a real signal
        score: toScore(meta),
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <main className="p-6">
      <h1 className="text-lg font-semibold mb-4">Provider Leaderboard (Demo)</h1>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Provider</th>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">API?</th>
              <th className="text-left px-3 py-2">Supports Automation?</th>
              <th className="text-left px-3 py-2">Affiliate?</th>
              <th className="text-left px-3 py-2">UI-only?</th>
              <th className="text-left px-3 py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 opacity-70">{r.id}</td>
                <td className="px-3 py-2">{r.apiEnabled ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{r.supportsAutomation ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{r.hasAffiliate ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{r.uiOnly ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{r.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Demo scoring only; we’ll swap in the 7-criteria weighted score later.
      </p>
    </main>
  );
}




