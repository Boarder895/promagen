// src/lib/admin/code-evolution-radar.ts
// ============================================================================
// CODE EVOLUTION RADAR — 9-System Self-Awareness Engine
// ============================================================================
//
// Every other dashboard section answers "is the DATA healthy?"
// This section answers "is the CODE still appropriate for the data?"
//
// ── The 9 Systems ──────────────────────────────────────────────────────
//
//   DETECTION LAYER (1–5):
//     1. Correlation Ceiling     — scoring formula hit its mathematical limit
//     2. Factor Exhaustion       — a weight pinned at floor for too long
//     3. Threshold Staleness     — hard-coded constants diverge from reality
//     4. Vocabulary Category Drift — new category emerging from user behaviour
//     5. Algorithm Saturation    — O(n²) scan approaching frame budget
//
//   INTELLIGENCE LAYER (6–9):
//     6. Assumption Registry     — explicit, testable per-file assumptions
//     7. Confidence Thermometer  — per-file decay based on data evolution
//     8. Predictive Drift        — time-to-stale forecasting
//     9. Evolution Proposals     — data-backed rewrite suggestions
//
// All pure functions.  No fetch, no DOM, no side effects.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 2.0.0 — Git-Aware Confidence + Act-on-Proposal workflow
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type DetectorSeverity = 'critical' | 'warning' | 'info' | 'healthy';

/** A single detector finding */
export interface DetectorResult {
  detectorId: string;
  detectorName: string;
  file: string;
  severity: DetectorSeverity;
  summary: string;
  detail: string;
  confidence: number;
  drillSection: string;
}

/** A testable assumption about what the code expects from data */
export interface Assumption {
  file: string;
  text: string;
  expected: string;
  observed: string;
  valid: boolean;
}

/** Per-file confidence score with decay breakdown */
export interface FileConfidence {
  file: string;
  confidence: number;
  decayFactors: {
    ageDays: number;
    ageDecay: number;
    volumeGrowthFactor: number;
    volumeDecay: number;
    brokenAssumptions: number;
    assumptionDecay: number;
    upstreamChanges: number;
    upstreamDecay: number;
  };
  detectorFindings: DetectorResult[];
  brokenAssumptions: Assumption[];
}

/** Time-to-stale prediction */
export interface DriftPrediction {
  file: string;
  currentValue: number;
  threshold: number;
  metric: string;
  velocityPerWeek: number;
  weeksUntilStale: number | null;
  summary: string;
}

/** Data-backed suggestion for code evolution */
export interface EvolutionProposal {
  file: string;
  title: string;
  description: string;
  dataBasis: string;
  expectedImpact: string;
  urgency: DetectorSeverity;
}

/** Historical evolution event */
export interface EvolutionHistoryEntry {
  date: string;
  file: string;
  action: string;
  /** What kind of action the admin took */
  actionType: 'acted' | 'reviewed' | 'dismissed';
  confidenceBefore: number;
  confidenceAfter: number;
  impact: string;
  /** Proposal title if acting on a proposal */
  proposalTitle?: string;
  /** Detector that flagged the file */
  detectorId?: string;
}

/** POST body for acting on a proposal, reviewing, or dismissing a finding */
export interface EvolutionActionRequest {
  actionType: 'acted' | 'reviewed' | 'dismissed';
  file: string;
  proposalTitle?: string;
  detectorId?: string;
  /** Admin note (why they took this action) */
  note?: string;
  /** Current confidence before action */
  confidenceBefore: number;
}

/** Stored in learned_weights under key 'radar-history' */
export interface StoredRadarHistory {
  entries: EvolutionHistoryEntry[];
  /** Per-file last-reviewed ISO timestamp */
  reviews: Record<string, string>;
}

/** Complete radar report */
export interface RadarReport {
  files: FileConfidence[];
  detectorFindings: DetectorResult[];
  allAssumptions: Assumption[];
  brokenAssumptions: Assumption[];
  predictions: DriftPrediction[];
  proposals: EvolutionProposal[];
  history: EvolutionHistoryEntry[];
  /** Per-file last-reviewed dates (from stored history) */
  reviews: Record<string, string>;
  overallConfidence: number;
  summary: {
    filesMonitored: number;
    filesFlagged: number;
    critical: number;
    warning: number;
    healthy: number;
    earliestPrediction: string | null;
  };
  generatedAt: string;
}

// ============================================================================
// SOURCE DATA — What the API feeds into the radar
// ============================================================================

export interface RadarSourceData {
  // Overview
  correlation: number;
  correlationTrend: number;
  correlationHistory: { date: string; correlation: number }[];
  totalPrompts: number;
  weeklyDelta: number;
  lastCronSuccess: boolean;
  lastCronTimestamp: string | null;

  // Weights
  currentWeights: Record<string, number> | null;
  staticDefaults: Record<string, number>;
  weightFloor: number;
  factorFloorStreak: Record<string, number>;

  // Outcome signals
  codedSignalWeights: Record<string, number>;
  observedSignalDistribution: Record<string, number>;

  // Anti-patterns
  activePatternCount: number;
  patternGrowthPerWeek: number;
  maxPatternsBeforeSaturation: number;
  scanTimeMs: number;
  scanBudgetMs: number;

  // Vocabulary
  vocabularyCategoryCount: number;
  uncategorisedTermCount: number;
  uncategorisedGrowthPerWeek: number;
  emergingClusterTerms: string[];

  // Feedback
  feedbackTotal: number;
  feedbackThisWeek: number;

  // Code metadata
  codeLastUpdated: Record<string, string>;
  dataVolumeAtCodeWrite: Record<string, number>;
}

// ============================================================================
// SYSTEM 1: CORRELATION CEILING DETECTOR
// ============================================================================

export const CORRELATION_PLATEAU_RUNS = 10;

export function detectCorrelationCeiling(
  history: { date: string; correlation: number }[],
): DetectorResult | null {
  if (history.length < CORRELATION_PLATEAU_RUNS) return null;

  const recent = history.slice(-CORRELATION_PLATEAU_RUNS);
  const values = recent.map((h) => h.correlation);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

  // Variance < 0.005 = effectively flat
  if (variance >= 0.005) return null;

  const plateauLevel = Math.round(mean * 100) / 100;

  return {
    detectorId: 'correlation-ceiling',
    detectorName: 'Correlation Ceiling',
    file: 'weight-recalibration.ts',
    severity: plateauLevel < 0.5 ? 'critical' : plateauLevel < 0.7 ? 'warning' : 'info',
    summary: `Correlation plateaued at ${plateauLevel} for ${CORRELATION_PLATEAU_RUNS}+ runs`,
    detail: `The scoring formula has hit its mathematical ceiling at r=${plateauLevel}. `
      + `No amount of weight tuning will improve it beyond this point. `
      + `Variance over last ${CORRELATION_PLATEAU_RUNS} runs: ${variance.toFixed(4)}. `
      + `The formula needs a new scoring factor or structural change to break through.`,
    confidence: Math.min(95, Math.round((1 - variance / 0.005) * 95)),
    drillSection: 'weight-drift',
  };
}

// ============================================================================
// SYSTEM 2: FACTOR EXHAUSTION DETECTOR
// ============================================================================

export const FLOOR_STREAK_THRESHOLD = 20;

export function detectFactorExhaustion(
  factorFloorStreak: Record<string, number>,
  weightFloor: number,
): DetectorResult[] {
  const results: DetectorResult[] = [];

  for (const [factor, streak] of Object.entries(factorFloorStreak)) {
    if (streak >= FLOOR_STREAK_THRESHOLD) {
      results.push({
        detectorId: 'factor-exhaustion',
        detectorName: 'Factor Exhaustion',
        file: 'weight-recalibration.ts',
        severity: streak >= 30 ? 'warning' : 'info',
        summary: `"${factor}" at floor weight (${weightFloor}) for ${streak} consecutive runs`,
        detail: `The "${factor}" scoring factor has been pinned at WEIGHT_FLOOR (${weightFloor}) `
          + `for ${streak} consecutive cron runs. It contributes effectively nothing to scores `
          + `but still executes every cron cycle. Consider removing it from the pipeline `
          + `or replacing it with a more predictive factor.`,
        confidence: Math.min(90, 50 + streak),
        drillSection: 'weight-drift',
      });
    }
  }

  return results;
}

// ============================================================================
// SYSTEM 3: THRESHOLD STALENESS DETECTOR
// ============================================================================

export const SIGNAL_DIVERGENCE_THRESHOLD = 0.15;

export function detectThresholdStaleness(
  codedWeights: Record<string, number>,
  observedDistribution: Record<string, number>,
): DetectorResult[] {
  const results: DetectorResult[] = [];

  const obsTotal = Object.values(observedDistribution).reduce((s, v) => s + Math.abs(v), 0);
  if (obsTotal === 0) return results;

  const codedTotal = Object.values(codedWeights).reduce((s, v) => s + Math.abs(v), 0);
  if (codedTotal === 0) return results;

  const normObs: Record<string, number> = {};
  for (const [k, v] of Object.entries(observedDistribution)) {
    normObs[k] = Math.abs(v) / obsTotal;
  }

  const normCoded: Record<string, number> = {};
  for (const [k, v] of Object.entries(codedWeights)) {
    normCoded[k] = Math.abs(v) / codedTotal;
  }

  const allSignals = new Set([...Object.keys(normCoded), ...Object.keys(normObs)]);

  for (const signal of allSignals) {
    const coded = normCoded[signal] ?? 0;
    const observed = normObs[signal] ?? 0;
    const divergence = Math.abs(observed - coded);

    if (divergence >= SIGNAL_DIVERGENCE_THRESHOLD) {
      const direction = observed > coded ? 'underweighted' : 'overweighted';
      results.push({
        detectorId: 'threshold-staleness',
        detectorName: 'Threshold Staleness',
        file: 'outcome-score.ts',
        severity: divergence >= 0.30 ? 'warning' : 'info',
        summary: `"${signal}" signal ${direction}: coded ${(coded * 100).toFixed(0)}% vs observed ${(observed * 100).toFixed(0)}%`,
        detail: `The "${signal}" outcome signal is coded at ${(coded * 100).toFixed(1)}% weight `
          + `but drives ${(observed * 100).toFixed(1)}% of actual positive outcomes. `
          + `Divergence: ${(divergence * 100).toFixed(1)}pp. `
          + `The hard-coded signal weights in outcome-score.ts may need rebalancing.`,
        confidence: Math.min(88, Math.round(divergence * 200)),
        drillSection: 'feedback-summary',
      });
    }
  }

  return results;
}

// ============================================================================
// SYSTEM 4: VOCABULARY CATEGORY DRIFT DETECTOR
// ============================================================================

export const UNCATEGORISED_WARNING = 30;
export const UNCATEGORISED_CRITICAL = 60;

export function detectVocabularyDrift(
  uncategorisedCount: number,
  categoryCount: number,
  emergingClusterTerms: string[],
): DetectorResult | null {
  if (uncategorisedCount < UNCATEGORISED_WARNING) return null;

  const clusterPreview = emergingClusterTerms.slice(0, 6).join(', ');
  const severity: DetectorSeverity =
    uncategorisedCount >= UNCATEGORISED_CRITICAL ? 'warning' : 'info';

  return {
    detectorId: 'vocabulary-drift',
    detectorName: 'Vocabulary Category Drift',
    file: 'vocabulary system',
    severity,
    summary: `${uncategorisedCount} uncategorised terms — possible ${categoryCount + 1}th category emerging`,
    detail: `${uncategorisedCount} vocabulary terms don't fit the existing ${categoryCount} categories `
      + `and show high co-occurrence clustering. `
      + (clusterPreview ? `Top cluster terms: ${clusterPreview}. ` : '')
      + `This suggests a new category is emerging organically from user behaviour.`,
    confidence: Math.min(85, 40 + uncategorisedCount),
    drillSection: 'term-quality',
  };
}

// ============================================================================
// SYSTEM 5: ALGORITHM SATURATION DETECTOR
// ============================================================================

export const SATURATION_WARNING_RATIO = 0.75;

export function detectAlgorithmSaturation(
  activePatterns: number,
  maxPatterns: number,
  scanTimeMs: number,
  scanBudgetMs: number,
): DetectorResult | null {
  const patternRatio = maxPatterns > 0 ? activePatterns / maxPatterns : 0;
  const timeRatio = scanBudgetMs > 0 ? scanTimeMs / scanBudgetMs : 0;

  if (patternRatio < SATURATION_WARNING_RATIO && timeRatio < SATURATION_WARNING_RATIO) {
    return null;
  }

  const worstRatio = Math.max(patternRatio, timeRatio);
  const severity: DetectorSeverity =
    worstRatio >= 0.95 ? 'critical' : worstRatio >= 0.85 ? 'warning' : 'info';

  return {
    detectorId: 'algorithm-saturation',
    detectorName: 'Algorithm Saturation',
    file: 'anti-pattern-detection.ts',
    severity,
    summary: `Patterns ${activePatterns}/${maxPatterns} (${Math.round(patternRatio * 100)}%) — scan ${scanTimeMs}ms/${scanBudgetMs}ms`,
    detail: `The anti-pattern O(n²) pair scan is approaching capacity. `
      + `Patterns: ${activePatterns}/${maxPatterns} (${Math.round(patternRatio * 100)}%). `
      + `Scan time: ${scanTimeMs}ms of ${scanBudgetMs}ms budget (${Math.round(timeRatio * 100)}%). `
      + `Consider optimising the pair-matching algorithm (hash-indexed lookup) or increasing the cap.`,
    confidence: Math.min(92, Math.round(worstRatio * 95)),
    drillSection: 'anti-patterns',
  };
}

// ============================================================================
// SYSTEM 6: ASSUMPTION REGISTRY
// ============================================================================

export function evaluateAssumptions(source: RadarSourceData): Assumption[] {
  const assumptions: Assumption[] = [];

  // ── weight-recalibration.ts ─────────────────────────────────────────
  const factorCount = source.currentWeights
    ? Object.keys(source.currentWeights).length
    : Object.keys(source.staticDefaults).length;

  assumptions.push({
    file: 'weight-recalibration.ts',
    text: 'Scoring factors: exactly 7',
    expected: '7 factors',
    observed: `${factorCount} factors`,
    valid: factorCount === 7,
  });

  assumptions.push({
    file: 'weight-recalibration.ts',
    text: 'Minimum 100 events for recalibration',
    expected: '≥ 100 events',
    observed: `${source.totalPrompts.toLocaleString()} events`,
    valid: source.totalPrompts >= 100,
  });

  // ── outcome-score.ts ────────────────────────────────────────────────
  const signalCount = Object.keys(source.codedSignalWeights).length;
  assumptions.push({
    file: 'outcome-score.ts',
    text: 'Outcome signals: exactly 8 (5 base + 3 feedback)',
    expected: '8 signals',
    observed: `${signalCount} signals`,
    valid: signalCount === 8,
  });

  // Check signal dominance
  const obsTotal = Object.values(source.observedSignalDistribution)
    .reduce((s, v) => s + Math.abs(v), 0);
  if (obsTotal > 0) {
    for (const [signal, value] of Object.entries(source.observedSignalDistribution)) {
      const pct = Math.abs(value) / obsTotal;
      if (pct > 0.50) {
        assumptions.push({
          file: 'outcome-score.ts',
          text: 'No single signal should dominate >50%',
          expected: 'Each signal ≤ 50%',
          observed: `"${signal}" drives ${Math.round(pct * 100)}%`,
          valid: false,
        });
      }
    }
  }

  // ── anti-pattern-detection.ts ───────────────────────────────────────
  assumptions.push({
    file: 'anti-pattern-detection.ts',
    text: 'Pattern count within O(n²) scan capacity',
    expected: `≤ ${source.maxPatternsBeforeSaturation} patterns`,
    observed: `${source.activePatternCount} patterns`,
    valid: source.activePatternCount <= source.maxPatternsBeforeSaturation,
  });

  assumptions.push({
    file: 'anti-pattern-detection.ts',
    text: 'Scan time within frame budget',
    expected: `≤ ${source.scanBudgetMs}ms`,
    observed: `${source.scanTimeMs}ms`,
    valid: source.scanTimeMs <= source.scanBudgetMs,
  });

  // ── vocabulary system ───────────────────────────────────────────────
  assumptions.push({
    file: 'vocabulary system',
    text: `${source.vocabularyCategoryCount} categories cover all terms`,
    expected: `< ${UNCATEGORISED_WARNING} uncategorised`,
    observed: `${source.uncategorisedTermCount} uncategorised`,
    valid: source.uncategorisedTermCount < UNCATEGORISED_WARNING,
  });

  // ── temporal-intelligence.ts ────────────────────────────────────────
  assumptions.push({
    file: 'temporal-intelligence.ts',
    text: 'Cron pipeline runs successfully',
    expected: 'Last cron succeeded',
    observed: source.lastCronSuccess ? 'Succeeded' : 'Failed',
    valid: source.lastCronSuccess,
  });

  return assumptions;
}

// ============================================================================
// SYSTEM 7: CONFIDENCE THERMOMETER
// ============================================================================

/**
 * Confidence = 100 − ageDecay − volumeDecay − assumptionDecay − upstreamDecay
 *
 *   ageDecay:        1pt per 2 days, max 30
 *   volumeDecay:     log₂(growthFactor) × 8, max 25
 *   assumptionDecay: 8pt per broken assumption, max 25
 *   upstreamDecay:   10pt per changed upstream, max 20
 */
export function computeFileConfidence(
  file: string,
  ageDays: number,
  volumeGrowthFactor: number,
  brokenAssumptionCount: number,
  upstreamChanges: number,
  detectorFindings: DetectorResult[],
  brokenAssumptions: Assumption[],
): FileConfidence {
  const ageDecay = Math.min(30, Math.floor(ageDays / 2));
  const volumeDecay = Math.min(25, Math.floor(Math.log2(Math.max(1, volumeGrowthFactor)) * 8));
  const assumptionDecay = Math.min(25, brokenAssumptionCount * 8);
  const upstreamDecay = Math.min(20, upstreamChanges * 10);

  const confidence = Math.max(0, 100 - ageDecay - volumeDecay - assumptionDecay - upstreamDecay);

  return {
    file,
    confidence,
    decayFactors: {
      ageDays,
      ageDecay,
      volumeGrowthFactor,
      volumeDecay,
      brokenAssumptions: brokenAssumptionCount,
      assumptionDecay,
      upstreamChanges,
      upstreamDecay,
    },
    detectorFindings,
    brokenAssumptions,
  };
}

// ============================================================================
// SYSTEM 8: PREDICTIVE DRIFT
// ============================================================================

export function predictDrift(source: RadarSourceData): DriftPrediction[] {
  const predictions: DriftPrediction[] = [];

  // ── Anti-pattern count → saturation ─────────────────────────────────
  if (source.patternGrowthPerWeek > 0 && source.activePatternCount < source.maxPatternsBeforeSaturation) {
    const remaining = source.maxPatternsBeforeSaturation - source.activePatternCount;
    const weeks = remaining / source.patternGrowthPerWeek;
    predictions.push({
      file: 'anti-pattern-detection.ts',
      currentValue: source.activePatternCount,
      threshold: source.maxPatternsBeforeSaturation,
      metric: 'active patterns',
      velocityPerWeek: source.patternGrowthPerWeek,
      weeksUntilStale: Math.round(weeks * 10) / 10,
      summary: `Pattern saturation in ~${Math.round(weeks)} weeks at +${source.patternGrowthPerWeek}/week`,
    });
  }

  // ── Uncategorised terms → new category needed ───────────────────────
  if (source.uncategorisedGrowthPerWeek > 0 && source.uncategorisedTermCount < UNCATEGORISED_CRITICAL) {
    const remaining = UNCATEGORISED_CRITICAL - source.uncategorisedTermCount;
    const weeks = remaining / source.uncategorisedGrowthPerWeek;
    predictions.push({
      file: 'vocabulary system',
      currentValue: source.uncategorisedTermCount,
      threshold: UNCATEGORISED_CRITICAL,
      metric: 'uncategorised terms',
      velocityPerWeek: source.uncategorisedGrowthPerWeek,
      weeksUntilStale: Math.round(weeks * 10) / 10,
      summary: `New category needed in ~${Math.round(weeks)} weeks at +${source.uncategorisedGrowthPerWeek}/week`,
    });
  }

  // ── O(n²) scan time → budget exceeded ───────────────────────────────
  if (source.scanTimeMs > 0 && source.scanBudgetMs > 0 && source.patternGrowthPerWeek > 0) {
    const n0 = source.activePatternCount;
    const budget = source.scanBudgetMs;
    const current = source.scanTimeMs;
    if (current < budget && n0 > 0) {
      const nMax = n0 * Math.sqrt(budget / current);
      const weeks = (nMax - n0) / source.patternGrowthPerWeek;
      if (weeks > 0 && weeks < 52) {
        predictions.push({
          file: 'anti-pattern-detection.ts',
          currentValue: current,
          threshold: budget,
          metric: 'scan time (ms)',
          velocityPerWeek: source.patternGrowthPerWeek,
          weeksUntilStale: Math.round(weeks * 10) / 10,
          summary: `Scan budget exceeded in ~${Math.round(weeks)} weeks at current growth`,
        });
      }
    }
  }

  // ── Correlation plateau persistence ─────────────────────────────────
  if (source.correlationHistory.length >= CORRELATION_PLATEAU_RUNS) {
    const recent = source.correlationHistory.slice(-CORRELATION_PLATEAU_RUNS);
    const vals = recent.map((h) => h.correlation);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    if (variance < 0.005 && mean < 0.80) {
      predictions.push({
        file: 'weight-recalibration.ts',
        currentValue: Math.round(mean * 100),
        threshold: 80,
        metric: 'correlation (%)',
        velocityPerWeek: 0,
        weeksUntilStale: null,
        summary: `Correlation stuck at ${(mean * 100).toFixed(0)}% — needs structural change, not time`,
      });
    }
  }

  predictions.sort((a, b) => (a.weeksUntilStale ?? 999) - (b.weeksUntilStale ?? 999));
  return predictions;
}

// ============================================================================
// SYSTEM 9: EVOLUTION PROPOSALS
// ============================================================================

export function generateProposals(
  findings: DetectorResult[],
  source: RadarSourceData,
): EvolutionProposal[] {
  const proposals: EvolutionProposal[] = [];

  // ── Correlation ceiling → new factor ────────────────────────────────
  if (findings.some((f) => f.detectorId === 'correlation-ceiling')) {
    proposals.push({
      file: 'weight-recalibration.ts',
      title: 'Add new scoring factor to break correlation ceiling',
      description: 'The scoring formula has plateaued. Introduce a new factor that captures '
        + 'prompt quality dimensions the current 7 factors miss. '
        + 'Candidates: styleComplexity, environmentDetail, subjectSpecificity.',
      dataBasis: `Correlation flat at ${source.correlation.toFixed(2)} for ${source.correlationHistory.length}+ runs`,
      expectedImpact: 'Potential +0.05 to +0.15 correlation improvement',
      urgency: 'warning',
    });
  }

  // ── Factor exhaustion → remove dead factor ──────────────────────────
  for (const finding of findings.filter((f) => f.detectorId === 'factor-exhaustion')) {
    const match = finding.summary.match(/"([^"]+)"/);
    const factor = match ? match[1] : 'unknown';
    const streakMatch = finding.summary.match(/for (\d+)/);
    const streak = streakMatch ? streakMatch[1] : '?';

    proposals.push({
      file: 'weight-recalibration.ts',
      title: `Remove "${factor}" from scoring pipeline`,
      description: `"${factor}" at WEIGHT_FLOOR for ${streak} consecutive runs. `
        + `It contributes nothing but still executes every cron cycle.`,
      dataBasis: `${streak} runs at floor weight ${source.weightFloor}`,
      expectedImpact: 'Reduced cron time, cleaner weight vector',
      urgency: 'info',
    });
  }

  // ── Threshold staleness → rebalance signals ─────────────────────────
  const staleness = findings.filter((f) => f.detectorId === 'threshold-staleness');
  if (staleness.length > 0) {
    const suggestions: string[] = [];
    for (const [signal, coded] of Object.entries(source.codedSignalWeights)) {
      const obs = source.observedSignalDistribution[signal];
      if (obs !== undefined) {
        suggestions.push(`${signal}: ${coded.toFixed(2)} → ${obs.toFixed(2)}`);
      }
    }
    proposals.push({
      file: 'outcome-score.ts',
      title: 'Rebalance outcome signal weights',
      description: 'Hard-coded signal weights diverge from observed outcome distributions.\n'
        + 'Recommended rebalance:\n' + suggestions.join('\n'),
      dataBasis: `${source.totalPrompts.toLocaleString()} events analysed`,
      expectedImpact: 'Better outcome accuracy, improved weight recalibration downstream',
      urgency: 'warning',
    });
  }

  // ── Vocabulary drift → add category ─────────────────────────────────
  if (findings.some((f) => f.detectorId === 'vocabulary-drift')) {
    const terms = source.emergingClusterTerms.slice(0, 8).join(', ');
    proposals.push({
      file: 'vocabulary system',
      title: `Add ${source.vocabularyCategoryCount + 1}th vocabulary category`,
      description: `${source.uncategorisedTermCount} terms with high co-occurrence don't fit existing categories.`
        + (terms ? ` Top cluster: ${terms}.` : ''),
      dataBasis: `${source.uncategorisedTermCount} uncategorised, +${source.uncategorisedGrowthPerWeek}/week`,
      expectedImpact: 'Better term classification, improved coherence scoring',
      urgency: 'info',
    });
  }

  // ── Algorithm saturation → optimise ─────────────────────────────────
  if (findings.some((f) => f.detectorId === 'algorithm-saturation')) {
    proposals.push({
      file: 'anti-pattern-detection.ts',
      title: 'Optimise pair-matching algorithm',
      description: `O(n²) pair scan approaching capacity. Replace with hash-indexed lookup `
        + `for O(n). Current: ${source.activePatternCount} patterns, `
        + `${source.scanTimeMs}ms/${source.scanBudgetMs}ms budget.`,
      dataBasis: `${source.activePatternCount}/${source.maxPatternsBeforeSaturation} patterns, +${source.patternGrowthPerWeek}/week`,
      expectedImpact: 'O(n²) → O(n), ~60% scan time reduction',
      urgency: findings.some((f) => f.detectorId === 'algorithm-saturation' && f.severity === 'critical')
        ? 'critical' : 'warning',
    });
  }

  return proposals;
}

// ============================================================================
// MASTER EVALUATOR — Runs all 9 systems
// ============================================================================

const MONITORED_FILES = [
  'weight-recalibration.ts',
  'outcome-score.ts',
  'anti-pattern-detection.ts',
  'vocabulary system',
  'temporal-intelligence.ts',
];

export function evaluateRadar(source: RadarSourceData): RadarReport {
  const now = new Date().toISOString();

  // ── Systems 1–5: Detection layer ────────────────────────────────────
  const findings: DetectorResult[] = [];

  const ceiling = detectCorrelationCeiling(source.correlationHistory);
  if (ceiling) findings.push(ceiling);

  findings.push(...detectFactorExhaustion(source.factorFloorStreak, source.weightFloor));

  findings.push(...detectThresholdStaleness(
    source.codedSignalWeights,
    source.observedSignalDistribution,
  ));

  const vocabDrift = detectVocabularyDrift(
    source.uncategorisedTermCount,
    source.vocabularyCategoryCount,
    source.emergingClusterTerms,
  );
  if (vocabDrift) findings.push(vocabDrift);

  const saturation = detectAlgorithmSaturation(
    source.activePatternCount,
    source.maxPatternsBeforeSaturation,
    source.scanTimeMs,
    source.scanBudgetMs,
  );
  if (saturation) findings.push(saturation);

  // ── System 6: Assumption registry ───────────────────────────────────
  const allAssumptions = evaluateAssumptions(source);
  const brokenAssumptions = allAssumptions.filter((a) => !a.valid);

  // ── System 8: Predictive drift ──────────────────────────────────────
  const predictions = predictDrift(source);

  // ── System 9: Evolution proposals ───────────────────────────────────
  const proposals = generateProposals(findings, source);

  // ── System 7: Confidence thermometer (per file) ─────────────────────
  const files: FileConfidence[] = MONITORED_FILES.map((file) => {
    const lastUpdated = source.codeLastUpdated[file];
    const ageDays = lastUpdated
      ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const volumeAtWrite = source.dataVolumeAtCodeWrite[file] ?? source.totalPrompts;
    const volumeGrowth = volumeAtWrite > 0 ? source.totalPrompts / volumeAtWrite : 1;

    const fileFindings = findings.filter((f) => f.file === file);
    const fileBroken = brokenAssumptions.filter((a) => a.file === file);

    return computeFileConfidence(
      file, ageDays, volumeGrowth, fileBroken.length, 0,
      fileFindings, fileBroken,
    );
  });

  files.sort((a, b) => a.confidence - b.confidence);

  // ── Summary ─────────────────────────────────────────────────────────
  const overallConfidence = files.length > 0
    ? Math.round(files.reduce((s, f) => s + f.confidence, 0) / files.length)
    : 100;

  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;
  const filesFlagged = files.filter((f) => f.confidence < 80).length;
  const firstPred = predictions[0];
  const earliestPred = firstPred != null && firstPred.weeksUntilStale !== null
    ? `~${Math.round(firstPred.weeksUntilStale)}w` : null;

  return {
    files,
    detectorFindings: findings,
    allAssumptions,
    brokenAssumptions,
    predictions,
    proposals,
    history: [], // Populated by API from stored history
    reviews: {}, // Populated by API from stored history
    overallConfidence,
    summary: {
      filesMonitored: files.length,
      filesFlagged,
      critical,
      warning,
      healthy: files.filter((f) => f.confidence >= 80).length,
      earliestPrediction: earliestPred,
    },
    generatedAt: now,
  };
}

// ============================================================================
// REVIEW BOOST — Confidence recovery from human action
// ============================================================================

/**
 * When an admin acts on a proposal, reviews a file, or dismisses a finding,
 * confidence gets a boost:
 *   acted:    +25  (code was actually changed)
 *   reviewed: +15  (confirmed still appropriate — resets age decay)
 *   dismissed: +5  (acknowledged but chose not to act)
 */
export function computeReviewBoost(actionType: 'acted' | 'reviewed' | 'dismissed'): number {
  switch (actionType) {
    case 'acted': return 25;
    case 'reviewed': return 15;
    case 'dismissed': return 5;
  }
}

/**
 * Build the history entry for an evolution action.
 */
export function buildHistoryEntry(
  action: EvolutionActionRequest,
  confidenceAfterBoost: number,
): EvolutionHistoryEntry {
  const labels: Record<string, string> = {
    acted: `Acted on proposal: ${action.proposalTitle ?? action.file}`,
    reviewed: `Reviewed and confirmed: ${action.file}`,
    dismissed: `Dismissed finding for: ${action.file}`,
  };

  return {
    date: new Date().toISOString().slice(0, 10),
    file: action.file,
    action: action.note
      ? `${labels[action.actionType] ?? action.actionType} — ${action.note}`
      : (labels[action.actionType] ?? action.actionType),
    actionType: action.actionType,
    confidenceBefore: action.confidenceBefore,
    confidenceAfter: Math.min(100, confidenceAfterBoost),
    impact: action.actionType === 'acted'
      ? 'Code updated — confidence restored'
      : action.actionType === 'reviewed'
        ? 'Confirmed still appropriate — age decay reset'
        : 'Finding acknowledged — minor boost',
    proposalTitle: action.proposalTitle,
    detectorId: action.detectorId,
  };
}
