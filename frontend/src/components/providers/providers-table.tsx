// src/components/providers/providers-table.tsx

import React from 'react';
import type { Provider } from '@/types/provider';
import { buildGoHref } from '@/lib/affiliate/outbound';

export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;

  /** Optional heading text (some pages render their own headings). */
  title?: string;

  /** Optional caption/description (some pages render their own copy). */
  caption?: string;

  /** Optional row limit. When set, the table renders at most this many providers. */
  limit?: number;

  /** Optional rank column toggle (kept for backwards compatibility). */
  showRank?: boolean;
};

function hasOutboundDestination(provider: Provider): boolean {
  return Boolean(provider.affiliateUrl ?? provider.url ?? provider.website);
}

export default function ProvidersTable(props: ProvidersTableProps) {
  const { providers, limit } = props;

  const rows =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? providers.slice(0, Math.floor(limit))
      : providers;

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
      <table className="min-w-full text-sm text-slate-200">
        <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 text-left">Provider</th>
            <th className="px-4 py-3 text-right">Score</th>
            <th className="px-4 py-3 text-right">Trend</th>
            <th className="px-4 py-3 text-left">Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-900/30">
              <td className="px-4 py-3 font-medium text-slate-50">
                {hasOutboundDestination(p) ? (
                  <a
                    href={buildGoHref(p.id, 'leaderboard')}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-600 underline-offset-4 hover:decoration-slate-300"
                  >
                    {p.name}
                  </a>
                ) : (
                  <span>{p.name}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{p.score ?? '—'}</td>
              <td className="px-4 py-3 text-right">{p.trend ?? '—'}</td>
              <td className="px-4 py-3">
                {p.tags?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
