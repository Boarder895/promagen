// src/components/providers/image-quality-vote-button.tsx
// Animated thumbs-up button for image quality voting

'use client';

import React, { useCallback } from 'react';
import { useImageQualityVote } from '@/hooks/use-image-quality-vote';
import { cn } from '@/lib/cn';

export type ImageQualityVoteButtonProps = {
  providerId: string;
  isAuthenticated?: boolean;
  className?: string;
};

/**
 * Thumbs-up vote button for image quality ranking.
 *
 * Visual states:
 * - Outline thumb: Not yet voted
 * - Filled thumb: Already voted (within 24h)
 * - Bounce animation: On successful vote
 * - Static/dimmed: When daily limit reached or already voted
 *
 * Behavior:
 * - Requires authentication to vote
 * - Max 3 providers per day
 * - 1 vote per provider per 24 hours (rolling)
 * - Silent failure (no error messages)
 */
export function ImageQualityVoteButton({
  providerId,
  isAuthenticated = false,
  className,
}: ImageQualityVoteButtonProps) {
  const { hasVoted, canVoteMore, voteState, vote, isReady } = useImageQualityVote(
    providerId,
    isAuthenticated
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Silent no-op if can't vote
      if (!isAuthenticated || hasVoted || !canVoteMore) {
        return;
      }

      vote();
    },
    [isAuthenticated, hasVoted, canVoteMore, vote]
  );

  // Don't render until hydrated to avoid flash
  if (!isReady) {
    return (
      <span className={cn('vote-thumb vote-thumb--loading', className)}>
        <ThumbIcon filled={false} />
      </span>
    );
  }

  // Determine if button should be interactive
  const isInteractive = isAuthenticated && !hasVoted && canVoteMore;
  const showAnimation = voteState === 'animating';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isInteractive}
      aria-label={
        hasVoted
          ? 'You voted for this provider'
          : isAuthenticated
            ? canVoteMore
              ? 'Vote for this provider'
              : 'Daily vote limit reached'
            : 'Sign in to vote'
      }
      className={cn(
        'vote-thumb',
        hasVoted && 'vote-thumb--voted',
        !isInteractive && 'vote-thumb--disabled',
        showAnimation && 'vote-thumb--animating',
        className
      )}
    >
      <ThumbIcon filled={hasVoted} />
    </button>
  );
}

/**
 * SVG thumb icon - outline or filled based on vote state
 */
function ThumbIcon({ filled }: { filled: boolean }) {
  if (filled) {
    // Filled thumb (voted state)
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
      </svg>
    );
  }

  // Outline thumb (not voted state)
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export default ImageQualityVoteButton;
