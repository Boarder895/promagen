// src/components/ux/feedback-memory-banner.tsx
// ============================================================================
// FEEDBACK MEMORY BANNER — Contextual overlap messages
// ============================================================================
//
// Phase 7.10g — Shows a micro-summary when current selections overlap with
// previously rated prompts. Creates a dopamine loop: users see that their
// feedback is remembered and used.
//
// Examples:
//   👍 "Your last Midjourney prompt with 'cinematic lighting + bokeh' scored 👍"
//   👎 "Heads up: 'watercolor + hyperrealistic' missed on DALL·E 3"
//
// Animations live in <style> JSX per code-standard.md.
// All sizing uses clamp() — zero fixed px/rem.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10g
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { FeedbackOverlap } from '@/hooks/use-feedback-memory';

// ============================================================================
// TYPES
// ============================================================================

export interface FeedbackMemoryBannerProps {
  /** The detected overlap (null = don't render) */
  overlap: FeedbackOverlap | null;
  /** Platform display name (e.g. "Midjourney") */
  platformName: string;
  /** User tier for encouragement message differentiation */
  userTier?: string | null;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FeedbackMemoryBanner({
  overlap,
  platformName,
  userTier,
  onDismiss,
}: FeedbackMemoryBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Animate in when overlap detected
  useEffect(() => {
    if (overlap && !dismissed) {
      // Small delay so it feels reactive, not instant
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [overlap, dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!overlap || dismissed) return null;

  const isPositive = overlap.rating === 'positive';
  const isNegative = overlap.rating === 'negative';

  // Format overlapping terms: "term1 + term2" (max 3 shown)
  const termDisplay = overlap.overlappingTerms
    .slice(0, 3)
    .map((t) => `'${t}'`)
    .join(' + ');
  const moreCount = overlap.overlappingTerms.length - 3;

  // Build message
  let emoji: string;
  let message: string;
  if (isPositive) {
    emoji = '👍';
    message = `Your last ${platformName} prompt with ${termDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''} scored ${emoji} — similar setup detected`;
  } else if (isNegative) {
    emoji = '👎';
    message = `Heads up: ${termDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''} missed on ${platformName} — consider alternatives`;
  } else {
    // Neutral — still show but softer
    emoji = '👌';
    message = `You've used ${termDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''} on ${platformName} before — rated as okay`;
  }

  // Tier-aware encouragement suffix
  const encouragement =
    userTier === 'paid'
      ? 'Pro feedback — weighted 1.25× in our learning engine.'
      : 'Your feedback helps Promagen learn.';

  // Colour scheme
  const borderColor = isPositive
    ? 'rgba(34, 197, 94, 0.4)'  // green
    : isNegative
      ? 'rgba(251, 191, 36, 0.4)' // amber
      : 'rgba(148, 163, 184, 0.3)'; // slate

  const bgColor = isPositive
    ? 'rgba(34, 197, 94, 0.08)'
    : isNegative
      ? 'rgba(251, 191, 36, 0.08)'
      : 'rgba(148, 163, 184, 0.06)';

  const textColor = isPositive
    ? 'rgb(187, 247, 208)' // green-200
    : isNegative
      ? 'rgb(253, 230, 138)' // amber-200
      : 'rgb(203, 213, 225)'; // slate-300

  return (
    <>
      <style>{`
        @keyframes fb-mem-fadeIn {
          from { opacity: 0; transform: translateY(clamp(4px, 0.3vw, 8px)); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fb-mem-fade-in {
          animation: fb-mem-fadeIn 250ms ease-out forwards;
        }
      `}</style>

      <div
        role="status"
        aria-live="polite"
        data-testid="feedback-memory-banner"
        className={visible ? 'fb-mem-fade-in' : ''}
        style={{
          opacity: visible ? undefined : 0,
          border: `1px solid ${borderColor}`,
          backgroundColor: bgColor,
          borderRadius: 'clamp(6px, 0.5vw, 10px)',
          padding: 'clamp(6px, 0.5vw, 10px) clamp(10px, 0.8vw, 14px)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'clamp(6px, 0.5vw, 10px)',
          position: 'relative',
        }}
      >
        {/* Emoji indicator */}
        <span
          style={{
            fontSize: 'clamp(14px, 1.1vw, 18px)',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {isNegative ? '⚠️' : isPositive ? '✨' : '💡'}
        </span>

        {/* Message body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            data-testid="feedback-memory-message"
            style={{
              margin: 0,
              fontSize: 'clamp(11px, 0.8vw, 13px)',
              lineHeight: 1.4,
              color: textColor,
            }}
          >
            {message}
          </p>
          <p
            style={{
              margin: `clamp(2px, 0.2vw, 4px) 0 0`,
              fontSize: 'clamp(9px, 0.65vw, 11px)',
              lineHeight: 1.3,
              color: 'rgba(148, 163, 184, 0.7)',
            }}
          >
            {encouragement}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          data-testid="feedback-memory-dismiss"
          aria-label="Dismiss feedback memory hint"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(148, 163, 184, 0.6)',
            cursor: 'pointer',
            padding: 'clamp(2px, 0.15vw, 4px)',
            fontSize: 'clamp(12px, 0.9vw, 16px)',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </>
  );
}

export default FeedbackMemoryBanner;
