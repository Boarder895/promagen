/**
 * Index Rating Cell Component
 * 
 * Displays provider's Index Rating in the leaderboard table.
 * Styled to match exchange card index quote.
 * 
 * Format:
 * Line 1: Current rating (e.g., "1,847")
 * Line 2: Change indicator + absolute + percentage (e.g., "▲ +23 (+1.26%)")
 * 
 * IMPORTANT: Colors use custom CSS classes defined below that must be added
 * to globals.css to override .providers-table color rule.
 * 
 * FONT SIZE LINES:
 * - Line 95: Rating value font size
 * - Line 103: Change indicator font size
 * 
 * Updated: 27 Jan 2026 - Added rank-up-arrow class to RankUpArrow for CSS animation
 * 
 * @see docs/authority/index-rating.md
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { DisplayRating, RatingChangeState } from '@/types/index-rating';

// =============================================================================
// TYPES
// =============================================================================

type IndexRatingCellProps = {
  rating: DisplayRating;
  compact?: boolean;
  className?: string;
};

// =============================================================================
// HELPERS
// =============================================================================

function formatRating(rating: number | null): string {
  if (rating === null) return '—';
  return Math.round(rating).toLocaleString('en-US');
}

function formatChange(change: number | null): string {
  if (change === null) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${Math.round(change)}`;
}

function formatPercent(percent: number | null): string {
  if (percent === null) return '—';
  return `${percent.toFixed(2)}%`;
}

function getDirectionSymbol(state: RatingChangeState): string {
  switch (state) {
    case 'gain': return '▲';
    case 'loss': return '▼';
    default: return '●';
  }
}

// Returns CSS class that has !important in globals.css
function getTickColorClass(state: RatingChangeState): string {
  return state === 'gain' 
    ? 'index-rating-gain' 
    : state === 'loss' 
      ? 'index-rating-loss' 
      : 'index-rating-flat';
}

// =============================================================================
// TICKER HOOK — animates number from old to new over 600ms
// =============================================================================

function useRatingTicker(target: number | null): number | null {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;

    // No animation needed
    if (target === null || prev === null || prev === target) {
      setDisplay(target);
      return;
    }

    // Respect reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }

    // Cancel any running animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const diff = target - prev;
    const from = prev; // capture non-null for closure
    const duration = 600;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic — fast start, gentle landing
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + diff * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return display;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function IndexRatingCell({ rating, compact = false, className = '' }: IndexRatingCellProps) {
  const { rating: ratingValue, change, changePercent, state } = rating;

  // Ticker: animates the number from old to new value
  const displayValue = useRatingTicker(ratingValue);

  const symbol = getDirectionSymbol(state);
  const tickColorClass = getTickColorClass(state);

  return (
    <div className={`index-rating-cell ${className}`}>
      {/* Line 1: Rating value - white, animated ticker */}
      <span className="index-rating-value">
        {formatRating(displayValue)}
      </span>

      {/* Line 2: Change indicator - COLORED */}
      <span className={`index-rating-change ${tickColorClass}`}>
        {symbol} {formatChange(change)}
        {!compact && changePercent !== null && (
          <span className="index-rating-percent">({formatPercent(changePercent)})</span>
        )}
      </span>
    </div>
  );
}

// =============================================================================
// SUPPORTING COMPONENTS
// =============================================================================

/**
 * Green glowing up arrow shown when provider climbed in rankings (within 24h).
 * Uses rank-up-arrow CSS class for pulsing glow animation.
 * 
 * Display location: Provider column, after API/Affiliate emojis
 * Duration: 24 hours from moment of rank change
 * 
 * @see docs/authority/index-rating.md § Rank Change Indicator
 */
export function RankUpArrow({ show, className = '' }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span 
      className={`rank-up-arrow ${className}`} 
      title="Climbed in rankings (24h)"
      aria-label="Climbed in rankings"
    >
      ⬆
    </span>
  );
}

/**
 * Underdog badge shown for providers with MPI < 3.0.
 * These providers get more points per engagement (underdog boost).
 */
export function UnderdogBadge({ show, className = '' }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span 
      className={className} 
      title="Rising platform — scores adjusted for fair competition"
      aria-label="Underdog badge"
    >
      🌱
    </span>
  );
}

/**
 * Newcomer badge shown for providers less than 12 months old.
 * These providers benefit from newcomer K-factor multiplier.
 */
export function NewcomerBadge({ show, className = '' }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span 
      className={className} 
      title="New platform — less than 12 months old"
      aria-label="Newcomer badge"
    >
      🆕
    </span>
  );
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default IndexRatingCell;
