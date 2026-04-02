// src/components/prompt-lab/xray-teletype.tsx
// ============================================================================
// XRAY TELETYPE — Mechanical Text Reveal
// ============================================================================
// Characters appear one by one, left to right, with a blinking cursor
// at the leading edge. Used across all three X-Ray phases for summary
// lines and cog descriptions.
//
// Human factors:
//   §1 Curiosity Gap — partial text creates anticipation for the full message.
//   §6 Temporal Compression — reading character-by-character occupies attention.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - Co-located cursor animation (§6.2)
//   - prefers-reduced-motion: 2× speed (§14.1 performance ladder)
//
// Authority: docs/authority/righthand-rail.md v1.2.0 §14
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const TELETYPE_STYLES = `
  @keyframes xray-cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .xray-cursor {
    animation: xray-cursor-blink 530ms step-end infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .xray-cursor {
      animation: none !important;
      opacity: 1 !important;
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface XRayTeletypeProps {
  /** Text to reveal character by character */
  text: string;
  /** Milliseconds per character (default: 25) */
  speed?: number;
  /** Delay before typing starts in ms (default: 0) */
  delay?: number;
  /** Text colour (default: warm amber #FCD34D) */
  color?: string;
  /** Font size as clamp() value */
  fontSize?: string;
  /** Callback when typing completes */
  onComplete?: () => void;
  /** Whether to show the blinking cursor (default: true) */
  showCursor?: boolean;
  /** Generation ID — if this changes, reset and retype (cancellation model) */
  generationId?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function XRayTeletype({
  text,
  speed = 25,
  delay = 0,
  color = '#FCD34D',
  fontSize = 'clamp(10px, 0.65vw, 11px)',
  onComplete,
  showCursor = true,
  generationId = 0,
}: XRayTeletypeProps) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genRef = useRef(generationId);

  // Check reduced motion preference
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Reset when text or generationId changes
  useEffect(() => {
    genRef.current = generationId;
    setVisibleChars(0);
    setIsComplete(false);
    setIsTyping(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!text) return;

    // Reduced motion: show full text immediately at 2× speed minimum
    const effectiveSpeed = prefersReduced.current ? Math.min(speed, 12) : speed;

    // Start typing after delay
    timerRef.current = setTimeout(() => {
      if (genRef.current !== generationId) return; // stale generation
      setIsTyping(true);

      let charIndex = 0;
      const typeNext = () => {
        if (genRef.current !== generationId) return; // cancelled
        charIndex++;
        setVisibleChars(charIndex);

        if (charIndex >= text.length) {
          setIsTyping(false);
          setIsComplete(true);
          onComplete?.();
        } else {
          timerRef.current = setTimeout(typeNext, effectiveSpeed);
        }
      };

      timerRef.current = setTimeout(typeNext, effectiveSpeed);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, generationId, speed, delay, onComplete]);

  const displayText = text.slice(0, visibleChars);
  const showCursorNow = showCursor && isTyping && !isComplete;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TELETYPE_STYLES }} />
      <span
        style={{
          fontSize,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          color,
          letterSpacing: '0.02em',
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        aria-label={text}
        role="status"
      >
        {displayText}
        {showCursorNow && (
          <span
            className="xray-cursor"
            style={{
              color: '#B5972E', // muted amber cursor — visible, not opacity-dimmed
              marginLeft: '1px',
            }}
            aria-hidden="true"
          >
            |
          </span>
        )}
      </span>
    </>
  );
}

export default XRayTeletype;
