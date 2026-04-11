// src/lib/call-3-harness/triage.ts
// ============================================================================
// PHASE 6 — Harmony Pass 2.0 Triage Computation
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §9.2
// Build plan:   call-3-quality-build-plan-v1.md §10
//
// Takes BQI batch results and computes the Green/Amber/Red triage for
// all 40 platforms. The triage drives Phase 7 (builder refinement):
//   Green  (≥50% headroom fraction) → Keep GPT, refine builder
//   Amber  (20–49%)                 → Test deterministic alternative
//   Red    (<20% or negative)       → Switch to deterministic immediately
//
// Pure computation. No API calls. No side effects.
// ============================================================================

import type { PlatformDNA } from '@/data/platform-dna/types';

// ============================================================================
// TYPES
// ============================================================================

/** Triage bucket per architecture §9.2. */
export type TriageBucket = 'green' | 'amber' | 'red';

/** Raw score input for a single platform from a BQI batch run. */
export interface PlatformBatchScore {
  /** Platform ID matching platform-config.json / DNA profile */
  readonly platformId: string;
  /** Scene ID from test-scenes.json */
  readonly sceneId: string;
  /** Assembled prompt score (Call 2 output, before Call 3) */
  readonly assembledScore: number;
  /** Optimised prompt score (Call 3 output) */
  readonly optimisedScore: number;
}

/** Aggregated triage result for a single platform. */
export interface PlatformTriageResult {
  /** Platform ID */
  readonly platformId: string;
  /** Mean assembled baseline across all scenes */
  readonly meanAssembledBaseline: number;
  /** Mean optimised score across all scenes */
  readonly meanOptimisedScore: number;
  /** Theoretical ceiling for this platform (100 or DNA-derived) */
  readonly ceiling: number;
  /** Available headroom = ceiling - meanAssembledBaseline */
  readonly availableHeadroom: number;
  /** Absolute gain = meanOptimisedScore - meanAssembledBaseline */
  readonly absoluteGain: number;
  /** Headroom fraction = absoluteGain / availableHeadroom (0.0–1.0, can be negative) */
  readonly headroomFraction: number;
  /** Triage bucket assignment */
  readonly bucket: TriageBucket;
  /** Number of scenes scored */
  readonly sceneCount: number;
  /** Whether the platform requires GPT (from DNA) */
  readonly requiresGPT: boolean;
  /** Per-scene breakdown */
  readonly scenes: readonly SceneTriageDetail[];
}

/** Per-scene detail within a platform triage result. */
export interface SceneTriageDetail {
  readonly sceneId: string;
  readonly assembledScore: number;
  readonly optimisedScore: number;
  readonly gain: number;
}

/** Full triage report across all platforms. */
export interface TriageReport {
  /** ISO timestamp of when the triage was computed */
  readonly computedAt: string;
  /** Total platforms triaged */
  readonly platformCount: number;
  /** Bucket counts */
  readonly greenCount: number;
  readonly amberCount: number;
  readonly redCount: number;
  /** Per-platform results sorted by headroom fraction (descending) */
  readonly platforms: readonly PlatformTriageResult[];
  /** Global mean assembled baseline */
  readonly globalMeanBaseline: number;
  /** Global mean optimised score */
  readonly globalMeanOptimised: number;
}

// ============================================================================
// TRIAGE THRESHOLDS — Architecture §9.2
// ============================================================================

/** Green: headroom fraction ≥ 50% */
const GREEN_THRESHOLD = 0.50;

/** Amber: headroom fraction ≥ 20% */
const AMBER_THRESHOLD = 0.20;

/** Default ceiling when no DNA measurement exists. */
const DEFAULT_CEILING = 100;

// ============================================================================
// COMPUTATION
// ============================================================================

/**
 * Assign a triage bucket based on headroom fraction.
 *
 * Architecture §9.2:
 *   Green  ≥ 50%  — Call 3 is helping. Keep GPT. Refine builder.
 *   Amber  20–49% — Marginal. Test deterministic alternative.
 *   Red    < 20%  — Degrading or negligible. Switch to deterministic.
 */
export function assignBucket(headroomFraction: number): TriageBucket {
  if (headroomFraction >= GREEN_THRESHOLD) return 'green';
  if (headroomFraction >= AMBER_THRESHOLD) return 'amber';
  return 'red';
}

/**
 * Compute headroom fraction for a platform.
 *
 * headroomFraction = absoluteGain / availableHeadroom
 *
 * Edge cases:
 *   - If availableHeadroom ≤ 0 (baseline already at/above ceiling), fraction = 0
 *   - If absoluteGain is negative (Call 3 degraded output), fraction is negative → Red
 *   - If no scores provided, all values are 0 → Red
 */
export function computeHeadroomFraction(
  meanBaseline: number,
  meanOptimised: number,
  ceiling: number,
): { absoluteGain: number; availableHeadroom: number; headroomFraction: number } {
  const absoluteGain = meanOptimised - meanBaseline;
  const availableHeadroom = ceiling - meanBaseline;

  if (availableHeadroom <= 0) {
    // Baseline already at or above ceiling — no room to improve
    return { absoluteGain, availableHeadroom: 0, headroomFraction: 0 };
  }

  const headroomFraction = absoluteGain / availableHeadroom;

  return { absoluteGain, availableHeadroom, headroomFraction };
}

/**
 * Aggregate raw BQI batch scores into per-platform triage results.
 *
 * @param scores   Raw per-scene scores from BQI batch run
 * @param dnaMap   Map of platformId → PlatformDNA (for ceiling and requiresGPT)
 * @returns        Full triage report
 */
export function computeTriage(
  scores: readonly PlatformBatchScore[],
  dnaMap: ReadonlyMap<string, PlatformDNA>,
): TriageReport {
  // ── Group scores by platform ───────────────────────────────────────
  const byPlatform = new Map<string, PlatformBatchScore[]>();

  for (const score of scores) {
    const existing = byPlatform.get(score.platformId) ?? [];
    existing.push(score);
    byPlatform.set(score.platformId, existing);
  }

  // ── Compute per-platform triage ────────────────────────────────────
  const platforms: PlatformTriageResult[] = [];

  for (const [platformId, platformScores] of byPlatform) {
    const dna = dnaMap.get(platformId);

    // Mean scores across scenes
    const meanAssembledBaseline = platformScores.reduce(
      (sum, s) => sum + s.assembledScore, 0,
    ) / platformScores.length;

    const meanOptimisedScore = platformScores.reduce(
      (sum, s) => sum + s.optimisedScore, 0,
    ) / platformScores.length;

    // Ceiling: from DNA if measured, otherwise default
    const ceiling = DEFAULT_CEILING;

    // Headroom computation
    const { absoluteGain, availableHeadroom, headroomFraction } =
      computeHeadroomFraction(meanAssembledBaseline, meanOptimisedScore, ceiling);

    // Per-scene breakdown
    const scenes: SceneTriageDetail[] = platformScores.map((s) => ({
      sceneId: s.sceneId,
      assembledScore: s.assembledScore,
      optimisedScore: s.optimisedScore,
      gain: s.optimisedScore - s.assembledScore,
    }));

    platforms.push({
      platformId,
      meanAssembledBaseline: Math.round(meanAssembledBaseline * 100) / 100,
      meanOptimisedScore: Math.round(meanOptimisedScore * 100) / 100,
      ceiling,
      availableHeadroom: Math.round(availableHeadroom * 100) / 100,
      absoluteGain: Math.round(absoluteGain * 100) / 100,
      headroomFraction: Math.round(headroomFraction * 1000) / 1000,
      bucket: assignBucket(headroomFraction),
      sceneCount: platformScores.length,
      requiresGPT: dna?.requiresGPT ?? false,
      scenes,
    });
  }

  // ── Sort by headroom fraction (highest first) ──────────────────────
  platforms.sort((a, b) => b.headroomFraction - a.headroomFraction);

  // ── Bucket counts ──────────────────────────────────────────────────
  const greenCount = platforms.filter((p) => p.bucket === 'green').length;
  const amberCount = platforms.filter((p) => p.bucket === 'amber').length;
  const redCount = platforms.filter((p) => p.bucket === 'red').length;

  // ── Global means ───────────────────────────────────────────────────
  const globalMeanBaseline = platforms.length > 0
    ? platforms.reduce((sum, p) => sum + p.meanAssembledBaseline, 0) / platforms.length
    : 0;
  const globalMeanOptimised = platforms.length > 0
    ? platforms.reduce((sum, p) => sum + p.meanOptimisedScore, 0) / platforms.length
    : 0;

  return {
    computedAt: new Date().toISOString(),
    platformCount: platforms.length,
    greenCount,
    amberCount,
    redCount,
    platforms,
    globalMeanBaseline: Math.round(globalMeanBaseline * 100) / 100,
    globalMeanOptimised: Math.round(globalMeanOptimised * 100) / 100,
  };
}

// ============================================================================
// MARKDOWN REPORT GENERATOR
// ============================================================================

/**
 * Generate a markdown triage table for the harmony-pass-2-triage.md doc.
 * Build plan §10.4: "A triage table showing every platform's assembled
 * baseline, optimised score, headroom fraction, and bucket."
 */
export function generateTriageMarkdown(report: TriageReport): string {
  const lines: string[] = [];

  lines.push('# Harmony Pass 2.0 — Triage Report');
  lines.push('');
  lines.push(`**Computed:** ${report.computedAt}`);
  lines.push(`**Platforms:** ${report.platformCount}`);
  lines.push(`**Global mean baseline:** ${report.globalMeanBaseline}`);
  lines.push(`**Global mean optimised:** ${report.globalMeanOptimised}`);
  lines.push('');
  lines.push(`| Bucket | Count |`);
  lines.push(`| ------ | ----- |`);
  lines.push(`| 🟢 Green (≥50%) | ${report.greenCount} |`);
  lines.push(`| 🟡 Amber (20–49%) | ${report.amberCount} |`);
  lines.push(`| 🔴 Red (<20%) | ${report.redCount} |`);
  lines.push('');
  lines.push('## Per-Platform Triage');
  lines.push('');
  lines.push('| Platform | GPT? | Baseline | Optimised | Gain | Headroom | Fraction | Bucket |');
  lines.push('| -------- | ---- | -------- | --------- | ---- | -------- | -------- | ------ |');

  for (const p of report.platforms) {
    const bucketIcon = p.bucket === 'green' ? '🟢' : p.bucket === 'amber' ? '🟡' : '🔴';
    const gpt = p.requiresGPT ? 'GPT' : 'Det';
    const fraction = `${(p.headroomFraction * 100).toFixed(1)}%`;

    lines.push(
      `| ${p.platformId} | ${gpt} | ${p.meanAssembledBaseline} | ${p.meanOptimisedScore} | ${p.absoluteGain > 0 ? '+' : ''}${p.absoluteGain} | ${p.availableHeadroom} | ${fraction} | ${bucketIcon} |`,
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Next Steps');
  lines.push('');
  lines.push('- **Green platforms:** Proceed to Phase 7 (builder refinement)');
  lines.push('- **Amber platforms:** Test deterministic alternative, score, decide');
  lines.push('- **Red platforms:** Switch to deterministic immediately or pass_through');

  return lines.join('\n');
}
