// src/components/prompt-lab/leaderboard-rail.tsx
// ============================================================================
// LEADERBOARD RAIL — Left Rail: AI Leaderboard (v4.0.0)
// ============================================================================
// Columns 1, 4 & 5 from providers-table.tsx.
//
// Col 1: Rank + Icon + Name
//   - Icon click → provider homepage (new tab, stopPropagation)
//   - Row/name click → selects provider for optimisation
//   - No flag, city, clock, weather emoji, API/affiliate emojis
//   - All icons fixed 20×20px for consistency
//
// Col 4: Support (SupportIconsCell — social icons)
//   - Hides on narrow viewports (≤1440px), leaving Provider + Rating only
//
// Col 5: Index Rating (IndexRatingCell — rating + change arrow)
//
// No horizontal scroll. Top 10 default, "Show all 40" expand.
// Demo jitter ±1-3 every 30s. Same CSS classes as main table.
//
// Authority: providers-table.tsx (visual source of truth)
// Existing features preserved: Yes — same props contract as PlatformMatchRail.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Provider } from '@/types/providers';
import type { ProviderRating, DisplayRating, RatingChangeState } from '@/types/index-rating';
import { IndexRatingCell } from '@/components/providers/index-rating-cell';
import { SupportIconsCell } from '@/components/providers/support-icons-cell';

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
const FALLBACK_ICON = '/icons/providers/fallback.png';

/** Fixed icon size — all icons render at this size for consistency */
const ICON_SIZE = 20;

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardRailProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
}

type SortColumn = 'indexRating';
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
  const [hasMounted, setHasMounted] = useState(false);

  // ── Mark as mounted — avoids Date.now() hydration mismatch ──────────
  useEffect(() => { setHasMounted(true); }, []);

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
  // hasRankUp uses Date.now() which differs server vs client — force false
  // until mounted to prevent hydration mismatch.
  const enriched = useMemo<ProviderWithRating[]>(() => {
    return providers.map((p) => {
      const rating = toDisplayRating(p, indexRatings.get(p.id));
      if (!hasMounted) rating.hasRankUp = false;
      return { ...p, indexRating: rating };
    });
  }, [providers, indexRatings, hasMounted]);

  // ── Fixed rank map — rank by rating descending, never changes with sort ──
  // Craiyon at 40th stays "40." whether the table is sorted asc or desc.
  const rankMap = useMemo(() => {
    const byRatingDesc = [...enriched].sort((a, b) => {
      const aVal = a.indexRating?.rating ?? 0;
      const bVal = b.indexRating?.rating ?? 0;
      return bVal - aVal;
    });
    const map = new Map<string, number>();
    byRatingDesc.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [enriched]);

  // ── Apply jitter + sort ─────────────────────────────────────────────
  // jitterTick starts at 0 — skip jitter on initial render to avoid
  // hydration mismatch (Math.random differs server vs client).
  // First jitter fires after DEMO_JITTER_INTERVAL (30s) on client only.
  const sorted = useMemo(() => {
    void jitterTick; // reactive dependency
    const data = jitterTick === 0 ? enriched : applyJitter(enriched);

    return [...data].sort((a, b) => {
      const aVal = a.indexRating?.rating ?? 0;
      const bVal = b.indexRating?.rating ?? 0;
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [enriched, jitterTick, sortDirection]);

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
      {/* ── Responsive CSS: 2-col default, 3-col only on very wide screens ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes leaderboardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        /* Default: hide Support column — Provider + Rating only */
        .leaderboard-rail-support { display: none !important; }
        /* Show Support column only on very wide viewports where the rail has room */
        @media (min-width: 1800px) {
          .leaderboard-rail-support { display: table-cell !important; }
          .leaderboard-rail-provider { width: 45% !important; }
          .leaderboard-rail-rating { width: 25% !important; }
        }
      `}} />

      {/* ── Scroll wrapper — same CSS as main table, NO horizontal scroll ── */}
      <div
        className="providers-table-scroll-wrapper"
        style={{ overflowX: 'hidden' }}
      >
        <table className="providers-table w-full" style={{ tableLayout: 'fixed' }}>
          <thead className="providers-table-header">
            <tr>
              <th className="providers-table-th px-4 py-3 text-center leaderboard-rail-provider border-r border-white/5"
                  style={{ width: '65%' }}>
                Provider
              </th>
              <th className="providers-table-th px-4 py-3 text-center leaderboard-rail-support border-r border-white/5"
                  style={{ width: '30%' }}>
                Support
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center leaderboard-rail-rating"
                  style={{ width: '35%' }}>
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
              const rank = rankMap.get(p.id) ?? (index + 1);
              const iconPath = p.localIcon || `/icons/providers/${p.id}.png`;
              const homepageUrl = `/go/${encodeURIComponent(p.id)}?src=leaderboard_rail`;

              return (
                <tr
                  key={p.id}
                  data-provider-id={p.id}
                  className={`providers-table-row border-t border-slate-800 hover:bg-slate-900/30 transition-colors ${
                    isSelected ? 'bg-cyan-950/30' : ''
                  }`}
                  style={{
                    borderLeft: isSelected
                      ? '3px solid rgba(34, 211, 238, 0.8)'
                      : '3px solid transparent',
                    transition: 'border-left 300ms ease, background-color 300ms ease',
                  }}
                  aria-label={`${p.name} — rank ${rank}`}
                >
                  {/* ── Col 1: Provider — Rank + Icon + Name ─────────── */}
                  <td className="providers-table-td px-4 py-3 leaderboard-rail-provider border-r border-white/5">
                    <div className="provider-name-row">
                      {/* Rank number — min-width overridden from globals (1.75rem too wide for rail) */}
                      <span className="provider-rank" style={{ minWidth: 'auto' }}>{rank}.</span>

                      {/* Provider icon — click opens homepage (stopPropagation) */}
                      <a
                        href={homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="provider-logo-link"
                        aria-label={`Visit ${p.name} website (opens in new tab)`}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={iconPath}
                          alt=""
                          className="provider-logo-icon"
                          style={{
                            width: `${ICON_SIZE}px`,
                            height: `${ICON_SIZE}px`,
                            minWidth: `${ICON_SIZE}px`,
                            minHeight: `${ICON_SIZE}px`,
                            padding: '2px',
                            borderRadius: '5px',
                            background: 'rgba(255, 255, 255, 0.10)',
                            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15), 0 0 4px rgba(255, 255, 255, 0.06)',
                          }}
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== FALLBACK_ICON) {
                              target.src = FALLBACK_ICON;
                            }
                          }}
                        />
                      </a>

                      {/* Provider name — click selects for optimisation */}
                      <span
                        className="provider-name-link cursor-pointer"
                        style={{
                          fontSize: 'clamp(0.6rem, 1vw, 1rem)',
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => onSelectProvider(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectProvider(p.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${p.name} for optimisation`}
                      >
                        {p.name}
                      </span>

                      {/* Rank-up arrow */}
                      {p.indexRating?.hasRankUp && (
                        <span className="rank-up-arrow" title="Climbed in rankings (24h)">⬆</span>
                      )}
                    </div>
                  </td>

                  {/* ── Col 4: Support — social icons (hidden on narrow) ── */}
                  <td className="providers-table-td px-4 py-3 leaderboard-rail-support border-r border-white/5">
                    <SupportIconsCell
                      providerName={p.name}
                      socials={p.socials}
                      providerId={p.id}
                    />
                  </td>

                  {/* ── Col 5: Index Rating ──────────────────────────── */}
                  <td className="providers-table-td px-4 py-3 text-center leaderboard-rail-rating">
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
    </div>
  );
}

export default LeaderboardRail;
