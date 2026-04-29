// src/components/authority/platform-hub-table.tsx
// ============================================================================
// PLATFORM HUB TABLE — Client component: filtering + sorting
// ============================================================================
// Progressive enhancement: server HTML includes all rows in A→Z order.
// Client hydration adds tier filter buttons and column sorting.
// Default state = filter:'all', sort:'name'/asc → matches SSR exactly.
//
// Sort logic extracted to usePlatformSort hook.
// Shared components (FaqItem, FactCard) in shared.tsx.
// Presentation constants from @/lib/authority/presentation (shared).
//
// RULES:
//   - Zero opacity dimming, zero banned greys
//   - All sizing via clamp()
//   - cursor-pointer on all interactive elements
//   - CSS-only hover (no onMouseEnter/Leave)
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §4.2 PAGE 1
// ============================================================================

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AuthorityPlatform } from '@/lib/authority/platform-data';
import {
  getTierBadge,
  NEG_SUPPORT_COLOR,
  NEG_SUPPORT_LABEL,
  TABLE_CELL_PAD,
  ROW_STRIPE,
} from '@/lib/authority/presentation';
import { usePlatformSort, type SortKey } from '@/hooks/use-platform-sort';

// ─── Props ─────────────────────────────────────────────────────────────────

interface PlatformHubTableProps {
  platforms: AuthorityPlatform[];
  tierMeta: Record<number, { shortName: string; name: string; promptStyle: string }>;
}

// ─── Column definitions ────────────────────────────────────────────────────

interface Column {
  label: string;
  sortKey: SortKey | null;
  align: 'left' | 'right';
}

const COLUMNS: Column[] = [
  { label: 'Platform', sortKey: 'name', align: 'left' },
  { label: 'Tier', sortKey: 'tier', align: 'left' },
  { label: 'Prompt Style', sortKey: null, align: 'left' },
  { label: 'Negative Prompts', sortKey: 'negativeSupport', align: 'left' },
  { label: 'Sweet Spot', sortKey: 'sweetSpot', align: 'right' },
  { label: 'Max Chars', sortKey: 'maxChars', align: 'right' },
  { label: '', sortKey: null, align: 'right' },
];

type FilterValue = 'all' | 1 | 2 | 3 | 4;

// ─── Component ─────────────────────────────────────────────────────────────

export default function PlatformHubTable({ platforms, tierMeta }: PlatformHubTableProps) {
  const [filter, setFilter] = useState<FilterValue>('all');

  // Precompute tier counts once
  const tierCounts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const p of platforms) c[p.tier] = (c[p.tier] ?? 0) + 1;
    return c;
  }, [platforms]);

  // Filter
  const filtered = useMemo(
    () => (filter === 'all' ? platforms : platforms.filter((p) => p.tier === filter)),
    [platforms, filter],
  );

  // Sort (hook handles state + comparator)
  const { sorted: rows, sortKey, sortDir, toggleSort } = usePlatformSort(filtered);

  const filterButtons: { value: FilterValue; label: string }[] = [
    { value: 'all', label: `All (${platforms.length})` },
    ...([1, 2, 3, 4] as const).map((t) => ({
      value: t as FilterValue,
      label: `${tierMeta[t]?.shortName ?? `T${t}`} (${tierCounts[t] ?? 0})`,
    })),
  ];

  return (
    <div>
      {/* CSS-only row hover — no JS event handlers */}
      <style>{`.authority-row:hover { background: rgba(255,255,255,0.06) !important; }`}</style>

      {/* ── Filter buttons ──────────────────────────────────────── */}
      <div className="flex flex-wrap" style={{ gap: 'clamp(6px, 0.6vw, 10px)', marginBottom: 'clamp(12px, 1.5vw, 20px)' }}>
        {filterButtons.map(({ value, label }) => {
          const isActive = filter === value;
          const tierNum = typeof value === 'number' ? value : null;
          const badge = tierNum ? getTierBadge(tierNum) : null;

          return (
            <button
              key={String(value)}
              onClick={() => setFilter(value)}
              className="cursor-pointer rounded-lg font-medium transition-colors"
              style={{
                fontSize: 'clamp(11px, 0.85vw, 14px)',
                padding: `clamp(4px, 0.4vw, 7px) clamp(10px, 1vw, 16px)`,
                background: isActive
                  ? (badge ? `${badge.bg}33` : 'rgba(251, 191, 36, 0.2)')
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive
                  ? (badge ? `${badge.border}66` : 'rgba(251, 191, 36, 0.4)')
                  : 'rgba(255,255,255,0.08)'}`,
                color: isActive ? (badge?.border ?? '#fbbf24') : '#ffffff',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <table className="w-full border-collapse" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {COLUMNS.map((col, i) => {
                const isSortable = col.sortKey !== null;
                const isActive = col.sortKey === sortKey;

                return (
                  <th
                    key={col.label || `col-${i}`}
                    className={`text-amber-400 font-semibold ${isSortable ? 'cursor-pointer select-none' : ''}`}
                    style={{ textAlign: col.align, padding: `clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px)`, whiteSpace: 'nowrap' }}
                    onClick={isSortable ? () => toggleSort(col.sortKey!) : undefined}
                    title={isSortable ? `Sort by ${col.label}` : undefined}
                  >
                    {col.label}
                    {isActive && <span className="text-white">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const badge = getTierBadge(p.tier);
              const meta = tierMeta[p.tier] ?? { shortName: `T${p.tier}`, name: 'Unknown', promptStyle: p.promptStyle };

              return (
                <tr
                  key={p.id}
                  className="authority-row transition-colors"
                  style={{
                    background: i % 2 === 0 ? ROW_STRIPE : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <td style={{ padding: TABLE_CELL_PAD }}>
                    <span className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
                      {p.localIcon && (
                        <Image
                          src={p.localIcon}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-sm flex-shrink-0"
                          style={{ width: 'clamp(16px, 1.3vw, 22px)', height: 'clamp(16px, 1.3vw, 22px)' }}
                        />
                      )}
                      <Link
                        href={`/platforms/${p.id}`}
                        className="text-white font-medium hover:text-amber-400 cursor-pointer transition-colors"
                      >
                        {p.name}
                      </Link>
                    </span>
                  </td>

                  <td style={{ padding: TABLE_CELL_PAD }}>
                    <span
                      className="inline-block rounded-md font-semibold"
                      style={{
                        fontSize: 'clamp(10px, 0.75vw, 12px)',
                        padding: `clamp(1px, 0.2vw, 3px) clamp(5px, 0.5vw, 8px)`,
                        background: `${badge.bg}22`,
                        color: badge.border,
                        border: `1px solid ${badge.border}44`,
                      }}
                    >
                      {meta.shortName}
                    </span>
                  </td>

                  <td className="text-white" style={{ padding: TABLE_CELL_PAD }}>{meta.promptStyle}</td>
                  <td style={{ padding: TABLE_CELL_PAD, color: NEG_SUPPORT_COLOR[p.negativeSupport] }}>{NEG_SUPPORT_LABEL[p.negativeSupport]}</td>
                  <td className="text-white tabular-nums" style={{ padding: TABLE_CELL_PAD, textAlign: 'right' }}>{p.sweetSpot > 0 ? `${p.sweetSpot} chars` : '—'}</td>
                  <td className="text-white tabular-nums" style={{ padding: TABLE_CELL_PAD, textAlign: 'right' }}>{p.maxChars ? `${p.maxChars}` : '—'}</td>

                  <td style={{ padding: TABLE_CELL_PAD, textAlign: 'right' }}>
                    {/* Try button — routes through /go/[id] for affiliate
                        attribution + click_id. rel="sponsored" is FTC-compliant
                        and required by Google for paid links. Replaces the
                        previous /studio/playground link, which now redirects
                        back to /platforms (broken loop). */}
                    <a
                      href={`/go/${encodeURIComponent(p.id)}?src=platform_hub_try`}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      aria-label={`Try ${p.name} (opens in new tab)`}
                      title={`Try ${p.name}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 'clamp(3px, 0.4vw, 5px) clamp(8px, 0.9vw, 12px)',
                        fontSize: 'clamp(0.7rem, 0.8vw, 0.82rem)',
                        fontWeight: 600,
                        color: '#bae6fd',
                        background:
                          'linear-gradient(90deg, rgba(56,189,248,0.18), rgba(110,231,183,0.14), rgba(129,140,248,0.18))',
                        border: '1px solid rgba(56,189,248,0.45)',
                        borderRadius: '999px',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        transition: 'all 150ms ease',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: '#e0f2fe' }}>Try</span>
                      <span aria-hidden="true" style={{ color: '#bae6fd' }}>→</span>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Status line ─────────────────────────────────────────── */}
      <p className="text-white" style={{ fontSize: 'clamp(11px, 0.8vw, 13px)', marginTop: 'clamp(6px, 0.7vw, 10px)' }}>
        Showing <span className="text-amber-400 font-semibold tabular-nums">{rows.length}</span> of{' '}
        <span className="tabular-nums">{platforms.length}</span> platforms
        {filter !== 'all' && (
          <>
            {' · '}
            <span style={{ color: getTierBadge(filter as number).border }}>
              {tierMeta[filter as number]?.name ?? ''}
            </span>
          </>
        )}
        {sortKey !== 'name' && (
          <>
            {' · sorted by '}
            <span className="text-amber-400">{COLUMNS.find((c) => c.sortKey === sortKey)?.label ?? sortKey}</span>
            {sortDir === 'desc' ? ' ▼' : ' ▲'}
          </>
        )}
      </p>
    </div>
  );
}
