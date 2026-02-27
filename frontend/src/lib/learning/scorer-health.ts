// src/lib/learning/scorer-health.ts
// ============================================================================
// SELF-IMPROVING SCORER — Scorer Health Report
// ============================================================================
//
// Phase 6, Part 6.7 — Mechanism: Meta-Loop
//
// Measures whether the scorer is actually improving. Computes:
//   - Score-outcome Pearson correlation (overall + per-tier)
//   - Correlation trend (month-over-month)
//   - Weight drift (how much weights shifted this run)
//   - Actionable alerts (warnings, critical issues)
//   - Rolling history (last 30 runs)
//
// This is the "scorer that scores the scorer" — it tells us if the
// self-improving loop is working or if something is going wrong.
//
// Pure computation layer — receives data, returns report.
// No I/O, no database access, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10
// Build plan: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.7
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { computeOutcomeScore } from '@/lib/learning/outcome-score';
import { pearsonCorrelation } from '@/lib/learning/weight-recalibration';
import type { ScoringWeights } from '@/lib/learning/weight-recalibration';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum history entries retained (one per cron run) */
export const MAX_HISTORY_LENGTH = 30;

/** Correlation drop threshold for warning alert */
export const CORRELATION_DROP_WARNING = 0.05;

/** Correlation below this is critical */
export const CORRELATION_CRITICAL_THRESHOLD = 0.20;

/** Weight drift above this triggers a warning */
export const WEIGHT_DRIFT_WARNING = 0.5;

/** Minimum events per tier before we flag it */
export const MIN_TIER_EVENTS_INFO = 50;

const VALID_TIERS = [1, 2, 3, 4] as const;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Alert from the health report */
export interface HealthAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

/** Single history entry (one per cron run) */
export interface HealthHistoryEntry {
  date: string;
  correlation: number;
  eventCount: number;
  weightDrift: number;
}

/** Complete scorer health report */
export interface ScorerHealthReport {
  /** Schema version */
  version: string;

  /** ISO timestamp */
  generatedAt: string;

  /** Score-outcome correlation (Pearson r across all events) */
  overallCorrelation: number;

  /** Per-tier correlations */
  tierCorrelations: Record<string, number>;

  /** Month-over-month correlation change (positive = improving) */
  correlationTrend: number;

  /** Weight stability: 0 = stable, 1 = complete overhaul */
  weightDrift: number;

  /** Events processed */
  eventCount: number;

  /** Per-tier event counts */
  tierEventCounts: Record<string, number>;

  /** Actionable alerts */
  alerts: HealthAlert[];

  /** Rolling history (last 30 runs) */
  history: HealthHistoryEntry[];
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Generate a scorer health report.
 *
 * @param events — Qualifying prompt events
 * @param currentWeights — The scoring weights just computed this run
 * @param previousWeights — Scoring weights from the previous run (for drift)
 * @param previousReport — Previous health report (for history + trend)
 * @returns Complete ScorerHealthReport
 *
 * @example
 * const report = generateHealthReport(events, newWeights, oldWeights, oldReport);
 * await upsertLearnedWeights('scorer-health-report', report);
 */
export function generateHealthReport(
  events: PromptEventRow[],
  currentWeights: ScoringWeights | null,
  previousWeights: ScoringWeights | null,
  previousReport: ScorerHealthReport | null,
): ScorerHealthReport {
  const now = new Date().toISOString();

  // ── Correlations ────────────────────────────────────────────────────
  const { overall, perTier, tierEventCounts } = computeCorrelations(events);

  // ── Weight drift ────────────────────────────────────────────────────
  const weightDrift = computeWeightDrift(currentWeights, previousWeights);

  // ── Trend ───────────────────────────────────────────────────────────
  const previousCorrelation = previousReport?.overallCorrelation ?? null;
  const correlationTrend = previousCorrelation !== null
    ? round4(overall - previousCorrelation)
    : 0;

  // ── Alerts ──────────────────────────────────────────────────────────
  const alerts = generateAlerts(
    overall,
    correlationTrend,
    weightDrift,
    tierEventCounts,
    events.length,
  );

  // ── History ─────────────────────────────────────────────────────────
  const historyEntry: HealthHistoryEntry = {
    date: now,
    correlation: overall,
    eventCount: events.length,
    weightDrift,
  };

  const history = buildHistory(previousReport?.history ?? [], historyEntry);

  return {
    version: '1.0.0',
    generatedAt: now,
    overallCorrelation: overall,
    tierCorrelations: perTier,
    correlationTrend,
    weightDrift,
    eventCount: events.length,
    tierEventCounts,
    alerts,
    history,
  };
}

// ============================================================================
// CORRELATIONS
// ============================================================================

/**
 * Compute score-outcome Pearson correlation (overall + per-tier).
 *
 * This measures "does a higher health score actually predict better
 * user outcomes?" — the fundamental question Phase 6 answers.
 */
function computeCorrelations(events: PromptEventRow[]): {
  overall: number;
  perTier: Record<string, number>;
  tierEventCounts: Record<string, number>;
} {
  if (events.length === 0) {
    const perTier: Record<string, number> = {};
    const tierEventCounts: Record<string, number> = {};
    for (const t of VALID_TIERS) {
      perTier[String(t)] = 0;
      tierEventCounts[String(t)] = 0;
    }
    return { overall: 0, perTier, tierEventCounts };
  }

  // Pre-compute outcome scores and collect health scores
  const healthScores: number[] = [];
  const outcomeScores: number[] = [];

  // Group by tier
  const tierData = new Map<number, { health: number[]; outcome: number[] }>();

  for (const event of events) {
    const health = event.score;
    const outcome = computeOutcomeScore(event.outcome);

    healthScores.push(health);
    outcomeScores.push(outcome);

    if (!tierData.has(event.tier)) {
      tierData.set(event.tier, { health: [], outcome: [] });
    }
    const td = tierData.get(event.tier)!;
    td.health.push(health);
    td.outcome.push(outcome);
  }

  // Overall correlation
  const overall = round4(pearsonCorrelation(healthScores, outcomeScores));

  // Per-tier correlations
  const perTier: Record<string, number> = {};
  const tierEventCounts: Record<string, number> = {};

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const td = tierData.get(tierId);

    if (!td || td.health.length < 10) {
      perTier[tierKey] = 0;
      tierEventCounts[tierKey] = td?.health.length ?? 0;
      continue;
    }

    perTier[tierKey] = round4(pearsonCorrelation(td.health, td.outcome));
    tierEventCounts[tierKey] = td.health.length;
  }

  return { overall, perTier, tierEventCounts };
}

// ============================================================================
// WEIGHT DRIFT
// ============================================================================

/**
 * Compute weight drift between current and previous scoring weights.
 *
 * Drift = mean absolute difference between corresponding weights.
 * 0 = identical, 1 = completely different (theoretical maximum).
 *
 * Uses global weights for the comparison.
 */
export function computeWeightDrift(
  current: ScoringWeights | null,
  previous: ScoringWeights | null,
): number {
  if (!current || !previous) return 0;

  const currentWeights = current.global?.weights ?? {};
  const previousWeights = previous.global?.weights ?? {};

  const allKeys = new Set([
    ...Object.keys(currentWeights),
    ...Object.keys(previousWeights),
  ]);

  if (allKeys.size === 0) return 0;

  let totalDiff = 0;
  for (const key of allKeys) {
    const curr = currentWeights[key] ?? 0;
    const prev = previousWeights[key] ?? 0;
    totalDiff += Math.abs(curr - prev);
  }

  // Normalise: max possible drift for N factors is 2.0 (each moves from 0→1 or 1→0)
  // But in practice weights sum to 1.0 so max realistic drift is ~1.0
  return round4(Math.min(totalDiff, 1));
}

// ============================================================================
// ALERTS
// ============================================================================

/**
 * Generate actionable alerts based on health metrics.
 */
function generateAlerts(
  correlation: number,
  correlationTrend: number,
  weightDrift: number,
  tierEventCounts: Record<string, number>,
  totalEvents: number,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  // Critical: zero or near-zero events
  if (totalEvents === 0) {
    alerts.push({
      level: 'critical',
      message: 'No qualifying events found. Scorer cannot learn without data.',
    });
    return alerts; // No point checking anything else
  }

  // Critical: correlation near zero
  if (totalEvents >= 50 && Math.abs(correlation) < CORRELATION_CRITICAL_THRESHOLD) {
    alerts.push({
      level: 'critical',
      message: `Scorer has near-zero predictive value (r=${correlation.toFixed(3)}). Health scores do not predict user outcomes.`,
    });
  }

  // Warning: correlation declining
  if (correlationTrend < -CORRELATION_DROP_WARNING) {
    alerts.push({
      level: 'warning',
      message: `Score-outcome correlation declining (${correlationTrend > 0 ? '+' : ''}${correlationTrend.toFixed(3)} this run).`,
    });
  }

  // Warning: large weight drift
  if (weightDrift > WEIGHT_DRIFT_WARNING) {
    alerts.push({
      level: 'warning',
      message: `Significant weight recalibration detected (drift=${weightDrift.toFixed(3)}). Monitor for instability.`,
    });
  }

  // Info: tier with insufficient data
  for (const tierId of VALID_TIERS) {
    const count = tierEventCounts[String(tierId)] ?? 0;
    if (count < MIN_TIER_EVENTS_INFO && count > 0) {
      alerts.push({
        level: 'info',
        message: `Tier ${tierId} has only ${count} events (need ${MIN_TIER_EVENTS_INFO}+ for reliable weights).`,
      });
    }
  }

  // Info: improving correlation
  if (correlationTrend > CORRELATION_DROP_WARNING) {
    const pct = (correlationTrend * 100).toFixed(1);
    alerts.push({
      level: 'info',
      message: `Scorer is learning effectively (+${pct}% correlation this run).`,
    });
  }

  return alerts;
}

// ============================================================================
// HISTORY
// ============================================================================

/**
 * Build rolling history, capped at MAX_HISTORY_LENGTH.
 * Newest entry goes at the end.
 */
function buildHistory(
  previousHistory: HealthHistoryEntry[],
  newEntry: HealthHistoryEntry,
): HealthHistoryEntry[] {
  const history = [...previousHistory, newEntry];

  // Cap at max length — remove oldest entries
  if (history.length > MAX_HISTORY_LENGTH) {
    return history.slice(history.length - MAX_HISTORY_LENGTH);
  }

  return history;
}

// ============================================================================
// UTILITIES
// ============================================================================

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
