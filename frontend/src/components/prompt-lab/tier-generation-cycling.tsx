// src/components/prompt-lab/tier-generation-cycling.tsx
// ============================================================================
// TierGenerationCycling — Algorithm Cycling During Tier Generation (Call 2)
// ============================================================================
// Self-contained component that cycles through algorithm names while
// Call 2 (tier generation) is in progress. Two improvements over v1:
//
// 1. LANDING MESSAGE — when generation completes, briefly flashes
//    "✓ Analysis complete" in emerald before disappearing. Matches
//    the Call 3 AlgorithmCycling landing pattern.
//
// 2. CATEGORY-AWARE CYCLING — when activeCategories are passed,
//    every 3rd cycling step shows a name specific to one of the
//    user's detected categories. Makes the cycling feel responsive
//    to the specific prompt.
//
// Human factors:
//   §3 Anticipatory Dopamine — cycling → landing = expectation→reward
//   §6 Temporal Compression — reading speed occupies working memory
//   §1 Curiosity Gap — category-specific names deepen engagement
//   §12 Von Restorff Effect — emerald landing isolates from amber
//   §18 Animation as Communication — answers "Is something happening?"
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - Co-located animations in <style dangerouslySetInnerHTML> (§6.2)
//   - No grey text — amber-300/emerald-400/white only
//   - Desktop-only — no mobile breakpoints
//
// Authority: ai-disguise.md §8, §9
// Existing features preserved: Yes.
// ============================================================================

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { shuffleCategoryAware, getAlgorithmCount } from '@/data/algorithm-names';

// ============================================================================
// CO-LOCATED STYLES (code-standard.md §6.2)
// ============================================================================

const TIER_CYCLING_STYLES = `
  @keyframes tcyc-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.12); }
    50% { box-shadow: 0 0 10px 3px rgba(251, 191, 36, 0.06); }
  }
  @keyframes tcyc-pulse-emerald {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.15); }
    50% { box-shadow: 0 0 12px 4px rgba(52, 211, 153, 0.08); }
  }
  @keyframes tcyc-text-swap {
    from { opacity: 0; transform: translateY(1px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes tcyc-sweep {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes tcyc-landing-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.04); }
    100% { transform: scale(1); }
  }

  .tcyc-container {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(251, 191, 36, 0.04) 40%,
      rgba(251, 191, 36, 0.02) 60%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: tcyc-pulse 1.4s ease-in-out infinite, tcyc-sweep 3s linear infinite;
  }
  .tcyc-container-landing {
    animation: tcyc-pulse-emerald 1.8s ease-in-out infinite;
  }
  .tcyc-name {
    animation: tcyc-text-swap 0.1s ease-out;
  }
  .tcyc-landing-text {
    animation: tcyc-landing-pop 0.3s ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .tcyc-container,
    .tcyc-container-landing {
      animation: none;
      background: rgba(251, 191, 36, 0.03);
    }
    .tcyc-name,
    .tcyc-landing-text {
      animation: none;
    }
  }
`;

// ============================================================================
// TIMING
// ============================================================================

/** Cycling interval range (ms) — randomised each step for organic feel */
const CYCLE_MIN_MS = 140;
const CYCLE_MAX_MS = 190;

/** How long the emerald landing message stays visible (ms) */
const LANDING_DISPLAY_MS = 800;

// ============================================================================
// INTERNAL PHASE — state machine for this component only
// ============================================================================

type CyclingPhase = 'idle' | 'cycling' | 'landing';

// ============================================================================
// COMPONENT
// ============================================================================

interface TierGenerationCyclingProps {
  /** Whether tier generation (Call 2) is in progress */
  isActive: boolean;
  /** Category names populated by Call 1 (e.g., ["subject", "lighting", "colour"]) */
  activeCategories?: string[];
}

export function TierGenerationCycling({
  isActive,
  activeCategories = [],
}: TierGenerationCyclingProps) {
  const [phase, setPhase] = useState<CyclingPhase>('idle');
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [landingCount, setLandingCount] = useState<number | null>(null);

  const shuffledRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const wasActiveRef = useRef(false);
  const activeCatsRef = useRef<string[]>(activeCategories);

  // Keep category ref in sync without re-triggering effects
  activeCatsRef.current = activeCategories;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Cycling tick function ──────────────────────────────────────────
  const tick = useCallback(() => {
    if (!mountedRef.current) return;

    const names = shuffledRef.current;
    if (names.length === 0) return;

    const name = names[indexRef.current % names.length];
    if (name) setCurrentName(name);
    indexRef.current++;

    // Random interval for organic feel — not metronomic
    const delay = CYCLE_MIN_MS + Math.floor(Math.random() * (CYCLE_MAX_MS - CYCLE_MIN_MS + 1));
    timerRef.current = setTimeout(tick, delay);
  }, []);

  // ── Main state machine effect ──────────────────────────────────────
  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;

    // ── TRANSITION: inactive → active = START CYCLING ──
    if (isActive && !wasActive) {
      if (timerRef.current) clearTimeout(timerRef.current);

      // Build category-aware shuffled sequence
      shuffledRef.current = shuffleCategoryAware(activeCatsRef.current);
      indexRef.current = 0;
      setLandingCount(null);
      setPhase('cycling');

      // Start ticking
      tick();
      return;
    }

    // ── TRANSITION: active → inactive = ENTER LANDING ──
    if (!isActive && wasActive) {
      // Stop the cycling timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Show landing message
      const count = getAlgorithmCount();
      setLandingCount(count);
      setCurrentName(`✓ ${count} algorithms applied`);
      setPhase('landing');

      // Hold the landing for LANDING_DISPLAY_MS then go idle
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setPhase('idle');
        setCurrentName(null);
        setLandingCount(null);
      }, LANDING_DISPLAY_MS);
      return;
    }

    // ── STEADY STATE: still inactive, nothing to do ──
    // (still active is handled by the running tick timer)
  }, [isActive, tick]);

  // ── Don't render when idle ─────────────────────────────────────────
  if (phase === 'idle' || !currentName) return null;

  // ── Phase-specific styling ─────────────────────────────────────────
  const isLanding = phase === 'landing';

  const containerClass = isLanding ? 'tcyc-container-landing' : 'tcyc-container';
  const textClass = isLanding ? 'tcyc-landing-text' : 'tcyc-name';

  const textColour = isLanding ? '#34D399' : '#FCD34D';
  const iconColour = isLanding ? '#34D399' : '#FBBF24';
  const borderColour = isLanding
    ? 'rgba(52, 211, 153, 0.25)'
    : 'rgba(251, 191, 36, 0.12)';
  const bgColour = isLanding
    ? 'rgba(6, 78, 59, 0.15)'
    : 'rgba(120, 53, 15, 0.08)';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TIER_CYCLING_STYLES }} />
      <div
        className={containerClass}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 0.6vw, 10px)',
          padding: 'clamp(6px, 0.55vw, 10px) clamp(10px, 1vw, 16px)',
          borderRadius: 'clamp(6px, 0.5vw, 8px)',
          border: `1px solid ${borderColour}`,
          backgroundColor: bgColour,
          minHeight: 'clamp(32px, 2.6vw, 40px)',
          overflow: 'hidden',
          transition: 'border-color 0.4s ease, background-color 0.4s ease',
        }}
        role="status"
        aria-live="polite"
        aria-label={
          isLanding
            ? `Analysis complete. ${landingCount ?? 97} algorithms applied.`
            : `Processing: ${currentName}`
        }
      >
        {/* Icon: gear (cycling) or checkmark (landing) */}
        <span
          style={{
            fontSize: 'clamp(0.7rem, 0.75vw, 0.9rem)',
            color: iconColour,
            flexShrink: 0,
            lineHeight: 1,
            transition: 'color 0.4s ease',
          }}
          aria-hidden="true"
        >
          {isLanding ? '✓' : '⚙'}
        </span>

        {/* Algorithm name — key forces re-mount for animation */}
        <span
          key={currentName}
          className={textClass}
          style={{
            fontSize: 'clamp(0.62rem, 0.66vw, 0.76rem)',
            fontWeight: isLanding ? 600 : 400,
            color: textColour,
            letterSpacing: isLanding ? '0.01em' : '0.02em',
            fontFamily: isLanding
              ? 'inherit'
              : "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'color 0.3s ease',
          }}
        >
          {currentName}
          {/* Trailing ellipsis during cycling only */}
          {!isLanding && (
            <span style={{ color: 'rgba(252, 211, 77, 0.35)' }}>...</span>
          )}
        </span>
      </div>
    </>
  );
}

export default TierGenerationCycling;
