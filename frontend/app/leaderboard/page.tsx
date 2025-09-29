// Simple provider leaderboard (server component).
// Uses the Option-A provider registry and lists API-enabled providers first.

import { getProviders } from "@/lib/providers";

export default async function LeaderboardPage() {
  const all = await getProviders();
  const rows = all
    .slice()
    .sort((a, b) => (a.mode === "real" ? -1 : 1) - (b.mode === "real" ? -1 : 1));

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Provider Leaderboard</h1>
      <p className="opacity-70 max-w-[65ch]">
        Lightweight view of providers in your front-end registry. API-enabled providers are listed first.
      </p>

      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Provider</th>
              <th className="p-3">Mode</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.name}</td>
                <td className="p-3">
                  {p.mode === "real" ? "API" : p.mode === "copy" ? "Copy/Open" : "Disabled"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center opacity-70" colSpan={2}>
                  No providers registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
