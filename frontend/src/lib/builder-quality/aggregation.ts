// src/lib/builder-quality/aggregation.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Aggregation & Decision Logic
// ============================================================================
// Three-layer aggregation, decision thresholds, instability detection,
// comparison confidence, and baseline compatibility guards.
//
// All functions are pure and return structured objects — no console output,
// no formatting. Part 8 (dashboard) consumes these directly.
//
// Definitions (explicit, used everywhere):
//   preserved = exact + approximate
//   preservation % = preserved / total expected × 100
//   platform stddev = stddev across ALL raw result rows for that platform
//   instability = per-scene-per-platform stddev across replicates only
//
// v1.0.0 (3 Apr 2026): Initial implementation.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §7
// ChatGPT review: 93/100, signed off.
// ============================================================================

// ============================================================================
// STATISTICAL HELPERS
// ============================================================================

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function min(values: number[]): number {
  return values.length === 0 ? 0 : Math.min(...values);
}

export function max(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// TYPES — Result Row (matches what the batch runner stores)
// ============================================================================

/** Minimal result shape needed for aggregation (subset of DB row) */
export interface ResultRow {
  platform_id: string;
  platform_name: string;
  scene_id: string;
  scene_name: string;
  tier: number;
  replicate_index: number;
  gpt_score: number;
  anchors_expected: number;
  anchors_preserved: number;
  anchors_dropped: number;
  critical_anchors_dropped: number;
  anchor_audit?: AnchorAuditEntry[] | null;
  status: string;
  is_holdout: boolean;
}

interface AnchorAuditEntry {
  anchor: string;
  severity: 'critical' | 'important' | 'optional';
  status: 'exact' | 'approximate' | 'dropped';
  note?: string;
}

// ============================================================================
// TYPES — Aggregation Outputs (structured for Part 8 consumption)
// ============================================================================

/** Layer 1: Per-platform overall */
export interface PlatformAggregate {
  platformId: string;
  platformName: string;
  tier: number;
  /** Mean across ALL raw result rows for this platform */
  meanScore: number;
  minScore: number;
  maxScore: number;
  /** Stddev across ALL raw result rows (not scene means) */
  stddevScore: number;
  totalResults: number;
  /** (exact + approximate) / expected × 100 */
  preservationPct: number;
  criticalDropped: number;
  importantDropped: number;
  optionalDropped: number;
  unstableSceneCount: number;
  classification: Classification;
}

/** Layer 2: Per-scene overall */
export interface SceneAggregate {
  sceneId: string;
  sceneName: string;
  /** Mean across ALL platforms for this scene */
  meanScore: number;
  stddevScore: number;
  totalResults: number;
  preservationPct: number;
}

/** Layer 3: Per-platform-per-scene */
export interface PlatformSceneAggregate {
  platformId: string;
  sceneId: string;
  /** Mean across replicates only */
  meanScore: number;
  minScore: number;
  maxScore: number;
  /** Stddev across replicates (instability measure) */
  stddevScore: number;
  replicateCount: number;
  preservationPct: number;
  criticalDropped: number;
  importantDropped: number;
  optionalDropped: number;
  /** stddev > 8 across replicates */
  unstable: boolean;
  classification: Classification;
}

export type Classification =
  | 'regression'
  | 'improvement'
  | 'neutral'
  | 'neutral_unstable';

export type ComparisonConfidence = 'low' | 'medium' | 'high';

// ============================================================================
// TYPES — Comparison Outputs
// ============================================================================

export interface PlatformComparison {
  platformId: string;
  currentMean: number;
  baselineMean: number;
  delta: number;
  classification: Classification;
  confidence: ComparisonConfidence;
  criticalNewlyDropped: number;
  importantNewlyDropped: number;
  optionalNewlyDropped: number;
  worstSceneRegression: SceneRegression | null;
}

export interface SceneRegression {
  sceneId: string;
  currentMean: number;
  baselineMean: number;
  delta: number;
  criticalNewlyDropped: number;
}

export type CompatibilityCode =
  | 'MODE_MISMATCH_BLOCKED'
  | 'HOLDOUT_MISMATCH_BLOCKED'
  | 'SCORER_MODE_MISMATCH_WARN'
  | 'REPLICATE_COUNT_MISMATCH_WARN';

export interface CompatibilityCheck {
  compatible: boolean;
  blocked: boolean;
  codes: CompatibilityCode[];
  warnings: string[];
}

// ============================================================================
// LAYER 1 — Per-Platform Aggregation
// ============================================================================

export function aggregateByPlatform(results: ResultRow[]): PlatformAggregate[] {
  const complete = results.filter((r) => r.status === 'complete');
  const byPlatform = groupBy(complete, (r) => r.platform_id);

  return Object.entries(byPlatform)
    .map(([platformId, rows]) => {
      const scores = rows.map((r) => r.gpt_score);
      const totalExpected = rows.reduce((s, r) => s + r.anchors_expected, 0);
      const totalPreserved = rows.reduce((s, r) => s + r.anchors_preserved, 0);
      const { critical, important, optional } = countDroppedBySeverity(rows);

      // Instability: count scenes with stddev > 8 across replicates
      const byScene = groupBy(rows, (r) => r.scene_id);
      let unstableSceneCount = 0;
      for (const sceneRows of Object.values(byScene)) {
        if (sceneRows.length >= 2) {
          const sd = stddev(sceneRows.map((r) => r.gpt_score));
          if (sd > 8) unstableSceneCount++;
        }
      }

      return {
        platformId,
        platformName: rows[0]?.platform_name ?? platformId,
        tier: rows[0]?.tier ?? 3,
        meanScore: round2(mean(scores)),
        minScore: min(scores),
        maxScore: max(scores),
        stddevScore: round2(stddev(scores)),
        totalResults: rows.length,
        preservationPct: totalExpected > 0 ? round2((totalPreserved / totalExpected) * 100) : 0,
        criticalDropped: critical,
        importantDropped: important,
        optionalDropped: optional,
        unstableSceneCount,
        classification: 'neutral' as Classification, // Set during comparison
      };
    })
    .sort((a, b) => a.meanScore - b.meanScore);
}

// ============================================================================
// LAYER 2 — Per-Scene Aggregation
// ============================================================================

export function aggregateByScene(results: ResultRow[]): SceneAggregate[] {
  const complete = results.filter((r) => r.status === 'complete');
  const byScene = groupBy(complete, (r) => r.scene_id);

  return Object.entries(byScene)
    .map(([sceneId, rows]) => {
      const scores = rows.map((r) => r.gpt_score);
      const totalExpected = rows.reduce((s, r) => s + r.anchors_expected, 0);
      const totalPreserved = rows.reduce((s, r) => s + r.anchors_preserved, 0);

      return {
        sceneId,
        sceneName: rows[0]?.scene_name ?? sceneId,
        meanScore: round2(mean(scores)),
        stddevScore: round2(stddev(scores)),
        totalResults: rows.length,
        preservationPct: totalExpected > 0 ? round2((totalPreserved / totalExpected) * 100) : 0,
      };
    })
    .sort((a, b) => a.meanScore - b.meanScore);
}

// ============================================================================
// LAYER 3 — Per-Platform-Per-Scene Aggregation
// ============================================================================

export function aggregateByPlatformScene(results: ResultRow[]): PlatformSceneAggregate[] {
  const complete = results.filter((r) => r.status === 'complete');
  const byKey = groupBy(complete, (r) => `${r.platform_id}::${r.scene_id}`);

  return Object.entries(byKey).map(([, rows]) => {
    const scores = rows.map((r) => r.gpt_score);
    const totalExpected = rows.reduce((s, r) => s + r.anchors_expected, 0);
    const totalPreserved = rows.reduce((s, r) => s + r.anchors_preserved, 0);
    const { critical, important, optional } = countDroppedBySeverity(rows);
    const sd = round2(stddev(scores));

    return {
      platformId: rows[0]!.platform_id,
      sceneId: rows[0]!.scene_id,
      meanScore: round2(mean(scores)),
      minScore: min(scores),
      maxScore: max(scores),
      stddevScore: sd,
      replicateCount: rows.length,
      preservationPct: totalExpected > 0 ? round2((totalPreserved / totalExpected) * 100) : 0,
      criticalDropped: critical,
      importantDropped: important,
      optionalDropped: optional,
      unstable: sd > 8,
      classification: 'neutral' as Classification,
    };
  });
}

// ============================================================================
// BASELINE COMPATIBILITY
// ============================================================================

export function checkCompatibility(
  currentRun: { mode: string; includeHoldout: boolean; scorerMode: string; replicateCount: number },
  baselineRun: { mode: string; includeHoldout: boolean; scorerMode: string; replicateCount: number },
): CompatibilityCheck {
  const codes: CompatibilityCode[] = [];
  const warnings: string[] = [];
  let blocked = false;

  if (currentRun.mode !== baselineRun.mode) {
    codes.push('MODE_MISMATCH_BLOCKED');
    warnings.push(`Mode mismatch: current=${currentRun.mode}, baseline=${baselineRun.mode}. Builder vs pipeline results are not comparable.`);
    blocked = true;
  }

  if (currentRun.includeHoldout !== baselineRun.includeHoldout) {
    codes.push('HOLDOUT_MISMATCH_BLOCKED');
    warnings.push(`Holdout mismatch: current=${currentRun.includeHoldout}, baseline=${baselineRun.includeHoldout}. Scene sets differ.`);
    blocked = true;
  }

  if (currentRun.scorerMode !== baselineRun.scorerMode) {
    codes.push('SCORER_MODE_MISMATCH_WARN');
    warnings.push(`Scorer mode mismatch: current=${currentRun.scorerMode}, baseline=${baselineRun.scorerMode}. Scores may not be comparable.`);
  }

  if (currentRun.replicateCount !== baselineRun.replicateCount) {
    codes.push('REPLICATE_COUNT_MISMATCH_WARN');
    warnings.push(`Replicate count mismatch: current=${currentRun.replicateCount}, baseline=${baselineRun.replicateCount}. Reduced comparison confidence.`);
  }

  return {
    compatible: !blocked,
    blocked,
    codes,
    warnings,
  };
}

// ============================================================================
// COMPARISON CONFIDENCE
// ============================================================================

export function getComparisonConfidence(
  currentReplicates: number,
  baselineReplicates: number,
): ComparisonConfidence {
  if (currentReplicates >= 3 && baselineReplicates >= 3) return 'high';
  if (currentReplicates >= 3 || baselineReplicates >= 3) return 'medium';
  return 'low';
}

// ============================================================================
// DECISION CLASSIFICATION
// ============================================================================

/**
 * Classify a platform change vs baseline using the revised thresholds.
 *
 * Regression (any of):
 *   - Platform mean drops ≥5 AND any critical anchor newly dropped
 *   - Platform mean drops ≥8 regardless
 *   - Any single scene drops ≥8 with newly dropped critical anchor
 *
 * Improvement (all of):
 *   - Platform mean rises ≥4
 *   - No critical/important anchor newly dropped
 *   - No single scene drops ≥5
 *   - Confidence is high (both runs ≥3 replicates)
 *   - No scene flagged as unstable
 */
export function classifyPlatformChange(
  current: {
    meanScore: number;
    criticalNewlyDropped: number;
    importantNewlyDropped: number;
    unstableSceneCount: number;
    sceneDeltas: { sceneId: string; delta: number; criticalNewlyDropped: number }[];
  },
  baseline: {
    meanScore: number;
  },
  confidence: ComparisonConfidence,
): Classification {
  const delta = current.meanScore - baseline.meanScore;

  // ── Regression checks ────────────────────────────────────────
  // Platform-level
  if (delta <= -5 && current.criticalNewlyDropped > 0) return 'regression';
  if (delta <= -8) return 'regression';

  // Scene-level override: any single scene drops ≥8 with critical loss
  for (const sd of current.sceneDeltas) {
    if (sd.delta <= -8 && sd.criticalNewlyDropped > 0) return 'regression';
  }

  // ── Improvement checks ───────────────────────────────────────
  if (delta >= 4) {
    // Block improvement unless high confidence
    if (confidence !== 'high') return 'neutral';

    // Block if any critical or important anchor newly dropped
    if (current.criticalNewlyDropped > 0 || current.importantNewlyDropped > 0) return 'neutral';

    // Block if any single scene drops ≥5
    for (const sd of current.sceneDeltas) {
      if (sd.delta <= -5) return 'neutral';
    }

    // Block if any scene is unstable
    if (current.unstableSceneCount > 0) return 'neutral_unstable';

    return 'improvement';
  }

  // ── Neutral ──────────────────────────────────────────────────
  if (current.unstableSceneCount > 0) return 'neutral_unstable';
  return 'neutral';
}

// ============================================================================
// FULL COMPARISON — Compare current run to baseline
// ============================================================================

export function compareToBaseline(
  currentResults: ResultRow[],
  baselineResults: ResultRow[],
  confidence: ComparisonConfidence,
): {
  platforms: PlatformComparison[];
  worstSceneRegressions: SceneRegression[];
} {
  const currentByPlatform = groupBy(
    currentResults.filter((r) => r.status === 'complete'),
    (r) => r.platform_id,
  );
  const baselineByPlatform = groupBy(
    baselineResults.filter((r) => r.status === 'complete'),
    (r) => r.platform_id,
  );

  const platforms: PlatformComparison[] = [];
  const allSceneRegressions: SceneRegression[] = [];

  for (const [platformId, currentRows] of Object.entries(currentByPlatform)) {
    const baselineRows = baselineByPlatform[platformId];
    if (!baselineRows || baselineRows.length === 0) continue;

    const currentMean = round2(mean(currentRows.map((r) => r.gpt_score)));
    const baselineMean = round2(mean(baselineRows.map((r) => r.gpt_score)));

    // Per-scene comparison for this platform
    const currentByScene = groupBy(currentRows, (r) => r.scene_id);
    const baselineByScene = groupBy(baselineRows, (r) => r.scene_id);

    const sceneDeltas: { sceneId: string; delta: number; criticalNewlyDropped: number }[] = [];
    let criticalNewlyDropped = 0;
    let importantNewlyDropped = 0;
    let optionalNewlyDropped = 0;
    let unstableSceneCount = 0;
    let worstSceneRegression: SceneRegression | null = null;

    for (const [sceneId, curSceneRows] of Object.entries(currentByScene)) {
      const baseSceneRows = baselineByScene[sceneId];
      if (!baseSceneRows || baseSceneRows.length === 0) continue;

      const curSceneMean = round2(mean(curSceneRows.map((r) => r.gpt_score)));
      const baseSceneMean = round2(mean(baseSceneRows.map((r) => r.gpt_score)));
      const sceneDelta = round2(curSceneMean - baseSceneMean);

      // Newly dropped anchors: were preserved in baseline, dropped in current
      const baseCritDropped = baseSceneRows.reduce((s, r) => s + r.critical_anchors_dropped, 0);
      const curCritDropped = curSceneRows.reduce((s, r) => s + r.critical_anchors_dropped, 0);
      const sceneCritNewlyDropped = Math.max(0, curCritDropped - baseCritDropped);

      const { critical: curCrit, important: curImp, optional: curOpt } = countDroppedBySeverity(curSceneRows);
      const { critical: baseCrit, important: baseImp, optional: baseOpt } = countDroppedBySeverity(baseSceneRows);

      criticalNewlyDropped += Math.max(0, curCrit - baseCrit);
      importantNewlyDropped += Math.max(0, curImp - baseImp);
      optionalNewlyDropped += Math.max(0, curOpt - baseOpt);

      // Instability check
      if (curSceneRows.length >= 2) {
        const sd = stddev(curSceneRows.map((r) => r.gpt_score));
        if (sd > 8) unstableSceneCount++;
      }

      sceneDeltas.push({ sceneId, delta: sceneDelta, criticalNewlyDropped: sceneCritNewlyDropped });

      // Track worst scene regression
      if (sceneDelta < 0) {
        const regression: SceneRegression = {
          sceneId,
          currentMean: curSceneMean,
          baselineMean: baseSceneMean,
          delta: sceneDelta,
          criticalNewlyDropped: sceneCritNewlyDropped,
        };
        allSceneRegressions.push(regression);

        if (!worstSceneRegression || sceneDelta < worstSceneRegression.delta) {
          worstSceneRegression = regression;
        }
      }
    }

    const classification = classifyPlatformChange(
      {
        meanScore: currentMean,
        criticalNewlyDropped,
        importantNewlyDropped,
        unstableSceneCount,
        sceneDeltas,
      },
      { meanScore: baselineMean },
      confidence,
    );

    platforms.push({
      platformId,
      currentMean,
      baselineMean,
      delta: round2(currentMean - baselineMean),
      classification,
      confidence,
      criticalNewlyDropped,
      importantNewlyDropped,
      optionalNewlyDropped,
      worstSceneRegression,
    });
  }

  // Sort platforms by delta (worst first)
  platforms.sort((a, b) => a.delta - b.delta);

  // Sort all scene regressions by delta (worst first), take top 3
  allSceneRegressions.sort((a, b) => a.delta - b.delta);
  const worstSceneRegressions = allSceneRegressions.slice(0, 3);

  return { platforms, worstSceneRegressions };
}

// ============================================================================
// HELPERS
// ============================================================================

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

/**
 * Count dropped anchors by severity across all rows.
 * Uses anchor_audit JSONB when available, falls back to
 * critical_anchors_dropped column.
 */
function countDroppedBySeverity(rows: ResultRow[]): {
  critical: number;
  important: number;
  optional: number;
} {
  let critical = 0;
  let important = 0;
  let optional = 0;

  for (const row of rows) {
    if (row.anchor_audit && Array.isArray(row.anchor_audit)) {
      for (const entry of row.anchor_audit) {
        if (entry.status === 'dropped') {
          if (entry.severity === 'critical') critical++;
          else if (entry.severity === 'important') important++;
          else if (entry.severity === 'optional') optional++;
        }
      }
    } else {
      // Fallback: only critical count is available
      critical += row.critical_anchors_dropped;
    }
  }

  return { critical, important, optional };
}
