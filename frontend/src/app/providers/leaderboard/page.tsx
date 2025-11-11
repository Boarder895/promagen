'use client';

import { PROVIDERS } from '@/data/providers';

export default function ProvidersLeaderboardPage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">AI Image-Generation Platforms — Top 20</h1>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/60 text-neutral-300">
              <tr>
                <th className="px-4 py-3 text-left w-[70px]">#</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left w-[90px]">Aff</th>
                <th className="px-4 py-3 text-right w-[110px]">Score</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.slice(0, 20).map((p: any, i: number) => (
                <tr key={p.id ?? i} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3">
                    <a className="hover:underline" href={String(p.url ?? p.website ?? '#')} target="_blank" rel="noreferrer">
                      {String(p.name ?? p.displayName ?? 'Unknown')}
                    </a>
                  </td>
                  <td className="px-4 py-3">{p.affiliateUrl ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-right">{(0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-neutral-400">
          Temporary static scoring; will be computed in Stage 3.
        </p>
      </div>
    </main>
  );
}

