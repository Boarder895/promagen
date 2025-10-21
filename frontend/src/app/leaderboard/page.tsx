import { providers, type Provider } from "@/lib/providers";

const toScore = (_p?: Provider): number => {
  const s = _p?.score ?? 0;
  return Math.max(0, Math.min(10, s));
};

export default function Page() {
  const rows = (Array.isArray(providers) ? providers : []).map((p) => ({
    id: p.id,
    name: p.name,
    apiEnabled: p.apiEnabled === true,
    score: toScore(p), // placeholder until you wire real meta
  }));

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Leaderboard (Demo)</h1>
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
              <td className="px-3 py-2">{r.apiEnabled ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{r.score.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">
        Demo scoring only; swap in the real scorer later.
      </p>
    </main>
  );
}













