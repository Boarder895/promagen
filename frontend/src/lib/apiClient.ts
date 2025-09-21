// src/lib/apiClient.ts
export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // TODO: replace with real data fetching
  return [];
}
