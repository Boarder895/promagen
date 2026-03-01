// src/lib/admin/anomaly-thresholds.ts
// ============================================================================
// ANOMALY THRESHOLDS — Pure evaluation functions
// ============================================================================
//
// Evaluates raw section data against configurable thresholds to produce
// a flat list of anomalies for the Anomaly Alert Banner (7.11g).
//
// Design: No fetch calls, no side effects. Functions accept pre-fetched
// section data and return Anomaly[] — making them trivially testable.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 10
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface Anomaly {
  /** Unique key for deduplication + acknowledge tracking */
  id: string;
  /** Human-readable title */
  title: string;
  /** Extended detail (cause / recommendation) */
  detail: string;
  /** Severity level */
  severity: AnomalySeverity;
  /** Section ID to scroll to (drill-through target) */
  jumpTo: string;
  /** Section label for the jump button */
  jumpLabel: string;
}

// ============================================================================
// THRESHOLD CONSTANTS
// ============================================================================

export const ANOMALY_THRESHOLDS = {
  /** Correlation drop in recent history */
  CORRELATION_DROP_CRITICAL: 0.10, // > 10% drop → CRITICAL
  CORRELATION_DROP_WARNING: 0.05,  // > 5% drop  → WARNING

  /** Stale pipeline data (minutes) */
  STALE_DATA_CRITICAL_MIN: 72 * 60, // 72 hours
  STALE_DATA_WARNING_MIN: 36 * 60,  // 36 hours

  /** Anti-pattern spike */
  ANTI_PATTERN_HIGH_THRESHOLD: 1,   // ≥ 1 new high-severity → WARNING

  /** Feedback satisfaction drop */
  FEEDBACK_SAT_DROP_THRESHOLD: 50,  // platform score < 50% → WARNING

  /** Weight divergence: any tier > 50% from baseline (1/N) */
  WEIGHT_DIVERGENCE_THRESHOLD: 50,  // percent
} as const;

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluate correlation health from overview data.
 */
export function evaluateCorrelation(
  correlation: number,
  correlationTrend: number,
  lastCronSuccess: boolean,
  lastCronTimestamp: string | null,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Correlation drop
  if (correlationTrend < 0) {
    const dropPct = Math.abs(correlationTrend);
    const previousCorrelation = correlation - correlationTrend;

    if (dropPct >= ANOMALY_THRESHOLDS.CORRELATION_DROP_CRITICAL) {
      anomalies.push({
        id: 'correlation-drop-critical',
        title: `Correlation dropped ${(dropPct * 100).toFixed(0)}% recently`,
        detail: `${previousCorrelation.toFixed(2)} → ${correlation.toFixed(2)}. Review weight drift section and consider rollback.`,
        severity: 'critical',
        jumpTo: 'weight-drift',
        jumpLabel: 'Weight Drift',
      });
    } else if (dropPct >= ANOMALY_THRESHOLDS.CORRELATION_DROP_WARNING) {
      anomalies.push({
        id: 'correlation-drop-warning',
        title: `Correlation dropped ${(dropPct * 100).toFixed(0)}%`,
        detail: `${previousCorrelation.toFixed(2)} → ${correlation.toFixed(2)}. Monitor over next few cron cycles.`,
        severity: 'warning',
        jumpTo: 'scorer-health',
        jumpLabel: 'Scorer Health',
      });
    }
  }

  // Cron failure
  if (!lastCronSuccess && lastCronTimestamp) {
    anomalies.push({
      id: 'cron-failure',
      title: 'Last cron run failed',
      detail: `Last attempt: ${lastCronTimestamp}. Pipeline data may be stale. Check server logs.`,
      severity: 'critical',
      jumpTo: 'scorer-health',
      jumpLabel: 'Scorer Health',
    });
  }

  return anomalies;
}

/**
 * Evaluate temporal data freshness.
 */
export function evaluateTemporalFreshness(
  channels: { label: string; ageMinutes: number; status: string }[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const ch of channels) {
    if (ch.ageMinutes < 0) continue; // no data yet — not an anomaly

    if (ch.ageMinutes >= ANOMALY_THRESHOLDS.STALE_DATA_CRITICAL_MIN) {
      anomalies.push({
        id: `stale-${ch.label.toLowerCase()}-critical`,
        title: `${ch.label} data critically stale (${Math.round(ch.ageMinutes / 60)}h)`,
        detail: `Expected refresh within 24h. Last update: ${Math.round(ch.ageMinutes / 60)} hours ago.`,
        severity: 'critical',
        jumpTo: 'temporal-trends',
        jumpLabel: 'Temporal Trends',
      });
    } else if (ch.ageMinutes >= ANOMALY_THRESHOLDS.STALE_DATA_WARNING_MIN) {
      anomalies.push({
        id: `stale-${ch.label.toLowerCase()}-warning`,
        title: `${ch.label} data stale (${Math.round(ch.ageMinutes / 60)}h since last cron)`,
        detail: `Expected within 24h. Check cron health.`,
        severity: 'warning',
        jumpTo: 'temporal-trends',
        jumpLabel: 'Temporal Trends',
      });
    }
  }

  return anomalies;
}

/**
 * Evaluate anti-pattern alerts.
 */
export function evaluateAntiPatterns(
  highCount: number,
  topPair?: { termA: string; termB: string; occurrenceCount: number; qualityImpact: number },
): Anomaly[] {
  if (highCount < ANOMALY_THRESHOLDS.ANTI_PATTERN_HIGH_THRESHOLD) return [];

  const detail = topPair
    ? `"${topPair.termA}" + "${topPair.termB}" (${topPair.occurrenceCount.toLocaleString()} occurrences, ${topPair.qualityImpact > 0 ? '+' : ''}${(topPair.qualityImpact * 100).toFixed(0)}% quality)`
    : `${highCount} high-severity patterns detected.`;

  return [{
    id: 'anti-patterns-spike',
    title: `${highCount} high-severity anti-pattern${highCount > 1 ? 's' : ''} detected`,
    detail,
    severity: 'warning',
    jumpTo: 'anti-patterns',
    jumpLabel: 'Anti-Patterns',
  }];
}

/**
 * Evaluate A/B test significance (info-level).
 */
export function evaluateABTests(
  running: number,
  concluded: number,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (concluded > 0) {
    anomalies.push({
      id: 'ab-test-concluded',
      title: `${concluded} A/B test${concluded > 1 ? 's' : ''} reached significance`,
      detail: `Review results and decide: promote or roll back.`,
      severity: 'info',
      jumpTo: 'ab-tests',
      jumpLabel: 'A/B Tests',
    });
  }

  return anomalies;
}

/**
 * Evaluate feedback satisfaction flags.
 */
export function evaluateFeedback(
  redFlags: { type: string; message: string; severity: string; platform?: string }[],
  platformSatisfaction: { platform: string; score: number; eventCount: number }[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Direct red flags from feedback API
  const criticalFlags = redFlags.filter((f) => f.severity === 'critical');
  const warningFlags = redFlags.filter((f) => f.severity === 'warning');

  if (criticalFlags.length > 0) {
    anomalies.push({
      id: 'feedback-critical',
      title: `${criticalFlags.length} critical feedback issue${criticalFlags.length > 1 ? 's' : ''}`,
      detail: criticalFlags.map((f) => f.message).join('; '),
      severity: 'critical',
      jumpTo: 'feedback-summary',
      jumpLabel: 'Feedback Summary',
    });
  }

  if (warningFlags.length > 0) {
    anomalies.push({
      id: 'feedback-warning',
      title: `${warningFlags.length} feedback warning${warningFlags.length > 1 ? 's' : ''}`,
      detail: warningFlags.map((f) => f.message).join('; '),
      severity: 'warning',
      jumpTo: 'feedback-summary',
      jumpLabel: 'Feedback Summary',
    });
  }

  // Low-satisfaction platforms not already caught by red flags
  const lowPlatforms = platformSatisfaction.filter(
    (p) => p.score < ANOMALY_THRESHOLDS.FEEDBACK_SAT_DROP_THRESHOLD && p.eventCount >= 3,
  );
  if (lowPlatforms.length > 0 && criticalFlags.length === 0) {
    anomalies.push({
      id: 'feedback-low-platforms',
      title: `${lowPlatforms.length} platform${lowPlatforms.length > 1 ? 's' : ''} below 50% satisfaction`,
      detail: lowPlatforms.map((p) => `${p.platform}: ${p.score}%`).join(', '),
      severity: 'warning',
      jumpTo: 'feedback-summary',
      jumpLabel: 'Feedback Summary',
    });
  }

  return anomalies;
}

/**
 * Evaluate weight divergence from baseline.
 */
export function evaluateWeightDivergence(
  factors: { factor: string; changePercent: number }[],
): Anomaly[] {
  const diverged = factors.filter(
    (f) => Math.abs(f.changePercent) > ANOMALY_THRESHOLDS.WEIGHT_DIVERGENCE_THRESHOLD,
  );

  if (diverged.length === 0) return [];

  const worst = diverged.reduce((a, b) =>
    Math.abs(b.changePercent) > Math.abs(a.changePercent) ? b : a,
  );

  return [{
    id: 'weight-divergence',
    title: `${diverged.length} weight factor${diverged.length > 1 ? 's' : ''} diverged > 50% from baseline`,
    detail: `Worst: "${worst.factor}" at ${worst.changePercent > 0 ? '+' : ''}${worst.changePercent.toFixed(0)}%. Consider reviewing tier models.`,
    severity: 'warning',
    jumpTo: 'tier-models',
    jumpLabel: 'Tier Models',
  }];
}

// ============================================================================
// AGGREGATE — convenience function to run all evaluators
// ============================================================================

export interface AnomalySourceData {
  overview: {
    correlation: number;
    correlationTrend: number;
    lastCronSuccess: boolean;
    lastCronTimestamp: string | null;
    abTestsConcluded: number;
    abTestsRunning: number;
  } | null;
  temporal: {
    channels: { label: string; ageMinutes: number; status: string }[];
  } | null;
  antiPatterns: {
    highCount: number;
    topPair?: { termA: string; termB: string; occurrenceCount: number; qualityImpact: number };
  } | null;
  feedback: {
    redFlags: { type: string; message: string; severity: string; platform?: string }[];
    platformSatisfaction: { platform: string; score: number; eventCount: number }[];
  } | null;
  weightDrift: {
    factors: { factor: string; changePercent: number }[];
  } | null;
}

/**
 * Run all anomaly evaluators and return a unified, severity-sorted list.
 */
export function evaluateAllAnomalies(data: AnomalySourceData): Anomaly[] {
  const all: Anomaly[] = [];

  if (data.overview) {
    all.push(...evaluateCorrelation(
      data.overview.correlation,
      data.overview.correlationTrend,
      data.overview.lastCronSuccess,
      data.overview.lastCronTimestamp,
    ));
    all.push(...evaluateABTests(
      data.overview.abTestsRunning,
      data.overview.abTestsConcluded,
    ));
  }

  if (data.temporal) {
    all.push(...evaluateTemporalFreshness(data.temporal.channels));
  }

  if (data.antiPatterns) {
    all.push(...evaluateAntiPatterns(
      data.antiPatterns.highCount,
      data.antiPatterns.topPair,
    ));
  }

  if (data.feedback) {
    all.push(...evaluateFeedback(
      data.feedback.redFlags,
      data.feedback.platformSatisfaction,
    ));
  }

  if (data.weightDrift) {
    all.push(...evaluateWeightDivergence(data.weightDrift.factors));
  }

  // Sort: critical first, then warning, then info
  const order: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };
  all.sort((a, b) => order[a.severity] - order[b.severity]);

  return all;
}
