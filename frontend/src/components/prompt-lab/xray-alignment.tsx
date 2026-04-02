// src/components/prompt-lab/xray-alignment.tsx
// ============================================================================
// XRAY ALIGNMENT — Phase 3: Platform Optimisation
// ============================================================================
// The peak moment. Platform badge locks in, cog indicators spin and lock
// for each change Call 3 made, capacity gauge fills, ticker tape concludes.
//
// Human factors:
//   §5 Optimal Stimulation — most complex visual arrives at max anticipation.
//   §10 Peak-End Rule — this is the "peak" of the X-Ray sequence.
//   §1 Curiosity Gap — cog descriptions appear via teletype, one by one.
//
// Code standards:
//   - All sizing via clamp() — minimum 10px text (§6.0.1)
//   - No opacity dimming (§6.0.3)
//   - Co-located animations (§6.2)
//   - prefers-reduced-motion: instant display (§14.1)
//   - Phase 3 time budget: 3.5s max (righthand-rail.md §10, D13)
//   - Max 4 individual cogs, rest collapsed (righthand-rail.md §15)
//
// Authority: docs/authority/righthand-rail.md v1.2.0 §10
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { AiOptimiseResult } from '@/hooks/use-ai-optimisation';
import { XRayTeletype } from './xray-teletype';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLOURS = {
  headerBrass: '#B87333',
  headerActive: '#FBBF24',
  warmAmber: '#FCD34D',
  lockEmerald: '#34D399',
  dormantText: '#9B7B55',
  dimBrass: '#5C4328',
  cogAmber: '#FBBF24',
  cogEmerald: '#34D399',
  gaugeEmerald: '#34D399',
  gaugeAmber: '#FBBF24',
  gaugeRose: '#FB7185',
} as const;

/** Tier colours for the platform badge */
const TIER_COLOUR: Record<number, string> = {
  1: '#60a5fa',
  2: '#c084fc',
  3: '#34d399',
  4: '#fb923c',
};

const TIER_LABEL: Record<number, string> = {
  1: 'CLIP-Based',
  2: 'Midjourney',
  3: 'Natural Language',
  4: 'Plain Language',
};

/** Stagger between cog entries (ms) — tightened from 500 to 350 per D13 */
const COG_STAGGER_MS = 350;

/** Max individual cogs before collapsing (D9 revised: 4, not 5) */
const MAX_INDIVIDUAL_COGS = 4;

/** Phase 3 time budget cap (ms) — per D13 */
const PHASE_BUDGET_MS = 3500;

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const ALIGNMENT_STYLES = `
  @keyframes xray-cog-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(180deg); }
  }
  @keyframes xray-cog-lock {
    0% { transform: scale(1.0); }
    50% { transform: scale(1.12); }
    100% { transform: scale(1.0); }
  }
  @keyframes xray-badge-stamp {
    0% { transform: scale(1.15); }
    100% { transform: scale(1.0); }
  }
  .xray-cog-spinning {
    animation: xray-cog-spin 400ms cubic-bezier(0.1, 0, 0.3, 1);
  }
  .xray-cog-locked {
    animation: xray-cog-lock 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .xray-badge-enter {
    animation: xray-badge-stamp 200ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .xray-cog-spinning,
    .xray-cog-locked,
    .xray-badge-enter {
      animation: none !important;
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface XRayAlignmentProps {
  /** Call 3 optimisation result — null when not yet optimised */
  optimiseResult: AiOptimiseResult | null;
  /** Whether Call 3 is currently in flight */
  isOptimising: boolean;
  /** Selected platform name */
  platformName: string | null;
  /** Selected platform tier */
  platformTier: number | null;
  /** Platform maxChars for gauge display */
  maxChars: number | null;
  /** Generation ID for cancellation model */
  generationId: number;
}

type CogState = 'waiting' | 'spinning' | 'locked';

// ============================================================================
// COG INDICATOR
// ============================================================================

function CogEntry({
  text,
  state,
}: {
  text: string;
  state: CogState;
}) {
  const iconColour = state === 'locked' ? COLOURS.cogEmerald : COLOURS.cogAmber;
  const animClass = state === 'spinning'
    ? 'xray-cog-spinning'
    : state === 'locked'
      ? 'xray-cog-locked'
      : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'clamp(6px, 0.5vw, 8px)',
      }}
    >
      {/* Gear icon */}
      <span
        className={animClass}
        style={{
          fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
          color: iconColour,
          flexShrink: 0,
          lineHeight: 1.3,
          transition: 'color 0.3s ease',
          display: 'inline-block',
        }}
        aria-hidden="true"
      >
        ⚙
      </span>

      {/* Change description */}
      <span
        style={{
          fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
          color: state === 'locked' ? '#FFFFFF' : COLOURS.dormantText,
          lineHeight: 1.4,
          transition: 'color 0.3s ease',
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ============================================================================
// CAPACITY GAUGE
// ============================================================================

function CapacityGauge({
  charCount,
  maxChars,
}: {
  charCount: number;
  maxChars: number | null;
}) {
  if (!maxChars || maxChars <= 0) return null;

  const percent = Math.min(100, Math.round((charCount / maxChars) * 100));
  const gaugeColour = percent > 90 ? COLOURS.gaugeRose : percent > 70 ? COLOURS.gaugeAmber : COLOURS.gaugeEmerald;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 0.2vw, 4px)' }}>
      {/* Gauge bar */}
      <div
        style={{
          width: '100%',
          height: 'clamp(4px, 0.35vw, 6px)',
          borderRadius: 'clamp(2px, 0.15vw, 3px)',
          backgroundColor: '#1A1510',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            backgroundColor: gaugeColour,
            borderRadius: 'inherit',
            transition: 'width 600ms cubic-bezier(0.4, 0, 0, 1)',
          }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}
      >
        <span style={{ color: gaugeColour }}>{charCount} / {maxChars} chars</span>
        <span style={{ color: COLOURS.dormantText }}>{percent}%</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ALIGNMENT COMPONENT
// ============================================================================

export function XRayAlignment({
  optimiseResult,
  isOptimising,
  platformName,
  platformTier,
  maxChars,
  generationId,
}: XRayAlignmentProps) {
  const [cogStates, setCogStates] = useState<CogState[]>([]);
  const [showGauge, setShowGauge] = useState(false);
  const [showTicker, setShowTicker] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const genRef = useRef(generationId);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  };

  // Prepare changes list (cap at MAX_INDIVIDUAL_COGS) — memoised for stable reference
  const { effectiveChanges, hasExtra, extraCount, allChanges } = useMemo(() => {
    const all = optimiseResult?.changes ?? [];
    const over = all.length > MAX_INDIVIDUAL_COGS;
    const display = over ? all.slice(0, MAX_INDIVIDUAL_COGS) : all;
    const effective = display.length > 0
      ? display
      : ['Prompt already optimised — no adaptations needed'];
    return {
      effectiveChanges: effective,
      hasExtra: over,
      extraCount: all.length - MAX_INDIVIDUAL_COGS,
      allChanges: all,
    };
  }, [optimiseResult]);

  // Reset when optimising starts
  useEffect(() => {
    if (isOptimising) {
      genRef.current = generationId;
      clearTimers();
      setCogStates([]);
      setShowGauge(false);
      setShowTicker(false);
      setShowBadge(false);

      // Show badge immediately when optimising starts
      const badgeTimer = setTimeout(() => {
        if (genRef.current !== generationId) return;
        setShowBadge(true);
      }, 50);
      timersRef.current.push(badgeTimer);
    }
  }, [isOptimising, generationId]);

  // Cog cascade when result arrives
  useEffect(() => {
    if (!optimiseResult || isOptimising) return;
    if (genRef.current !== generationId) return;
    clearTimers();

    if (!showBadge) setShowBadge(true);

    // Compute timing to stay within budget
    const cogCount = effectiveChanges.length;
    const effectiveStagger = Math.min(COG_STAGGER_MS, PHASE_BUDGET_MS / (cogCount + 3));

    // Initialize all cogs as spinning
    setCogStates(effectiveChanges.map(() => 'spinning'));

    // Stagger lock each cog
    effectiveChanges.forEach((_, idx) => {
      const timer = setTimeout(() => {
        if (genRef.current !== generationId) return;
        setCogStates(prev => {
          const next = [...prev];
          next[idx] = 'locked';
          return next;
        });
      }, (idx + 1) * effectiveStagger);
      timersRef.current.push(timer);
    });

    // Gauge after last cog
    const gaugeDelay = (cogCount + 1) * effectiveStagger;
    const gaugeTimer = setTimeout(() => {
      if (genRef.current !== generationId) return;
      setShowGauge(true);
    }, gaugeDelay);
    timersRef.current.push(gaugeTimer);

    // Ticker after gauge
    const tickerDelay = gaugeDelay + 700;
    const tickerTimer = setTimeout(() => {
      if (genRef.current !== generationId) return;
      setShowTicker(true);
    }, tickerDelay);
    timersRef.current.push(tickerTimer);

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showBadge excluded: set by this effect
  }, [optimiseResult, isOptimising, generationId, effectiveChanges]);

  // Build ticker text
  const tickerText = optimiseResult
    ? `✓ ${allChanges.length} adaptation${allChanges.length !== 1 ? 's' : ''} · ${optimiseResult.charCount} chars · ${optimiseResult.tokenEstimate} tokens`
    : '';

  const tierColour = platformTier ? (TIER_COLOUR[platformTier] ?? COLOURS.dimBrass) : COLOURS.dimBrass;
  const tierLabel = platformTier ? (TIER_LABEL[platformTier] ?? '') : '';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ALIGNMENT_STYLES }} />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 10px)' }}
        role="status"
        aria-live="polite"
        aria-label={
          isOptimising
            ? 'Optimising prompt for platform...'
            : optimiseResult
              ? `${allChanges.length} adaptations applied, ${optimiseResult.charCount} characters`
              : 'Alignment — waiting for optimisation'
        }
      >
        {/* Section header */}
        <div
          style={{
            fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: isOptimising ? COLOURS.headerActive : COLOURS.headerBrass,
            lineHeight: 1,
            userSelect: 'none',
            transition: 'color 0.4s ease',
          }}
          aria-hidden="true"
        >
          § The Alignment
        </div>

        {/* Platform badge */}
        {showBadge && platformName && (
          <div
            className="xray-badge-enter"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(6px, 0.5vw, 8px)',
              padding: 'clamp(4px, 0.3vw, 6px) clamp(8px, 0.6vw, 10px)',
              borderRadius: 'clamp(4px, 0.3vw, 6px)',
              border: `1px solid ${tierColour}`,
              backgroundColor: '#0A0D14',
            }}
          >
            {/* Tier dot */}
            <span
              style={{
                width: 'clamp(6px, 0.5vw, 8px)',
                height: 'clamp(6px, 0.5vw, 8px)',
                borderRadius: '50%',
                backgroundColor: tierColour,
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            {/* Platform name */}
            <span style={{
              fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
              fontWeight: 600,
              color: '#FFFFFF',
              lineHeight: 1.2,
            }}>
              {platformName}
            </span>
            {/* Tier label */}
            <span style={{
              fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
              color: tierColour,
              lineHeight: 1.2,
              marginLeft: 'auto',
            }}>
              {tierLabel}
            </span>
          </div>
        )}

        {/* Cog cascade — only after result arrives */}
        {optimiseResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.3vw, 6px)' }}>
            {effectiveChanges.map((change, idx) => (
              <CogEntry
                key={`${generationId}-${idx}`}
                text={change}
                state={cogStates[idx] ?? 'waiting'}
              />
            ))}

            {/* Overflow summary */}
            {hasExtra && (
              <span style={{
                fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
                color: COLOURS.warmAmber,
                paddingLeft: 'clamp(20px, 1.6vw, 26px)',
              }}>
                … and {extraCount} more adaptation{extraCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Capacity gauge */}
        {showGauge && optimiseResult && (
          <CapacityGauge
            charCount={optimiseResult.charCount}
            maxChars={maxChars}
          />
        )}

        {/* Ticker tape conclusion */}
        {showTicker && tickerText && (
          <div
            style={{
              borderTop: `1px solid ${COLOURS.dimBrass}`,
              paddingTop: 'clamp(4px, 0.3vw, 6px)',
              textAlign: 'center',
            }}
          >
            <XRayTeletype
              text={tickerText}
              speed={30}
              color={COLOURS.lockEmerald}
              fontSize="clamp(0.65rem, 0.8vw, 0.875rem)"
              generationId={generationId}
            />
          </div>
        )}

        {/* Dormant state — show pipeline phases with colour hints */}
        {!showBadge && !isOptimising && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(8px, 0.7vw, 12px)',
            justifyContent: 'center',
          }}>
            {[
              { label: '① Analyse', color: '#FBBF24' },
              { label: '② Generate', color: '#c084fc' },
              { label: '③ Optimise', color: '#34D399' },
            ].map((phase) => (
              <span
                key={phase.label}
                style={{
                  fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
                  fontWeight: 500,
                  color: phase.color,
                  letterSpacing: '0.04em',
                  userSelect: 'none',
                  lineHeight: 1,
                }}
              >
                {phase.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default XRayAlignment;
