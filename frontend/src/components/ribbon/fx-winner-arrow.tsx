'use client';

import * as React from 'react';

import type { FxWinnerSide } from '@/hooks/use-fx-quotes';

export type FxWinnerArrowSide = 'left' | 'right' | 'off';

export type FxWinnerArrowProps = {
  winnerSide: FxWinnerSide;

  /** 0..1 confidence => opacity */
  opacity: number;

  /**
   * Confirmation delay before showing/flipping.
   * Spec: ~500–800ms. Default 650ms.
   */
  confirmDelayMs?: number;

  /** Micro choreography: fade out -> reposition -> fade in */
  fadeOutMs?: number;
  settleMs?: number;

  /** Optional hover explanation (desktop only) */
  hoverText?: string | null;

  /**
   * Calm Mode (global pause): pause the arrow "life" animation only.
   * (Decision/timing stays identical; this is visual-only.)
   */
  isPaused?: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toArrowSide(winnerSide: FxWinnerSide): FxWinnerArrowSide {
  if (winnerSide === 'base') return 'left';
  if (winnerSide === 'quote') return 'right';
  return 'off';
}

function canHoverDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function FxWinnerArrow({
  winnerSide,
  opacity,
  confirmDelayMs = 650,
  fadeOutMs = 160,
  settleMs = 40,
  hoverText = null,
  isPaused = false,
}: FxWinnerArrowProps) {
  const desiredSide = toArrowSide(winnerSide);
  const desiredOpacity = clamp01(opacity);

  // Visual state we actually render (can lag intentionally)
  const [side, setSide] = React.useState<FxWinnerArrowSide>(desiredSide);
  const [isVisible, setIsVisible] = React.useState<boolean>(desiredSide !== 'off');
  const [liveOpacity, setLiveOpacity] = React.useState<number>(
    desiredSide !== 'off' ? desiredOpacity : 0,
  );

  const timers = React.useRef<number[]>([]);
  const lastStable = React.useRef<{ side: FxWinnerArrowSide; opacity: number }>({
    side: desiredSide,
    opacity: desiredSide !== 'off' ? desiredOpacity : 0,
  });

  const firstRender = React.useRef(true);

  const clearTimers = React.useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  React.useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  React.useEffect(() => {
    // On first render, render immediately (no "confirmation delay" on initial load)
    if (firstRender.current) {
      firstRender.current = false;
      setSide(desiredSide);
      setIsVisible(desiredSide !== 'off');
      setLiveOpacity(desiredSide !== 'off' ? desiredOpacity : 0);
      lastStable.current = {
        side: desiredSide,
        opacity: desiredSide !== 'off' ? desiredOpacity : 0,
      };
      return;
    }

    // If side doesn't change, just update opacity (confidence) smoothly
    if (side === desiredSide) {
      const nextOpacity = desiredSide !== 'off' ? desiredOpacity : 0;
      setLiveOpacity(nextOpacity);
      lastStable.current = { side: desiredSide, opacity: nextOpacity };
      return;
    }

    clearTimers();

    // 1) Confirmation delay (feels "earned", not twitchy)
    const t1 = window.setTimeout(() => {
      // 2) Fade out
      setIsVisible(false);
      setLiveOpacity(0);

      // 3) Reposition while hidden
      const t2 = window.setTimeout(() => {
        setSide(desiredSide);

        // tiny settle so layout is stable
        const t3 = window.setTimeout(() => {
          const nextVisible = desiredSide !== 'off';
          const nextOpacity = nextVisible ? desiredOpacity : 0;

          setIsVisible(nextVisible);
          setLiveOpacity(nextOpacity);

          lastStable.current = { side: desiredSide, opacity: nextOpacity };
        }, settleMs);

        timers.current.push(t3);
      }, fadeOutMs);

      timers.current.push(t2);
    }, confirmDelayMs);

    timers.current.push(t1);
  }, [desiredSide, desiredOpacity, clearTimers, side, fadeOutMs, settleMs, confirmDelayMs]);

  const showTooltip = hoverText && canHoverDesktop() && desiredSide !== 'off';

  // Upward-pointing arrow SVG (spec: green arrow pointing up next to winning currency)
  // The arrow always points UP — it indicates "this currency strengthened"
  const arrow = (
    <span
      aria-hidden="true"
      className={[
        'fx-winner-arrow',
        isVisible ? 'fx-winner-arrow--on' : 'fx-winner-arrow--off',
        isVisible && side !== 'off' ? 'fx-winner-arrow--life' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        opacity: isVisible ? liveOpacity : 0,
        animationPlayState: isPaused ? 'paused' : 'running',
      }}
    >
      {/* Upward-pointing arrow: indicates the adjacent currency has strengthened */}
      <svg
        width="0.75em"
        height="0.75em"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        {/* Arrow shaft (vertical) */}
        <path
          d="M12 19V6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Arrow head (pointing up) */}
        <path
          d="M5 12l7-7 7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  if (showTooltip) {
    return (
      <span title={hoverText} aria-label={hoverText}>
        {arrow}
      </span>
    );
  }

  return arrow;
}

export default FxWinnerArrow;
