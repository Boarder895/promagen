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
// Updated: 22 Jan 2026 - BUGFIX: Fixed inverted sort direction
//                      - 'desc' now correctly shows highest scores first
//                      - Separate dir calculation for score vs imageQuality
// Updated: 27 Jan 2026 - Replaced "Overall Score" column with "Index Rating"
//                      - Integrated IndexRatingCell component for live ratings
//                      - Added client-side fetching of Index Rating data
//                      - Sorting now uses Index Rating instead of static score
// Updated: 27 Jan 2026 - Added hasRankUp prop to ProviderCell for green arrow display
//                      - Added isUnderdog/isNewcomer calculation from market-power.json
//                      - Imported market power data and MPI calculation

'use client';

import React, { useState, useEffect } from 'react';
import type { Provider } from '@/types/provider';
import type { ProviderRating, DisplayRating } from '@/types/index-rating';
import { ProviderCell } from './provider-cell';
import { ImageQualityVoteButton } from './image-quality-vote-button';
import { SupportIconsCell } from './support-icons-cell';
import { IndexRatingCell } from './index-rating-cell';
import { toRomanNumeral } from '@/lib/format/number';
import { Flag } from '@/components/ui/flag';
import Tooltip from '@/components/ui/tooltip';

// Market power data for MPI calculation
import marketPowerData from '@/data/providers/market-power.json';
import { calculateMPI } from '@/lib/index-rating/calculations';
import type { MarketPowerData, ProviderMarketPower } from '@/lib/index-rating';

// Cast market power data to typed version
const typedMarketPowerData = marketPowerData as MarketPowerData;

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
  /** Whether the table is in expanded (full-centre) mode */
  isExpanded?: boolean;
  /** Callback to toggle expanded mode */
  onExpandToggle?: () => void;
};

type PromagenUsersCountryUsage = {
  countryCode: string;
  count: number;
};

type ProviderWithExtras = Provider & {
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
  indexRating?: DisplayRating;
};

type SortColumn = 'indexRating' | 'imageQuality';
type SortDirection = 'asc' | 'desc';

// =============================================================================
// MARKET POWER HELPERS
// =============================================================================

/**
 * Calculate if provider is an underdog (MPI < 3.0)
 */
function isProviderUnderdog(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as ProviderMarketPower | undefined;

  if (!providerData) {
    // Unknown provider — default MPI is 3.0, so NOT underdog
    return false;
  }

  const mpi = calculateMPI(providerData);
  return mpi < 3.0;
}

/**
 * Calculate if provider is a newcomer (founded < 12 months ago)
 */
function isProviderNewcomer(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as ProviderMarketPower | undefined;

  if (!providerData || !providerData.foundingYear) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  const providerAge = currentYear - providerData.foundingYear;

  // Newcomer = less than 1 year old (founded this year or last year within 12 months)
  // For simplicity, we check if founded in current year
  return providerAge < 1;
}

// =============================================================================
// INDEX RATING HELPERS
// =============================================================================

/**
 * Fetch Index Ratings from API for given provider IDs
 */
async function fetchIndexRatings(providerIds: string[]): Promise<Map<string, ProviderRating>> {
  try {
    const response = await fetch('/api/index-rating/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerIds }),
    });

    if (!response.ok) {
      console.warn('[ProvidersTable] Failed to fetch index ratings:', response.status);
      return new Map();
    }

    const data = await response.json();
    const ratings = new Map<string, ProviderRating>();

    if (data.ratings && typeof data.ratings === 'object') {
      for (const [id, rating] of Object.entries(data.ratings)) {
        ratings.set(id, rating as ProviderRating);
      }
    }

    return ratings;
  } catch (error) {
    console.error('[ProvidersTable] Error fetching index ratings:', error);
    return new Map();
  }
}

/**
 * Convert database rating to display rating
 */
function toDisplayRating(provider: Provider, dbRating: ProviderRating | undefined): DisplayRating {
  const providerId = provider.id.toLowerCase();

  if (dbRating) {
    // Determine state from changePercent
    let state: 'gain' | 'loss' | 'flat' | 'fallback' = 'flat';
    if (dbRating.changePercent > 0.1) {
      state = 'gain';
    } else if (dbRating.changePercent < -0.1) {
      state = 'loss';
    }

    // Check for recent rank up (within 24 hours)
    const hasRankUp = dbRating.rankChangedAt
      ? Date.now() - new Date(dbRating.rankChangedAt).getTime() < 24 * 60 * 60 * 1000
      : false;

    // Calculate underdog/newcomer from market power data
    const isUnderdog = isProviderUnderdog(providerId);
    const isNewcomer = isProviderNewcomer(providerId);

    return {
      rating: dbRating.currentRating,
      change: dbRating.change,
      changePercent: dbRating.changePercent,
      state,
      source: 'database',
      rank: dbRating.currentRank,
      hasRankUp,
      isUnderdog,
      isNewcomer,
    };
  }

  // Fallback: use static score × 20 (or null if no score)
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

// =============================================================================
// EXPAND HEADER COMPONENT (Provider column toggle)
// =============================================================================
// All styles inline — no globals.css dependency.
// To change arrow colour: edit ARROW_COLOUR / ARROW_ACTIVE_COLOUR below.
// To change transition speed: edit TRANSITION_SPEED.
// =============================================================================

const ARROW_COLOUR = 'rgba(168, 85, 247, 0.5)'; // idle: dim slate
const ARROW_HOVER_COLOUR = 'rgba(148, 163, 184, 0.9)'; // hover: brighter slate
const ARROW_ACTIVE_COLOUR = 'rgba(34, 211, 238, 1)'; // expanded: cyan-400
const UNDERLINE_COLOUR = 'rgba(34, 211, 238, 0.6)'; // underline sweep
const UNDERLINE_ACTIVE = 'rgba(34, 211, 238, 0.8)'; // underline when expanded
const LABEL_GLOW = 'rgba(34, 211, 238, 0.3)'; // label text-shadow
const TRANSITION_SPEED = '2s'; // arrow rotation/colour speed

function ExpandHeader({ isExpanded, onToggle }: { isExpanded: boolean; onToggle?: () => void }) {
  const [hovered, setHovered] = React.useState(false);

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    textTransform: 'inherit' as React.CSSProperties['textTransform'],
    letterSpacing: 'inherit',
    color: hovered ? 'rgba(226, 232, 240, 1)' : 'inherit',
    transition: `all 0.2s ease`,
    position: 'relative',
  };

  const underlineStyle: React.CSSProperties = {
    content: '""',
    position: 'absolute',
    bottom: '0.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    width: isExpanded ? '80%' : hovered ? '70%' : '0',
    height: '2px',
    background: `linear-gradient(90deg, transparent, ${isExpanded ? UNDERLINE_ACTIVE : UNDERLINE_COLOUR}, transparent)`,
    borderRadius: '1px',
    transition: 'width 0.25s ease',
  };

  const labelStyle: React.CSSProperties = {
    transition: `color 0.2s ease`,
    color: isExpanded ? 'rgba(226, 232, 240, 1)' : undefined,
    textShadow: isExpanded ? `0 0 8px ${LABEL_GLOW}` : undefined,
  };

  const arrowStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.8em',
    color: isExpanded ? ARROW_ACTIVE_COLOUR : hovered ? ARROW_HOVER_COLOUR : ARROW_COLOUR,
    transition: `all ${TRANSITION_SPEED} ease`,
    minWidth: '1em',
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
    filter: isExpanded
      ? `drop-shadow(0 0 4px rgba(34, 211, 238, 0.5)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.3))`
      : 'none',
    animation: 'expandArrowPulse 1.5s ease-in-out infinite',
  };

  return (
    <>
      {/* Keyframes — 1.5s gentle opacity pulse */}
      <style>{`@keyframes expandArrowPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={buttonStyle}
        aria-label={
          isExpanded ? 'Collapse table, show finance ribbon' : 'Expand table, hide finance ribbon'
        }
        title={isExpanded ? 'Show FX & commodities' : 'Expand leaderboard'}
      >
        {/* Underline sweep pseudo-element replacement */}
        <span style={underlineStyle} aria-hidden="true" />
        <span style={labelStyle}>Provider</span>
        <span style={arrowStyle}>▼</span>
      </button>
    </>
  );
}

// =============================================================================
// SORTABLE HEADER COMPONENT
// =============================================================================

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
  infoTooltip,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentDirection: SortDirection;
  onSort: (col: SortColumn) => void;
  infoTooltip?: string;
}) {
  const isActive = currentSort === column;
  const isAsc = currentDirection === 'asc';

  // Determine which arrow to show
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
        <span className={`sortable-header-arrow ${isActive ? 'sortable-header-arrow-active' : ''}`}>
          {arrow}
        </span>
      </button>
      {infoTooltip && (
        <Tooltip text={infoTooltip}>
          <span
            className="text-muted-foreground hover:text-foreground transition-colors cursor-help text-xs"
            aria-label={`${label} information`}
          >
            ℹ
          </span>
        </Tooltip>
      )}
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function chunkPairs<T>(items: ReadonlyArray<T>): Array<ReadonlyArray<T>> {
  const out: Array<ReadonlyArray<T>> = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push(items.slice(i, i + 2));
  }
  return out;
}

/**
 * Promagen Users cell: 2×2×2 grid of flags + Roman numeral counts
 */
function PromagenUsersCell({ usage }: { usage?: ReadonlyArray<PromagenUsersCountryUsage> }) {
  if (!usage || usage.length === 0) {
    return <span className="text-slate-600 text-base">—</span>;
  }

  // Take top 6
  const top6 = usage.slice(0, 6);
  const rows = chunkPairs(top6);

  return (
    <div className="promagen-users-cell flex flex-col items-center gap-1">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-center justify-center gap-3">
          {row.map((item) => (
            <span key={item.countryCode} className="inline-flex items-center gap-1">
              <Flag countryCode={item.countryCode} size={26} decorative />
              <span className="text-xl text-slate-400">{toRomanNumeral(item.count)}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Image Quality cell: rank (ordinal), medal emoji (top 3), vote button
 */
function ImageQualityCell({
  rank,
  providerId,
  isAuthenticated,
}: {
  rank?: number | null;
  providerId: string;
  isAuthenticated?: boolean;
}) {
  if (!rank) {
    return <span className="text-slate-600 text-xs">—</span>;
  }

  // Medal for top 3
  let medal = '';
  if (rank === 1) medal = '🥇';
  else if (rank === 2) medal = '🥈';
  else if (rank === 3) medal = '🥉';

  // Ordinal suffix
  const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-sm">
        {ordinal} {medal}
      </span>
      <ImageQualityVoteButton providerId={providerId} isAuthenticated={isAuthenticated} />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ProvidersTable({
  providers,
  title: _title,
  caption: _caption,
  limit,
  isAuthenticated = false,
  onProvidersChange,
  isExpanded = false,
  onExpandToggle,
}: ProvidersTableProps) {
  // Sort state: default to Index Rating descending (highest first)
  const [sortBy, setSortBy] = useState<SortColumn>('indexRating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Index Rating data from database
  const [indexRatings, setIndexRatings] = useState<Map<string, ProviderRating>>(new Map());
  const [_ratingsLoaded, setRatingsLoaded] = useState(false);

  // Fetch Index Ratings on mount
  useEffect(() => {
    const providerIds = providers.map((p) => p.id);
    if (providerIds.length === 0) return;

    fetchIndexRatings(providerIds).then((ratings) => {
      setIndexRatings(ratings);
      setRatingsLoaded(true);
    });
  }, [providers]);

  // Handle sort toggle: if same column, flip direction; else switch column with default direction
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      // Toggle direction
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      // Switch to new column with default direction
      setSortBy(column);
      // Image quality: lower rank = better, so default to asc (shows rank 1 first)
      // Index Rating: higher = better, so default to desc (shows highest first)
      setSortDirection(column === 'imageQuality' ? 'asc' : 'desc');
    }
  };

  const sliced =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? providers.slice(0, Math.floor(limit))
      : providers;

  // Enrich providers with Index Rating display data
  const enriched: ProviderWithExtras[] = sliced.map((p) => ({
    ...p,
    indexRating: toDisplayRating(p, indexRatings.get(p.id.toLowerCase())),
  }));

  // Sort providers based on selected column and direction
  const sorted = React.useMemo(() => {
    const arr = [...enriched];

    if (sortBy === 'imageQuality') {
      // For imageQuality: lower rank = better
      // 'asc' (default) → show rank 1, 2, 3... (best first) → natural order
      // 'desc' → show worst first → inverted
      const dir = sortDirection === 'asc' ? 1 : -1;
      return arr.sort((a, b) => {
        const aRank = a.imageQualityRank ?? 999;
        const bRank = b.imageQualityRank ?? 999;
        return (aRank - bRank) * dir;
      });
    }

    // Default: sort by Index Rating
    // For indexRating: higher = better
    // 'desc' (default) → show highest first → natural order for (bRating - aRating)
    // 'asc' → show lowest first → inverted
    const dir = sortDirection === 'desc' ? 1 : -1;
    return arr.sort((a, b) => {
      const aRating = a.indexRating?.rating ?? 0;
      const bRating = b.indexRating?.rating ?? 0;
      return (bRating - aRating) * dir;
    });
  }, [enriched, sortBy, sortDirection]);

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
          {/* 5 columns: Provider (30%) | Promagen Users (18%) | Image Quality (18%) | Support (18%) | Index Rating (16%) */}
          <thead className="providers-table-header">
            <tr>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[30%] border-r border-white/5">
                <ExpandHeader isExpanded={isExpanded} onToggle={onExpandToggle} />
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
            {sorted.map((p, index) => (
              <tr
                key={p.id}
                data-provider-id={p.id}
                className="providers-table-row border-t border-slate-800 hover:bg-slate-900/30 transition-colors market-pulse-target"
              >
                <td className="providers-table-td px-4 py-3 w-[30%] border-r border-white/5">
                  <ProviderCell
                    provider={p}
                    rank={index + 1}
                    hasRankUp={p.indexRating?.hasRankUp ?? false}
                  />
                </td>

                <td className="providers-table-td px-4 py-3 w-[18%] text-center border-r border-white/5">
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
                  <SupportIconsCell providerName={p.name} socials={p.socials} providerId={p.id} />
                </td>

                <td className="providers-table-td px-4 py-3 text-center w-[16%]">
                  {p.indexRating ? (
                    <IndexRatingCell rating={p.indexRating} />
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
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
            {/* Row 1: Rank + Name + Index Rating */}
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
              {p.indexRating?.hasRankUp && <span className="rank-up-arrow">⬆</span>}
              <span className="providers-mobile-score">
                {p.indexRating?.rating ? Math.round(p.indexRating.rating).toLocaleString() : '—'}
                {p.indexRating?.state === 'gain' && (
                  <span className="text-emerald-400 ml-1">▲</span>
                )}
                {p.indexRating?.state === 'loss' && <span className="text-rose-400 ml-1">▼</span>}
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

export default ProvidersTable;
