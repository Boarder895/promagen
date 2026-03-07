// src/components/ux/feedback-widget.tsx
// ============================================================================
// FEEDBACK WIDGET — Compact Inline 👍👌👎 Rating
// ============================================================================
//
// Unified feedback component for use across all Promagen surfaces:
//   - PotM showcase (replaces heart)
//   - Community Pulse cards (replaces heart)
//   - Prompt builder (alongside existing FeedbackInvitation for post-copy)
//
// One click, locked vote. Three coloured counts. Fires to the same
// /api/feedback endpoint as the builder's FeedbackInvitation.
//
// Sizing matches the leaderboard Image Quality vote thumb (28px container,
// 18px icon) for visual consistency across the product.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10
// Authority: docs/authority/code-standard.md § clamp()
//
// Version: 1.0.0
// Created: 2026-03-07
//
// Existing features preserved: Yes (additive component).
// ============================================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FeedbackRating } from '@/types/feedback';
import { sendFeedbackDirect } from '@/lib/feedback/feedback-client';

// ============================================================================
// TYPES
// ============================================================================

export interface FeedbackWidgetProps {
  /** Unique identifier for this item (e.g. 'potm:3:tier1', 'pulse:abc', 'iq:leonardo') */
  itemId: string;
  /** Where the widget is rendered — for analytics + admin drill-down */
  source: 'showcase' | 'pulse' | 'builder' | 'image-quality-vote';
  /** Platform ID (e.g. 'leonardo') — for per-platform learning */
  platformId?: string;
  /** Platform tier (1–4) */
  tier?: number;
  /** Initial counts to display (from server/cache) */
  initialCounts?: FeedbackCounts;
}

export interface FeedbackCounts {
  positive: number;
  neutral: number;
  negative: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_KEY_PREFIX = 'promagen_fb_voted_';

const RATING_COLOURS: Record<FeedbackRating, string> = {
  positive: '#34D399', // emerald
  neutral: '#FBBF24',  // amber
  negative: '#F87171',  // soft red
};

const RATING_EMOJIS: Record<FeedbackRating, string> = {
  positive: '👍',
  neutral: '👌',
  negative: '👎',
};

const RATINGS: FeedbackRating[] = ['positive', 'neutral', 'negative'];

// ============================================================================
// SESSION PERSISTENCE — one vote per item, survives page navigation
// ============================================================================

function getVotedRating(itemId: string): FeedbackRating | null {
  try {
    const val = sessionStorage.getItem(SESSION_KEY_PREFIX + itemId);
    if (val === 'positive' || val === 'neutral' || val === 'negative') return val;
    return null;
  } catch {
    return null;
  }
}

function setVotedRating(itemId: string, rating: FeedbackRating): void {
  try {
    sessionStorage.setItem(SESSION_KEY_PREFIX + itemId, rating);
  } catch { /* noop */ }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FeedbackWidget({
  itemId,
  source,
  platformId,
  tier,
  initialCounts,
}: FeedbackWidgetProps) {
  const [voted, setVoted] = useState<FeedbackRating | null>(null);
  const [counts, setCounts] = useState<FeedbackCounts>(
    initialCounts ?? { positive: 0, neutral: 0, negative: 0 },
  );

  // Restore vote state from sessionStorage on mount
  useEffect(() => {
    const saved = getVotedRating(itemId);
    if (saved) setVoted(saved);
  }, [itemId]);

  // Update counts when initialCounts change (server data arrives)
  useEffect(() => {
    if (initialCounts) setCounts(initialCounts);
  }, [initialCounts]);

  const handleRate = useCallback(
    (rating: FeedbackRating) => {
      if (voted) return; // Already voted — locked

      setVoted(rating);
      setVotedRating(itemId, rating);

      // Optimistic count update
      setCounts((prev) => ({
        ...prev,
        [rating]: prev[rating] + 1,
      }));

      // Fire-and-forget POST to /api/feedback
      void sendFeedbackDirect({
        promptEventId: itemId,
        rating,
        platform: platformId ?? 'unknown',
        tier: tier ?? 3,
        source,
      });
    },
    [voted, itemId, platformId, tier, source],
  );

  return (
    <div
      className="inline-flex items-center"
      style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}
      role="group"
      aria-label="Rate this prompt"
    >
      {RATINGS.map((rating) => {
        const isSelected = voted === rating;
        const isDisabled = voted !== null && voted !== rating;
        const count = counts[rating];
        const colour = RATING_COLOURS[rating];

        return (
          <button
            key={rating}
            type="button"
            onClick={() => handleRate(rating)}
            disabled={voted !== null}
            className="inline-flex shrink-0 cursor-pointer items-center transition-all"
            style={{
              gap: 'clamp(2px, 0.15vw, 3px)',
              padding: 'clamp(1px, 0.1vw, 2px) clamp(2px, 0.15vw, 3px)',
              opacity: isDisabled ? 0.3 : 1,
              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
              transition: 'opacity 200ms ease, transform 200ms ease',
              cursor: voted ? 'default' : 'pointer',
              background: 'none',
              border: 'none',
            }}
            aria-label={`${RATING_EMOJIS[rating]} ${rating} (${count})`}
          >
            {/* Emoji — matches leaderboard thumb size */}
            <span
              style={{
                fontSize: 'clamp(14px, 1.1vw, 18px)',
                lineHeight: 1,
                filter: isSelected
                  ? `drop-shadow(0 0 4px ${colour})`
                  : 'none',
              }}
              aria-hidden="true"
            >
              {RATING_EMOJIS[rating]}
            </span>
            {/* Count — coloured, same tabular-nums as existing like count */}
            {count > 0 && (
              <span
                className="tabular-nums font-medium"
                style={{
                  fontSize: 'clamp(0.55rem, 0.7vw, 0.85rem)',
                  color: colour,
                  opacity: isDisabled ? 0.4 : 0.9,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
