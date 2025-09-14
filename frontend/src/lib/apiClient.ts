const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export async function getLeaderboard(): Promise<import("./types").LeaderboardResponse> {
  const res = await fetch(`${BASE}/api/leaderboard`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Leaderboard fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
