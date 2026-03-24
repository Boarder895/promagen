// src/components/prompt-lab/assessment-box.tsx
// ============================================================================
// ASSESSMENT BOX — Prompt Lab v4 Phase 2 (Assess)
// ============================================================================
// +++ IMPROVEMENT 1: Live Prompt Strength Score
//   Circular progress ring (0–100) next to headline. Updates live as user
//   makes Phase 3 decisions. No API call — pure client-side computation.
//   Human factors: §1 Curiosity Gap ("I'm at 72, what gets me to 90+?"),
//   §3 Anticipatory Dopamine (watching number climb), §11 Cognitive Load
//   (one number replaces mental math about prompt readiness).
//
// +++ IMPROVEMENT 2: Sequential Category Scan Reveal
//   Pills scan one-by-one (120ms stagger) from neutral→result. Covered pills
//   bounce emerald/amber, gap pills shake pink. Score ring counts up in sync.
//   Human factors: §3 Anticipatory Dopamine (watching categories checked),
//   §6 Temporal Compression (1.4s scan feels purposeful), §12 Von Restorff
//   (gaps stand out after preceding green), §18 Animation as Communication.
//
// Authority: prompt-lab-v4-flow.md §4, §8, §12, §14
// Code standard: All clamp(), no grey text, cursor-pointer, co-located anims
// ============================================================================

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import type { CoverageAssessment, CategoryDecision, SideNote } from '@/types/category-assessment';
import { CategoryDecisionList } from '@/components/prompt-lab/category-decision';

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const ASSESSMENT_STYLES = `
  @keyframes assess-slide-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .assess-enter {
    animation: assess-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes assess-glow-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
    50% { box-shadow: 0 0 12px 2px rgba(52, 211, 153, 0.12); }
  }
  .assess-all-good {
    animation: assess-glow-green 2.5s ease-in-out infinite;
  }

  @keyframes assess-generate-pulse {
    0%, 100% {
      box-shadow: 0 0 16px rgba(52, 211, 153, 0.25), 0 0 32px rgba(56, 189, 248, 0.15);
    }
    50% {
      box-shadow: 0 0 24px rgba(52, 211, 153, 0.4), 0 0 48px rgba(56, 189, 248, 0.25);
    }
  }
  .assess-generate-ready {
    animation: assess-generate-pulse 2s ease-in-out infinite;
  }

  @keyframes assess-shimmer-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .assess-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.25) 50%, transparent 100%);
    animation: assess-shimmer-sweep 1.5s ease-in-out infinite;
  }

  /* ── Scan Reveal: scanning state pulse ──────────────────────────── */
  @keyframes scan-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
  .scan-pending {
    animation: scan-pulse 0.8s ease-in-out infinite;
  }

  /* ── Scan Reveal: result transitions ────────────────────────────── */
  @keyframes scan-reveal-covered {
    0% { transform: scale(0.9); opacity: 0.5; }
    50% { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  .scan-covered {
    animation: scan-reveal-covered 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes scan-reveal-gap {
    0% { transform: translateX(0); opacity: 0.5; }
    20% { transform: translateX(-3px); }
    40% { transform: translateX(3px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(1px); }
    100% { transform: translateX(0); opacity: 1; }
  }
  .scan-gap {
    animation: scan-reveal-gap 0.35s ease-out both;
  }

  /* ── Score ring ─────────────────────────────────────────────────── */
  @keyframes score-count-up {
    from { stroke-dashoffset: var(--ring-circumference); }
  }

  @media (prefers-reduced-motion: reduce) {
    .assess-enter { animation-duration: 0.01ms; }
    .assess-all-good { animation: none; }
    .assess-generate-ready {
      animation: none;
      box-shadow: 0 0 20px rgba(52, 211, 153, 0.3), 0 0 40px rgba(56, 189, 248, 0.2);
    }
    .assess-shimmer { animation: none; opacity: 0 !important; }
    .scan-pending { animation: none; opacity: 0.5; }
    .scan-covered { animation: none; opacity: 1; transform: scale(1); }
    .scan-gap { animation: none; opacity: 1; transform: none; }
  }
`;

// ============================================================================
// CATEGORY DISPLAY CONFIG
// ============================================================================

const CATEGORY_DISPLAY: Record<PromptCategory, { emoji: string; label: string }> = {
  subject: { emoji: '👤', label: 'Subject' },
  action: { emoji: '🏃', label: 'Action' },
  style: { emoji: '🎨', label: 'Style' },
  environment: { emoji: '🌍', label: 'Environment' },
  composition: { emoji: '📐', label: 'Composition' },
  camera: { emoji: '📷', label: 'Camera' },
  lighting: { emoji: '💡', label: 'Lighting' },
  colour: { emoji: '🎨', label: 'Colour' },
  atmosphere: { emoji: '🌫️', label: 'Atmosphere' },
  materials: { emoji: '🧱', label: 'Materials' },
  fidelity: { emoji: '✨', label: 'Fidelity' },
  negative: { emoji: '🚫', label: 'Constraints' },
};

// ============================================================================
// SCORING ENGINE (Improvement 1)
// ============================================================================

/** Points per category — subject and style worth more (visual impact) */
const CATEGORY_WEIGHT: Record<PromptCategory, number> = {
  subject: 12, action: 8, style: 11, environment: 9,
  composition: 8, camera: 7, lighting: 10, colour: 8,
  atmosphere: 7, materials: 6, fidelity: 7, negative: 7,
};
const MAX_SCORE = Object.values(CATEGORY_WEIGHT).reduce((a, b) => a + b, 0); // 100

/**
 * Compute prompt strength score (0–100) from assessment + decisions.
 * - Covered high → full points
 * - Covered medium → 70% points
 * - Not covered + engine fill → 80% points
 * - Not covered + manual fill (term chosen) → full points
 * - Not covered + no decision → 0 points
 */
function computeStrengthScore(
  assessment: CoverageAssessment,
  decisions: CategoryDecision[],
): number {
  let score = 0;

  for (const cat of CATEGORY_ORDER) {
    const weight = CATEGORY_WEIGHT[cat];
    const { covered, confidence } = assessment.coverage[cat];

    if (covered) {
      score += confidence === 'high' ? weight : weight * 0.7;
    } else {
      const decision = decisions.find((d) => d.category === cat);
      if (decision) {
        score += decision.fill === 'engine' ? weight * 0.8 : weight;
      }
      // No decision = 0 points
    }
  }

  return Math.round((score / MAX_SCORE) * 100);
}

/** Score → colour gradient */
function scoreColor(score: number): string {
  if (score >= 90) return '#34d399'; // emerald
  if (score >= 70) return '#38bdf8'; // sky
  if (score >= 50) return '#fbbf24'; // amber
  return '#f87171'; // red
}

// ============================================================================
// TYPES
// ============================================================================

export interface AssessmentBoxProps {
  assessment: CoverageAssessment;
  onGenerate: () => void;
  onSkipGaps: () => void;
  isGenerating?: boolean;
  decisions?: CategoryDecision[];
  sideNotes?: SideNote[];
  onDecisionChange?: (category: PromptCategory, fill: 'engine' | string) => void;
  sentenceLength?: number;
}

// ============================================================================
// SCORE RING (Improvement 1)
// ============================================================================

const RING_SIZE = 48;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score, animatedScore }: { score: number; animatedScore: number }) {
  const color = scoreColor(score);
  const dashOffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * animatedScore) / 100;

  return (
    <div
      className="relative shrink-0"
      style={{
        width: `clamp(${RING_SIZE - 8}px, 3.2vw, ${RING_SIZE + 4}px)`,
        height: `clamp(${RING_SIZE - 8}px, 3.2vw, ${RING_SIZE + 4}px)`,
      }}
      role="meter"
      aria-label={`Prompt strength: ${score} out of 100`}
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(148, 163, 184, 0.15)"
          strokeWidth={RING_STROKE}
        />
        {/* Progress */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease' }}
        />
      </svg>
      {/* Score number */}
      <span
        className="absolute inset-0 flex items-center justify-center font-bold"
        style={{
          fontSize: 'clamp(0.7rem, 0.8vw, 0.9rem)',
          color,
          transition: 'color 0.4s ease',
        }}
      >
        {animatedScore}
      </span>
    </div>
  );
}

// ============================================================================
// SCANNING PILL (Improvement 2)
// ============================================================================

type ScanState = 'pending' | 'revealed';

function ScanningPill({
  category,
  covered,
  confidence,
  scanState,
}: {
  category: PromptCategory;
  covered: boolean;
  confidence: 'high' | 'medium';
  scanState: ScanState;
}) {
  const display = CATEGORY_DISPLAY[category];

  if (scanState === 'pending') {
    return (
      <div
        className="scan-pending inline-flex items-center rounded-full bg-slate-800/50 ring-1 ring-slate-600/30"
        style={{
          padding: 'clamp(3px, 0.25vw, 5px) clamp(8px, 0.7vw, 12px)',
          gap: 'clamp(4px, 0.3vw, 6px)',
        }}
      >
        <span style={{ fontSize: 'clamp(0.7rem, 0.75vw, 0.85rem)' }} aria-hidden="true">
          {display.emoji}
        </span>
        <span
          className="font-medium text-white"
          style={{ fontSize: 'clamp(0.65rem, 0.72vw, 0.8rem)' }}
        >
          {display.label}
        </span>
        <span
          className="text-white"
          style={{ fontSize: 'clamp(0.55rem, 0.6vw, 0.7rem)' }}
        >
          ·
        </span>
      </div>
    );
  }

  // Revealed state — apply result styling + animation
  let pillClasses: string;
  let labelColor: string;
  let animClass: string;

  if (covered && confidence === 'high') {
    pillClasses = 'bg-emerald-500/15 ring-1 ring-emerald-400/40';
    labelColor = 'text-emerald-300';
    animClass = 'scan-covered';
  } else if (covered && confidence === 'medium') {
    pillClasses = 'bg-amber-500/12 ring-1 ring-amber-400/30';
    labelColor = 'text-amber-300';
    animClass = 'scan-covered';
  } else {
    pillClasses = 'bg-slate-800/40 ring-1 ring-slate-600/40';
    labelColor = 'text-pink-300';
    animClass = 'scan-gap';
  }

  return (
    <div
      className={`${animClass} inline-flex items-center rounded-full ${pillClasses}`}
      style={{
        padding: 'clamp(3px, 0.25vw, 5px) clamp(8px, 0.7vw, 12px)',
        gap: 'clamp(4px, 0.3vw, 6px)',
      }}
    >
      <span style={{ fontSize: 'clamp(0.7rem, 0.75vw, 0.85rem)' }} aria-hidden="true">
        {display.emoji}
      </span>
      <span
        className={`font-medium ${labelColor}`}
        style={{ fontSize: 'clamp(0.65rem, 0.72vw, 0.8rem)' }}
      >
        {display.label}
      </span>
      {covered ? (
        <span
          className={confidence === 'high' ? 'text-emerald-400' : 'text-amber-400'}
          style={{ fontSize: 'clamp(0.55rem, 0.6vw, 0.7rem)' }}
          aria-label={confidence === 'high' ? 'Covered' : 'Loosely covered'}
        >
          {confidence === 'high' ? '✓' : '~'}
        </span>
      ) : (
        <span
          className="text-pink-400"
          style={{ fontSize: 'clamp(0.55rem, 0.6vw, 0.7rem)' }}
          aria-label="Not covered"
        >
          ✕
        </span>
      )}
    </div>
  );
}

// ============================================================================
// SCAN ORCHESTRATOR HOOK (Improvement 2)
// ============================================================================

const SCAN_DELAY_MS = 120;

function useScanReveal(assessment: CoverageAssessment) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  // Stable ID to detect new assessments — triggers re-scan only when coverage changes
  const assessmentId = useMemo(
    () => JSON.stringify(assessment.coverage),
    [assessment],
  );

  useEffect(() => {
    // Reset for fresh scan
    setRevealedCount(0);
    setAnimatedScore(0);
    setScanComplete(false);

    // Stagger reveals — each pill flips from pending → result at 120ms intervals
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 12; i++) {
      timers.push(
        setTimeout(() => {
          setRevealedCount(i);
          const partialScore = computePartialScore(assessment, i);
          setAnimatedScore(partialScore);
          if (i === 12) {
            setScanComplete(true);
          }
        }, i * SCAN_DELAY_MS),
      );
    }

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assessmentId is the stable proxy for assessment
  }, [assessmentId]);

  return { revealedCount, animatedScore, scanComplete };
}

/** Score based on only the first N revealed categories (for count-up animation) */
function computePartialScore(assessment: CoverageAssessment, revealedCount: number): number {
  let score = 0;

  for (let i = 0; i < revealedCount && i < CATEGORY_ORDER.length; i++) {
    const cat = CATEGORY_ORDER[i]!;
    const weight = CATEGORY_WEIGHT[cat];
    const { covered, confidence } = assessment.coverage[cat];
    if (covered) {
      score += confidence === 'high' ? weight : weight * 0.7;
    }
  }

  // Scale to 100 based on total max (not partial max) for smooth ramp
  return Math.round((score / MAX_SCORE) * 100);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AssessmentBox({
  assessment,
  onGenerate,
  onSkipGaps,
  isGenerating = false,
  decisions = [],
  sideNotes = [],
  onDecisionChange,
  sentenceLength = 0,
}: AssessmentBoxProps) {
  // ── Scan reveal state ──────────────────────────────────────────────
  const { revealedCount, animatedScore: scanAnimScore, scanComplete } = useScanReveal(assessment);

  // ── Live score (updates with decisions after scan completes) ────────
  const liveScore = useMemo(
    () => computeStrengthScore(assessment, decisions),
    [assessment, decisions],
  );

  // Display score: during scan use animated partial, after scan use live
  const displayScore = scanComplete ? liveScore : scanAnimScore;

  // ── Derive gap categories ──────────────────────────────────────────
  const gapCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat) => !assessment.coverage[cat].covered);
  }, [assessment]);

  const hasGaps = gapCategories.length > 0;
  const progressPercent = (assessment.coveredCount / 12) * 100;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ASSESSMENT_STYLES }} />

      <div
        className={`assess-enter rounded-xl border ${
          assessment.allSatisfied
            ? 'assess-all-good border-emerald-500/30 bg-slate-950/70'
            : 'border-slate-700/50 bg-slate-950/70'
        }`}
        style={{ padding: 'clamp(14px, 1.3vw, 20px)' }}
        role="region"
        aria-label="Prompt assessment results"
      >
        {/* ── Header: Score ring + headline + progress bar ───────────── */}
        <div style={{ marginBottom: 'clamp(10px, 1vw, 16px)' }}>
          <div className="flex items-center" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
            {/* Score Ring (Improvement 1) */}
            <ScoreRing score={liveScore} animatedScore={displayScore} />

            {/* Headline */}
            <div>
              {assessment.allSatisfied ? (
                <span
                  className="text-emerald-400 font-semibold"
                  style={{ fontSize: 'clamp(0.8rem, 0.9vw, 1rem)' }}
                >
                  All 12 categories covered
                </span>
              ) : (
                <div className="flex items-center" style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}>
                  <span
                    className="text-white font-semibold"
                    style={{ fontSize: 'clamp(0.8rem, 0.9vw, 1rem)' }}
                  >
                    <span className="text-sky-300">{assessment.coveredCount}</span>
                    <span className="text-white"> of </span>
                    <span className="text-white">12</span>
                    <span className="text-white"> covered</span>
                  </span>
                  <span
                    className="inline-flex items-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/30 text-amber-300 font-medium"
                    style={{
                      padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.5vw, 10px)',
                      fontSize: 'clamp(0.6rem, 0.65vw, 0.72rem)',
                    }}
                  >
                    {12 - assessment.coveredCount} {12 - assessment.coveredCount === 1 ? 'gap' : 'gaps'}
                  </span>
                </div>
              )}
              {/* Score label */}
              <p
                className="text-sky-300"
                style={{
                  fontSize: 'clamp(0.56rem, 0.6vw, 0.68rem)',
                  marginTop: 'clamp(1px, 0.1vw, 2px)',
                }}
              >
                Prompt strength
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="relative w-full overflow-hidden rounded-full bg-slate-800/60"
            style={{
              height: 'clamp(4px, 0.35vw, 6px)',
              marginTop: 'clamp(8px, 0.7vw, 12px)',
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: assessment.allSatisfied
                  ? 'linear-gradient(90deg, #34d399, #10b981)'
                  : `linear-gradient(90deg, #38bdf8, #34d399 ${progressPercent}%)`,
              }}
            />
          </div>
        </div>

        {/* ── OD-8: Length ≠ quality hint ────────────────────────────── */}
        {!assessment.allSatisfied && sentenceLength > 200 && assessment.coveredCount <= 5 && (
          <p
            className="text-amber-300"
            style={{
              marginTop: 'clamp(6px, 0.5vw, 8px)',
              fontSize: 'clamp(0.58rem, 0.64vw, 0.72rem)',
              lineHeight: 1.4,
            }}
          >
            Your description is detailed but focused on {assessment.coveredCount} {assessment.coveredCount === 1 ? 'area' : 'areas'} — adding terms for the missing categories will strengthen your prompt
          </p>
        )}

        {/* ── Category pills — Sequential Scan Reveal (Improvement 2) ── */}
        <div
          className="flex flex-wrap"
          style={{ gap: 'clamp(5px, 0.45vw, 8px)' }}
        >
          {CATEGORY_ORDER.map((cat, i) => {
            const { covered, confidence } = assessment.coverage[cat];
            const scanState: ScanState = i < revealedCount ? 'revealed' : 'pending';
            return (
              <ScanningPill
                key={cat}
                category={cat}
                covered={covered}
                confidence={confidence}
                scanState={scanState}
              />
            );
          })}
        </div>

        {/* ── Gap instruction — amber flashing (matches mission-control.tsx) ── */}
        {hasGaps && scanComplete && (
          <p
            className="italic text-amber-400/80 animate-pulse"
            style={{
              marginTop: 'clamp(10px, 0.9vw, 14px)',
              fontSize: 'clamp(0.65rem, 0.7vw, 0.78rem)',
              lineHeight: 1.5,
            }}
          >
            The Dynamic Intelligent Prompt Builder can auto select the missing criteria or you can choose specific terms yourself.
          </p>
        )}

        {/* ── Phase 3: Decision toggles + Skip gaps (after scan completes) ── */}
        {hasGaps && scanComplete && onDecisionChange && (
          <div
            className="flex items-start"
            style={{
              marginTop: 'clamp(6px, 0.5vw, 10px)',
              gap: 'clamp(10px, 1vw, 16px)',
            }}
          >
            {/* Decision rows (Engine/Manual toggles per gap) */}
            <div className="flex-1 min-w-0">
              <CategoryDecisionList
                gapCategories={gapCategories}
                decisions={decisions}
                sideNotes={sideNotes}
                onDecisionChange={onDecisionChange}
                disabled={isGenerating}
              />
            </div>

            {/* Skip gaps — purple button like Clear All, to the right of toggles */}
            {!isGenerating && (
              <button
                type="button"
                onClick={onSkipGaps}
                className="inline-flex items-center shrink-0 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-semibold text-white hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 shadow-sm"
                style={{
                  padding: 'clamp(5px, 0.5vw, 8px) clamp(10px, 1vw, 16px)',
                  fontSize: 'clamp(0.65rem, 0.72vw, 0.8rem)',
                  marginTop: 'clamp(2px, 0.2vw, 4px)',
                }}
              >
                Skip gaps
              </button>
            )}
          </div>
        )}

        {/* ── Action buttons (after scan completes) ────────────────── */}
        {scanComplete && (
          <div
            className="flex items-center"
            style={{
              marginTop: 'clamp(12px, 1.1vw, 18px)',
              gap: 'clamp(8px, 0.8vw, 14px)',
            }}
          >
            {/* Primary: Generate */}
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className={`
                group relative inline-flex items-center overflow-hidden rounded-lg
                font-semibold text-white transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80
                ${
                  isGenerating
                    ? 'border-emerald-400/30 bg-emerald-500/20 cursor-wait'
                    : 'assess-generate-ready border-emerald-400/50 bg-gradient-to-r from-emerald-500/30 via-sky-400/25 to-emerald-500/30 cursor-pointer hover:from-emerald-500/40 hover:via-sky-400/35 hover:to-emerald-500/40'
                }
              `}
              style={{
                padding: 'clamp(7px, 0.65vw, 11px) clamp(14px, 1.3vw, 22px)',
                fontSize: 'clamp(0.72rem, 0.8vw, 0.88rem)',
                border: '1px solid',
                gap: 'clamp(5px, 0.45vw, 7px)',
              }}
            >
              {!isGenerating && (
                <div
                  className="assess-shimmer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 inline-flex items-center" style={{ gap: 'clamp(5px, 0.45vw, 7px)' }}>
                {isGenerating ? (
                  <>
                    <svg
                      className="animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      style={{ width: 'clamp(14px, 1vw, 16px)', height: 'clamp(14px, 1vw, 16px)' }}
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ width: 'clamp(14px, 1vw, 16px)', height: 'clamp(14px, 1vw, 16px)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {assessment.allSatisfied ? 'Generate Prompts' : 'Generate with Engine Fill'}
                  </>
                )}
              </span>
            </button>

            {/* OD-7: Low coverage warning */}
            {hasGaps && !isGenerating && assessment.coveredCount <= 3 && (
              <span
                className="text-amber-400"
                style={{ fontSize: 'clamp(0.56rem, 0.6vw, 0.68rem)' }}
              >
                Low coverage — results may lack detail
              </span>
            )}
          </div>
        )}

        {/* ── All-satisfied hint ────────────────────────────────────── */}
        {assessment.allSatisfied && scanComplete && !isGenerating && (
          <p
            className="text-emerald-400"
            style={{
              marginTop: 'clamp(6px, 0.5vw, 10px)',
              fontSize: 'clamp(0.58rem, 0.62vw, 0.7rem)',
              lineHeight: 1.4,
            }}
          >
            Your description is comprehensive — ready for prompt generation
          </p>
        )}
      </div>
    </>
  );
}

export default AssessmentBox;
