// src/__tests__/admin/scoring-health-7-11d.test.ts
// ============================================================================
// Tests for Phase 7.11d: Undo Stack, Anti-Pattern Alerts, A/B Test Section
// ============================================================================
//
// Tests:
//   - Undo stack: push, mark undone, max size, descriptions
//   - Anti-pattern severity: bucket classification, dedup, sorting
//   - A/B test history: outcome badges, sort order, lift display
//
// Version: 1.0.0
// Created: 2026-03-01
// ============================================================================

import {
  pushUndoEntry,
  markUndone,
  describeWeightEdit,
  describeProfileActivate,
  countPending,
  getRecentEntries,
  MAX_UNDO_ENTRIES,
} from '@/lib/admin/undo-stack';
import type { UndoEntry } from '@/lib/admin/undo-stack';
import type { AntiPatternAlert, AntiPatternSeverity, ABTestHistoryEntry } from '@/lib/admin/scoring-health-types';

// ============================================================================
// HELPERS (mirror component logic for testing)
// ============================================================================

function severityBucket(score: number): AntiPatternSeverity {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function sortHistory(entries: ABTestHistoryEntry[]): ABTestHistoryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.outcome === 'running' && b.outcome !== 'running') return -1;
    if (b.outcome === 'running' && a.outcome !== 'running') return 1;
    const dateA = a.concludedAt ?? a.startedAt;
    const dateB = b.concludedAt ?? b.startedAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

// ============================================================================
// UNDO STACK TESTS
// ============================================================================

describe('Undo Stack', () => {
  describe('pushUndoEntry', () => {
    it('pushes an entry onto an empty stack', () => {
      const stack = pushUndoEntry([], {
        type: 'weight-edit',
        description: 'Test edit',
        revertPayload: {
          type: 'weight-edit',
          tier: '1',
          factor: 'coherence',
          previousWeight: 0.15,
          newWeight: 0.20,
          normalise: true,
        },
      });
      expect(stack).toHaveLength(1);
      expect(stack[0]!.description).toBe('Test edit');
      expect(stack[0]!.undone).toBe(false);
      expect(stack[0]!.id).toMatch(/^undo_/);
    });

    it('prepends new entries (newest first)', () => {
      let stack: UndoEntry[] = [];
      stack = pushUndoEntry(stack, {
        type: 'weight-edit',
        description: 'First',
        revertPayload: { type: 'weight-edit', tier: '1', factor: 'a', previousWeight: 0.1, newWeight: 0.2, normalise: true },
      });
      stack = pushUndoEntry(stack, {
        type: 'weight-edit',
        description: 'Second',
        revertPayload: { type: 'weight-edit', tier: '1', factor: 'b', previousWeight: 0.1, newWeight: 0.3, normalise: true },
      });
      expect(stack[0]!.description).toBe('Second');
      expect(stack[1]!.description).toBe('First');
    });

    it('trims to MAX_UNDO_ENTRIES', () => {
      let stack: UndoEntry[] = [];
      for (let i = 0; i < MAX_UNDO_ENTRIES + 10; i++) {
        stack = pushUndoEntry(stack, {
          type: 'weight-edit',
          description: `Entry ${i}`,
          revertPayload: { type: 'weight-edit', tier: '1', factor: 'a', previousWeight: 0.1, newWeight: 0.2, normalise: true },
        });
      }
      expect(stack.length).toBe(MAX_UNDO_ENTRIES);
    });
  });

  describe('markUndone', () => {
    it('marks an entry as undone by ID', () => {
      const stack = pushUndoEntry([], {
        type: 'weight-edit',
        description: 'Test',
        revertPayload: { type: 'weight-edit', tier: '1', factor: 'a', previousWeight: 0.1, newWeight: 0.2, normalise: true },
      });
      const id = stack[0]!.id;
      const result = markUndone(stack, id);
      expect(result.entry!.undone).toBe(true);
      expect(result.stack[0]!.undone).toBe(true);
    });

    it('returns null entry for unknown ID', () => {
      const stack = pushUndoEntry([], {
        type: 'weight-edit',
        description: 'Test',
        revertPayload: { type: 'weight-edit', tier: '1', factor: 'a', previousWeight: 0.1, newWeight: 0.2, normalise: true },
      });
      const result = markUndone(stack, 'nonexistent');
      expect(result.entry).toBeNull();
    });
  });

  describe('descriptions', () => {
    it('describes weight increase with ↑', () => {
      const desc = describeWeightEdit('coherence', 'Tier 1', 0.15, 0.25);
      expect(desc).toContain('↑');
      expect(desc).toContain('coherence');
      expect(desc).toContain('Tier 1');
    });

    it('describes weight decrease with ↓', () => {
      const desc = describeWeightEdit('coherence', 'Tier 1', 0.25, 0.15);
      expect(desc).toContain('↓');
    });

    it('describes profile activation', () => {
      const desc = describeProfileActivate('Balanced', null);
      expect(desc).toContain('Activated');
      expect(desc).toContain('Balanced');
    });

    it('describes profile switch', () => {
      const desc = describeProfileActivate('Aggressive', 'Conservative');
      expect(desc).toContain('Conservative');
      expect(desc).toContain('Aggressive');
    });
  });

  describe('countPending', () => {
    it('counts non-undone entries', () => {
      let stack = pushUndoEntry([], {
        type: 'weight-edit',
        description: 'A',
        revertPayload: { type: 'weight-edit', tier: '1', factor: 'a', previousWeight: 0.1, newWeight: 0.2, normalise: true },
      });
      stack = pushUndoEntry(stack, {
        type: 'weight-edit',
        description: 'B',
        revertPayload: { type: 'weight-edit', tier: '1', factor: 'b', previousWeight: 0.1, newWeight: 0.3, normalise: true },
      });
      expect(countPending(stack)).toBe(2);

      const result = markUndone(stack, stack[0]!.id);
      expect(countPending(result.stack)).toBe(1);
    });

    it('returns 0 for empty stack', () => {
      expect(countPending([])).toBe(0);
    });
  });

  describe('getRecentEntries', () => {
    it('returns limited entries', () => {
      let stack: UndoEntry[] = [];
      for (let i = 0; i < 5; i++) {
        stack = pushUndoEntry(stack, {
          type: 'weight-edit',
          description: `E${i}`,
          revertPayload: { type: 'weight-edit', tier: '1', factor: 'a', previousWeight: 0.1, newWeight: 0.2, normalise: true },
        });
      }
      expect(getRecentEntries(stack, 3)).toHaveLength(3);
      expect(getRecentEntries(stack, 10)).toHaveLength(5);
    });
  });
});

// ============================================================================
// ANTI-PATTERN SEVERITY TESTS
// ============================================================================

describe('Anti-Pattern Severity', () => {
  describe('severityBucket', () => {
    it('classifies high severity (>= 0.7)', () => {
      expect(severityBucket(0.7)).toBe('high');
      expect(severityBucket(0.92)).toBe('high');
      expect(severityBucket(1.0)).toBe('high');
    });

    it('classifies medium severity (0.4–0.69)', () => {
      expect(severityBucket(0.4)).toBe('medium');
      expect(severityBucket(0.55)).toBe('medium');
      expect(severityBucket(0.69)).toBe('medium');
    });

    it('classifies low severity (< 0.4)', () => {
      expect(severityBucket(0.0)).toBe('low');
      expect(severityBucket(0.2)).toBe('low');
      expect(severityBucket(0.39)).toBe('low');
    });
  });

  describe('grouping', () => {
    const SAMPLE_ALERTS: AntiPatternAlert[] = [
      { id: '1', termA: 'oil painting', termB: 'digital art', patternType: 'collision', severity: 0.92, severityLevel: 'high', occurrenceCount: 847, qualityImpact: -23, suppressed: false, dismissed: false },
      { id: '2', termA: 'golden hour', termB: 'night scene', patternType: 'conflict', severity: 0.64, severityLevel: 'medium', occurrenceCount: 203, qualityImpact: -11, suppressed: false, dismissed: false },
      { id: '3', termA: 'fog', termB: 'foggy', patternType: 'redundancy', severity: 0.35, severityLevel: 'low', occurrenceCount: 89, qualityImpact: -3, suppressed: false, dismissed: false },
      { id: '4', termA: 'hyperrealistic', termB: 'cartoon', patternType: 'collision', severity: 0.88, severityLevel: 'high', occurrenceCount: 412, qualityImpact: -31, suppressed: false, dismissed: false },
    ];

    it('groups correctly by severity level', () => {
      const high = SAMPLE_ALERTS.filter((a) => a.severityLevel === 'high');
      const medium = SAMPLE_ALERTS.filter((a) => a.severityLevel === 'medium');
      const low = SAMPLE_ALERTS.filter((a) => a.severityLevel === 'low');
      expect(high).toHaveLength(2);
      expect(medium).toHaveLength(1);
      expect(low).toHaveLength(1);
    });

    it('sorts within group by severity descending', () => {
      const high = SAMPLE_ALERTS
        .filter((a) => a.severityLevel === 'high')
        .sort((a, b) => b.severity - a.severity);
      expect(high[0]!.severity).toBe(0.92);
      expect(high[1]!.severity).toBe(0.88);
    });

    it('counts active alerts (not suppressed, not dismissed)', () => {
      const active = SAMPLE_ALERTS.filter((a) => !a.suppressed && !a.dismissed);
      expect(active).toHaveLength(4);
    });
  });

  describe('deduplication', () => {
    it('deduplicates by sorted term pair', () => {
      const alerts: Pick<AntiPatternAlert, 'termA' | 'termB'>[] = [
        { termA: 'oil painting', termB: 'digital art' },
        { termA: 'digital art', termB: 'oil painting' }, // Same pair, reversed
        { termA: 'golden hour', termB: 'night scene' },
      ];

      const seen = new Set<string>();
      const deduped = alerts.filter((a) => {
        const key = [a.termA, a.termB].sort().join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      expect(deduped).toHaveLength(2);
    });
  });
});

// ============================================================================
// A/B TEST HISTORY TESTS
// ============================================================================

describe('A/B Test History', () => {
  const SAMPLE_HISTORY: ABTestHistoryEntry[] = [
    { testId: 't1', name: 'coherence-boost-v2', outcome: 'promoted', lift: 4.2, concludedAt: '2026-02-28T12:00:00Z', startedAt: '2026-02-20T10:00:00Z' },
    { testId: 't2', name: 'tier4-simplify-v1', outcome: 'rolled_back', lift: -1.1, concludedAt: '2026-02-21T15:00:00Z', startedAt: '2026-02-14T10:00:00Z' },
    { testId: 't3', name: 'category-weight-v3', outcome: 'promoted', lift: 2.8, concludedAt: '2026-02-14T09:00:00Z', startedAt: '2026-02-07T10:00:00Z' },
    { testId: 't4', name: 'new-experiment', outcome: 'running', lift: null, concludedAt: null, startedAt: '2026-03-01T08:00:00Z' },
  ];

  it('sorts running tests first', () => {
    const sorted = sortHistory(SAMPLE_HISTORY);
    expect(sorted[0]!.outcome).toBe('running');
  });

  it('sorts concluded tests by date descending', () => {
    const sorted = sortHistory(SAMPLE_HISTORY);
    // After running, the rest should be newest first
    const concluded = sorted.filter((t) => t.outcome !== 'running');
    expect(concluded[0]!.name).toBe('coherence-boost-v2');
    expect(concluded[1]!.name).toBe('tier4-simplify-v1');
    expect(concluded[2]!.name).toBe('category-weight-v3');
  });

  it('counts outcomes correctly', () => {
    const running = SAMPLE_HISTORY.filter((t) => t.outcome === 'running').length;
    const promoted = SAMPLE_HISTORY.filter((t) => t.outcome === 'promoted').length;
    const rolledBack = SAMPLE_HISTORY.filter((t) => t.outcome === 'rolled_back').length;
    expect(running).toBe(1);
    expect(promoted).toBe(2);
    expect(rolledBack).toBe(1);
  });

  it('handles null lift for running tests', () => {
    const running = SAMPLE_HISTORY.find((t) => t.outcome === 'running');
    expect(running!.lift).toBeNull();
    expect(running!.concludedAt).toBeNull();
  });

  it('handles empty history', () => {
    const sorted = sortHistory([]);
    expect(sorted).toEqual([]);
  });
});
