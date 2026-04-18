// src/components/prompt-lab/algorithm-cycling.tsx
// ============================================================================
// AlgorithmCycling — Optimisation Animation Display
// ============================================================================
// Visual component that renders the algorithm name cycling animation
// during Call 3 (AI prompt optimisation).
//
// Consumes the animation state from useAiOptimisation hook:
//   animationPhase: 'idle' | 'cycling' | 'decelerating' | 'landing' | 'complete'
//   currentAlgorithm: string | null
//   algorithmCount: number | null
//
// Human factors:
//   §3 Anticipatory Dopamine — three-phase pattern:
//       Awareness (amber cycling → "something is being processed")
//       Acceleration (deceleration phase → "it's almost done")
//       Payoff (emerald landing → family-specific completion message)
//   §6 Temporal Compression — rapid text changes occupy working memory,
//       making 2–4 second wait feel shorter than clock time.
//   §17 Colour Psychology — amber = anticipation/warmth (cycling),
//       emerald = success/"go" (landing). Max 2 accent colours.
//   §18 Animation as Communication — answers "Is something happening?"
//       with rapid text changes + pulsing glow (Progress indicator).
//   §12 Von Restorff Effect — emerald landing message isolates from
//       preceding amber text, making it unmissable.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - Co-located animations in <style dangerouslySetInnerHTML> (§6.2)
//   - No grey text — amber-300/emerald-400/white only (memory: no grey rule)
//   - No opacity-based state dimming (§6.0.3)
//   - prefers-reduced-motion respected (§18 human-factors)
//   - Desktop-only — no mobile breakpoints
//
// Authority: ai-disguise.md §8 (Algorithm Cycling Animation System)
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import React from 'react';
import type { AnimationPhase } from '@/hooks/use-ai-optimisation';

// ============================================================================
// CO-LOCATED STYLES (code-standard.md §6.2)
// ============================================================================

const CYCLING_STYLES = `
  @keyframes alg-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.15); }
    50% { box-shadow: 0 0 12px 4px rgba(251, 191, 36, 0.08); }
  }
  @keyframes alg-pulse-emerald {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.15); }
    50% { box-shadow: 0 0 12px 4px rgba(52, 211, 153, 0.08); }
  }
  @keyframes alg-text-enter {
    from { opacity: 0; transform: translateY(2px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes alg-landing-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.04); }
    100% { transform: scale(1); }
  }
  @keyframes alg-glow-sweep {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  .alg-cycling {
    animation: alg-pulse 1.4s ease-in-out infinite;
  }
  .alg-decel {
    animation: alg-pulse-emerald 1.8s ease-in-out infinite;
  }
  .alg-text {
    animation: alg-text-enter 0.12s ease-out;
  }
  .alg-landing {
    animation: alg-landing-pop 0.3s ease-out;
  }
  .alg-sweep {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(251, 191, 36, 0.06) 40%,
      rgba(52, 211, 153, 0.06) 60%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: alg-glow-sweep 2.5s linear infinite;
  }

  /* §18 human-factors: prefers-reduced-motion — replace motion with opacity */
  @media (prefers-reduced-motion: reduce) {
    .alg-cycling,
    .alg-decel {
      animation: none;
    }
    .alg-text {
      animation: none;
      opacity: 1;
    }
    .alg-landing {
      animation: none;
    }
    .alg-sweep {
      animation: none;
      background: rgba(251, 191, 36, 0.04);
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface AlgorithmCyclingProps {
  /** Current animation phase from useAiOptimisation */
  animationPhase: AnimationPhase;
  /** Current algorithm name being displayed */
  currentAlgorithm: string | null;
  /** Final algorithm count (set during landing phase) */
  algorithmCount: number | null;
  /** Optional className for outer container */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AlgorithmCycling({
  animationPhase,
  currentAlgorithm,
  algorithmCount: _algorithmCount,
  className = '',
}: AlgorithmCyclingProps) {
  // Don't render when idle or complete
  if (animationPhase === 'idle' || animationPhase === 'complete') {
    return null;
  }

  // ── Phase-specific styles ────────────────────────────────────────
  const isLanding = animationPhase === 'landing';
  const isDecel = animationPhase === 'decelerating';
  const isCycling = animationPhase === 'cycling';

  // §17 Colour Psychology: amber = anticipation (cycling), emerald = success (landing)
  const textColour = isLanding
    ? '#34D399'   // emerald-400 — success, "go"
    : isDecel
      ? '#6EE7B7' // emerald-300 — transitioning toward success
      : '#FCD34D'; // amber-300 — warmth, anticipation

  const iconColour = isLanding
    ? '#34D399'
    : '#FBBF24';  // amber-400

  const borderColour = isLanding
    ? 'rgba(52, 211, 153, 0.25)'  // emerald
    : 'rgba(251, 191, 36, 0.15)'; // amber

  const bgColour = isLanding
    ? 'rgba(6, 78, 59, 0.15)'     // emerald-950
    : 'rgba(120, 53, 15, 0.1)';   // amber-950

  // Container animation class
  const pulseClass = isLanding
    ? ''
    : isDecel
      ? 'alg-decel'
      : 'alg-cycling';

  const sweepClass = !isLanding ? 'alg-sweep' : '';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CYCLING_STYLES }} />
      <div
        className={`${pulseClass} ${sweepClass} ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(8px, 0.8vw, 12px)',
          padding: 'clamp(8px, 0.7vw, 12px) clamp(12px, 1.2vw, 18px)',
          borderRadius: 'clamp(6px, 0.5vw, 8px)',
          border: `1px solid ${borderColour}`,
          backgroundColor: bgColour,
          transition: 'border-color 0.4s ease, background-color 0.4s ease',
          minHeight: 'clamp(36px, 3vw, 44px)',
          overflow: 'hidden',
        }}
        role="status"
        aria-live="polite"
        aria-label={
          isLanding
            ? `Optimisation complete. ${currentAlgorithm ?? 'Processing finished.'}`
            : `Processing: ${currentAlgorithm ?? 'Analysing prompt...'}`
        }
      >
        {/* ── Icon: gear (cycling) or checkmark (landing) ──────────── */}
        <span
          style={{
            fontSize: 'clamp(0.8rem, 0.85vw, 1rem)',
            color: iconColour,
            flexShrink: 0,
            transition: 'color 0.4s ease',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {isLanding ? '✓' : '⚙'}
        </span>

        {/* ── Algorithm name text ──────────────────────────────────── */}
        {currentAlgorithm && (
          <span
            key={currentAlgorithm}
            className={isLanding ? 'alg-landing' : 'alg-text'}
            style={{
              fontSize: 'clamp(0.68rem, 0.72vw, 0.82rem)',
              fontWeight: isLanding ? 600 : 400,
              color: textColour,
              letterSpacing: isLanding ? '0.01em' : '0.02em',
              fontFamily: isCycling
                ? "'SF Mono', 'Fira Code', 'Cascadia Code', monospace"
                : 'inherit',
              transition: 'color 0.3s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentAlgorithm}
            {/* Trailing ellipsis for cycling/decel phases (not landing) */}
            {!isLanding && (
              <span
                style={{
                  color: isDecel
                    ? 'rgba(110, 231, 183, 0.5)' // emerald-300/50
                    : 'rgba(252, 211, 77, 0.4)',  // amber-300/40
                }}
              >
                ...
              </span>
            )}
          </span>
        )}
      </div>
    </>
  );
}

export default AlgorithmCycling;
