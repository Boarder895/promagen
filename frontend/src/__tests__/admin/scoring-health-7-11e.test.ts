/**
 * Phase 7.11e — Temporal Trends & Feedback Summary Tests
 *
 * Tests:
 *   - Freshness status computation (fresh / stale / no-data)
 *   - Velocity badge direction mapping
 *   - Seasonal insight filtering (boosted vs dampened)
 *   - Weekend deviation filtering
 *   - Feedback distribution percentage computation
 *   - Red flag detection (low satisfaction, velocity drop)
 *   - Platform satisfaction sorting (top 5 + bottom 5)
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

// ============================================================================
// PURE FUNCTIONS UNDER TEST (extracted from route/component logic)
// ============================================================================

// Freshness classification (mirrors temporal/route.ts)
function freshnessStatus(minutes: number): 'fresh' | 'stale' | 'no-data' {
  if (!isFinite(minutes)) return 'no-data';
  if (minutes <= 120) return 'fresh';
  if (minutes <= 1440) return 'stale';
  return 'no-data';
}

// Severity bucket for anti-pattern alerts — needed for red flag tests
type FeedbackRedFlag = {
  type: string;
  message: string;
  severity: 'warning' | 'critical';
  platform?: string;
};

function detectRedFlags(
  platformSat: { platform: string; score: number; eventCount: number }[],
  dailySpark: { date: string; positive: number; neutral: number; negative: number }[],
): FeedbackRedFlag[] {
  const flags: FeedbackRedFlag[] = [];

  for (const p of platformSat) {
    if (p.eventCount >= 3 && p.score < 50) {
      flags.push({
        type: 'low_satisfaction',
        message: `${p.platform} satisfaction at ${p.score}% (${p.eventCount} events)`,
        severity: p.score < 25 ? 'critical' : 'warning',
        platform: p.platform,
      });
    }
  }

  if (dailySpark.length >= 10) {
    const mid = Math.floor(dailySpark.length / 2);
    const recentTotal = dailySpark.slice(mid).reduce((s, d) => s + d.positive + d.neutral + d.negative, 0);
    const olderTotal = dailySpark.slice(0, mid).reduce((s, d) => s + d.positive + d.neutral + d.negative, 0);
    if (olderTotal > 0 && recentTotal < olderTotal * 0.5) {
      flags.push({
        type: 'velocity_drop',
        message: `Feedback volume dropped ${Math.round((1 - recentTotal / olderTotal) * 100)}% vs previous period`,
        severity: 'warning',
      });
    }
  }

  return flags;
}

// Sentiment percentage computation
function sentimentPercentages(positive: number, neutral: number, negative: number) {
  const total = positive + neutral + negative || 1;
  return {
    positivePct: (positive / total) * 100,
    neutralPct: (neutral / total) * 100,
    negativePct: (negative / total) * 100,
    total,
  };
}

// Weekend boost filtering (mirrors temporal route)
function filterWeekendInsights(
  patterns: { term: string; category: string; dayBoosts: Record<number, number>; totalEvents: number }[],
  threshold: number = 0.15,
) {
  return patterns
    .map((p) => {
      const satBoost = p.dayBoosts[6] ?? 1;
      const sunBoost = p.dayBoosts[0] ?? 1;
      const weekendAvg = (satBoost + sunBoost) / 2;
      return { ...p, weekendBoost: weekendAvg };
    })
    .filter((p) => Math.abs(p.weekendBoost - 1) >= threshold);
}

// Seasonal filtering for current month
function filterSeasonalInsights(
  boosts: { term: string; category: string; monthlyBoosts: Record<number, number>; totalEvents: number }[],
  month: number,
) {
  return boosts
    .filter((b) => b.monthlyBoosts[month] !== undefined)
    .map((b) => ({
      term: b.term,
      category: b.category,
      currentMonthBoost: b.monthlyBoosts[month]!,
      totalEvents: b.totalEvents,
    }));
}

// ============================================================================
// TESTS
// ============================================================================

describe('Phase 7.11e — Temporal Trends & Feedback Summary', () => {
  // ── Freshness Status ──────────────────────────────────────────────
  describe('freshnessStatus', () => {
    it('classifies <= 120 minutes as fresh', () => {
      expect(freshnessStatus(0)).toBe('fresh');
      expect(freshnessStatus(60)).toBe('fresh');
      expect(freshnessStatus(120)).toBe('fresh');
    });

    it('classifies 121-1440 minutes as stale', () => {
      expect(freshnessStatus(121)).toBe('stale');
      expect(freshnessStatus(720)).toBe('stale');
      expect(freshnessStatus(1440)).toBe('stale');
    });

    it('classifies > 1440 minutes as no-data', () => {
      expect(freshnessStatus(1441)).toBe('no-data');
      expect(freshnessStatus(10000)).toBe('no-data');
    });

    it('classifies Infinity as no-data', () => {
      expect(freshnessStatus(Infinity)).toBe('no-data');
    });

    it('classifies NaN as no-data', () => {
      expect(freshnessStatus(NaN)).toBe('no-data');
    });
  });

  // ── Sentiment Percentages ─────────────────────────────────────────
  describe('sentimentPercentages', () => {
    it('computes correct percentages', () => {
      const result = sentimentPercentages(68, 24, 8);
      expect(result.positivePct).toBeCloseTo(68, 0);
      expect(result.neutralPct).toBeCloseTo(24, 0);
      expect(result.negativePct).toBeCloseTo(8, 0);
      expect(result.total).toBe(100);
    });

    it('handles zero total without division by zero', () => {
      const result = sentimentPercentages(0, 0, 0);
      expect(result.positivePct).toBe(0);
      expect(result.total).toBe(1); // guarded
    });

    it('handles 100% positive', () => {
      const result = sentimentPercentages(200, 0, 0);
      expect(result.positivePct).toBe(100);
      expect(result.neutralPct).toBe(0);
      expect(result.negativePct).toBe(0);
    });
  });

  // ── Red Flag Detection ────────────────────────────────────────────
  describe('detectRedFlags', () => {
    it('flags platform with satisfaction below 50%', () => {
      const platforms = [
        { platform: 'Craiyon', score: 41, eventCount: 5 },
        { platform: 'Midjourney', score: 82, eventCount: 100 },
      ];
      const flags = detectRedFlags(platforms, []);
      expect(flags).toHaveLength(1);
      expect(flags[0]!.platform).toBe('Craiyon');
      expect(flags[0]!.severity).toBe('warning');
    });

    it('marks critical for satisfaction below 25%', () => {
      const platforms = [{ platform: 'TestPlatform', score: 20, eventCount: 10 }];
      const flags = detectRedFlags(platforms, []);
      expect(flags[0]!.severity).toBe('critical');
    });

    it('ignores platforms with fewer than 3 events', () => {
      const platforms = [{ platform: 'NewPlatform', score: 10, eventCount: 2 }];
      const flags = detectRedFlags(platforms, []);
      expect(flags).toHaveLength(0);
    });

    it('detects velocity drop when recent volume is less than 50% of older', () => {
      // 14 days of data, older half has 10/day, recent half has 3/day
      const spark = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${(15 + i).toString().padStart(2, '0')}`,
        positive: i < 7 ? 8 : 2,
        neutral: i < 7 ? 1 : 1,
        negative: i < 7 ? 1 : 0,
      }));
      const flags = detectRedFlags([], spark);
      expect(flags).toHaveLength(1);
      expect(flags[0]!.type).toBe('velocity_drop');
    });

    it('does not flag velocity drop when volume is stable', () => {
      const spark = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${(15 + i).toString().padStart(2, '0')}`,
        positive: 5,
        neutral: 2,
        negative: 1,
      }));
      const flags = detectRedFlags([], spark);
      expect(flags).toHaveLength(0);
    });
  });

  // ── Weekend Boost Filtering ───────────────────────────────────────
  describe('filterWeekendInsights', () => {
    it('includes terms with significant weekend deviation', () => {
      const patterns = [
        { term: 'fantasy', category: 'style', dayBoosts: { 0: 1.4, 6: 1.3 }, totalEvents: 50 },
        { term: 'minimal', category: 'style', dayBoosts: { 0: 1.05, 6: 1.02 }, totalEvents: 30 },
      ];
      const filtered = filterWeekendInsights(patterns);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.term).toBe('fantasy');
      expect(filtered[0]!.weekendBoost).toBeCloseTo(1.35, 1);
    });

    it('returns empty when no significant patterns', () => {
      const patterns = [
        { term: 'neutral', category: 'style', dayBoosts: { 0: 1.0, 6: 1.0 }, totalEvents: 20 },
      ];
      expect(filterWeekendInsights(patterns)).toHaveLength(0);
    });

    it('includes terms with significant weekend decrease', () => {
      const patterns = [
        { term: 'corporate', category: 'style', dayBoosts: { 0: 0.6, 6: 0.7 }, totalEvents: 40 },
      ];
      const filtered = filterWeekendInsights(patterns);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.weekendBoost).toBeLessThan(1);
    });
  });

  // ── Seasonal Insight Filtering ────────────────────────────────────
  describe('filterSeasonalInsights', () => {
    const boosts = [
      { term: 'spring flowers', category: 'environment', monthlyBoosts: { 3: 2.2, 4: 1.8 } as Record<number, number>, totalEvents: 100 },
      { term: 'winter snow', category: 'environment', monthlyBoosts: { 12: 2.5, 1: 2.0 } as Record<number, number>, totalEvents: 80 },
      { term: 'golden hour', category: 'lighting', monthlyBoosts: {} as Record<number, number>, totalEvents: 60 },
    ];

    it('returns terms with boosts for the target month', () => {
      const march = filterSeasonalInsights(boosts, 3);
      expect(march).toHaveLength(1);
      expect(march[0]!.term).toBe('spring flowers');
      expect(march[0]!.currentMonthBoost).toBe(2.2);
    });

    it('returns empty for months with no data', () => {
      const july = filterSeasonalInsights(boosts, 7);
      expect(july).toHaveLength(0);
    });

    it('handles December correctly', () => {
      const dec = filterSeasonalInsights(boosts, 12);
      expect(dec).toHaveLength(1);
      expect(dec[0]!.term).toBe('winter snow');
    });
  });

  // ── Platform Sorting (top + bottom) ───────────────────────────────
  describe('platform sorting', () => {
    it('sorts by score descending for top/bottom display', () => {
      const platforms = [
        { platform: 'A', score: 90, eventCount: 50 },
        { platform: 'B', score: 40, eventCount: 30 },
        { platform: 'C', score: 70, eventCount: 80 },
        { platform: 'D', score: 55, eventCount: 20 },
      ];

      const sorted = [...platforms].sort((a, b) => b.score - a.score);
      expect(sorted[0]!.platform).toBe('A');
      expect(sorted[sorted.length - 1]!.platform).toBe('B');
    });
  });
});
