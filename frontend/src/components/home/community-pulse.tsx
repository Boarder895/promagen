// src/components/home/community-pulse.tsx
// ============================================================================
// COMMUNITY PULSE — Right rail on new homepage
// ============================================================================
// Scrollable feed of recent high-scoring prompts from the community.
// Provides social proof that Promagen is alive and active.
//
// Features:
// - 20 most recent entries (weather-seeded initially, user-generated later)
// - Score colour-coding: ≥90 emerald, ≥80 amber, <80 slate
// - Like button per entry (integrated with use-like hook)
// - "Most liked today" pinned card at bottom (hidden if no likes)
// - Relative timestamps ("2 min ago", "1 hour ago")
// - 30-second auto-refresh via use-community-pulse hook
// - All sizing via CSS clamp() (desktop-only per Promagen rules)
// - Skeleton loader (no CLS)
//
// Authority: docs/authority/homepage.md §6
// Existing features preserved: Yes (additive component only)
// ============================================================================

'use client';

import React, { useMemo, useCallback } from 'react';
import { useCommunityPulse } from '@/hooks/use-community-pulse';
import { useLike, type LikeState } from '@/hooks/use-like';
import type { CommunityPulseEntry } from '@/types/homepage';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default like state (not liked, 0 count). */
const EMPTY_LIKE: LikeState = { liked: false, count: 0, isUpdating: false };

// ============================================================================
// RELATIVE TIME HELPER
// ============================================================================

/**
 * Format an ISO timestamp as a relative "time ago" string.
 * Keeps it short: "just now", "2m ago", "1h ago", "3d ago".
 */
function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = Math.max(0, now - then);
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ============================================================================
// SCORE COLOUR HELPER
// ============================================================================

/**
 * Per spec §6.3: ≥90 emerald, ≥80 amber, <80 slate.
 */
function scoreColour(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-amber-400';
  return 'text-slate-400';
}

// ============================================================================
// PULSE CARD — Single entry in the feed
// ============================================================================

function PulseCard({
  entry,
  likeState,
  onToggleLike,
}: {
  entry: CommunityPulseEntry;
  likeState: LikeState;
  onToggleLike: () => void;
}) {
  return (
    <div
      className="flex flex-col rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.05]"
      style={{ padding: 'clamp(6px, 0.6vw, 10px)' }}
    >
      {/* Row 1: Score + Platform */}
      <div
        className="flex items-center"
        style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}
      >
        {/* Score badge */}
        <span
          className={`font-mono font-bold ${scoreColour(entry.score)}`}
          style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.75rem)' }}
        >
          {entry.score}
        </span>

        {/* Dot separator */}
        <span
          className="text-slate-600"
          style={{ fontSize: 'clamp(0.4rem, 0.45vw, 0.55rem)' }}
          aria-hidden="true"
        >
          ·
        </span>

        {/* Platform / City name */}
        <span
          className="truncate text-slate-400"
          style={{ fontSize: 'clamp(0.48rem, 0.58vw, 0.68rem)' }}
        >
          {entry.platform}
        </span>

        {/* Tier indicator dot */}
        <span
          className="ml-auto shrink-0 rounded-full"
          style={{
            width: 'clamp(4px, 0.3vw, 6px)',
            height: 'clamp(4px, 0.3vw, 6px)',
            backgroundColor: tierDotColour(entry.tier),
          }}
          title={tierLabel(entry.tier)}
          aria-hidden="true"
        />
      </div>

      {/* Row 2: Description */}
      <p
        className="truncate text-slate-200"
        style={{
          fontSize: 'clamp(0.55rem, 0.68vw, 0.78rem)',
          marginTop: 'clamp(2px, 0.15vw, 3px)',
        }}
        title={entry.description}
      >
        {entry.description || 'Untitled prompt'}
      </p>

      {/* Row 3: Time ago + Like button */}
      <div
        className="flex items-center"
        style={{ marginTop: 'clamp(2px, 0.2vw, 4px)' }}
      >
        {/* Time ago */}
        <span
          className="text-slate-500"
          style={{ fontSize: 'clamp(0.42rem, 0.5vw, 0.6rem)' }}
        >
          {timeAgo(entry.createdAt)}
        </span>

        {/* Like button — aligned right */}
        <button
          type="button"
          onClick={onToggleLike}
          disabled={likeState.isUpdating}
          className={`ml-auto inline-flex shrink-0 items-center transition-all ${
            likeState.liked
              ? 'text-pink-400'
              : 'text-slate-500 hover:text-pink-300'
          } ${likeState.isUpdating ? 'opacity-60' : ''}`}
          style={{
            gap: 'clamp(3px, 0.25vw, 4px)',
            fontSize: 'clamp(0.6rem, 0.72vw, 0.85rem)',
            padding: 'clamp(1px, 0.1vw, 2px) clamp(3px, 0.25vw, 5px)',
          }}
          title={likeState.liked ? 'Unlike this prompt' : 'Like this prompt'}
          aria-label={`${likeState.liked ? 'Unlike' : 'Like'} prompt (${likeState.count} likes)`}
        >
          <span
            style={{
              fontSize: 'clamp(1.1rem, 1.3vw, 1.56rem)',
              transition: 'transform 200ms ease-out',
              transform: likeState.liked ? 'scale(1.2)' : 'scale(1)',
              display: 'inline-block',
            }}
            aria-hidden="true"
          >
            {likeState.liked ? '♥' : '♡'}
          </span>
          <span className="tabular-nums">{likeState.count}</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MOST LIKED TODAY CARD — Pinned at bottom of feed
// ============================================================================

function MostLikedCard({ entry }: { entry: CommunityPulseEntry }) {
  return (
    <div
      className="flex items-center rounded-xl bg-amber-500/[0.06] ring-1 ring-amber-500/20"
      style={{ padding: 'clamp(6px, 0.6vw, 10px)', gap: 'clamp(6px, 0.5vw, 8px)' }}
    >
      {/* Trophy */}
      <span
        style={{ fontSize: 'clamp(0.7rem, 0.85vw, 1rem)' }}
        aria-hidden="true"
      >
        🏆
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className="font-medium text-amber-300"
          style={{ fontSize: 'clamp(0.42rem, 0.52vw, 0.62rem)' }}
        >
          Most liked today
        </p>
        <p
          className="truncate text-slate-300"
          style={{ fontSize: 'clamp(0.5rem, 0.62vw, 0.72rem)' }}
          title={entry.description}
        >
          {entry.description || 'Untitled prompt'}
        </p>
      </div>

      {/* Like count */}
      <span
        className="shrink-0 text-pink-400"
        style={{ fontSize: 'clamp(0.96rem, 1.16vw, 1.36rem)' }}
      >
        ♥ {entry.likeCount}
      </span>
    </div>
  );
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function PulseSkeleton() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}
      aria-label="Loading community pulse"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl bg-slate-800/40"
          style={{ height: 'clamp(48px, 4.5vw, 72px)' }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyPulse() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: 'clamp(16px, 1.5vw, 24px) 0' }}
    >
      <span
        style={{ fontSize: 'clamp(1.2rem, 1.5vw, 2rem)' }}
        aria-hidden="true"
      >
        📡
      </span>
      <p
        className="text-slate-500"
        style={{
          fontSize: 'clamp(0.55rem, 0.68vw, 0.78rem)',
          marginTop: 'clamp(4px, 0.3vw, 6px)',
        }}
      >
        No prompt activity yet
      </p>
      <p
        className="text-slate-600"
        style={{ fontSize: 'clamp(0.45rem, 0.55vw, 0.65rem)' }}
      >
        Weather-driven prompts will appear shortly
      </p>
    </div>
  );
}

// ============================================================================
// TIER HELPERS
// ============================================================================

function tierDotColour(tier: string): string {
  switch (tier) {
    case 'tier1': return '#8B5CF6'; // violet
    case 'tier2': return '#3B82F6'; // blue
    case 'tier3': return '#10B981'; // emerald
    case 'tier4': return '#F59E0B'; // amber
    default: return '#64748B';      // slate
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'tier1': return 'CLIP-Based';
    case 'tier2': return 'Midjourney';
    case 'tier3': return 'Natural Language';
    case 'tier4': return 'Plain Language';
    default: return 'Unknown';
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommunityPulse() {
  const { entries, mostLikedToday, isLoading } = useCommunityPulse();

  // ── Like system integration ────────────────────────────────────────────
  // Collect all entry IDs for batched like status
  const entryIds = useMemo(
    () => entries.map((e) => e.id),
    [entries],
  );

  const { states: likeStates, toggleLike } = useLike(entryIds);

  const handleToggleLike = useCallback(
    (entryId: string) => {
      toggleLike(entryId, { source: 'pulse' });
    },
    [toggleLike],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full flex-col"
      style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}
      data-testid="community-pulse"
    >
      {/* ── Section header ────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center"
        style={{
          gap: 'clamp(5px, 0.5vw, 8px)',
          padding: 'clamp(4px, 0.35vw, 6px) 0',
        }}
      >
        {/* Live dot */}
        <div
          className="animate-pulse rounded-full"
          style={{
            backgroundColor: '#10B981',
            width: 'clamp(5px, 0.3vw, 7px)',
            height: 'clamp(5px, 0.3vw, 7px)',
          }}
          aria-hidden="true"
        />
        <span
          className="font-mono uppercase tracking-wider text-slate-400"
          style={{ fontSize: 'clamp(0.45rem, 0.58vw, 0.68rem)' }}
        >
          Community Pulse
        </span>
        <span
          className="ml-auto text-slate-600"
          style={{ fontSize: 'clamp(0.38rem, 0.45vw, 0.55rem)' }}
        >
          Live
        </span>
      </div>

      {/* ── Feed area (scrollable) ────────────────────────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(148, 163, 184, 0.15) transparent',
        }}
      >
        {isLoading ? (
          <PulseSkeleton />
        ) : entries.length === 0 ? (
          <EmptyPulse />
        ) : (
          <div
            className="flex flex-col"
            style={{ gap: 'clamp(4px, 0.35vw, 6px)' }}
          >
            {entries.map((entry) => (
              <PulseCard
                key={entry.id}
                entry={entry}
                likeState={likeStates.get(entry.id) ?? EMPTY_LIKE}
                onToggleLike={() => handleToggleLike(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Most liked today (pinned at bottom, hidden if no likes) ──── */}
      {mostLikedToday && mostLikedToday.likeCount > 0 && (
        <div className="shrink-0">
          <MostLikedCard entry={mostLikedToday} />
        </div>
      )}
    </div>
  );
}
