import React from "react";
import { getLeaderboard, type LeaderboardRow } from "@/lib/apiClient";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const rows: LeaderboardRow[] = await getLeaderboard();

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Provider Leaderboard</h1>
      <div className="grid grid-cols-12 gap-2 font-medium border-b pb-2">
        <div className="col-span-1">#</div>
        <div className="col-span-5">Provider</div>
        <div className="col-span-3">Score</div>
        <div className="col-span-3">Δ (24h)</div>
      </div>
      {rows.map((r) => (
        <div key={r.provider.id} className="grid grid-cols-12 gap-2 py-2 border-b">
          <div className="col-span-1">{r.rank}</div>
          <div className="col-span-5">{r.provider.name}</div>
          <div className="col-span-3">{r.score}</div>
          <div className="col-span-3">{typeof r.delta === "number" ? r.delta : 0}</div>
        </div>
      ))}
    </main>
  );
}
