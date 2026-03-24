// src/components/prompt-lab/side-note-pills.tsx
// ============================================================================
// SIDE NOTE PILLS — Prompt Lab v4 (§7)
// ============================================================================
// Small pills/chips alongside the human text box showing user-chosen terms
// from Phase 3 Manual dropdowns. Each pill shows category + term and has
// a remove button.
//
// Lifecycle (§7):
//   1. Created when user selects a Manual dropdown term in Phase 3
//   2. Visible alongside human text box after creation
//   3. Sent to Call 2 as categoryDecisions with user's fill value
//   4. Persist across re-generations
//   5. Cleared on Clear All
//   6. Auto-cleared when re-assessment covers category with HIGH confidence
//      (medium confidence preserves the user's deliberate choice — D20)
//
// Authority: prompt-lab-v4-flow.md §7, §14 (OD-5)
// Code standard: All clamp(), no grey text, cursor-pointer, co-located anims
// ============================================================================

'use client';

import React from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { SideNote } from '@/types/category-assessment';

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const PILL_STYLES = `
  @keyframes sidenote-enter {
    from {
      opacity: 0;
      transform: scale(0.85) translateY(2px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .sidenote-pill {
    animation: sidenote-enter 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes sidenote-exit {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.85);
    }
  }
  .sidenote-removing {
    animation: sidenote-exit 0.2s ease-out forwards;
    pointer-events: none;
  }

  @keyframes sidenote-pulse {
    0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.3); }
    50% { box-shadow: 0 0 8px 2px rgba(56, 189, 248, 0.15); }
    100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
  }
  .sidenote-pulse {
    animation: sidenote-pulse 0.8s ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .sidenote-pill { animation-duration: 0.01ms; }
    .sidenote-removing { animation-duration: 0.01ms; }
    .sidenote-pulse { animation: none; }
  }
`;

// ============================================================================
// CATEGORY DISPLAY CONFIG
// ============================================================================

const CATEGORY_DISPLAY: Record<PromptCategory, { emoji: string; label: string; color: string }> = {
  subject: { emoji: '👤', label: 'Subject', color: '#FCD34D' },
  action: { emoji: '🏃', label: 'Action', color: '#A3E635' },
  style: { emoji: '🎨', label: 'Style', color: '#C084FC' },
  environment: { emoji: '🌍', label: 'Environment', color: '#38BDF8' },
  composition: { emoji: '📐', label: 'Composition', color: '#34D399' },
  camera: { emoji: '📷', label: 'Camera', color: '#FB923C' },
  lighting: { emoji: '💡', label: 'Lighting', color: '#FBBF24' },
  colour: { emoji: '🎨', label: 'Colour', color: '#F472B6' },
  atmosphere: { emoji: '🌫️', label: 'Atmosphere', color: '#22D3EE' },
  materials: { emoji: '🧱', label: 'Materials', color: '#2DD4BF' },
  fidelity: { emoji: '✨', label: 'Fidelity', color: '#93C5FD' },
  negative: { emoji: '🚫', label: 'Constraints', color: '#F87171' },
};

// ============================================================================
// TYPES
// ============================================================================

export interface SideNotePillsProps {
  /** Active side notes to display */
  sideNotes: SideNote[];
  /** Called when user removes a side note (click × on pill) */
  onRemove: (category: PromptCategory) => void;
  /** Disable remove buttons (during generation) */
  disabled?: boolean;
  /**
   * OD-6: Incrementing key that triggers a pulse animation on surviving pills
   * after re-assessment. Pulse indicates "these were evaluated and kept."
   */
  pulseKey?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SideNotePills({ sideNotes, onRemove, disabled = false, pulseKey = 0 }: SideNotePillsProps) {
  // OD-6: Track pulseKey changes to apply pulse animation
  const [isPulsing, setIsPulsing] = React.useState(false);
  const prevPulseKey = React.useRef(pulseKey);

  React.useEffect(() => {
    if (pulseKey > 0 && pulseKey !== prevPulseKey.current) {
      prevPulseKey.current = pulseKey;
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [pulseKey]);

  if (sideNotes.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PILL_STYLES }} />

      <div
        className="flex flex-wrap items-center"
        style={{
          gap: 'clamp(4px, 0.35vw, 6px)',
          marginTop: 'clamp(6px, 0.5vw, 8px)',
        }}
        role="list"
        aria-label="Your chosen terms"
      >
        {/* Label */}
        <span
          className="text-sky-400 shrink-0"
          style={{
            fontSize: 'clamp(0.56rem, 0.6vw, 0.68rem)',
            marginRight: 'clamp(2px, 0.2vw, 4px)',
          }}
        >
          Your choices:
        </span>

        {/* Pills */}
        {sideNotes.map((note, i) => {
          const display = CATEGORY_DISPLAY[note.category];

          return (
            <div
              key={note.category}
              role="listitem"
              className={`sidenote-pill inline-flex items-center rounded-full ring-1 transition-colors ${isPulsing ? 'sidenote-pulse' : ''}`}
              style={{
                background: `${display.color}12`,
                borderColor: `${display.color}30`,
                boxShadow: `0 0 0 1px ${display.color}25`,
                padding: 'clamp(2px, 0.15vw, 3px) clamp(3px, 0.25vw, 5px) clamp(2px, 0.15vw, 3px) clamp(6px, 0.5vw, 9px)',
                gap: 'clamp(3px, 0.25vw, 5px)',
                animationDelay: `${i * 40}ms`,
              }}
            >
              {/* Category emoji */}
              <span
                style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}
                aria-hidden="true"
              >
                {display.emoji}
              </span>

              {/* Category label + term */}
              <span
                style={{
                  fontSize: 'clamp(0.58rem, 0.64vw, 0.72rem)',
                  color: display.color,
                  maxWidth: 'clamp(100px, 10vw, 180px)',
                }}
                className="truncate font-medium"
              >
                {display.label}:
              </span>
              <span
                className="text-white truncate"
                style={{
                  fontSize: 'clamp(0.58rem, 0.64vw, 0.72rem)',
                  maxWidth: 'clamp(80px, 9vw, 150px)',
                }}
              >
                {note.term}
              </span>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(note.category)}
                disabled={disabled}
                className={`
                  inline-flex items-center justify-center rounded-full
                  transition-colors duration-150
                  ${disabled
                    ? 'cursor-not-allowed text-white/50'
                    : 'cursor-pointer text-white hover:bg-white/10'
                  }
                `}
                style={{
                  width: 'clamp(14px, 1vw, 18px)',
                  height: 'clamp(14px, 1vw, 18px)',
                  fontSize: 'clamp(0.55rem, 0.6vw, 0.7rem)',
                }}
                aria-label={`Remove ${display.label}: ${note.term}`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default SideNotePills;
