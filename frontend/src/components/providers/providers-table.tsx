// src/components/providers/providers-table.tsx
// Updated: January 2026 - Added image quality vote button
// Updated: January 2026 - Replaced Visual Styles with Support column (social icons)
// Updated: 20 Jan 2026 - Added fixed column widths (w-[Xpx] min-w-[Xpx]) to prevent layout shift
//                      - Added table-fixed class for consistent column sizing
// Updated: 22 Jan 2026 - Added vertical grid lines between columns
//                      - Centred header text for all columns
//                      - Removed API/Affiliate column (emojis moved to Provider cell)
//                      - Table now has 5 columns instead of 6
// Updated: 22 Jan 2026 - Switched from fixed px widths to proportional % widths
//                      - Enables fluid auto-scaling on large screens
//                      - Added mobile card view for small screens
// Updated: 22 Jan 2026 - Professional sortable headers with always-visible arrows
//                      - Underline on hover, glow on active
//                      - Bloomberg-style sort indicators

'use client';

import React, { useState, useEffect } from 'react';
import type { Provider } from '@/types/provider';
import { ProviderCell } from './provider-cell';
import { ImageQualityVoteButton } from './image-quality-vote-button';
import { SupportIconsCell } from './support-icons-cell';
import { toRomanNumeral } from '@/lib/format/number';
import { Flag } from '@/components/ui/flag';
import Tooltip from '@/components/ui/tooltip';

export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;
  title?: string;
  caption?: string;
  limit?: number;
  showRank?: boolean; // Kept for backwards compatibility (no longer used)
  /** Whether user is authenticated (required for voting) */
  isAuthenticated?: boolean;
  /** Optional callback to register provider IDs for market pulse */
  onProvidersChange?: (providerIds: string[]) => void;
};

type PromagenUsersCountryUsage = {
  countryCode: string;
  count: number;
};

type ProviderWithPromagenUsers = Provider & {
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
};

type SortColumn = 'score' | 'imageQuality';
type SortDirection = 'asc' | 'desc';

/**
 * Professional sortable header component.
 * Features:
 * - Always-visible sort arrows (↕ inactive, ▼/▲ active)
 * - Underline on hover
 * - Glow effect when active
 * - Smooth transitions
 */
function SortableHeader({
  label,
  column,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentDirection: SortDirection;
  onSort: (col: SortColumn) => void;
}) {
  const isActive = currentSort === column;
  const isAsc = currentDirection === 'asc';

  // Determine which arrow to show
  const arrow = isActive ? (isAsc ? '▲' : '▼') : '⇅';

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`sortable-header ${isActive ? 'sortable-header-active' : ''}`}
      aria-label={`Sort by ${label}${isActive ? (isAsc ? ', currently ascending' : ', currently descending') : ''}`}
      title={`Click to sort by ${label}`}
    >
      <span className="sortable-header-label">{label}</span>
      <span className={`sortable-header-arrow ${isActive ? 'sortable-header-arrow-active' : ''}`}>
        {arrow}
      </span>
    </button>
  );
}

function chunkPairs<T>(items: ReadonlyArray<T>): Array<ReadonlyArray<T>> {
  const out: Array<ReadonlyArray<T>> = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push(items.slice(i, i + 2));
  }
  return out;
}

function PromagenUsersCell({ usage }: { usage?: ReadonlyArray<PromagenUsersCountryUsage> }) {
  const cleaned = (usage ?? [])
    .filter(
      (u) =>
        Boolean(u) &&
        typeof u.countryCode === 'string' &&
        u.countryCode.trim().length === 2 &&
        typeof u.count === 'number' &&
        Number.isFinite(u.count) &&
        u.count > 0,
    )
    .map((u) => ({ countryCode: u.countryCode.trim().toUpperCase(), count: Math.floor(u.count) }))
    .sort((a, b) => b.count - a.count);

  if (cleaned.length === 0) {
    return null; // Empty cell when no users (not even a dash)
  }

  const top = cleaned.slice(0, 6);
  const remaining = Math.max(0, cleaned.length - top.length);
  const rows = chunkPairs(top).filter((r) => r.length > 0);

  return (
    <div className="providers-users-cell flex flex-col gap-1">
      {rows.map((pair, idx) => (
        <div key={`row-${idx}`} className="flex gap-3 whitespace-nowrap">
          {pair.map((c) => {
            const roman = toRomanNumeral(c.count);
            const aria = `${c.countryCode}: ${c.count} user${c.count === 1 ? '' : 's'}`;
            const title = `${c.count} user${c.count === 1 ? '' : 's'}`;

            return (
              <span
                key={`${c.countryCode}-${c.count}`}
                className="inline-flex items-center gap-1"
                title={title}
                aria-label={aria}
              >
                <Flag countryCode={c.countryCode} decorative />
                <span className="tabular-nums">{roman}</span>
              </span>
            );
          })}

          {idx === rows.length - 1 && remaining > 0 ? (
            <span
              className="text-slate-500"
              title={`${remaining} more countries`}
              aria-label={`${remaining} more countries`}
            >
              … +{remaining}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Image Quality cell with rank display and vote button.
 * Layout: "2nd 👍" where rank is on left, thumb on right.
 */
function ImageQualityCell({
  rank,
  providerId,
  isAuthenticated,
}: {
  rank?: number;
  providerId: string;
  isAuthenticated: boolean;
}) {
  if (!rank || rank < 1) {
    return (
      <span className="providers-quality-cell inline-flex items-center justify-center gap-3">
        <span className="text-slate-500">—</span>
        <ImageQualityVoteButton providerId={providerId} isAuthenticated={isAuthenticated} />
      </span>
    );
  }

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

  return (
    <span className="providers-quality-cell inline-flex items-center justify-center gap-3">
      <span className="inline-flex items-center gap-2">
        <span className="font-medium">{ordinal}</span>
        {medal && (
          <span className="providers-medal" aria-label={`Medal: ${ordinal}`}>
            {medal}
          </span>
        )}
      </span>
      <ImageQualityVoteButton providerId={providerId} isAuthenticated={isAuthenticated} />
    </span>
  );
}

function OverallScoreCell({ provider }: { provider: Provider }) {
  const rawScore = provider.score;
  if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) {
    return <span className="text-slate-500">—</span>;
  }

  const adjustedScore = provider.incumbentAdjustment ? rawScore - 5 : rawScore;
  const trend = provider.trend;

  const trendGlyph =
    trend === 'up' ? (
      <span
        className="providers-trend text-emerald-400"
        aria-label="Trending up"
        title="Trending up"
      >
        ↑
      </span>
    ) : trend === 'down' ? (
      <span
        className="providers-trend text-rose-400"
        aria-label="Trending down"
        title="Trending down"
      >
        ↓
      </span>
    ) : trend === 'flat' ? (
      <span className="providers-trend text-slate-400" aria-label="Flat" title="Flat">
        ●
      </span>
    ) : null;

  return (
    <span className="providers-score-cell inline-flex items-center justify-center gap-2 tabular-nums">
      {provider.incumbentAdjustment ? (
        <Tooltip text={`Adjusted for Big Tech advantage (${rawScore} - 5 = ${adjustedScore})`}>
          <span className="score-adjusted">{adjustedScore}*</span>
        </Tooltip>
      ) : (
        <span>{rawScore}</span>
      )}
      {trendGlyph}
    </span>
  );
}

export default function ProvidersTable(props: ProvidersTableProps) {
  const { providers, limit, isAuthenticated = false, onProvidersChange } = props;
  const [sortBy, setSortBy] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle sort toggle: if same column, flip direction; else switch column with default direction
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      // Toggle direction
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      // Switch to new column with default direction
      setSortBy(column);
      // Image quality: lower rank = better, so default to asc
      // Score: higher = better, so default to desc
      setSortDirection(column === 'imageQuality' ? 'asc' : 'desc');
    }
  };

  const sliced =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? providers.slice(0, Math.floor(limit))
      : providers;

  // Sort providers based on selected column and direction
  const sorted = React.useMemo(() => {
    const arr = [...sliced] as ProviderWithPromagenUsers[];
    const dir = sortDirection === 'asc' ? 1 : -1;

    if (sortBy === 'imageQuality') {
      return arr.sort((a, b) => {
        const aRank = a.imageQualityRank ?? 999;
        const bRank = b.imageQualityRank ?? 999;
        return (aRank - bRank) * dir; // Lower rank = better quality
      });
    }

    // Default: sort by overall score
    return arr.sort((a, b) => {
      const aScore = (a.score ?? 0) - (a.incumbentAdjustment ? 5 : 0);
      const bScore = (b.score ?? 0) - (b.incumbentAdjustment ? 5 : 0);
      return (bScore - aScore) * dir; // Higher score = better
    });
  }, [sliced, sortBy, sortDirection]);

  // Notify parent of displayed provider IDs (for market pulse)
  useEffect(() => {
    if (onProvidersChange) {
      onProvidersChange(sorted.map((p) => p.id));
    }
  }, [sorted, onProvidersChange]);

  return (
    <div className="providers-table-container leaderboard-glow-frame">
      {/* Desktop table view — hidden on mobile via CSS */}
      <div
        className="providers-table-scroll-wrapper providers-table-desktop"
        data-testid="providers-scroll"
      >
        <table className="providers-table w-full">
          {/* Proportional column widths — auto-scale with viewport */}
          {/* 5 columns: Provider (30%) | Promagen Users (18%) | Image Quality (18%) | Support (18%) | Overall Score (16%) */}
          <thead className="providers-table-header">
            <tr>
              <th className="providers-table-th px-4 py-3 text-center w-[30%] border-r border-white/5">
                Provider
              </th>
              <th className="providers-table-th px-4 py-3 text-center w-[18%] border-r border-white/5">
                Promagen Users
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[18%] border-r border-white/5">
                <SortableHeader
                  label="Image Quality"
                  column="imageQuality"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="providers-table-th px-4 py-3 text-center w-[18%] border-r border-white/5">
                Support
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[16%]">
                <SortableHeader
                  label="Overall Score"
                  column="score"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((p, index) => (
              <tr
                key={p.id}
                data-provider-id={p.id}
                className="providers-table-row border-t border-slate-800 hover:bg-slate-900/30 transition-colors market-pulse-target"
              >
                <td className="providers-table-td px-4 py-3 w-[30%] border-r border-white/5">
                  <ProviderCell provider={p} rank={index + 1} />
                </td>

                <td className="providers-table-td px-4 py-3 w-[18%] border-r border-white/5">
                  <PromagenUsersCell usage={p.promagenUsers} />
                </td>

                <td className="providers-table-td px-4 py-3 w-[18%] text-center border-r border-white/5">
                  <ImageQualityCell
                    rank={p.imageQualityRank}
                    providerId={p.id}
                    isAuthenticated={isAuthenticated}
                  />
                </td>

                <td className="providers-table-td px-4 py-3 w-[18%] border-r border-white/5">
                  <SupportIconsCell providerName={p.name} socials={p.socials} />
                </td>

                <td className="providers-table-td px-4 py-3 text-center w-[16%]">
                  <OverallScoreCell provider={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view — hidden on desktop, shown on mobile via CSS */}
      <div className="providers-mobile-cards" data-testid="providers-mobile">
        {sorted.map((p, index) => (
          <div
            key={p.id}
            data-provider-id={p.id}
            className="providers-mobile-card market-pulse-target"
          >
            {/* Row 1: Rank + Name + Score */}
            <div className="providers-mobile-header">
              <span className="providers-mobile-rank">{index + 1}.</span>
              <a
                href={`/go/${encodeURIComponent(p.id)}?src=leaderboard_mobile`}
                target="_blank"
                rel="noopener noreferrer"
                className="providers-mobile-name"
              >
                {p.name}
              </a>
              {p.apiAvailable && <span className="providers-mobile-emoji">🔌</span>}
              {p.affiliateProgramme && <span className="providers-mobile-emoji">🤝</span>}
              <span className="providers-mobile-score">
                {p.incumbentAdjustment ? (p.score ?? 0) - 5 : (p.score ?? '—')}
                {p.trend === 'up' && <span className="text-emerald-400 ml-1">↑</span>}
                {p.trend === 'down' && <span className="text-rose-400 ml-1">↓</span>}
              </span>
            </div>

            {/* Row 2: Location + Quality */}
            <div className="providers-mobile-details">
              {p.countryCode && p.hqCity && (
                <span className="providers-mobile-location">
                  <Flag countryCode={p.countryCode} size={14} decorative />
                  <span>{p.hqCity}</span>
                </span>
              )}
              {p.imageQualityRank && (
                <span className="providers-mobile-quality">
                  {p.imageQualityRank === 1
                    ? '1st 🥇'
                    : p.imageQualityRank === 2
                      ? '2nd 🥈'
                      : p.imageQualityRank === 3
                        ? '3rd 🥉'
                        : `${p.imageQualityRank}th`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
