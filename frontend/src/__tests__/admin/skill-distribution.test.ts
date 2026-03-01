/**
 * Phase 7.11f — Skill Distribution Tests
 *
 * Tests:
 *   - Skill classification (beginner / intermediate / expert)
 *   - Distribution percentage computation
 *   - Tier usage percentage conversion
 *   - Graduation funnel sorting
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

// ============================================================================
// PURE FUNCTIONS UNDER TEST (mirrors route logic)
// ============================================================================

type SkillLevel = 'beginner' | 'intermediate' | 'expert';

function classifySkill(eventCount: number, avgCategoryCount: number): SkillLevel {
  if (eventCount >= 16 || avgCategoryCount >= 6) return 'expert';
  if (eventCount >= 4 && avgCategoryCount >= 3) return 'intermediate';
  return 'beginner';
}

function computeDistribution(sessions: { eventCount: number; avgCat: number }[]) {
  const counts: Record<SkillLevel, number> = { beginner: 0, intermediate: 0, expert: 0 };
  for (const s of sessions) {
    counts[classifySkill(s.eventCount, s.avgCat)]++;
  }
  const total = sessions.length || 1;
  return (['beginner', 'intermediate', 'expert'] as const).map((level) => ({
    level,
    count: counts[level],
    percentage: Math.round((counts[level] / total) * 100),
  }));
}

function tierCountsToPercentages(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
  const pct: Record<string, number> = {};
  for (const [t, c] of Object.entries(counts)) {
    pct[t] = Math.round((c / total) * 100);
  }
  return pct;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Phase 7.11f — Skill Distribution', () => {
  // ── Classification ────────────────────────────────────────────────
  describe('classifySkill', () => {
    it('classifies 1-3 events as beginner', () => {
      expect(classifySkill(1, 2)).toBe('beginner');
      expect(classifySkill(3, 2)).toBe('beginner');
    });

    it('classifies low category count as beginner regardless of event count', () => {
      // 4+ events but avgCat < 3 → still beginner (both conditions must be met)
      expect(classifySkill(5, 2)).toBe('beginner');
      expect(classifySkill(10, 2.9)).toBe('beginner');
    });

    it('classifies 4-15 events with avgCat >= 3 as intermediate', () => {
      expect(classifySkill(4, 3)).toBe('intermediate');
      expect(classifySkill(10, 4)).toBe('intermediate');
      expect(classifySkill(15, 5)).toBe('intermediate');
    });

    it('classifies 16+ events as expert', () => {
      expect(classifySkill(16, 2)).toBe('expert');
      expect(classifySkill(50, 3)).toBe('expert');
    });

    it('classifies avgCat >= 6 as expert even with low event count', () => {
      expect(classifySkill(3, 6)).toBe('expert');
      expect(classifySkill(1, 8)).toBe('expert');
    });

    it('handles boundary at exactly 4 events with avgCat 3', () => {
      expect(classifySkill(4, 3)).toBe('intermediate');
    });

    it('handles boundary at exactly 16 events', () => {
      expect(classifySkill(16, 0)).toBe('expert');
    });
  });

  // ── Distribution ──────────────────────────────────────────────────
  describe('computeDistribution', () => {
    it('computes correct percentages', () => {
      const sessions = [
        { eventCount: 2, avgCat: 1 },   // beginner
        { eventCount: 1, avgCat: 2 },   // beginner
        { eventCount: 8, avgCat: 4 },   // intermediate
        { eventCount: 20, avgCat: 7 },  // expert
      ];
      const dist = computeDistribution(sessions);
      expect(dist[0]!.level).toBe('beginner');
      expect(dist[0]!.count).toBe(2);
      expect(dist[0]!.percentage).toBe(50);
      expect(dist[1]!.level).toBe('intermediate');
      expect(dist[1]!.count).toBe(1);
      expect(dist[1]!.percentage).toBe(25);
      expect(dist[2]!.level).toBe('expert');
      expect(dist[2]!.count).toBe(1);
      expect(dist[2]!.percentage).toBe(25);
    });

    it('handles empty sessions', () => {
      const dist = computeDistribution([]);
      expect(dist[0]!.count).toBe(0);
      expect(dist[0]!.percentage).toBe(0);
    });

    it('handles 100% single category', () => {
      const sessions = Array.from({ length: 10 }, () => ({ eventCount: 2, avgCat: 1 }));
      const dist = computeDistribution(sessions);
      expect(dist[0]!.percentage).toBe(100);
      expect(dist[1]!.percentage).toBe(0);
      expect(dist[2]!.percentage).toBe(0);
    });
  });

  // ── Tier Usage Percentages ────────────────────────────────────────
  describe('tierCountsToPercentages', () => {
    it('converts counts to rounded percentages', () => {
      const pct = tierCountsToPercentages({ '1': 8, '2': 12, '3': 25, '4': 55 });
      expect(pct['1']).toBe(8);
      expect(pct['2']).toBe(12);
      expect(pct['3']).toBe(25);
      expect(pct['4']).toBe(55);
    });

    it('handles zero total without division by zero', () => {
      const pct = tierCountsToPercentages({ '1': 0, '2': 0, '3': 0, '4': 0 });
      expect(pct['1']).toBe(0);
    });

    it('handles uneven distribution', () => {
      const pct = tierCountsToPercentages({ '1': 1, '2': 2, '3': 3, '4': 4 });
      expect(pct['1']).toBe(10);
      expect(pct['4']).toBe(40);
    });
  });

  // ── Graduation Funnel Sorting ─────────────────────────────────────
  describe('graduation funnel sorting', () => {
    it('sorts beginner→intermediate before intermediate→expert', () => {
      const levelOrder: SkillLevel[] = ['beginner', 'intermediate', 'expert'];
      const funnel = [
        { from: 'intermediate' as SkillLevel, to: 'expert' as SkillLevel, count: 12, avgSessions: 22 },
        { from: 'beginner' as SkillLevel, to: 'intermediate' as SkillLevel, count: 47, avgSessions: 8 },
      ];

      funnel.sort((a, b) => {
        const orderA = levelOrder.indexOf(a.from) * 10 + levelOrder.indexOf(a.to);
        const orderB = levelOrder.indexOf(b.from) * 10 + levelOrder.indexOf(b.to);
        return orderA - orderB;
      });

      expect(funnel[0]!.from).toBe('beginner');
      expect(funnel[1]!.from).toBe('intermediate');
    });
  });
});
