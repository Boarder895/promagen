'use client';

import type { ProviderTile } from '@/types/ribbon';
import { memo, useMemo } from 'react';

export interface ProviderTableProps {
  items: ProviderTile[];   // pass 0..20; we pad/trim to 20
  title?: string;
}

function padTo20(items: ProviderTile[]): (ProviderTile | null)[] {
  const copy: (ProviderTile | null)[] = [...items].slice(0, 20);
  while (copy.length < 20) copy.push(null);
  return copy;
}

const Cell = memo(function Cell({ p }: { p: ProviderTile | null }) {
  if (!p) {
    return (
      <td className="align-top">
        <div className="h-full min-h-[88px] rounded-2xl border border-white/5 bg-neutral-900/40 p-3 opacity-50" />
      </td>
    );
  }

  // Safe score (handles undefined), clamped 0..100
  const score = Math.max(0, Math.min(100, Math.round(p.score ?? 0)));

  // Safe trend symbol
  const trend =
    p.trend === 'up' ? '▲' : p.trend === 'down' ? '▼' : '↔';

  // Prefer affiliate link, fallback to canonical url, then '#'
  const href = p.affiliateUrl ?? p.url ?? '#';

  return (
    <td className="align-top">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group block h-full min-h-[88px] rounded-2xl border border-white/10 bg-neutral-900/60 p-3 shadow-sm transition hover:border-white/20 hover:bg-neutral-900/80"
        aria-label={`${p.name} — open provider`}
      >
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
  const rows = useMemo(() => {
    const padded = padTo20(items);
    return [padded.slice(0, 10), padded.slice(10, 20)]; // 2 rows × 10 columns
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
                {row.map((p, j) => (
                  <Cell key={`${i}-${j}`} p={p} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

