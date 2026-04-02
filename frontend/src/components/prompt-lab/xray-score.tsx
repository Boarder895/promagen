// src/components/prompt-lab/xray-score.tsx
// ============================================================================
// XRAY SCORE — Call 4 Scoring Display
// ============================================================================
// Circular score badge + 5-axis bars + directive cards.
// Renders inside the Glass Case below Alignment, above Platform Navigator.
//
// Human factors:
//   §10 Peak-End Rule — the score is the "end" of the X-Ray sequence.
//        A high score = positive ending = user remembers the tool favourably.
//   §1 Curiosity Gap — directives create "I can make this better" motivation.
//
// Code standards:
//   - All sizing via clamp() — minimum 10px text (§6.0.1)
//   - No opacity dimming (§6.0.3)
//   - Co-located animations (§6.2)
//   - prefers-reduced-motion (§14.1)
//
// Authority: docs/authority/call4-chatgpt-review-v4.md
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import React from 'react';
import type { PromptScoreResult } from '@/hooks/use-prompt-score';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLOURS = {
  headerBrass: '#B87333',
  headerActive: '#FBBF24',
  dormantText: '#9B7B55',
  dimBrass: '#5C4328',
  emerald: '#34D399',
  amber: '#FBBF24',
  rose: '#FB7185',
  white: '#FFFFFF',
  barTrack: '#1A1510',
} as const;

const AXIS_CONFIG = [
  { key: 'anchorPreservation' as const, label: 'Anchor Preservation', max: 30, color: '#FCD34D' },
  { key: 'platformFit' as const, label: 'Platform-Native Fit', max: 25, color: '#38BDF8' },
  { key: 'visualSpecificity' as const, label: 'Visual Specificity', max: 20, color: '#C084FC' },
  { key: 'economyClarity' as const, label: 'Economy & Clarity', max: 15, color: '#34D399' },
  { key: 'negativeQuality' as const, label: 'Negative Quality', max: 10, color: '#F87171' },
] as const;

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const SCORE_STYLES = `
  @keyframes xray-score-pop {
    0% { transform: scale(0.8); }
    60% { transform: scale(1.05); }
    100% { transform: scale(1.0); }
  }
  .xray-score-enter {
    animation: xray-score-pop 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .xray-score-enter {
      animation: none !important;
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface XRayScoreProps {
  /** Call 4 scoring result — null when not yet scored */
  scoreResult: PromptScoreResult | null;
  /** Whether Call 4 is currently in flight */
  isScoring: boolean;
  /** Error message from scoring */
  scoreError: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function scoreColour(score: number): string {
  if (score >= 80) return COLOURS.emerald;
  if (score >= 60) return COLOURS.amber;
  return COLOURS.rose;
}

// ============================================================================
// SCORE BADGE — Circular with number
// ============================================================================

function ScoreBadge({ score }: { score: number }) {
  const colour = scoreColour(score);
  const size = 'clamp(48px, 4vw, 64px)';

  return (
    <div
      className="xray-score-enter"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${colour}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 'clamp(0.75rem, 1.1vw, 1.5rem)',
          fontWeight: 800,
          color: colour,
          lineHeight: 1,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}
      >
        {score}
      </span>
      <span
        style={{
          fontSize: 'clamp(10px, 0.65vw, 11px)',
          color: COLOURS.dormantText,
          lineHeight: 1,
          marginTop: '1px',
        }}
      >
        /100
      </span>
    </div>
  );
}

// ============================================================================
// AXIS BAR — Single scoring axis
// ============================================================================

function AxisBar({ label, value, max, color }: {
  label: string;
  value: number | null;
  max: number;
  color: string;
}) {
  if (value === null) return null; // N/A axis — hidden

  const percent = Math.round((value / max) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.15vw, 3px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontSize: 'clamp(10px, 0.65vw, 11px)',
          color: COLOURS.dormantText,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 'clamp(10px, 0.65vw, 11px)',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color,
        }}>
          {value}/{max}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: 'clamp(4px, 0.35vw, 6px)',
          borderRadius: 'clamp(2px, 0.15vw, 3px)',
          backgroundColor: COLOURS.barTrack,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            backgroundColor: color,
            borderRadius: 'inherit',
            transition: 'width 600ms cubic-bezier(0.4, 0, 0, 1)',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// DIRECTIVE CARD
// ============================================================================

function DirectiveCard({ text, index }: { text: string; index: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'clamp(6px, 0.5vw, 8px)',
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
          color: COLOURS.amber,
          flexShrink: 0,
          lineHeight: 1.4,
        }}
      >
        {index + 1}.
      </span>
      <span
        style={{
          fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
          color: COLOURS.white,
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function XRayScore({ scoreResult, isScoring, scoreError }: XRayScoreProps) {
  // Dormant — no score yet and not scoring
  if (!scoreResult && !isScoring && !scoreError) {
    return null; // Invisible until Call 4 fires
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SCORE_STYLES }} />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.6vw, 12px)' }}
        role="status"
        aria-live="polite"
        aria-label={
          isScoring
            ? 'Scoring prompt...'
            : scoreResult
              ? `Prompt scored ${scoreResult.score} out of 100`
              : 'Score unavailable'
        }
      >
        {/* Section header */}
        <div
          style={{
            fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: isScoring ? COLOURS.headerActive : COLOURS.headerBrass,
            lineHeight: 1,
            userSelect: 'none',
            transition: 'color 0.4s ease',
          }}
          aria-hidden="true"
        >
          § The Score
        </div>

        {/* Scoring in progress */}
        {isScoring && (
          <div style={{
            fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
            color: COLOURS.headerActive,
            textAlign: 'center',
          }}>
            Scoring prompt…
          </div>
        )}

        {/* Error */}
        {scoreError && !isScoring && (
          <div style={{
            fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
            color: COLOURS.rose,
          }}>
            {scoreError}
          </div>
        )}

        {/* Score result */}
        {scoreResult && !isScoring && (
          <>
            {/* Badge + summary row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(10px, 0.8vw, 14px)',
            }}>
              <ScoreBadge score={scoreResult.score} />
              <span style={{
                fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
                color: COLOURS.white,
                lineHeight: 1.4,
                flex: 1,
              }}>
                {scoreResult.summary}
              </span>
            </div>

            {/* Axis bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.3vw, 6px)' }}>
              {AXIS_CONFIG.map((axis) => (
                <AxisBar
                  key={axis.key}
                  label={axis.label}
                  value={scoreResult.axes[axis.key]}
                  max={axis.max}
                  color={axis.color}
                />
              ))}

              {/* N/A label when negatives not applicable */}
              {scoreResult.axes.negativeQuality === null && (
                <div style={{
                  fontSize: 'clamp(10px, 0.65vw, 11px)',
                  color: COLOURS.dormantText,
                  fontStyle: 'italic',
                }}>
                  Negative: N/A — platform does not support negatives
                </div>
              )}
            </div>

            {/* Directives */}
            {scoreResult.directives.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(6px, 0.5vw, 8px)',
                borderTop: `1px solid ${COLOURS.dimBrass}`,
                paddingTop: 'clamp(6px, 0.5vw, 8px)',
              }}>
                <div style={{
                  fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
                  fontWeight: 600,
                  color: COLOURS.amber,
                }}>
                  Improve your score:
                </div>
                {scoreResult.directives.map((d, i) => (
                  <DirectiveCard key={i} text={d} index={i} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default XRayScore;
