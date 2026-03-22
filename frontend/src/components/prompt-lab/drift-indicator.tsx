// src/components/prompt-lab/drift-indicator.tsx
// ============================================================================
// DriftIndicator — Prompt DNA Drift Detection Badge
// ============================================================================
// Shows an amber badge when the user's textarea text has drifted from
// the last-generated text. Displays the number of word-level changes.
//
// Designed to sit adjacent to (or inside) the "Generate Prompt" button
// area in the "Describe Your Image" panel.
//
// Human factors:
//   §4 Zeigarnik Effect — the badge creates a sense of incompleteness.
//       The prompts are "stale" and the brain nags the user to close
//       the loop by regenerating. This keeps users in the
//       generate → review → refine cycle longer.
//   §12 Von Restorff Effect — the amber pulsing dot + badge isolates
//       from the surrounding UI, making the "out of sync" state
//       unmissable without being intrusive.
//   §1 Curiosity Gap — "3 changes detected" implies the new result
//       WILL be different, but the user can't see HOW different until
//       they click Generate. The gap drives the click.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - Co-located animation (§6.2)
//   - No grey text — amber palette only
//   - No opacity dimming (§6.0.3)
//   - prefers-reduced-motion respected (§18)
//
// Authority: ai-disguise.md (Improvement 1 — Prompt DNA Drift Detection)
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import React from 'react';

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const DRIFT_STYLES = `
  @keyframes drift-dot-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
    50% { transform: scale(1.15); box-shadow: 0 0 0 3px rgba(251, 191, 36, 0); }
  }
  .drift-dot {
    animation: drift-dot-pulse 1.6s ease-in-out infinite;
  }
  @keyframes drift-badge-enter {
    from { opacity: 0; transform: translateX(-4px) scale(0.95); }
    to { opacity: 1; transform: translateX(0) scale(1); }
  }
  .drift-badge {
    animation: drift-badge-enter 0.25s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .drift-dot { animation: none; }
    .drift-badge { animation: none; opacity: 1; }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface DriftIndicatorProps {
  /** Whether drift has been detected */
  isDrifted: boolean;
  /** Number of word-level changes */
  changeCount: number;
  /** Optional className for outer container */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DriftIndicator({
  isDrifted,
  changeCount,
  className = '',
}: DriftIndicatorProps) {
  // Don't render when no drift
  if (!isDrifted || changeCount === 0) {
    return null;
  }

  // Pluralise "change" / "changes"
  const label = changeCount === 1 ? '1 change detected' : `${changeCount} changes detected`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DRIFT_STYLES }} />
      <span
        className={`drift-badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'clamp(4px, 0.4vw, 6px)',
        }}
        title="Your description has changed since the last generation. Click Generate Prompt to update."
      >
        {/* Pulsing dot — §12 Von Restorff: isolated amber attention signal */}
        <span
          className="drift-dot"
          style={{
            width: 'clamp(5px, 0.45vw, 7px)',
            height: 'clamp(5px, 0.45vw, 7px)',
            borderRadius: '50%',
            backgroundColor: '#FBBF24', // amber-400
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        {/* Change count text */}
        <span
          style={{
            fontSize: 'clamp(0.58rem, 0.62vw, 0.7rem)',
            fontWeight: 500,
            color: '#FCD34D', // amber-300 — warm, not grey
            letterSpacing: '0.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </span>
    </>
  );
}

export default DriftIndicator;
