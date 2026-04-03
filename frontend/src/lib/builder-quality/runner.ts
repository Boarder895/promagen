// src/lib/builder-quality/runner.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Runner Types & Helpers
// ============================================================================
// Core types used by the batch runner script and future admin dashboard.
// The actual batch execution logic lives in scripts/builder-quality-run.ts
// (standalone, no server-only dependency). This module provides shared types
// and helpers importable from Next.js app code (server components, API routes).
//
// v1.0.0 (3 Apr 2026): Initial implementation — types only.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §7
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

import 'server-only';

// ============================================================================
// RUNNER CONFIGURATION TYPES
// ============================================================================

/** Scorer modes — which models score the output */
export type ScorerMode = 'gpt_only' | 'dual_on_flagged' | 'dual_full';

/** Runner modes — what input is used */
export type RunnerMode = 'builder' | 'pipeline';

/** Run status lifecycle */
export type RunStatus = 'pending' | 'running' | 'complete' | 'partial' | 'failed';

/** Result status for individual platform × scene × replicate */
export type ResultStatus = 'complete' | 'error';

/** CLI arguments for the batch runner script */
export interface RunnerConfig {
  platform: string | null;
  all: boolean;
  mode: RunnerMode;
  scorer: ScorerMode;
  replicates: number;
  holdout: boolean;
  baselineRunId?: string;
  rerunRunId?: string;
  resumeRunId?: string;
}

// ============================================================================
// DECISION THRESHOLDS (§7)
// ============================================================================

/**
 * Regression: flag for review when score drops significantly.
 * - Mean score drops ≥ 5 AND any critical anchor previously preserved is now dropped
 * - OR mean score drops ≥ 8 regardless of anchor changes
 */
export function isRegression(
  currentMean: number,
  baselineMean: number,
  criticalAnchorNewlyDropped: boolean,
): boolean {
  const drop = baselineMean - currentMean;
  if (drop >= 8) return true;
  if (drop >= 5 && criticalAnchorNewlyDropped) return true;
  return false;
}

/**
 * Improvement: safe to ship when score rises meaningfully.
 * - Mean score rises ≥ 3 AND no previously preserved critical/important anchor is now dropped
 */
export function isImprovement(
  currentMean: number,
  baselineMean: number,
  anchorNewlyDropped: boolean,
): boolean {
  const gain = currentMean - baselineMean;
  return gain >= 3 && !anchorNewlyDropped;
}

// ============================================================================
// COST ESTIMATION (§7)
// ============================================================================

/**
 * Estimate API cost for a batch run.
 * Based on §7 cost estimates.
 */
export function estimateCost(config: {
  platformCount: number;
  sceneCount: number;
  replicates: number;
  scorer: ScorerMode;
}): { calls: number; estimatedUsd: string } {
  const runsPerPlatform = config.sceneCount * config.replicates;
  const totalRuns = config.platformCount * runsPerPlatform;

  // 2 API calls per run in builder mode (Call 3 + Score)
  let callsPerRun = 2;
  if (config.scorer === 'dual_full') callsPerRun = 3; // + Claude

  const totalCalls = totalRuns * callsPerRun;

  // Rough cost: ~$0.0015 per GPT call, ~$0.005 per Claude call
  const gptCost = totalRuns * 2 * 0.0015;
  const claudeCost = config.scorer === 'dual_full' ? totalRuns * 0.005 : 0;
  const totalCost = gptCost + claudeCost;

  return {
    calls: totalCalls,
    estimatedUsd: `$${totalCost.toFixed(2)}–$${(totalCost * 2).toFixed(2)}`,
  };
}
