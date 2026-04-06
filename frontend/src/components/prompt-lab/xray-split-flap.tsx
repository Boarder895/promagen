// src/components/prompt-lab/xray-split-flap.tsx
// ============================================================================
// XRAY SPLIT-FLAP — Mechanical Counter Display
// ============================================================================
// Displays a number that "flips" to its target value like an airport
// departure board. Each digit rotates independently on its X-axis.
//
// Used in the Switchboard (Phase 2) for word counts and the Alignment
// (Phase 3) for character/token counts.
//
// Human factors:
//   §3 Anticipatory Dopamine — digits flipping builds micro-anticipation
//       for the final number.
//   §18 Animation as Communication — answers "what just changed?" with
//       visible digit transitions.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - Co-located flip animation (§6.2)
//   - prefers-reduced-motion: show final value instantly (§14.1)
//   - Monospace font with amber glow (righthand-rail.md §12)
//
// Authority: docs/authority/righthand-rail.md v1.2.0 §9
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const SPLIT_FLAP_STYLES = `
  @keyframes xray-digit-flip {
    0% { transform: rotateX(0deg); opacity: 1; }
    45% { transform: rotateX(-90deg); opacity: 0; }
    55% { transform: rotateX(90deg); opacity: 0; }
    100% { transform: rotateX(0deg); opacity: 1; }
  }
  .xray-digit-flipping {
    animation: xray-digit-flip 0.15s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .xray-digit-flipping {
      animation: none !important;
      transform: none !important;
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface XRaySplitFlapProps {
  /** Target number to display */
  value: number;
  /** Number of digits to pad to (default: 3, shows "042") */
  digits?: number;
  /** Suffix text after the number (e.g., " words") */
  suffix?: string;
  /** Duration of the count-up in ms (default: 600) */
  duration?: number;
  /** Delay before counting starts in ms (default: 0) */
  delay?: number;
  /** Text colour (default: warm amber) */
  color?: string;
  /** Font size as clamp() value */
  fontSize?: string;
  /** Generation ID for cancellation */
  generationId?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function XRaySplitFlap({
  value,
  digits = 3,
  suffix = '',
  duration = 600,
  delay = 0,
  color = '#FCD34D',
  fontSize = 'clamp(0.65rem, 0.8vw, 0.875rem)',
  generationId = 0,
}: XRaySplitFlapProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const genRef = useRef(generationId);

  // Check reduced motion
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    genRef.current = generationId;
    setDisplayValue(0);
    setIsFlipping(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (value === 0) return;

    // Reduced motion: show final value instantly
    if (prefersReduced.current) {
      timerRef.current = setTimeout(() => {
        if (genRef.current !== generationId) return;
        setDisplayValue(value);
      }, delay);
      return;
    }

    // Animated count-up
    timerRef.current = setTimeout(() => {
      if (genRef.current !== generationId) return;
      setIsFlipping(true);
      const startTime = performance.now();

      const tick = (now: number) => {
        if (genRef.current !== generationId) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out: fast start, slow finish
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * value);
        setDisplayValue(current);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setIsFlipping(false);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay, generationId]);

  // Pad to digit count
  const padded = String(displayValue).padStart(digits, '0');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPLIT_FLAP_STYLES }} />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '1px',
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize,
          fontWeight: 400,
          color,
          lineHeight: 1,
          textShadow: `0 0 6px rgba(251, 191, 36, 0.3)`,
          perspective: '200px',
        }}
        aria-label={`${value}${suffix}`}
      >
        {padded.split('').map((digit, idx) => (
          <span
            key={`${idx}-${digit}`}
            className={isFlipping ? 'xray-digit-flipping' : ''}
            style={{
              display: 'inline-block',
              minWidth: '0.6em',
              textAlign: 'center',
              transformStyle: 'preserve-3d',
            }}
          >
            {digit}
          </span>
        ))}
        {suffix && (
          <span
            style={{
              fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
              color: '#FFFFFF', // white — no muted text
              marginLeft: 'clamp(2px, 0.2vw, 4px)',
              fontFamily: 'inherit',
            }}
          >
            {suffix}
          </span>
        )}
      </span>
    </>
  );
}

export default XRaySplitFlap;
