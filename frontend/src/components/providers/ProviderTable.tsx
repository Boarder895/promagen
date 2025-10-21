'use client';

import type { ProviderTile } from '@/types/ribbon';
import { memo, useMemo } from 'react';

export interface ProviderTableProps {
  items: ProviderTile[];   // 0..20; we pad/trim to 20
  title?: string;
}

function padTo20(items: ProviderTile[]): (ProviderTile | null)[] {
  const copy: (ProviderTile | null)[] = [...items].slice(0, 20);
  while (copy.length < 20) copy.push(null);
  return copy;
}

const Cell = memo(function Cell({
  p,
  rank,
}: {
  p: ProviderTile | null;
  rank: number; // 1..20
}) {
  if (!p) {
    return (
      <td className="align-top">
        <div className="relative h-full min-h-[88px] rounded-2xl border border-white/5 bg-neutral-900/40 p-3 opacity-50">
          <div className="absolute -left-2 -top-2 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-white/70">
            {rank}
          </div>
        </div>
      </td>
    );
  }

  // Safe score (handles undefined), clamped 0..100
  const score = Math.max(0, Math.min(100, Math.round(p.score ?? 0)));
  const trend = p.trend === 'up' ? '▲' : p.trend === 'down' ? '▼' : '↔';
  const href = p.affiliateUrl ?? p.url ?? '#';

  return (
    <td className="align-top">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group relative block h-full min-h-[88px] rounded-2xl border border-white/10 bg-neutral-900/60 p-3 shadow-sm transition hover:border-white/20 hover:bg-neutral-900/80"
        aria-label={`${p.name} — open provider`}
      >
        {/* Rank badge */}
        <div className="absolute -left-2 -top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold leading-none text-white shadow">
          {rank}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-5">{p.name}</div>
            <div className="truncate text-xs text-white/60">{p.tagline ?? ''}</div>
          </div>
          <div className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-[11px] font-semibold leading-none text-white/90">
            {score}
            <span className="ml-1 text-[10px] opacity-80">{trend}</span>
          </div>
        </div>
      </a>
    </td>
  );
});

export default function ProviderTable({ items, title }: ProviderTableProps) {
  // -> 10 rows × 2 cols, rank = 1..20 in reading order
  const rows = useMemo(() => {
    const padded = padTo20(items);
    const out: (ProviderTile | null)[][] = [];
    for (let i = 0; i < 20; i += 2) out.push([padded[i], padded[i + 1]]);
    return out;
  }, [items]);

  return (
    <section aria-label="AI image providers">
      {title ? (
        <div className="mb-2 text-center text-sm uppercase tracking-wide text-white/60">
          {title}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-3">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((p, j) => {
                  const rank = i * 2 + j + 1; // 1..20
                  return <Cell key={`${i}-${j}`} p={p} rank={rank} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}



