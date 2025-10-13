'use client';

import React from 'react';
import { PROVIDERS, type ProviderMeta } from '@/lib/providers';

// Row = provider + demo score for compile sanity.
// Replace scoring with your 7-criteria weighted calc later.
type Row = ProviderMeta & { score: number; uiOnly: boolean };

const toScore = (p: ProviderMeta): number => {
  // Safe boolean reads for optional fields
  const supports = p.supportsAutomation === true ? 1 : 0;
  const hasAff   = p.hasAffiliate === true ? 1 : 0;

  // Simple, deterministic demo score
  // API/supportsAutomation is dominant; affiliate is a small bump.
  return Math.max(0, supports * 1.0 + hasAff * 0.1);
};

export default function LeaderboardPage() {
  const rows: Row[] = PROVIDERS
    .map((p) => ({
      ...p,
      uiOnly: p.hasApi === false,         // derive instead of reading a missing field
      score: toScore(p),
    }))
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
            {rows.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 opacity-70">{p.id}</td>
                <td className="px-3 py-2">{p.hasApi ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{p.supportsAutomation === true ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{p.hasAffiliate === true ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{p.uiOnly ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{p.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Demo scoring for compile sanity. We’ll swap in the 7-criteria weighted score later.
      </p>
    </main>
  );
}



