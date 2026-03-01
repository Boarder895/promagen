'use client';

// src/components/ux/feedback-invitation.tsx
// ============================================================================
// FEEDBACK INVITATION WIDGET — 👍👌👎 Rating UI
// ============================================================================
//
// Phase 7.10c — User-facing feedback collection widget.
//
// Three-button rating system that appears after a prompt is copied.
// Designed for minimal friction: one click, instant visual confirmation,
// auto-dismiss after 1.5 seconds.
//
// Visual design:
//   - Smooth slide-in from bottom (CSS transform + opacity)
//   - Three large tap-target buttons: 👍 Nailed it / 👌 Just okay / 👎 Missed
//   - Success state: selected button scales + checkmark + "Thanks!" text
//   - Dismiss (✕) records cooldown, prevents re-showing for 24h
//   - All sizing uses clamp() — no fixed px/rem values
//
// Animations:
//   - All @keyframes live in this file via <style> JSX — NOT globals.css
//   - Slide-in, success-pop, fade-out are component-scoped
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10c
//
// Version: 1.0.0 — Phase 7.10c Feedback Invitation Widget
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedbackRating } from '@/types/feedback';
import {
  sendFeedback,
  clearFeedbackPending,
  recordDismissal,
} from '@/lib/feedback/feedback-client';
import type {
  FeedbackPendingData,
  FeedbackUserContext,
} from '@/lib/feedback/feedback-client';

// ============================================================================
// TYPES
// ============================================================================

export interface FeedbackInvitationProps {
  /** Pending feedback metadata from sessionStorage */
  pending: FeedbackPendingData;
  /** User context for credibility scoring (all optional) */
  userContext?: FeedbackUserContext;
  /** Callback after feedback submitted or dismissed — parent clears state.
   *  Receives the rating if submitted, undefined if dismissed. */
  onComplete: (rating?: FeedbackRating) => void;
}

// ============================================================================
// RATING BUTTON CONFIG
// ============================================================================

interface RatingOption {
  rating: FeedbackRating;
  emoji: string;
  label: string;
}

const RATING_OPTIONS: readonly RatingOption[] = [
  { rating: 'positive', emoji: '👍', label: 'Nailed it' },
  { rating: 'neutral', emoji: '👌', label: 'Just okay' },
  { rating: 'negative', emoji: '👎', label: 'Missed' },
] as const;

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/** How long to show "Thanks!" before auto-dismiss (ms) */
const THANKS_DISPLAY_MS = 1_500;

/** Slide-in animation duration (ms) — matches CSS */
const SLIDE_IN_MS = 300;

// ============================================================================
// COMPONENT
// ============================================================================

type WidgetPhase = 'entering' | 'idle' | 'submitted' | 'exiting';

export default function FeedbackInvitation({
  pending,
  userContext,
  onComplete,
}: FeedbackInvitationProps) {
  const [phase, setPhase] = useState<WidgetPhase>('entering');
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(
    null,
  );
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Enter animation: 'entering' → 'idle' after slide-in completes ---
  useEffect(() => {
    const timer = setTimeout(() => setPhase('idle'), SLIDE_IN_MS);
    return () => clearTimeout(timer);
  }, []);

  // --- Auto-dismiss after "Thanks!" ---
  useEffect(() => {
    if (phase === 'submitted') {
      dismissTimerRef.current = setTimeout(() => {
        setPhase('exiting');
      }, THANKS_DISPLAY_MS);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [phase]);

  // --- Exit animation complete → call parent with rating ---
  useEffect(() => {
    if (phase === 'exiting') {
      const timer = setTimeout(() => {
        onComplete(selectedRating ?? undefined);
      }, SLIDE_IN_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete, selectedRating]);

  // --- Rate handler ---
  const handleRate = useCallback(
    (rating: FeedbackRating) => {
      if (phase !== 'idle' && phase !== 'entering') return;
      setSelectedRating(rating);
      setPhase('submitted');
      // Fire-and-forget — never blocks the UI
      void sendFeedback(rating, pending, userContext);
    },
    [phase, pending, userContext],
  );

  // --- Dismiss handler ---
  const handleDismiss = useCallback(() => {
    recordDismissal();
    clearFeedbackPending();
    setPhase('exiting');
  }, []);

  // --- Phase → CSS class mapping ---
  const containerClass =
    phase === 'entering'
      ? 'fb-inv-slide-in'
      : phase === 'exiting'
        ? 'fb-inv-slide-out'
        : '';

  return (
    <>
      {/* ================================================================
          SCOPED KEYFRAMES — lives in this component, not globals.css
          ================================================================ */}
      <style>{`
        @keyframes fb-inv-slideUp {
          from {
            opacity: 0;
            transform: translateY(clamp(12px, 1.2vw, 20px));
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fb-inv-slideDown {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(clamp(12px, 1.2vw, 20px));
          }
        }
        @keyframes fb-inv-successPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .fb-inv-slide-in {
          animation: fb-inv-slideUp ${SLIDE_IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .fb-inv-slide-out {
          animation: fb-inv-slideDown ${SLIDE_IN_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }
        .fb-inv-success-pop {
          animation: fb-inv-successPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <div
        data-testid="feedback-invitation"
        role="region"
        aria-label="Rate this prompt"
        className={containerClass}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(6px, 0.5vw, 10px)',
          padding: 'clamp(10px, 1vw, 18px) clamp(14px, 1.4vw, 24px)',
          borderRadius: 'clamp(10px, 0.8vw, 16px)',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative',
          width: '100%',
          maxWidth: 'clamp(280px, 26vw, 420px)',
          margin: '0 auto',
        }}
      >
        {/* --- Dismiss button (✕) --- */}
        {phase !== 'submitted' && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss feedback"
            data-testid="feedback-dismiss"
            style={{
              position: 'absolute',
              top: 'clamp(6px, 0.5vw, 10px)',
              right: 'clamp(8px, 0.6vw, 12px)',
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.35)',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 1vw, 18px)',
              lineHeight: 1,
              padding: 'clamp(2px, 0.2vw, 4px)',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'rgba(255, 255, 255, 0.7)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'rgba(255, 255, 255, 0.35)';
            }}
          >
            ✕
          </button>
        )}

        {/* --- Subtitle --- */}
        <p
          style={{
            margin: 0,
            fontSize: 'clamp(11px, 0.75vw, 14px)',
            color: 'rgba(255, 255, 255, 0.50)',
            letterSpacing: '0.01em',
            textAlign: 'center',
          }}
        >
          {phase === 'submitted'
            ? 'Thanks! Your feedback helps Promagen learn.'
            : 'Rate how the AI image matched your vision'}
        </p>

        {/* --- Rating buttons or success state --- */}
        {phase === 'submitted' && selectedRating ? (
          <div
            className="fb-inv-success-pop"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(6px, 0.5vw, 10px)',
            }}
          >
            <span
              style={{
                fontSize: 'clamp(22px, 1.8vw, 36px)',
              }}
              role="img"
              aria-label={`You rated: ${selectedRating}`}
            >
              {RATING_OPTIONS.find((r) => r.rating === selectedRating)?.emoji}
            </span>
            <span
              style={{
                fontSize: 'clamp(13px, 0.9vw, 16px)',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
              }}
            >
              ✓{' '}
              {RATING_OPTIONS.find((r) => r.rating === selectedRating)?.label}
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 'clamp(8px, 0.7vw, 14px)',
            }}
          >
            {RATING_OPTIONS.map((option) => (
              <RatingButton
                key={option.rating}
                option={option}
                disabled={phase === 'exiting'}
                onClick={() => handleRate(option.rating)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// RATING BUTTON — extracted for hover state management
// ============================================================================

interface RatingButtonProps {
  option: RatingOption;
  disabled: boolean;
  onClick: () => void;
}

function RatingButton({ option, disabled, onClick }: RatingButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={`feedback-btn-${option.rating}`}
      aria-label={`Rate: ${option.label}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(2px, 0.2vw, 4px)',
        padding: 'clamp(8px, 0.7vw, 14px) clamp(12px, 1vw, 20px)',
        borderRadius: 'clamp(8px, 0.6vw, 12px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        background: hovered
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(255, 255, 255, 0.03)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms ease, transform 100ms ease',
        transform: hovered && !disabled ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      <span
        style={{
          fontSize: 'clamp(20px, 1.6vw, 32px)',
          lineHeight: 1,
        }}
        role="img"
        aria-hidden="true"
      >
        {option.emoji}
      </span>
      <span
        style={{
          fontSize: 'clamp(10px, 0.7vw, 13px)',
          color: 'rgba(255, 255, 255, 0.60)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {option.label}
      </span>
    </button>
  );
}
