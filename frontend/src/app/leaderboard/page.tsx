// Normalised to your data module that exports `PROVIDERS`.
import { PROVIDERS } from '@/data/providers';

type ProviderRow = {
  id: string;
  name: string;
  url: string;
  affiliateUrl?: string | null;
  tagline?: string | null;
};

const toRows = (list: unknown, limit = 20): ProviderRow[] => {
  const arr = Array.isArray(list) ? (list as any[]) : [];
  return arr.slice(0, limit).map((p: any) => ({
    id: String(p.id ?? (String(p.name ?? p.displayName ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-'))),
    name: String(p.name ?? p.displayName ?? 'Unknown'),
    url: String(p.url ?? p.website ?? '#'),
    affiliateUrl: p.affiliateUrl ?? null,
    tagline: p.tagline ?? null,
  }));
};

export default function LeaderboardPage() {
  const rows = toRows(PROVIDERS, 20);

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">AI Image-Generation Platforms — Leaderboard</h1>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/60 text-neutral-300">
              <tr>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Affiliate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="px-4 py-3">
                    <a className="hover:underline" href={r.url} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                    {r.tagline ? <div className="text-xs opacity-70">{r.tagline}</div> : null}
                  </td>
                  <td className="px-4 py-3">{r.affiliateUrl ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-neutral-400">
          Data source: <code>src/data/providers.ts</code>. Scores wire up in Stage 3.
        </p>
      </div>
    </main>
  );
}

