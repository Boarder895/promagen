/**
 * Phase 7.11g — Anomaly Thresholds Tests
 *
 * Tests all pure evaluation functions in anomaly-thresholds.ts:
 *   - evaluateCorrelation (critical + warning + cron failure)
 *   - evaluateTemporalFreshness (stale data detection)
 *   - evaluateAntiPatterns (high-severity spike)
 *   - evaluateABTests (info-level concluded)
 *   - evaluateFeedback (red flags + low platforms)
 *   - evaluateWeightDivergence (>50% drift)
 *   - evaluateAllAnomalies (aggregate + severity sorting)
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  evaluateCorrelation,
  evaluateTemporalFreshness,
  evaluateAntiPatterns,
  evaluateABTests,
  evaluateFeedback,
  evaluateWeightDivergence,
  evaluateAllAnomalies,
  ANOMALY_THRESHOLDS,
  type AnomalySourceData,
} from '@/lib/admin/anomaly-thresholds';

// ============================================================================
// evaluateCorrelation
// ============================================================================

describe('evaluateCorrelation', () => {
  it('returns critical when drop >= 10%', () => {
    const result = evaluateCorrelation(0.60, -0.12, true, '2026-03-01T00:00:00Z');
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('critical');
    expect(result[0]!.id).toBe('correlation-drop-critical');
    expect(result[0]!.jumpTo).toBe('weight-drift');
  });

  it('returns warning when drop 5–10%', () => {
    const result = evaluateCorrelation(0.68, -0.07, true, '2026-03-01T00:00:00Z');
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('warning');
    expect(result[0]!.id).toBe('correlation-drop-warning');
  });

  it('returns empty when drop < 5%', () => {
    const result = evaluateCorrelation(0.70, -0.03, true, '2026-03-01T00:00:00Z');
    expect(result).toHaveLength(0);
  });

  it('returns empty when correlation is improving', () => {
    const result = evaluateCorrelation(0.75, 0.05, true, '2026-03-01T00:00:00Z');
    expect(result).toHaveLength(0);
  });

  it('returns cron-failure when last cron failed', () => {
    const result = evaluateCorrelation(0.70, 0.0, false, '2026-03-01T00:00:00Z');
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('critical');
    expect(result[0]!.id).toBe('cron-failure');
  });

  it('returns both correlation drop + cron failure', () => {
    const result = evaluateCorrelation(0.55, -0.15, false, '2026-03-01T00:00:00Z');
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toContain('correlation-drop-critical');
    expect(result.map((a) => a.id)).toContain('cron-failure');
  });

  it('does not fire cron-failure when timestamp is null', () => {
    const result = evaluateCorrelation(0.70, 0.0, false, null);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// evaluateTemporalFreshness
// ============================================================================

describe('evaluateTemporalFreshness', () => {
  it('returns critical when age > 72h', () => {
    const result = evaluateTemporalFreshness([
      { label: 'Seasonal', ageMinutes: 73 * 60, status: 'stale' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('critical');
    expect(result[0]!.jumpTo).toBe('temporal-trends');
  });

  it('returns warning when age 36–72h', () => {
    const result = evaluateTemporalFreshness([
      { label: 'Trending', ageMinutes: 40 * 60, status: 'stale' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('warning');
  });

  it('returns empty when fresh', () => {
    const result = evaluateTemporalFreshness([
      { label: 'Seasonal', ageMinutes: 60, status: 'fresh' },
      { label: 'Trending', ageMinutes: 120, status: 'fresh' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('ignores negative ages (no data)', () => {
    const result = evaluateTemporalFreshness([
      { label: 'Seasonal', ageMinutes: -1, status: 'no-data' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('returns multiple anomalies for multiple stale channels', () => {
    const result = evaluateTemporalFreshness([
      { label: 'Seasonal', ageMinutes: 80 * 60, status: 'stale' },
      { label: 'Trending', ageMinutes: 50 * 60, status: 'stale' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.severity).toBe('critical');
    expect(result[1]!.severity).toBe('warning');
  });
});

// ============================================================================
// evaluateAntiPatterns
// ============================================================================

describe('evaluateAntiPatterns', () => {
  it('returns warning when high-severity patterns detected', () => {
    const result = evaluateAntiPatterns(3, {
      termA: 'oil painting',
      termB: 'digital art',
      occurrenceCount: 847,
      qualityImpact: -0.23,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('warning');
    expect(result[0]!.detail).toContain('oil painting');
  });

  it('returns empty when no high-severity patterns', () => {
    const result = evaluateAntiPatterns(0);
    expect(result).toHaveLength(0);
  });

  it('handles missing topPair gracefully', () => {
    const result = evaluateAntiPatterns(2);
    expect(result).toHaveLength(1);
    expect(result[0]!.detail).toContain('2 high-severity');
  });
});

// ============================================================================
// evaluateABTests
// ============================================================================

describe('evaluateABTests', () => {
  it('returns info when tests concluded', () => {
    const result = evaluateABTests(2, 3);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('info');
    expect(result[0]!.jumpTo).toBe('ab-tests');
  });

  it('returns empty when no concluded tests', () => {
    const result = evaluateABTests(2, 0);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// evaluateFeedback
// ============================================================================

describe('evaluateFeedback', () => {
  it('returns critical from red flags', () => {
    const result = evaluateFeedback(
      [{ type: 'low_satisfaction', message: 'Craiyon at 41%', severity: 'critical', platform: 'Craiyon' }],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('critical');
  });

  it('returns warning from red flags', () => {
    const result = evaluateFeedback(
      [{ type: 'velocity_drop', message: 'Feedback dropped', severity: 'warning' }],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('warning');
  });

  it('returns low-platform warning when no critical flags exist', () => {
    const result = evaluateFeedback(
      [],
      [{ platform: 'Craiyon', score: 41, eventCount: 10 }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('feedback-low-platforms');
    expect(result[0]!.detail).toContain('Craiyon: 41%');
  });

  it('skips low-platform when critical flags already exist', () => {
    const result = evaluateFeedback(
      [{ type: 'low_satisfaction', message: 'test', severity: 'critical' }],
      [{ platform: 'Craiyon', score: 41, eventCount: 10 }],
    );
    // Should have critical but NOT the duplicate low-platforms
    const lowPlatform = result.find((a) => a.id === 'feedback-low-platforms');
    expect(lowPlatform).toBeUndefined();
  });

  it('ignores platforms with < 3 events', () => {
    const result = evaluateFeedback(
      [],
      [{ platform: 'TestPlatform', score: 30, eventCount: 2 }],
    );
    expect(result).toHaveLength(0);
  });

  it('returns empty when all healthy', () => {
    const result = evaluateFeedback(
      [],
      [{ platform: 'Midjourney', score: 85, eventCount: 50 }],
    );
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// evaluateWeightDivergence
// ============================================================================

describe('evaluateWeightDivergence', () => {
  it('returns warning when factor diverged > 50%', () => {
    const result = evaluateWeightDivergence([
      { factor: 'coherence', changePercent: 55 },
      { factor: 'categoryCount', changePercent: -10 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('warning');
    expect(result[0]!.detail).toContain('coherence');
  });

  it('returns empty when all within threshold', () => {
    const result = evaluateWeightDivergence([
      { factor: 'coherence', changePercent: 30 },
      { factor: 'categoryCount', changePercent: -40 },
    ]);
    expect(result).toHaveLength(0);
  });

  it('picks worst diverger in detail', () => {
    const result = evaluateWeightDivergence([
      { factor: 'coherence', changePercent: 55 },
      { factor: 'promptLength', changePercent: -80 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.detail).toContain('promptLength');
  });
});

// ============================================================================
// evaluateAllAnomalies — aggregate + severity sorting
// ============================================================================

describe('evaluateAllAnomalies', () => {
  it('returns empty for fully healthy system', () => {
    const data: AnomalySourceData = {
      overview: {
        correlation: 0.75,
        correlationTrend: 0.02,
        lastCronSuccess: true,
        lastCronTimestamp: '2026-03-01T00:00:00Z',
        abTestsConcluded: 0,
        abTestsRunning: 1,
      },
      temporal: {
        channels: [
          { label: 'Seasonal', ageMinutes: 60, status: 'fresh' },
          { label: 'Trending', ageMinutes: 30, status: 'fresh' },
        ],
      },
      antiPatterns: { highCount: 0 },
      feedback: {
        redFlags: [],
        platformSatisfaction: [{ platform: 'Midjourney', score: 85, eventCount: 50 }],
      },
      weightDrift: {
        factors: [{ factor: 'coherence', changePercent: 10 }],
      },
    };

    const result = evaluateAllAnomalies(data);
    expect(result).toHaveLength(0);
  });

  it('sorts critical before warning before info', () => {
    const data: AnomalySourceData = {
      overview: {
        correlation: 0.55,
        correlationTrend: -0.15,
        lastCronSuccess: true,
        lastCronTimestamp: '2026-03-01T00:00:00Z',
        abTestsConcluded: 2,
        abTestsRunning: 1,
      },
      temporal: null,
      antiPatterns: { highCount: 3 },
      feedback: null,
      weightDrift: null,
    };

    const result = evaluateAllAnomalies(data);
    expect(result.length).toBeGreaterThanOrEqual(3);

    // Verify sort order
    const severities = result.map((a) => a.severity);
    const criticalIdx = severities.indexOf('critical');
    const warningIdx = severities.indexOf('warning');
    const infoIdx = severities.indexOf('info');

    if (criticalIdx >= 0 && warningIdx >= 0) {
      expect(criticalIdx).toBeLessThan(warningIdx);
    }
    if (warningIdx >= 0 && infoIdx >= 0) {
      expect(warningIdx).toBeLessThan(infoIdx);
    }
  });

  it('handles null sources gracefully', () => {
    const data: AnomalySourceData = {
      overview: null,
      temporal: null,
      antiPatterns: null,
      feedback: null,
      weightDrift: null,
    };

    const result = evaluateAllAnomalies(data);
    expect(result).toHaveLength(0);
  });

  it('threshold constants are sensible', () => {
    expect(ANOMALY_THRESHOLDS.CORRELATION_DROP_CRITICAL).toBeGreaterThan(0);
    expect(ANOMALY_THRESHOLDS.CORRELATION_DROP_WARNING).toBeLessThan(ANOMALY_THRESHOLDS.CORRELATION_DROP_CRITICAL);
    expect(ANOMALY_THRESHOLDS.STALE_DATA_CRITICAL_MIN).toBeGreaterThan(ANOMALY_THRESHOLDS.STALE_DATA_WARNING_MIN);
    expect(ANOMALY_THRESHOLDS.FEEDBACK_SAT_DROP_THRESHOLD).toBe(50);
    expect(ANOMALY_THRESHOLDS.WEIGHT_DIVERGENCE_THRESHOLD).toBe(50);
  });
});
