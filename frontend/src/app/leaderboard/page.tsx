import { getLeaderboard } from "@/lib/apiClient";
import ProviderCard from "@/components/ProviderCard";
import WorldClocks from "@/components/WorldClocks";

export default async function LeaderboardPage() {
  const data = await getLeaderboard();
  const sorted = [...data.providers]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((p, i) => ({ ...p, rank: i + 1 }));

  return (
    <main className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Live Leaderboard</h2>
        <p className="text-sm text-gray-600">
          Updated: {new Date(data.updatedAt).toLocaleString()}
        </p>
        <div className="grid gap-3">
          {sorted.map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">World Clocks</h2>
        <WorldClocks />
      </section>
    </main>
  );
}
