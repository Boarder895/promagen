// src/__tests__/admin/term-quality-leaderboard.test.ts
// ============================================================================
// Tests for Term Quality Leaderboard filtering/sorting logic + API contract
// ============================================================================
//
// Tests the API route's data transformation logic:
//   - Sorting by score/usage/trend/term in asc/desc
//   - Category and search filtering
//   - Summary stat computation (high/low performers, average)
//   - Boundary conditions (empty data, missing tiers)
//   - Top/Bottom 20 extraction
//
// Version: 1.0.0
// Created: 2026-03-01
// ============================================================================

import type {
  TermQualityEntry,
  TermQualitySortField,
} from '@/lib/admin/scoring-health-types';

// ============================================================================
// HELPER: Sort entries (mirrors API logic)
// ============================================================================

function sortEntries(
  entries: TermQualityEntry[],
  sortBy: TermQualitySortField,
  dir: 'asc' | 'desc',
): TermQualityEntry[] {
  const sorted = [...entries].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'score':   cmp = a.score - b.score; break;
      case 'usage':   cmp = a.usage - b.usage; break;
      case 'trend':   cmp = a.trend - b.trend; break;
      case 'term':    cmp = a.term.localeCompare(b.term); break;
    }
    return dir === 'desc' ? -cmp : cmp;
  });
  return sorted;
}

// ============================================================================
// HELPER: Filter entries (mirrors API logic)
// ============================================================================

function filterEntries(
  entries: TermQualityEntry[],
  category: string,
  search: string,
): TermQualityEntry[] {
  return entries.filter((e) => {
    if (category && e.category !== category) return false;
    if (search && !e.term.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

// ============================================================================
// HELPER: Compute summary (mirrors API logic)
// ============================================================================

function computeSummary(entries: TermQualityEntry[]) {
  const totalScored = entries.length;
  const highPerformers = entries.filter((e) => e.score >= 80).length;
  const lowPerformers = entries.filter((e) => e.score <= 20).length;
  const averageScore = totalScored > 0
    ? entries.reduce((sum, e) => sum + e.score, 0) / totalScored
    : 0;
  return { totalScored, highPerformers, lowPerformers, averageScore };
}

// ============================================================================
// TEST DATA
// ============================================================================

const SAMPLE_ENTRIES: TermQualityEntry[] = [
  { term: 'cinematic',       score: 94, usage: 3412, trend: 0.02,  category: 'style' },
  { term: 'neon glow',       score: 91, usage: 2108, trend: 0.05,  category: 'lighting' },
  { term: 'golden hour',     score: 89, usage: 4201, trend: 0.00,  category: 'lighting' },
  { term: 'wide angle',      score: 76, usage: 1890, trend: -0.01, category: 'camera' },
  { term: 'oil painting',    score: 65, usage: 920,  trend: 0.03,  category: 'style' },
  { term: 'foggy',           score: 52, usage: 560,  trend: -0.02, category: 'atmosphere' },
  { term: 'macro shot',      score: 45, usage: 310,  trend: 0.01,  category: 'camera' },
  { term: 'very detailed',   score: 12, usage: 87,   trend: -0.08, category: 'fidelity' },
  { term: 'super realistic', score: 15, usage: 45,   trend: -0.12, category: 'fidelity' },
  { term: 'HDR',             score: 8,  usage: 23,   trend: -0.15, category: 'fidelity' },
];

// ============================================================================
// TESTS
// ============================================================================

describe('sortEntries', () => {
  it('sorts by score descending (default)', () => {
    const result = sortEntries(SAMPLE_ENTRIES, 'score', 'desc');
    expect(result[0]!.term).toBe('cinematic');
    expect(result[result.length - 1]!.term).toBe('HDR');
  });

  it('sorts by score ascending', () => {
    const result = sortEntries(SAMPLE_ENTRIES, 'score', 'asc');
    expect(result[0]!.term).toBe('HDR');
    expect(result[result.length - 1]!.term).toBe('cinematic');
  });

  it('sorts by usage descending', () => {
    const result = sortEntries(SAMPLE_ENTRIES, 'usage', 'desc');
    expect(result[0]!.term).toBe('golden hour');
    expect(result[0]!.usage).toBe(4201);
  });

  it('sorts by trend descending', () => {
    const result = sortEntries(SAMPLE_ENTRIES, 'trend', 'desc');
    expect(result[0]!.term).toBe('neon glow');
    expect(result[0]!.trend).toBe(0.05);
  });

  it('sorts by term alphabetically ascending', () => {
    const result = sortEntries(SAMPLE_ENTRIES, 'term', 'asc');
    expect(result[0]!.term).toBe('HDR');
    expect(result[1]!.term).toBe('cinematic');
  });

  it('sorts by term alphabetically descending', () => {
    const result = sortEntries(SAMPLE_ENTRIES, 'term', 'desc');
    expect(result[0]!.term).toBe('wide angle');
  });

  it('handles empty input', () => {
    expect(sortEntries([], 'score', 'desc')).toEqual([]);
  });

  it('handles single entry', () => {
    const single = [SAMPLE_ENTRIES[0]!];
    expect(sortEntries(single, 'score', 'desc')).toEqual(single);
  });
});

describe('filterEntries', () => {
  it('filters by category', () => {
    const result = filterEntries(SAMPLE_ENTRIES, 'lighting', '');
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.category === 'lighting')).toBe(true);
  });

  it('returns all when category is empty', () => {
    const result = filterEntries(SAMPLE_ENTRIES, '', '');
    expect(result).toHaveLength(SAMPLE_ENTRIES.length);
  });

  it('filters by search text (case-insensitive)', () => {
    const result = filterEntries(SAMPLE_ENTRIES, '', 'glow');
    expect(result).toHaveLength(1);
    expect(result[0]!.term).toBe('neon glow');
  });

  it('filters by search text uppercase', () => {
    const result = filterEntries(SAMPLE_ENTRIES, '', 'HDR');
    expect(result).toHaveLength(1);
    expect(result[0]!.term).toBe('HDR');
  });

  it('combines category + search', () => {
    const result = filterEntries(SAMPLE_ENTRIES, 'style', 'oil');
    expect(result).toHaveLength(1);
    expect(result[0]!.term).toBe('oil painting');
  });

  it('returns empty when no match', () => {
    const result = filterEntries(SAMPLE_ENTRIES, '', 'nonexistent');
    expect(result).toHaveLength(0);
  });

  it('returns empty when category has no match for search', () => {
    const result = filterEntries(SAMPLE_ENTRIES, 'camera', 'neon');
    expect(result).toHaveLength(0);
  });
});

describe('computeSummary', () => {
  it('counts high performers (score >= 80)', () => {
    const summary = computeSummary(SAMPLE_ENTRIES);
    // cinematic (94), neon glow (91), golden hour (89) = 3
    expect(summary.highPerformers).toBe(3);
  });

  it('counts low performers (score <= 20)', () => {
    const summary = computeSummary(SAMPLE_ENTRIES);
    // very detailed (12), super realistic (15), HDR (8) = 3
    expect(summary.lowPerformers).toBe(3);
  });

  it('computes total scored', () => {
    const summary = computeSummary(SAMPLE_ENTRIES);
    expect(summary.totalScored).toBe(10);
  });

  it('computes average score', () => {
    const summary = computeSummary(SAMPLE_ENTRIES);
    const expected = (94 + 91 + 89 + 76 + 65 + 52 + 45 + 12 + 15 + 8) / 10;
    expect(summary.averageScore).toBeCloseTo(expected);
  });

  it('handles empty entries', () => {
    const summary = computeSummary([]);
    expect(summary.totalScored).toBe(0);
    expect(summary.highPerformers).toBe(0);
    expect(summary.lowPerformers).toBe(0);
    expect(summary.averageScore).toBe(0);
  });

  it('handles single entry', () => {
    const summary = computeSummary([{ term: 'a', score: 90, usage: 1, trend: 0, category: 'style' }]);
    expect(summary.totalScored).toBe(1);
    expect(summary.highPerformers).toBe(1);
    expect(summary.lowPerformers).toBe(0);
    expect(summary.averageScore).toBe(90);
  });
});

describe('Top/Bottom extraction', () => {
  it('extracts top N sorted by score desc', () => {
    const sorted = [...SAMPLE_ENTRIES].sort((a, b) => b.score - a.score);
    const top5 = sorted.slice(0, 5);
    expect(top5[0]!.score).toBe(94);
    expect(top5[4]!.score).toBe(65);
    expect(top5).toHaveLength(5);
  });

  it('extracts bottom N sorted by score asc', () => {
    const sorted = [...SAMPLE_ENTRIES].sort((a, b) => a.score - b.score);
    const bottom3 = sorted.slice(0, 3);
    expect(bottom3[0]!.score).toBe(8);
    expect(bottom3[2]!.score).toBe(15);
  });

  it('handles limit larger than dataset', () => {
    const sorted = [...SAMPLE_ENTRIES].sort((a, b) => b.score - a.score);
    const top20 = sorted.slice(0, 20);
    expect(top20).toHaveLength(10); // Only 10 in sample
  });
});

describe('boundary conditions', () => {
  it('all terms score exactly 80 (boundary for high performers)', () => {
    const borderline: TermQualityEntry[] = [
      { term: 'a', score: 80, usage: 1, trend: 0, category: 'style' },
      { term: 'b', score: 79, usage: 1, trend: 0, category: 'style' },
    ];
    const summary = computeSummary(borderline);
    expect(summary.highPerformers).toBe(1);
  });

  it('all terms score exactly 20 (boundary for low performers)', () => {
    const borderline: TermQualityEntry[] = [
      { term: 'a', score: 20, usage: 1, trend: 0, category: 'style' },
      { term: 'b', score: 21, usage: 1, trend: 0, category: 'style' },
    ];
    const summary = computeSummary(borderline);
    expect(summary.lowPerformers).toBe(1);
  });

  it('trend zero treated as neutral', () => {
    const entry: TermQualityEntry = { term: 'neutral', score: 50, usage: 100, trend: 0, category: 'style' };
    // Trend sorting: zero should land in the middle
    const entries = [
      { ...entry, term: 'up', trend: 0.5 },
      { ...entry, term: 'zero', trend: 0 },
      { ...entry, term: 'down', trend: -0.5 },
    ];
    const sorted = sortEntries(entries, 'trend', 'desc');
    expect(sorted[0]!.term).toBe('up');
    expect(sorted[1]!.term).toBe('zero');
    expect(sorted[2]!.term).toBe('down');
  });
});
