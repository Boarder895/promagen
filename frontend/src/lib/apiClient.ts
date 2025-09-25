// src/lib/apiClient.ts
import type { Provider } from "./providers";
import PROVIDERS from "./providers";
import { getApiBase } from "./api";

export type LeaderboardRow = {
  provider: Provider;
  score: number; // 0-100
  delta?: number;
  rank?: number;
};

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/v1/leaderboard`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const rows = (await res.json()) as LeaderboardRow[];
      // Ensure rank is present
      return rows
        .sort((a, b) => b.score - a.score)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    }
  } catch {
    // fall through to local mock
  }

  // Deterministic mock ranking so UI renders when API isn’t available.
  const pseudo = (s: string) =>
    [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 101, 0);

  return PROVIDERS
    .map<LeaderboardRow>((p) => ({
      provider: p,
      score: 50 + Math.floor(pseudo(p.id) / 2), // 50–100
      delta: Math.floor((pseudo(p.name) % 11) - 5), // -5..+5
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
