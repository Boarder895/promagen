'use client';

import { buildGoHref } from '@/lib/affiliate/outbound';

type ProviderRow = {
  id: string;
  name: string;
  tagline: string;
  score: number;
  trend: 'up' | 'down' | 'flat';

  /**
   * Kept for backward compatibility with existing callers.
   * Do not use for outbound linking (must go via /go).
   */
  affiliateUrl?: string;
};

export default function ProviderTable({ rows }: { rows: ProviderRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-white/5 p-4 bg-neutral-900/40 hover:bg-neutral-900/60 transition-shadow shadow"
          role="button"
          aria-label={`${r.name} details`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-semibold">{r.name}</div>
              <div className="text-sm opacity-70">{r.tagline}</div>
            </div>
            <div className="text-emerald-400 text-sm font-semibold">
              {r.score.toFixed(1)}
              {r.trend === 'up' ? ' ?' : r.trend === 'down' ? ' ?' : ' ?'}
            </div>
          </div>
          <div className="pt-3">
            <a
              href={buildGoHref(r.id, 'leaderboard_table')}
              className="text-sm underline opacity-90"
            >
              Try ?
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
