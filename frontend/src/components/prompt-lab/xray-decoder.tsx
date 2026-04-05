// src/components/prompt-lab/xray-decoder.tsx
// ============================================================================
// XRAY DECODER — Phase 1: Category Rotor Detection
// ============================================================================
// 12 category rotors in a 6×2 grid. When Call 1 fires, rotors spin.
// When Call 1 returns, detected categories lock to their category colour
// with a staggered cascade. Undetected categories fade back to idle.
//
// Human factors:
//   §3 Anticipatory Dopamine — each rotor locking is a micro-reward.
//       The cascade builds: "another one found, and another..."
//   §2 Variable Reward — different prompts lock different rotors.
//       A lighting-rich prompt lights up different rotors than a
//       composition-focused one.
//   §12 Von Restorff — each locked rotor uses its category's unique
//       colour from CATEGORY_COLOURS SSOT.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - Co-located animations (§6.2)
//   - prefers-reduced-motion: instant lock, no spin (§14.1)
//   - Category colours from prompt-colours.ts SSOT
//   - No grey text — dim brass for dormant, category colour for locked
//
// Authority: docs/authority/righthand-rail.md v1.2.0 §8
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CATEGORY_COLOURS } from '@/lib/prompt-colours';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import type { CoverageAssessment } from '@/types/category-assessment';
import { XRayTeletype } from './xray-teletype';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLOURS = {
  // ── Solid colours only — NO rgba opacity dimming (§6.0.3) ──────────
  dimBrass: '#5C4328',       // Dormant rotor rings — dark but VISIBLE
  headerBrass: '#FBBF24',    // Section header — Analyse yellow
  dormantText: '#9B7B55',    // Dormant rotor text — muted gold, readable
  activeAmber: '#FBBF24',    // Spinning/processing state
  lockEmerald: '#34D399',    // Completion state
  warmAmber: '#FCD34D',      // Teletype summary text
} as const;

/** Category abbreviations for rotor labels */
const CATEGORY_ABBR: Record<string, string> = {
  subject: 'Sbj',
  action: 'Act',
  style: 'Sty',
  environment: 'Env',
  composition: 'Cmp',
  camera: 'Cam',
  lighting: 'Lit',
  colour: 'Col',
  atmosphere: 'Atm',
  materials: 'Mat',
  fidelity: 'Fid',
  negative: 'Neg',
};

/** Stagger delay between rotor locks (ms) */
const LOCK_STAGGER_MS = 120;

/**
 * Darken a hex colour by mixing with dark background.
 * strength 0.0 = pure background, 1.0 = full colour.
 * Returns a solid hex — no opacity, no rgba.
 */
function muteColour(hex: string, strength: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Mix with dark bg (#0A0D14)
  const br = 10, bg = 13, bb = 20;
  const mr = Math.round(br + (r - br) * strength);
  const mg = Math.round(bg + (g - bg) * strength);
  const mb = Math.round(bb + (b - bb) * strength);
  return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
}

/** Minimum display time for Phase 1 before Phase 2 can begin (ms) */
const MIN_PHASE_DISPLAY_MS = 800;

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const DECODER_STYLES = `
  @keyframes xray-rotor-spin-up {
    from { transform: rotate(0deg); }
    to { transform: rotate(720deg); }
  }
  @keyframes xray-rotor-lock-pop {
    0% { transform: scale(1.0); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1.0); }
  }
  @keyframes xray-rotor-breathe {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(3deg); }
    75% { transform: rotate(-3deg); }
  }
  .xray-rotor-idle {
    animation: xray-rotor-breathe 8s ease-in-out infinite;
  }
  .xray-rotor-spinning {
    animation: xray-rotor-spin-up 600ms cubic-bezier(0.2, 0, 0.8, 1);
  }
  .xray-rotor-locked {
    animation: xray-rotor-lock-pop 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .xray-rotor-idle,
    .xray-rotor-spinning,
    .xray-rotor-locked {
      animation: none !important;
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

type RotorState = 'idle' | 'spinning' | 'locked' | 'unlocked';

export interface XRayDecoderProps {
  /** Call 1 assessment data — null when not yet run */
  assessment: CoverageAssessment | null;
  /** Whether Call 1 is currently in flight */
  isChecking: boolean;
  /** Generation ID for cancellation model */
  generationId: number;
}

// ============================================================================
// SINGLE ROTOR
// ============================================================================

function Rotor({
  category,
  state,
  richness,
  staggerIndex,
}: {
  category: string;
  state: RotorState;
  richness: number;
  staggerIndex: number;
}) {
  const abbr = CATEGORY_ABBR[category] ?? category.slice(0, 3);
  const catColour = CATEGORY_COLOURS[category] ?? '#94A3B8';

  // Rotor angle based on richness (Variable Reward — different per prompt)
  // 1 term = 45°, 2 = 90°, 3+ = 135°
  const lockAngle = Math.min(richness, 3) * 45;

  const isLocked = state === 'locked';
  const isSpinning = state === 'spinning';
  const isIdle = state === 'idle';

  // Ring colour: muted category → active amber (spinning) → full category (locked)
  const ringColour = isLocked
    ? catColour
    : isSpinning
      ? COLOURS.activeAmber
      : muteColour(catColour, 0.35);  // each rotor hints at its own colour

  // Text colour: muted category → amber (spinning) → full category (locked)
  const textColour = isLocked
    ? catColour
    : isSpinning
      ? COLOURS.activeAmber
      : muteColour(catColour, 0.45);  // slightly brighter than ring for readability

  // Animation class
  const animClass = isSpinning
    ? 'xray-rotor-spinning'
    : isLocked
      ? 'xray-rotor-locked'
      : isIdle
        ? 'xray-rotor-idle'
        : ''; // unlocked: no animation, just dim

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(1px, 0.1vw, 2px)',
      }}
    >
      {/* Rotor circle */}
      <div
        className={animClass}
        style={{
          width: 'clamp(18px, 1.6vw, 24px)',
          height: 'clamp(18px, 1.6vw, 24px)',
          borderRadius: '50%',
          border: `1px solid ${ringColour}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.3s ease',
          animationDelay: isIdle ? `${staggerIndex * 0.6}s` : '0s',
          // Locked rotors rotate to their data-derived angle
          ...(isLocked && { transform: `rotate(${lockAngle}deg)` }),
          // Glow on locked rotors
          ...(isLocked && {
            boxShadow: `0 0 4px ${catColour}40`,
          }),
        }}
        title={`${category}: ${isLocked ? `detected (${richness} terms)` : isSpinning ? 'analysing...' : 'waiting'}`}
      >
        <span
          style={{
            fontSize: 'clamp(10px, 0.65vw, 11px)',
            fontWeight: 600,
            color: textColour,
            lineHeight: 1,
            userSelect: 'none',
            letterSpacing: '-0.02em',
            transition: 'color 0.3s ease',
            // Counter-rotate text so it stays readable when rotor is angled
            ...(isLocked && { transform: `rotate(-${lockAngle}deg)` }),
          }}
        >
          {abbr}
        </span>
      </div>

      {/* Tick indicator — shows below detected rotors */}
      <div
        style={{
          width: 'clamp(3px, 0.25vw, 4px)',
          height: 'clamp(3px, 0.25vw, 4px)',
          borderRadius: '50%',
          backgroundColor: isLocked ? catColour : 'transparent',
          transition: 'background-color 0.2s ease',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ============================================================================
// MAIN DECODER COMPONENT
// ============================================================================

export function XRayDecoder({ assessment, isChecking, generationId }: XRayDecoderProps) {
  const [rotorStates, setRotorStates] = useState<Record<string, RotorState>>(() => {
    const initial: Record<string, RotorState> = {};
    for (const cat of CATEGORY_ORDER) initial[cat] = 'idle';
    return initial;
  });
  const [summaryText, setSummaryText] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const genRef = useRef(generationId);
  const lockTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all timers on unmount or generation change
  const clearTimers = () => {
    for (const t of lockTimersRef.current) clearTimeout(t);
    lockTimersRef.current = [];
  };

  // ── SPINNING: When Call 1 starts ──────────────────────────────────
  useEffect(() => {
    if (!isChecking) return;
    genRef.current = generationId;
    clearTimers();
    setShowSummary(false);
    setSummaryText('');

    // All rotors → spinning
    const spinning: Record<string, RotorState> = {};
    for (const cat of CATEGORY_ORDER) spinning[cat] = 'spinning';
    setRotorStates(spinning);
  }, [isChecking, generationId]);

  // ── LOCKING: When Call 1 returns ──────────────────────────────────
  useEffect(() => {
    if (!assessment || isChecking) return;
    if (genRef.current !== generationId) return; // stale
    clearTimers();

    // Build lock order: detected categories first (in CATEGORY_ORDER),
    // then undetected. This makes the cascade feel purposeful.
    const detected = CATEGORY_ORDER.filter(
      (cat) => assessment.coverage[cat]?.covered,
    );
    const undetected = CATEGORY_ORDER.filter(
      (cat) => !assessment.coverage[cat]?.covered,
    );
    const lockOrder = [...detected, ...undetected];

    // Stagger locks
    lockOrder.forEach((cat, idx) => {
      const timer = setTimeout(() => {
        if (genRef.current !== generationId) return; // cancelled
        setRotorStates((prev) => ({
          ...prev,
          [cat]: assessment.coverage[cat]?.covered ? 'locked' : 'unlocked',
        }));
      }, idx * LOCK_STAGGER_MS);
      lockTimersRef.current.push(timer);
    });

    // Summary line after all rotors lock
    const totalLockTime = lockOrder.length * LOCK_STAGGER_MS;
    const summaryDelay = Math.max(totalLockTime + 100, MIN_PHASE_DISPLAY_MS);
    const summaryTimer = setTimeout(() => {
      if (genRef.current !== generationId) return;
      const count = assessment.coveredCount;
      const total = assessment.totalCategories;
      setSummaryText(`${count} of ${total} categories decoded`);
      setShowSummary(true);
    }, summaryDelay);
    lockTimersRef.current.push(summaryTimer);

    return () => clearTimers();
  }, [assessment, isChecking, generationId]);

  // ── RESET: When generation changes while idle ─────────────────────
  useEffect(() => {
    genRef.current = generationId;
  }, [generationId]);

  // Richness per category (phrase count)
  const getRichness = (cat: string): number => {
    if (!assessment) return 0;
    return assessment.coverage[cat as keyof typeof assessment.coverage]?.matchedPhrases?.length ?? 0;
  };

  // Summary colour: emerald if 10+, amber otherwise
  const summaryColour = (assessment?.coveredCount ?? 0) >= 10
    ? COLOURS.lockEmerald
    : COLOURS.warmAmber;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DECODER_STYLES }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(6px, 0.5vw, 10px)',
        }}
        role="status"
        aria-live="polite"
        aria-label={
          isChecking
            ? 'Analysing prompt categories...'
            : assessment
              ? `${assessment.coveredCount} of ${assessment.totalCategories} categories detected`
              : 'Category decoder — waiting for input'
        }
      >
        {/* Section header */}
        <div
          style={{
            fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: isChecking ? COLOURS.activeAmber : COLOURS.headerBrass,
            lineHeight: 1,
            userSelect: 'none',
            transition: 'color 0.4s ease',
            marginBottom: 'clamp(6px, 0.5vw, 10px)',
          }}
          aria-hidden="true"
        >
          § The Decoder
        </div>

        {/* 6×2 rotor grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 'clamp(4px, 0.35vw, 6px)',
            justifyItems: 'center',
          }}
        >
          {CATEGORY_ORDER.map((cat, idx) => (
            <Rotor
              key={cat}
              category={cat}
              state={rotorStates[cat] ?? 'idle'}
              richness={getRichness(cat)}
              staggerIndex={idx}
            />
          ))}
        </div>

        {/* Summary teletype — appears after all rotors lock */}
        {showSummary && summaryText && (
          <div style={{ textAlign: 'center' }}>
            <XRayTeletype
              text={summaryText}
              speed={25}
              color={summaryColour}
              fontSize="clamp(0.65rem, 0.8vw, 0.875rem)"
              generationId={generationId}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default XRayDecoder;
