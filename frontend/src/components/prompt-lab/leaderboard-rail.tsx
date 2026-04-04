// src/components/prompt-lab/leaderboard-rail.tsx
// ============================================================================
// LEADERBOARD RAIL — Left Rail: Identical to Homepage AI Leaderboard
// ============================================================================
// Columns 1, 4 & 5 from providers-table.tsx — same components, same CSS
// classes, same visual language. Only Promagen Users (col 2) and
// Support (col 3) are removed.
//
// - Col 1: ProviderCell (rank, name, icon, flag, city, clock, weather)
// - Col 4: Image Quality (ordinal + medal + vote button)
// - Col 5: IndexRatingCell (rating value + change arrow + percentage)
//
// Top 10 default, "Show all 40" expand. Clicking a row selects provider
// in centre PlaygroundWorkspace (same contract as PlatformMatchRail).
//
// Demo mode: subtle ±1-3 jitter every 30s on ratings until 500 paid users.
//
// Authority: providers-table.tsx (visual source of truth)
// Existing features preserved: Yes — same props contract as PlatformMatchRail.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Provider } from '@/types/providers';
import type { ProviderRating, DisplayRating, RatingChangeState } from '@/types/index-rating';
import { ProviderCell } from '@/components/providers/provider-cell';
import { IndexRatingCell } from '@/components/providers/index-rating-cell';
import { ImageQualityVoteButton } from '@/components/providers/image-quality-vote-button';

// Market power data for MPI/underdog/newcomer (same as providers-table)
import marketPowerData from '@/data/providers/market-power.json';
import { calculateMPI } from '@/lib/index-rating/calculations';
import type { MarketPowerData, ProviderMarketPower } from '@/lib/index-rating';

const typedMarketPowerData = marketPowerData as MarketPowerData;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_VISIBLE = 10;
const DEMO_JITTER_INTERVAL = 30_000;
const DEMO_JITTER_MIN = 1;
const DEMO_JITTER_MAX = 3;

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardRailProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
}

type SortColumn = 'indexRating' | 'imageQuality';
type SortDirection = 'asc' | 'desc';

type ProviderWithRating = Provider & {
  indexRating?: DisplayRating;
};

// ============================================================================
// MARKET POWER HELPERS (identical to providers-table.tsx)
// ============================================================================

function isProviderUnderdog(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as ProviderMarketPower | undefined;
  if (!providerData) return false;
  const mpi = calculateMPI(providerData);
  return mpi < 3.0;
}

function isProviderNewcomer(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as ProviderMarketPower | undefined;
  if (!providerData || !providerData.foundingYear) return false;
  const currentYear = new Date().getFullYear();
  return currentYear - providerData.foundingYear < 1;
}

// ============================================================================
// INDEX RATING HELPERS (identical to providers-table.tsx)
// ============================================================================

async function fetchIndexRatings(providerIds: string[]): Promise<Map<string, ProviderRating>> {
  try {
    const response = await fetch('/api/index-rating/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerIds }),
    });
    if (!response.ok) return new Map();
    const data = await response.json();
    const ratings = new Map<string, ProviderRating>();
    if (data.ratings && typeof data.ratings === 'object') {
      for (const [id, rating] of Object.entries(data.ratings)) {
        ratings.set(id, rating as ProviderRating);
      }
    }
    return ratings;
  } catch {
    return new Map();
  }
}

function toDisplayRating(provider: Provider, dbRating: ProviderRating | undefined): DisplayRating {
  const providerId = provider.id.toLowerCase();

  if (dbRating) {
    let state: RatingChangeState = 'flat';
    if (dbRating.changePercent > 0.1) state = 'gain';
    else if (dbRating.changePercent < -0.1) state = 'loss';

    const hasRankUp = dbRating.rankChangedAt
      ? Date.now() - new Date(dbRating.rankChangedAt).getTime() < 24 * 60 * 60 * 1000
      : false;

    return {
      rating: dbRating.currentRating,
      change: dbRating.change,
      changePercent: dbRating.changePercent,
      state,
      source: 'database',
      rank: dbRating.currentRank,
      hasRankUp,
      isUnderdog: isProviderUnderdog(providerId),
      isNewcomer: isProviderNewcomer(providerId),
    };
  }

  return {
    rating: typeof provider.score === 'number' ? provider.score * 20 : null,
    change: null,
    changePercent: null,
    state: 'fallback',
    source: 'fallback',
    rank: null,
    hasRankUp: false,
    isUnderdog: isProviderUnderdog(providerId),
    isNewcomer: isProviderNewcomer(providerId),
  };
}

// ============================================================================
// DEMO JITTER
// ============================================================================

function applyJitter(providers: ProviderWithRating[]): ProviderWithRating[] {
  return providers.map((p) => {
    if (!p.indexRating || p.indexRating.rating === null) return p;

    const jitter =
      (Math.random() * (DEMO_JITTER_MAX - DEMO_JITTER_MIN) + DEMO_JITTER_MIN) *
      (Math.random() > 0.5 ? 1 : -1);

    const newRating = p.indexRating.rating + jitter;
    const newState: RatingChangeState =
      jitter > 0 ? 'gain' : jitter < 0 ? 'loss' : 'flat';

    return {
      ...p,
      indexRating: {
        ...p.indexRating,
        rating: newRating,
        change: jitter,
        changePercent: p.indexRating.rating > 0 ? (jitter / p.indexRating.rating) * 100 : 0,
        state: newState,
      },
    };
  });
}

// ============================================================================
// IMAGE QUALITY CELL (identical to providers-table.tsx local function)
// ============================================================================

function ImageQualityCell({
  rank,
  providerId,
}: {
  rank?: number | null;
  providerId: string;
}) {
  if (!rank) {
    return <span className="text-slate-600 text-xs">—</span>;
  }

  let medal = '';
  if (rank === 1) medal = '🥇';
  else if (rank === 2) medal = '🥈';
  else if (rank === 3) medal = '🥉';

  const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-sm">
        {ordinal} {medal}
      </span>
      <ImageQualityVoteButton providerId={providerId} isAuthenticated={false} />
    </div>
  );
}

// ============================================================================
// SORTABLE HEADER (identical to providers-table.tsx)
// ============================================================================

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
  const arrow = isActive ? (isAsc ? '▲' : '▼') : '⇅';

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`sortable-header ${isActive ? 'sortable-header-active' : ''}`}
        aria-label={`Sort by ${label}${isActive ? (isAsc ? ', currently ascending' : ', currently descending') : ''}`}
        title={`Click to sort by ${label}`}
      >
        <span className="sortable-header-label">{label}</span>
        <span className="sortable-header-arrow">{arrow}</span>
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LeaderboardRail({
  providers,
  selectedProviderId,
  onSelectProvider,
}: LeaderboardRailProps) {
  const [indexRatings, setIndexRatings] = useState<Map<string, ProviderRating>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const [jitterTick, setJitterTick] = useState(0);
  const [sortBy, setSortBy] = useState<SortColumn>('indexRating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // ── Fetch index ratings on mount ────────────────────────────────────
  useEffect(() => {
    const ids = providers.map((p) => p.id);
    if (ids.length === 0) return;
    fetchIndexRatings(ids).then(setIndexRatings);
  }, [providers]);

  // ── Demo jitter timer ───────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const interval = setInterval(() => setJitterTick((t) => t + 1), DEMO_JITTER_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ── Build providers with ratings ────────────────────────────────────
  const enriched = useMemo<ProviderWithRating[]>(() => {
    return providers.map((p) => ({
      ...p,
      indexRating: toDisplayRating(p, indexRatings.get(p.id)),
    }));
  }, [providers, indexRatings]);

  // ── Apply jitter + sort ─────────────────────────────────────────────
  const sorted = useMemo(() => {
    void jitterTick; // reactive dependency
    const jittered = applyJitter(enriched);

    return [...jittered].sort((a, b) => {
      if (sortBy === 'indexRating') {
        const aVal = a.indexRating?.rating ?? 0;
        const bVal = b.indexRating?.rating ?? 0;
        return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
      }
      // imageQuality: lower rank number = better
      const aRank = a.imageQualityRank ?? 999;
      const bRank = b.imageQualityRank ?? 999;
      return sortDirection === 'desc' ? aRank - bRank : bRank - aRank;
    });
  }, [enriched, jitterTick, sortBy, sortDirection]);

  const displayed = isExpanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = sorted.length - DEFAULT_VISIBLE;

  // ── Sort handler ────────────────────────────────────────────────────
  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortBy === col) {
        setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortBy(col);
        setSortDirection('desc');
      }
    },
    [sortBy],
  );

  const toggleExpand = useCallback(() => setIsExpanded((v) => !v), []);

  return (
    <div className="providers-table-container">
      {/* ── Scroll wrapper — identical CSS to main table ────────────── */}
      <div className="providers-table-scroll-wrapper">
        <table className="providers-table w-full">
          {/* 3 columns: Provider (50%) | Image Quality (25%) | Index Rating (25%) */}
          <thead className="providers-table-header">
            <tr>
              <th className="providers-table-th px-4 py-3 text-center w-[50%] border-r border-white/5">
                Provider
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[25%] border-r border-white/5">
                <SortableHeader
                  label="Image Quality"
                  column="imageQuality"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[25%]">
                <SortableHeader
                  label="Index Rating"
                  column="indexRating"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {displayed.map((p, index) => {
              const isSelected = p.id === selectedProviderId;

              return (
                <tr
                  key={p.id}
                  data-provider-id={p.id}
                  onClick={() => onSelectProvider(p.id)}
                  className={`providers-table-row border-t border-slate-800 hover:bg-slate-900/30 transition-colors cursor-pointer ${
                    isSelected ? 'bg-cyan-950/30' : ''
                  }`}
                  style={{
                    borderLeft: isSelected
                      ? '3px solid rgba(34, 211, 238, 0.8)'
                      : '3px solid transparent',
                    transition: 'border-left 300ms ease, background-color 300ms ease',
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectProvider(p.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Select ${p.name}`}
                >
                  {/* Col 1: Provider — identical ProviderCell */}
                  <td className="providers-table-td px-4 py-3 w-[50%] border-r border-white/5">
                    <ProviderCell
                      provider={p}
                      rank={index + 1}
                      hasRankUp={p.indexRating?.hasRankUp ?? false}
                    />
                  </td>

                  {/* Col 4: Image Quality — identical */}
                  <td className="providers-table-td px-4 py-3 w-[25%] text-center border-r border-white/5">
                    <ImageQualityCell
                      rank={p.imageQualityRank}
                      providerId={p.id}
                    />
                  </td>

                  {/* Col 5: Index Rating — identical IndexRatingCell */}
                  <td className="providers-table-td px-4 py-3 text-center w-[25%]">
                    {p.indexRating ? (
                      <IndexRatingCell rating={p.indexRating} />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Show All / Collapse toggle ──────────────────────────────── */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={toggleExpand}
          className="cursor-pointer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(4px, 0.3vw, 6px)',
            padding: 'clamp(8px, 0.6vw, 12px) 0',
            marginTop: 'clamp(4px, 0.3vw, 6px)',
            border: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: 'clamp(0.7rem, 0.85vw, 0.9rem)',
            fontWeight: 500,
            color: '#22d3ee',
            letterSpacing: '0.03em',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#67e8f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#22d3ee'; }}
          aria-expanded={isExpanded}
        >
          <span
            style={{
              display: 'inline-block',
              transition: 'transform 0.25s ease',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
          {isExpanded ? 'Show Top 10' : `Show all ${sorted.length}`}
        </button>
      )}

      {/* ── Live indicator ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(4px, 0.3vw, 6px)',
          padding: 'clamp(4px, 0.3vw, 6px) clamp(8px, 0.6vw, 12px)',
        }}
      >
        <span
          style={{
            width: 'clamp(5px, 0.4vw, 7px)',
            height: 'clamp(5px, 0.4vw, 7px)',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            boxShadow: '0 0 4px rgba(34, 197, 94, 0.6)',
            animation: 'leaderboardPulse 2s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.8rem)', color: '#94A3B8' }}>
          Live
        </span>
        <span
          style={{
            fontSize: 'clamp(0.65rem, 0.75vw, 0.8rem)',
            color: '#64748B',
            marginLeft: 'auto',
          }}
        >
          {sorted.length} platforms
        </span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes leaderboardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}} />
    </div>
  );
}

export default LeaderboardRail;
