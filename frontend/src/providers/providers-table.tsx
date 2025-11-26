'use client';

import React from 'react';
import type { Provider } from '@/types/provider';
import { trackProviderOutbound } from '@/lib/analytics/providers';

export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;
  title?: string;
  caption?: string;
  limit?: number; // default 20
  showRank?: boolean; // default true
};

function trendLabel(t?: Provider['trend']): string {
  if (t === 'up') return 'Trending up';
  if (t === 'down') return 'Trending down';
  return 'No change';
}

export default function ProvidersTable(props: ProvidersTableProps): JSX.Element {
  const {
    providers,
    title = 'AI Providers',
    caption = 'Top providers ranked by Promagen score.',
    limit = 20,
    showRank = true,
  } = props;

  const rows = React.useMemo(() => {
    const copy = [...providers];
    copy.sort((a, b) => {
      const scoreA = typeof a.score === 'number' ? a.score : -Infinity;
      const scoreB = typeof b.score === 'number' ? b.score : -Infinity;

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      return a.name.localeCompare(b.name);
    });

    if (limit > 0 && copy.length > limit) {
      return copy.slice(0, limit);
    }

    return copy;
  }, [providers, limit]);

  if (rows.length === 0) {
    return (
      <section aria-label={title}>
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {caption ? <p className="mt-1 text-sm text-white/60">{caption}</p> : null}
        </header>
        <p className="text-sm text-white/60">No providers available.</p>
      </section>
    );
  }

  return (
    <section aria-label={title}>
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {caption ? <p className="mt-1 text-sm text-white/60">{caption}</p> : null}
      </header>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <table className="min-w-full divide-y divide-white/10">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-white/60">
              {showRank && (
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  #
                </th>
              )}
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Provider
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Score
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Trend
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Tags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((p, i) => (
              <tr key={p.id}>
                {showRank && (
                  <th scope="row" className="px-3 py-2 font-normal text-white/70">
                    {i + 1}
                  </th>
                )}
                <td className="px-3 py-2">
                  {p.url ? (
                    <a
                      href={p.url}
                      onClick={() =>
                        trackProviderOutbound({
                          providerId: p.id,
                          providerName: p.name,
                          destinationUrl: p.url!,
                          source: 'leaderboard',
                        })
                      }
                      className="underline underline-offset-2 hover:text-white"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.name}
                    </a>
                  ) : (
                    p.name
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{p.score ?? '—'}</td>
                <td className="px-3 py-2">
                  {p.trend ? (
                    <span
                      aria-label={trendLabel(p.trend)}
                      className="inline-flex items-center gap-1 text-xs"
                    >
                      <span
                        aria-hidden="true"
                        className={
                          p.trend === 'up'
                            ? 'h-2 w-2 rounded-full bg-emerald-400'
                            : p.trend === 'down'
                            ? 'h-2 w-2 rounded-full bg-rose-400'
                            : 'h-2 w-2 rounded-full bg-slate-400'
                        }
                      />
                      <span className="capitalize text-white/80">{p.trend}</span>
                    </span>
                  ) : (
                    <span className="text-white/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {p.tags && p.tags.length > 0 ? (
                    <ul className="flex flex-wrap gap-1 text-[0.7rem] text-white/70">
                      {p.tags.map((tag) => (
                        <li key={tag} className="rounded-full border border-white/10 px-2 py-0.5">
                          #{tag}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-white/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
