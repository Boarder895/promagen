// src/components/providers/providers-table.tsx
// Updated: January 2026 - Added image quality vote button

'use client';

import React, { useState, useEffect } from 'react';
import type { Provider } from '@/types/provider';
import { ProviderCell } from './provider-cell';
import { ImageQualityVoteButton } from './image-quality-vote-button';
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

function chunkPairs<T>(items: ReadonlyArray<T>): Array<ReadonlyArray<T>> {
  const out: Array<ReadonlyArray<T>> = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push(items.slice(i, i + 2));
  }
  return out;
}

function renderApiAffiliateCell(p: Provider): React.ReactNode {
  const api = p.apiAvailable;
  const aff = p.affiliateProgramme;

  if (!api && !aff) return <span className="text-slate-500">—</span>;

  return (
    <span className="inline-flex items-center gap-1">
      {api && (
        <Tooltip text="API available">
          <span aria-label="API available">🔌</span>
        </Tooltip>
      )}
      {aff && (
        <Tooltip text="Affiliate programme available">
          <span aria-label="Affiliate programme">🤝</span>
        </Tooltip>
      )}
    </span>
  );
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
    <div className="flex flex-col gap-1">
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
      <span className="inline-flex items-center gap-3">
        <span className="text-slate-500">—</span>
        <ImageQualityVoteButton
          providerId={providerId}
          isAuthenticated={isAuthenticated}
        />
      </span>
    );
  }

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const ordinal =
    rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

  return (
    <span className="inline-flex items-center gap-3">
      <span className="inline-flex items-center gap-2">
        <span className="font-medium">{ordinal}</span>
        {medal && <span aria-label={`Medal: ${ordinal}`}>{medal}</span>}
      </span>
      <ImageQualityVoteButton
        providerId={providerId}
        isAuthenticated={isAuthenticated}
      />
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
      <span className="text-emerald-400" aria-label="Trending up" title="Trending up">
        ↑
      </span>
    ) : trend === 'down' ? (
      <span className="text-rose-400" aria-label="Trending down" title="Trending down">
        ↓
      </span>
    ) : trend === 'flat' ? (
      <span className="text-slate-400" aria-label="Flat" title="Flat">
        ●
      </span>
    ) : null;

  return (
    <span className="inline-flex items-center justify-end gap-2 tabular-nums">
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

  const sliced =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? providers.slice(0, Math.floor(limit))
      : providers;

  // Sort providers based on selected column
  const sorted = React.useMemo(() => {
    const arr = [...sliced] as ProviderWithPromagenUsers[];
    
    if (sortBy === 'imageQuality') {
      return arr.sort((a, b) => {
        const aRank = a.imageQualityRank ?? 999;
        const bRank = b.imageQualityRank ?? 999;
        return aRank - bRank; // Lower rank number = better quality
      });
    }
    
    // Default: sort by overall score DESC
    return arr.sort((a, b) => {
      const aScore = (a.score ?? 0) - (a.incumbentAdjustment ? 5 : 0);
      const bScore = (b.score ?? 0) - (b.incumbentAdjustment ? 5 : 0);
      return bScore - aScore; // Higher score = better
    });
  }, [sliced, sortBy]);

  // Notify parent of displayed provider IDs (for market pulse)
  useEffect(() => {
    if (onProvidersChange) {
      onProvidersChange(sorted.map((p) => p.id));
    }
  }, [sorted, onProvidersChange]);

  return (
    <div className="providers-table-container">
      <div className="providers-table-scroll-wrapper" data-testid="providers-scroll">
        <table className="providers-table">
          <thead className="providers-table-header">
            <tr>
              <th className="px-4 py-3 text-left">Provider</th>
              <th className="px-4 py-3 text-left">Promagen Users</th>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => setSortBy('imageQuality')}
                title="Click to sort by image quality"
              >
                <span className="inline-flex items-center gap-1">
                  Image Quality
                  {sortBy === 'imageQuality' && <span className="text-emerald-400">●</span>}
                </span>
              </th>
              <th className="px-4 py-3 text-left">Visual Styles</th>
              <th className="px-4 py-3 text-center">API/Affiliate</th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => setSortBy('score')}
                title="Click to sort by overall score"
              >
                <span className="inline-flex items-center gap-1">
                  Overall Score
                  {sortBy === 'score' && <span className="text-emerald-400">●</span>}
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((p, index) => (
              <tr
                key={p.id}
                data-provider-id={p.id}
                className="border-t border-slate-800 hover:bg-slate-900/30 transition-colors market-pulse-target"
              >
                <td className="px-4 py-3">
                  <ProviderCell provider={p} rank={index + 1} />
                </td>

                <td className="px-4 py-3">
                  <PromagenUsersCell usage={p.promagenUsers} />
                </td>

                <td className="px-4 py-3">
                  <ImageQualityCell
                    rank={p.imageQualityRank}
                    providerId={p.id}
                    isAuthenticated={isAuthenticated}
                  />
                </td>

                <td className="px-4 py-3">
                  {p.visualStyles ? (
                    <span className="block line-clamp-2">{p.visualStyles}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-center">
                  {renderApiAffiliateCell(p)}
                </td>

                <td className="px-4 py-3 text-right">
                  <OverallScoreCell provider={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
