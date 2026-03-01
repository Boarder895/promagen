/**
 * Phase 7.11j — Code Evolution Radar Tests
 *
 * 49 tests across all 9 systems + review boost + master evaluator.
 *
 * Version: 2.0.0
 * Created: 2026-03-01
 */

import {
  detectCorrelationCeiling,
  detectFactorExhaustion,
  detectThresholdStaleness,
  detectVocabularyDrift,
  detectAlgorithmSaturation,
  evaluateAssumptions,
  computeFileConfidence,
  predictDrift,
  generateProposals,
  evaluateRadar,
  computeReviewBoost,
  buildHistoryEntry,
  CORRELATION_PLATEAU_RUNS,
  FLOOR_STREAK_THRESHOLD,
  SIGNAL_DIVERGENCE_THRESHOLD,
  UNCATEGORISED_WARNING,
  SATURATION_WARNING_RATIO,
  type RadarSourceData,
  type EvolutionActionRequest,
} from '@/lib/admin/code-evolution-radar';

// ============================================================================
// HELPERS — build source data with sensible defaults
// ============================================================================

function makeSource(overrides: Partial<RadarSourceData> = {}): RadarSourceData {
  return {
    correlation: 0.72,
    correlationTrend: 0.01,
    correlationHistory: [],
    totalPrompts: 5000,
    weeklyDelta: 200,
    lastCronSuccess: true,
    lastCronTimestamp: '2026-03-01T00:00:00Z',
    currentWeights: { a: 0.15, b: 0.15, c: 0.15, d: 0.15, e: 0.15, f: 0.15, g: 0.10 },
    staticDefaults: { a: 0.20, b: 0.20, c: 0.15, d: 0.15, e: 0.10, f: 0.10, g: 0.10 },
    weightFloor: 0.02,
    factorFloorStreak: {},
    codedSignalWeights: { copied: 0.10, copiedNoReturn: 0.15, saved: 0.35, reused: 0.50, penalty: -0.20 },
    observedSignalDistribution: { copied: 0.10, copiedNoReturn: 0.15, saved: 0.35, reused: 0.50, penalty: -0.20 },
    activePatternCount: 20,
    patternGrowthPerWeek: 3,
    maxPatternsBeforeSaturation: 500,
    scanTimeMs: 50,
    scanBudgetMs: 200,
    vocabularyCategoryCount: 11,
    uncategorisedTermCount: 5,
    uncategorisedGrowthPerWeek: 2,
    emergingClusterTerms: [],
    feedbackTotal: 100,
    feedbackThisWeek: 10,
    codeLastUpdated: { 'test-file.ts': '2026-02-15' },
    dataVolumeAtCodeWrite: { 'test-file.ts': 2000 },
    ...overrides,
  };
}

// ============================================================================
// SYSTEM 1: CORRELATION CEILING
// ============================================================================

describe('detectCorrelationCeiling', () => {
  it('returns null when not enough history', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({ date: `2026-02-${i + 1}`, correlation: 0.7 }));
    expect(detectCorrelationCeiling(history)).toBeNull();
  });

  it('detects plateau when variance is near zero', () => {
    const history = Array.from({ length: CORRELATION_PLATEAU_RUNS }, (_, i) => ({
      date: `2026-02-${i + 1}`,
      correlation: 0.72 + (i % 2 === 0 ? 0.001 : -0.001),
    }));
    const result = detectCorrelationCeiling(history);
    expect(result).not.toBeNull();
    expect(result!.detectorId).toBe('correlation-ceiling');
    expect(result!.file).toBe('weight-recalibration.ts');
  });

  it('returns null when correlation is still moving', () => {
    const history = Array.from({ length: CORRELATION_PLATEAU_RUNS }, (_, i) => ({
      date: `2026-02-${i + 1}`,
      correlation: 0.50 + i * 0.05,
    }));
    expect(detectCorrelationCeiling(history)).toBeNull();
  });

  it('flags critical severity for low plateau', () => {
    const history = Array.from({ length: CORRELATION_PLATEAU_RUNS }, (_, i) => ({
      date: `2026-02-${i + 1}`,
      correlation: 0.40,
    }));
    const result = detectCorrelationCeiling(history);
    expect(result!.severity).toBe('critical');
  });
});

// ============================================================================
// SYSTEM 2: FACTOR EXHAUSTION
// ============================================================================

describe('detectFactorExhaustion', () => {
  it('returns empty when no factor at floor', () => {
    expect(detectFactorExhaustion({ density: 5 }, 0.02)).toEqual([]);
  });

  it('detects factor at floor for >= threshold runs', () => {
    const results = detectFactorExhaustion({ density: FLOOR_STREAK_THRESHOLD }, 0.02);
    expect(results).toHaveLength(1);
    expect(results[0]!.summary).toContain('density');
  });

  it('detects multiple exhausted factors', () => {
    const results = detectFactorExhaustion(
      { density: 25, fidelity: 22 },
      0.02,
    );
    expect(results).toHaveLength(2);
  });

  it('flags warning severity for long streaks (>= 30)', () => {
    const results = detectFactorExhaustion({ density: 30 }, 0.02);
    expect(results[0]!.severity).toBe('warning');
  });
});

// ============================================================================
// SYSTEM 3: THRESHOLD STALENESS
// ============================================================================

describe('detectThresholdStaleness', () => {
  it('returns empty when distributions match', () => {
    const weights = { a: 0.5, b: 0.5 };
    expect(detectThresholdStaleness(weights, weights)).toEqual([]);
  });

  it('detects divergence above threshold', () => {
    const coded = { a: 0.10, b: 0.90 };
    const observed = { a: 0.50, b: 0.50 };
    const results = detectThresholdStaleness(coded, observed);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.detectorId).toBe('threshold-staleness');
  });

  it('returns empty when observed is empty', () => {
    expect(detectThresholdStaleness({ a: 0.5 }, {})).toEqual([]);
  });

  it('handles new signals not in coded weights', () => {
    const coded = { a: 0.5, b: 0.5 };
    const observed = { a: 0.3, b: 0.3, c: 0.4 };
    const results = detectThresholdStaleness(coded, observed);
    expect(results.some((r) => r.summary.includes('"c"'))).toBe(true);
  });
});

// ============================================================================
// SYSTEM 4: VOCABULARY DRIFT
// ============================================================================

describe('detectVocabularyDrift', () => {
  it('returns null when below warning threshold', () => {
    expect(detectVocabularyDrift(10, 11, [])).toBeNull();
  });

  it('detects drift at warning threshold', () => {
    const result = detectVocabularyDrift(UNCATEGORISED_WARNING, 11, ['brushstroke', 'impasto']);
    expect(result).not.toBeNull();
    expect(result!.detectorId).toBe('vocabulary-drift');
    expect(result!.summary).toContain('12th category');
  });

  it('includes cluster terms in detail', () => {
    const result = detectVocabularyDrift(40, 11, ['brushstroke', 'impasto', 'glazing']);
    expect(result!.detail).toContain('brushstroke');
  });
});

// ============================================================================
// SYSTEM 5: ALGORITHM SATURATION
// ============================================================================

describe('detectAlgorithmSaturation', () => {
  it('returns null when well below thresholds', () => {
    expect(detectAlgorithmSaturation(10, 500, 20, 200)).toBeNull();
  });

  it('detects when pattern ratio exceeds warning', () => {
    const result = detectAlgorithmSaturation(400, 500, 50, 200);
    expect(result).not.toBeNull();
    expect(result!.detectorId).toBe('algorithm-saturation');
  });

  it('detects when time ratio exceeds warning', () => {
    const result = detectAlgorithmSaturation(10, 500, 160, 200);
    expect(result).not.toBeNull();
  });

  it('flags critical at 95%+', () => {
    const result = detectAlgorithmSaturation(480, 500, 195, 200);
    expect(result!.severity).toBe('critical');
  });
});

// ============================================================================
// SYSTEM 6: ASSUMPTION REGISTRY
// ============================================================================

describe('evaluateAssumptions', () => {
  it('returns assumptions for all monitored files', () => {
    const source = makeSource();
    const assumptions = evaluateAssumptions(source);
    expect(assumptions.length).toBeGreaterThan(0);

    const files = new Set(assumptions.map((a) => a.file));
    expect(files.has('weight-recalibration.ts')).toBe(true);
    expect(files.has('outcome-score.ts')).toBe(true);
  });

  it('marks factor count assumption valid for 7 factors', () => {
    const source = makeSource();
    const assumptions = evaluateAssumptions(source);
    const factorAssumption = assumptions.find((a) => a.text.includes('Scoring factors'));
    expect(factorAssumption!.valid).toBe(true);
  });

  it('marks cron assumption invalid when cron failed', () => {
    const source = makeSource({ lastCronSuccess: false });
    const assumptions = evaluateAssumptions(source);
    const cronAssumption = assumptions.find((a) => a.text.includes('Cron'));
    expect(cronAssumption!.valid).toBe(false);
  });

  it('detects signal dominance > 50%', () => {
    const source = makeSource({
      observedSignalDistribution: { feedback: 0.80, copied: 0.20 },
    });
    const assumptions = evaluateAssumptions(source);
    const dominance = assumptions.find((a) => a.text.includes('dominate'));
    expect(dominance).toBeDefined();
    expect(dominance!.valid).toBe(false);
  });
});

// ============================================================================
// SYSTEM 7: CONFIDENCE THERMOMETER
// ============================================================================

describe('computeFileConfidence', () => {
  it('returns 100% for fresh code with no issues', () => {
    const result = computeFileConfidence('test.ts', 0, 1, 0, 0, [], []);
    expect(result.confidence).toBe(100);
  });

  it('decays confidence with age', () => {
    const result = computeFileConfidence('test.ts', 60, 1, 0, 0, [], []);
    expect(result.confidence).toBeLessThan(100);
    expect(result.decayFactors.ageDecay).toBe(30); // capped at 30
  });

  it('decays confidence with volume growth', () => {
    const result = computeFileConfidence('test.ts', 0, 8, 0, 0, [], []);
    expect(result.confidence).toBeLessThan(100);
    expect(result.decayFactors.volumeDecay).toBeGreaterThan(0);
  });

  it('decays confidence with broken assumptions', () => {
    const result = computeFileConfidence('test.ts', 0, 1, 3, 0, [], []);
    expect(result.confidence).toBe(100 - 24); // 3 × 8 = 24
    expect(result.decayFactors.assumptionDecay).toBe(24);
  });

  it('never goes below 0', () => {
    const result = computeFileConfidence('test.ts', 200, 1024, 10, 5, [], []);
    expect(result.confidence).toBe(0);
  });
});

// ============================================================================
// SYSTEM 8: PREDICTIVE DRIFT
// ============================================================================

describe('predictDrift', () => {
  it('predicts pattern saturation', () => {
    const source = makeSource({
      activePatternCount: 400,
      maxPatternsBeforeSaturation: 500,
      patternGrowthPerWeek: 10,
    });
    const predictions = predictDrift(source);
    const patternPred = predictions.find((p) => p.metric === 'active patterns');
    expect(patternPred).toBeDefined();
    expect(patternPred!.weeksUntilStale).toBe(10);
  });

  it('predicts vocabulary category needed', () => {
    const source = makeSource({
      uncategorisedTermCount: 40,
      uncategorisedGrowthPerWeek: 5,
    });
    const predictions = predictDrift(source);
    const vocabPred = predictions.find((p) => p.metric === 'uncategorised terms');
    expect(vocabPred).toBeDefined();
    expect(vocabPred!.weeksUntilStale).toBe(4);
  });

  it('returns empty when no growth', () => {
    const source = makeSource({
      patternGrowthPerWeek: 0,
      uncategorisedGrowthPerWeek: 0,
    });
    const predictions = predictDrift(source);
    expect(predictions).toHaveLength(0);
  });

  it('sorts by urgency (nearest first)', () => {
    const source = makeSource({
      activePatternCount: 490,
      maxPatternsBeforeSaturation: 500,
      patternGrowthPerWeek: 5,
      uncategorisedTermCount: 20,
      uncategorisedGrowthPerWeek: 2,
    });
    const predictions = predictDrift(source);
    if (predictions.length >= 2) {
      const first = predictions[0]!.weeksUntilStale ?? 999;
      const second = predictions[1]!.weeksUntilStale ?? 999;
      expect(first).toBeLessThanOrEqual(second);
    }
  });
});

// ============================================================================
// SYSTEM 9: EVOLUTION PROPOSALS
// ============================================================================

describe('generateProposals', () => {
  it('generates new-factor proposal for correlation ceiling', () => {
    const findings = [{ detectorId: 'correlation-ceiling', detectorName: '', file: '', severity: 'warning' as const, summary: '', detail: '', confidence: 80, drillSection: '' }];
    const source = makeSource();
    const proposals = generateProposals(findings, source);
    expect(proposals.some((p) => p.title.includes('new scoring factor'))).toBe(true);
  });

  it('generates removal proposal for factor exhaustion', () => {
    const findings = [{ detectorId: 'factor-exhaustion', detectorName: '', file: '', severity: 'info' as const, summary: '"density" at floor weight (0.02) for 25 consecutive runs', detail: '', confidence: 75, drillSection: '' }];
    const source = makeSource();
    const proposals = generateProposals(findings, source);
    expect(proposals.some((p) => p.title.includes('density'))).toBe(true);
  });

  it('generates rebalance proposal for threshold staleness', () => {
    const findings = [{ detectorId: 'threshold-staleness', detectorName: '', file: '', severity: 'info' as const, summary: '', detail: '', confidence: 60, drillSection: '' }];
    const source = makeSource();
    const proposals = generateProposals(findings, source);
    expect(proposals.some((p) => p.title.includes('Rebalance'))).toBe(true);
  });

  it('returns empty when no findings', () => {
    expect(generateProposals([], makeSource())).toEqual([]);
  });
});

// ============================================================================
// MASTER EVALUATOR
// ============================================================================

describe('evaluateRadar', () => {
  it('returns a valid RadarReport', () => {
    const source = makeSource();
    const report = evaluateRadar(source);

    expect(report.files.length).toBe(5);
    expect(report.generatedAt).toBeTruthy();
    expect(report.summary.filesMonitored).toBe(5);
    expect(report.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(report.overallConfidence).toBeLessThanOrEqual(100);
  });

  it('files are sorted by confidence ascending (worst first)', () => {
    const source = makeSource();
    const report = evaluateRadar(source);
    for (let i = 1; i < report.files.length; i++) {
      expect(report.files[i]!.confidence).toBeGreaterThanOrEqual(report.files[i - 1]!.confidence);
    }
  });

  it('populates allAssumptions and brokenAssumptions', () => {
    const source = makeSource();
    const report = evaluateRadar(source);
    expect(report.allAssumptions.length).toBeGreaterThan(0);
    // With default healthy source, most should be valid
    expect(report.brokenAssumptions.length).toBeLessThanOrEqual(report.allAssumptions.length);
  });

  it('fires detectors when data warrants it', () => {
    const source = makeSource({
      factorFloorStreak: { density: 25 },
      activePatternCount: 400,
      uncategorisedTermCount: 50,
      emergingClusterTerms: ['brushstroke', 'impasto'],
    });
    const report = evaluateRadar(source);
    const ids = report.detectorFindings.map((f) => f.detectorId);
    expect(ids).toContain('factor-exhaustion');
    expect(ids).toContain('vocabulary-drift');
  });
});

// ============================================================================
// REVIEW BOOST — computeReviewBoost + buildHistoryEntry
// ============================================================================

describe('computeReviewBoost', () => {
  it('returns 25 for acted', () => {
    expect(computeReviewBoost('acted')).toBe(25);
  });

  it('returns 15 for reviewed', () => {
    expect(computeReviewBoost('reviewed')).toBe(15);
  });

  it('returns 5 for dismissed', () => {
    expect(computeReviewBoost('dismissed')).toBe(5);
  });
});

describe('buildHistoryEntry', () => {
  const baseAction: EvolutionActionRequest = {
    actionType: 'acted',
    file: 'outcome-score.ts',
    proposalTitle: 'Rebalance signal weights',
    confidenceBefore: 62,
  };

  it('produces correct date format (YYYY-MM-DD)', () => {
    const entry = buildHistoryEntry(baseAction, 87);
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sets file from action', () => {
    const entry = buildHistoryEntry(baseAction, 87);
    expect(entry.file).toBe('outcome-score.ts');
  });

  it('captures confidenceBefore and confidenceAfter', () => {
    const entry = buildHistoryEntry(baseAction, 87);
    expect(entry.confidenceBefore).toBe(62);
    expect(entry.confidenceAfter).toBe(87);
  });

  it('caps confidenceAfter at 100', () => {
    const entry = buildHistoryEntry({ ...baseAction, confidenceBefore: 90 }, 115);
    expect(entry.confidenceAfter).toBe(100);
  });

  it('includes proposal title for acted actions', () => {
    const entry = buildHistoryEntry(baseAction, 87);
    expect(entry.action).toContain('Rebalance signal weights');
    expect(entry.proposalTitle).toBe('Rebalance signal weights');
  });

  it('includes admin note when provided', () => {
    const entry = buildHistoryEntry({ ...baseAction, note: 'Shipped in v2.1' }, 87);
    expect(entry.action).toContain('Shipped in v2.1');
  });

  it('sets correct actionType', () => {
    expect(buildHistoryEntry(baseAction, 87).actionType).toBe('acted');
    expect(buildHistoryEntry({ ...baseAction, actionType: 'reviewed' }, 77).actionType).toBe('reviewed');
    expect(buildHistoryEntry({ ...baseAction, actionType: 'dismissed' }, 67).actionType).toBe('dismissed');
  });

  it('generates meaningful impact strings', () => {
    expect(buildHistoryEntry(baseAction, 87).impact).toContain('restored');
    expect(buildHistoryEntry({ ...baseAction, actionType: 'reviewed' }, 77).impact).toContain('reset');
    expect(buildHistoryEntry({ ...baseAction, actionType: 'dismissed' }, 67).impact).toContain('boost');
  });
});

describe('evaluateRadar reviews field', () => {
  it('includes empty reviews object in report', () => {
    const source = makeSource();
    const report = evaluateRadar(source);
    expect(report.reviews).toEqual({});
  });
});

