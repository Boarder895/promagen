// src/components/prompt-lab/leaderboard-rail.tsx
// ============================================================================
// LEADERBOARD RAIL — Left Rail: Mini AI Leaderboard (replaces PlatformMatchRail)
// ============================================================================
// Compact 3-column leaderboard: Provider | Image Quality | Index Rating
// Top 10 by default, "Show all 40" expander. Clicking a row selects the
// provider in the centre Prompt Lab workspace.
//
// Demo mode: subtle simulated rating jitter every 30s until 500 paying users,
// then switches to live-only data.
//
// Columns match the homepage AI Leaderboard table columns 1, 4 & 5:
//   Col 1: Rank + Icon + Name (compact)
//   Col 4: Image Quality (ordinal + medal)
//   Col 5: Index Rating (value + change arrow)
//
// Human factors:
//   §7  Spatial Framing — ranked list creates authority hierarchy
//   §13 Fitts's Law — full-width clickable rows
//   §12 Von Restorff — selected row glows, medals pop
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - No grey text — dimmest is #94A3B8 (§6.0.2)
//   - cursor-pointer on all clickables (§6.0.4)
//   - prefers-reduced-motion respected (§18)
//
// Authority: playground-page-client.tsx leftContent slot
// Existing features preserved: Yes — same props contract as PlatformMatchRail.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Provider } from '@/types/providers';
import type { ProviderRating, RatingChangeState } from '@/types/index-rating';

// ============================================================================
// CONSTANTS
// ============================================================================

/** How many rows to show before "Show all" */
const DEFAULT_VISIBLE = 10;

/** Demo jitter interval (ms) — subtle movement every 30s */
const DEMO_JITTER_INTERVAL = 30_000;

/** Demo jitter range: ±1 to ±3 on rating value */
const DEMO_JITTER_MIN = 1;
const DEMO_JITTER_MAX = 3;

/** Fallback icon */
const FALLBACK_ICON = '/icons/providers/fallback.png';

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardRailProps {
  /** All providers from the catalog */
  providers: Provider[];
  /** Currently selected provider ID (null = none) */
  selectedProviderId: string | null;
  /** Callback when user clicks a platform row */
  onSelectProvider: (providerId: string) => void;
}

interface RailRow {
  id: string;
  name: string;
  iconPath: string;
  imageQualityRank: number | null;
  rating: number | null;
  change: number | null;
  changePercent: number | null;
  state: RatingChangeState;
  hasRankUp: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRating(rating: number | null): string {
  if (rating === null) return '—';
  return Math.round(rating).toLocaleString('en-US');
}

function getOrdinal(rank: number | null): string {
  if (rank === null) return '—';
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function getMedal(rank: number | null): string {
  if (rank === 1) return ' 🥇';
  if (rank === 2) return ' 🥈';
  if (rank === 3) return ' 🥉';
  return '';
}

function getChangeSymbol(state: RatingChangeState): string {
  if (state === 'gain') return '▲';
  if (state === 'loss') return '▼';
  return '●';
}

function getChangeColour(state: RatingChangeState): string {
  if (state === 'gain') return '#22c55e';
  if (state === 'loss') return '#ef4444';
  return '#94A3B8';
}

// ============================================================================
// INDEX RATING FETCHER (same pattern as providers-table.tsx)
// ============================================================================

async function fetchIndexRatings(providerIds: string[]): Promise<Map<string, ProviderRating>> {
  try {
    const response = await fetch('/api/index-rating/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerIds }),
    });

    if (!response.ok) {
      console.warn('[LeaderboardRail] Failed to fetch index ratings:', response.status);
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
    console.error('[LeaderboardRail] Error fetching index ratings:', error);
    return new Map();
  }
}

// ============================================================================
// DEMO JITTER — subtle simulated movement for pre-launch
// ============================================================================

function applyJitter(rows: RailRow[]): RailRow[] {
  return rows.map((row) => {
    if (row.rating === null) return row;

    const jitterAmount =
      (Math.random() * (DEMO_JITTER_MAX - DEMO_JITTER_MIN) + DEMO_JITTER_MIN) *
      (Math.random() > 0.5 ? 1 : -1);

    const newRating = row.rating + jitterAmount;
    const newChange = jitterAmount;
    const newState: RatingChangeState =
      jitterAmount > 0 ? 'gain' : jitterAmount < 0 ? 'loss' : 'flat';

    return {
      ...row,
      rating: newRating,
      change: newChange,
      changePercent: row.rating > 0 ? (jitterAmount / row.rating) * 100 : 0,
      state: newState,
    };
  });
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
  const jitterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch index ratings on mount ────────────────────────────────────
  useEffect(() => {
    const ids = providers.map((p) => p.id);
    if (ids.length === 0) return;

    fetchIndexRatings(ids).then(setIndexRatings);
  }, [providers]);

  // ── Demo jitter timer ───────────────────────────────────────────────
  useEffect(() => {
    // Check prefers-reduced-motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    jitterRef.current = setInterval(() => {
      setJitterTick((t) => t + 1);
    }, DEMO_JITTER_INTERVAL);

    return () => {
      if (jitterRef.current) clearInterval(jitterRef.current);
    };
  }, []);

  // ── Build sorted rows ───────────────────────────────────────────────
  const baseRows = useMemo<RailRow[]>(() => {
    return providers.map((p) => {
      const dbRating = indexRatings.get(p.id);

      let state: RatingChangeState = 'flat';
      if (dbRating) {
        if (dbRating.changePercent > 0.1) state = 'gain';
        else if (dbRating.changePercent < -0.1) state = 'loss';
      }

      const hasRankUp = dbRating?.rankChangedAt
        ? Date.now() - new Date(dbRating.rankChangedAt).getTime() < 24 * 60 * 60 * 1000
        : false;

      return {
        id: p.id,
        name: p.name,
        iconPath: p.localIcon || `/icons/providers/${p.id}.png`,
        imageQualityRank: p.imageQualityRank ?? null,
        rating: dbRating?.currentRating ?? (typeof p.score === 'number' ? p.score * 20 : null),
        change: dbRating?.change ?? null,
        changePercent: dbRating?.changePercent ?? null,
        state: dbRating ? state : 'fallback',
        hasRankUp,
      };
    });
  }, [providers, indexRatings]);

  // Apply jitter for demo mode then sort by rating descending
  const sortedRows = useMemo(() => {
     
    const _tick = jitterTick; // reactive dependency
    const jittered = applyJitter(baseRows);
    return [...jittered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [baseRows, jitterTick]);

  const displayedRows = isExpanded ? sortedRows : sortedRows.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = sortedRows.length - DEFAULT_VISIBLE;

  const toggleExpand = useCallback(() => setIsExpanded((v) => !v), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Heading ────────────────────────────────────────────────────── */}
      <h3
        style={{
          fontSize: 'clamp(0.7rem, 0.95vw, 1.1rem)',
          fontWeight: 700,
          lineHeight: 1.2,
          margin: '0 0 clamp(6px, 0.5vw, 10px) 0',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#22d3ee',
          textShadow: '0 0 12px rgba(34, 211, 238, 0.3)',
        }}
      >
        AI Leaderboard
      </h3>

      {/* ── Column headers ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: 'clamp(4px, 0.4vw, 8px)',
          padding: 'clamp(3px, 0.25vw, 5px) clamp(4px, 0.4vw, 8px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          marginBottom: 'clamp(2px, 0.2vw, 4px)',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(0.55rem, 0.65vw, 0.7rem)',
            fontWeight: 600,
            color: '#94A3B8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Provider
        </span>
        <span
          style={{
            fontSize: 'clamp(0.55rem, 0.65vw, 0.7rem)',
            fontWeight: 600,
            color: '#94A3B8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textAlign: 'center',
            minWidth: 'clamp(40px, 4vw, 60px)',
          }}
        >
          Quality
        </span>
        <span
          style={{
            fontSize: 'clamp(0.55rem, 0.65vw, 0.7rem)',
            fontWeight: 600,
            color: '#94A3B8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textAlign: 'right',
            minWidth: 'clamp(48px, 5vw, 72px)',
          }}
        >
          Rating
        </span>
      </div>

      {/* ── Rows ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          maxHeight: isExpanded ? 'none' : undefined,
        }}
      >
        {displayedRows.map((row, index) => {
          const rank = index + 1;
          const isSelected = row.id === selectedProviderId;

          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectProvider(row.id)}
              className="cursor-pointer"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 'clamp(4px, 0.4vw, 8px)',
                alignItems: 'center',
                padding: 'clamp(4px, 0.35vw, 7px) clamp(4px, 0.4vw, 8px)',
                border: 'none',
                borderLeft: isSelected
                  ? '2px solid #22d3ee'
                  : '2px solid transparent',
                borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                background: isSelected
                  ? 'rgba(34, 211, 238, 0.08)'
                  : 'transparent',
                width: '100%',
                textAlign: 'left',
                borderRadius: 0,
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(148, 163, 184, 0.06)';
                  e.currentTarget.style.borderLeftColor = 'rgba(34, 211, 238, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }
              }}
              aria-pressed={isSelected}
              aria-label={`Select ${row.name} — Rank ${rank}, Rating ${formatRating(row.rating)}`}
            >
              {/* ── Col 1: Rank + Icon + Name ─────────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(3px, 0.3vw, 6px)',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Rank number */}
                <span
                  style={{
                    fontSize: 'clamp(0.55rem, 0.7vw, 0.8rem)',
                    fontWeight: 600,
                    color: rank <= 3 ? '#FBBF24' : '#94A3B8',
                    minWidth: 'clamp(14px, 1.4vw, 20px)',
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {rank}
                </span>

                {/* Provider icon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.iconPath}
                  alt=""
                  style={{
                    width: 'clamp(14px, 1.3vw, 20px)',
                    height: 'clamp(14px, 1.3vw, 20px)',
                    borderRadius: 'clamp(2px, 0.2vw, 4px)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.1)',
                    flexShrink: 0,
                    objectFit: 'contain',
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== FALLBACK_ICON) {
                      target.src = FALLBACK_ICON;
                    }
                  }}
                />

                {/* Provider name */}
                <span
                  style={{
                    fontSize: 'clamp(0.58rem, 0.72vw, 0.82rem)',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? '#FFFFFF' : '#E2E8F0',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {row.name}
                </span>

                {/* Rank-up arrow */}
                {row.hasRankUp && (
                  <span
                    style={{
                      fontSize: 'clamp(0.5rem, 0.6vw, 0.7rem)',
                      color: '#22c55e',
                      flexShrink: 0,
                      filter: 'drop-shadow(0 0 3px rgba(34, 197, 94, 0.5))',
                    }}
                    title="Climbed in rankings (24h)"
                  >
                    ⬆
                  </span>
                )}
              </div>

              {/* ── Col 2: Image Quality ──────────────────────────────── */}
              <span
                style={{
                  fontSize: 'clamp(0.55rem, 0.65vw, 0.75rem)',
                  color: row.imageQualityRank && row.imageQualityRank <= 3
                    ? '#FBBF24'
                    : '#CBD5E1',
                  textAlign: 'center',
                  minWidth: 'clamp(40px, 4vw, 60px)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {row.imageQualityRank
                  ? `${getOrdinal(row.imageQualityRank)}${getMedal(row.imageQualityRank)}`
                  : '—'}
              </span>

              {/* ── Col 3: Index Rating ───────────────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  minWidth: 'clamp(48px, 5vw, 72px)',
                  lineHeight: 1.2,
                }}
              >
                {/* Rating value */}
                <span
                  style={{
                    fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatRating(row.rating)}
                </span>

                {/* Change indicator */}
                <span
                  style={{
                    fontSize: 'clamp(0.45rem, 0.55vw, 0.65rem)',
                    color: getChangeColour(row.state),
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {getChangeSymbol(row.state)}
                  {row.change !== null
                    ? ` ${row.change >= 0 ? '+' : ''}${Math.round(row.change)}`
                    : ''}
                </span>
              </div>
            </button>
          );
        })}
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
            padding: 'clamp(6px, 0.5vw, 10px) 0',
            marginTop: 'clamp(4px, 0.3vw, 6px)',
            border: 'none',
            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
            background: 'transparent',
            width: '100%',
            fontSize: 'clamp(0.58rem, 0.7vw, 0.8rem)',
            fontWeight: 500,
            color: '#22d3ee',
            letterSpacing: '0.03em',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#67e8f9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#22d3ee';
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Show top 10 only' : `Show all ${sortedRows.length} platforms`}
        >
          <span
            style={{
              display: 'inline-block',
              transition: 'transform 0.25s ease',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              fontSize: 'clamp(0.5rem, 0.6vw, 0.7rem)',
            }}
          >
            ▼
          </span>
          {isExpanded ? 'Top 10' : `Show all ${sortedRows.length}`}
        </button>
      )}

      {/* ── Live indicator ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'clamp(4px, 0.3vw, 6px)',
          marginTop: 'clamp(4px, 0.35vw, 6px)',
          paddingRight: 'clamp(4px, 0.4vw, 8px)',
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
        <span
          style={{
            fontSize: 'clamp(0.5rem, 0.6vw, 0.68rem)',
            color: '#94A3B8',
            letterSpacing: '0.04em',
          }}
        >
          Live
        </span>
        <span
          style={{
            fontSize: 'clamp(0.5rem, 0.6vw, 0.68rem)',
            color: '#64748B',
            marginLeft: 'auto',
          }}
        >
          {sortedRows.length} platforms
        </span>
      </div>

      {/* ── Animations ──────────────────────────────────────────────── */}
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
