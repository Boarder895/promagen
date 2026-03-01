// src/__tests__/admin/scoring-health-overview.test.ts
// ============================================================================
// SCORING HEALTH OVERVIEW — Unit Tests
// ============================================================================
//
// Tests for:
//   - Sparkline normalisation (normaliseSparkline)
//   - Trend formatting (formatTrend)
//   - Relative time formatting (formatRelativeTime)
//
// Pure function tests — no DOM, no React, no fetch.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 4
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new test file).
// ============================================================================

import {
  normaliseSparkline,
  formatTrend,
  formatRelativeTime,
} from '@/lib/admin/scoring-health-types';

import type { SparklinePoint } from '@/lib/admin/scoring-health-types';

// ============================================================================
// SPARKLINE NORMALISATION
// ============================================================================

describe('normaliseSparkline', () => {
  it('returns empty array for empty input', () => {
    expect(normaliseSparkline([])).toEqual([]);
  });

  it('normalises values to 0–1 range', () => {
    const points: SparklinePoint[] = [
      { label: 'a', value: 0 },
      { label: 'b', value: 50 },
      { label: 'c', value: 100 },
    ];
    const result = normaliseSparkline(points);
    expect(result).toEqual([0, 0.5, 1]);
  });

  it('handles constant values (all same)', () => {
    const points: SparklinePoint[] = [
      { label: 'a', value: 42 },
      { label: 'b', value: 42 },
      { label: 'c', value: 42 },
    ];
    const result = normaliseSparkline(points);
    // Constant → all mid-line (0.5)
    expect(result).toEqual([0.5, 0.5, 0.5]);
  });

  it('handles single point', () => {
    const points: SparklinePoint[] = [{ label: 'a', value: 7 }];
    const result = normaliseSparkline(points);
    expect(result).toEqual([0.5]); // Single point = constant → mid-line
  });

  it('handles negative values correctly', () => {
    const points: SparklinePoint[] = [
      { label: 'a', value: -10 },
      { label: 'b', value: 0 },
      { label: 'c', value: 10 },
    ];
    const result = normaliseSparkline(points);
    expect(result).toEqual([0, 0.5, 1]);
  });

  it('handles decimal values', () => {
    const points: SparklinePoint[] = [
      { label: 'a', value: 0.5 },
      { label: 'b', value: 0.7 },
      { label: 'c', value: 0.9 },
    ];
    const result = normaliseSparkline(points);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0.5, 5);
    expect(result[2]).toBeCloseTo(1, 5);
  });
});

// ============================================================================
// TREND FORMATTING
// ============================================================================

describe('formatTrend', () => {
  it('formats positive trend as up arrow', () => {
    const result = formatTrend(0.05);
    expect(result.direction).toBe('up');
    expect(result.text).toContain('▲');
    expect(result.text).toContain('+0.050');
  });

  it('formats negative trend as down arrow', () => {
    const result = formatTrend(-0.03);
    expect(result.direction).toBe('down');
    expect(result.text).toContain('▼');
    expect(result.text).toContain('-0.030');
  });

  it('formats near-zero as flat', () => {
    const result = formatTrend(0.0001);
    expect(result.direction).toBe('flat');
    expect(result.text).toContain('—');
  });

  it('formats exactly zero as flat', () => {
    const result = formatTrend(0);
    expect(result.direction).toBe('flat');
  });

  it('handles large positive values', () => {
    const result = formatTrend(0.5);
    expect(result.direction).toBe('up');
    expect(result.text).toContain('+0.500');
  });

  it('handles large negative values', () => {
    const result = formatTrend(-0.5);
    expect(result.direction).toBe('down');
    expect(result.text).toContain('-0.500');
  });
});

// ============================================================================
// RELATIVE TIME FORMATTING
// ============================================================================

describe('formatRelativeTime', () => {
  it('returns "Never" for null', () => {
    expect(formatRelativeTime(null)).toBe('Never');
  });

  it('returns "just now" for future timestamps', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(formatRelativeTime(future)).toBe('just now');
  });

  it('returns "just now" for timestamps less than 1 minute ago', () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelativeTime(recent)).toBe('just now');
  });

  it('returns minutes for timestamps < 1 hour', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(formatRelativeTime(thirtyMinAgo)).toBe('30m ago');
  });

  it('returns hours and minutes for timestamps < 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000 - 14 * 60_000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h 14m ago');
  });

  it('returns just hours when no remaining minutes', () => {
    const exactlyThreeHours = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(exactlyThreeHours)).toBe('3h ago');
  });

  it('returns days for timestamps >= 24 hours', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});
