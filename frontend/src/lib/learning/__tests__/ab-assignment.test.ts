// src/lib/learning/__tests__/ab-assignment.test.ts
// ============================================================================
// A/B TESTING — Assignment Engine Tests
// ============================================================================
//
// Tests for FNV-1a hash and deterministic variant assignment.
//
// Test cases from build plan § 6 (Part 7.6a):
// 1. fnv1aHash produces consistent output for same input
// 2. fnv1aHash produces different output for different inputs
// 3. assignVariant returns 'A' or 'B' deterministically
// 4. assignVariant distribution is roughly 50/50 across 10,000 random hashes
// 5. Same abHash + testId always returns same variant
// 6. Different testId flips some users (not all stuck in same bucket)
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 6 (7.6a)
//
// Version: 1.1.0 — Added chi-squared uniformity smoke test (7.6b extra)
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import { fnv1aHash, assignVariant } from '../ab-assignment';

// ============================================================================
// Test 1: fnv1aHash produces consistent output for same input
// ============================================================================

describe('fnv1aHash', () => {
  it('produces consistent output for the same input', () => {
    const input = 'test-hash-input';
    const result1 = fnv1aHash(input);
    const result2 = fnv1aHash(input);
    const result3 = fnv1aHash(input);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  // ==========================================================================
  // Test 2: fnv1aHash produces different output for different inputs
  // ==========================================================================

  it('produces different output for different inputs', () => {
    const hash1 = fnv1aHash('input-alpha');
    const hash2 = fnv1aHash('input-beta');
    const hash3 = fnv1aHash('input-gamma');

    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);
  });

  it('returns an unsigned 32-bit integer', () => {
    const result = fnv1aHash('any-string');

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('handles empty string without error', () => {
    const result = fnv1aHash('');

    expect(typeof result).toBe('number');
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ============================================================================
// Test 3: assignVariant returns 'A' or 'B' deterministically
// ============================================================================

describe('assignVariant', () => {
  it('returns A or B deterministically', () => {
    const result = assignVariant('user-uuid-123', 'ab_test-001');

    expect(['A', 'B']).toContain(result);

    // Same inputs → same result (deterministic)
    const result2 = assignVariant('user-uuid-123', 'ab_test-001');
    expect(result).toBe(result2);
  });

  // ==========================================================================
  // Test 4: Distribution is roughly 50/50 across 10,000 random hashes
  // ==========================================================================

  it('distributes roughly 50/50 across 10,000 hashes', () => {
    const testId = 'ab_distribution-test';
    let countA = 0;
    let countB = 0;

    for (let i = 0; i < 10_000; i++) {
      // Simulate different users with sequential IDs
      const abHash = `user-${i}-${Math.random().toString(36).slice(2)}`;
      const variant = assignVariant(abHash, testId);
      if (variant === 'A') countA++;
      else countB++;
    }

    const total = countA + countB;
    expect(total).toBe(10_000);

    // Allow ±5% tolerance (45%–55% range)
    const ratioA = countA / total;
    expect(ratioA).toBeGreaterThan(0.45);
    expect(ratioA).toBeLessThan(0.55);
  });

  // ==========================================================================
  // Test 5: Same abHash + testId always returns same variant
  // ==========================================================================

  it('returns the same variant for same abHash + testId across calls', () => {
    const abHash = 'stable-user-uuid-abc';
    const testId = 'ab_consistency-test';

    const results = Array.from({ length: 100 }, () =>
      assignVariant(abHash, testId),
    );

    // All 100 calls should return the same value
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(1);
  });

  // ==========================================================================
  // Test 6: Different testId flips some users (not all stuck in same bucket)
  // ==========================================================================

  it('flips some users when testId changes', () => {
    const testId1 = 'ab_test-round-1';
    const testId2 = 'ab_test-round-2';

    let flippedCount = 0;
    const userCount = 1_000;

    for (let i = 0; i < userCount; i++) {
      const abHash = `user-flip-test-${i}`;
      const variant1 = assignVariant(abHash, testId1);
      const variant2 = assignVariant(abHash, testId2);
      if (variant1 !== variant2) flippedCount++;
    }

    // Expect roughly ~50% of users to flip (with tolerance)
    // At minimum, SOME users must flip (not all stuck in same bucket)
    expect(flippedCount).toBeGreaterThan(userCount * 0.3);
    expect(flippedCount).toBeLessThan(userCount * 0.7);
  });

  // ==========================================================================
  // Custom split percentage
  // ==========================================================================

  it('respects custom splitPct', () => {
    const testId = 'ab_split-test';
    let countB = 0;

    // 20% split → expect ~20% variant B
    for (let i = 0; i < 10_000; i++) {
      const abHash = `split-user-${i}`;
      if (assignVariant(abHash, testId, 20) === 'B') countB++;
    }

    const ratioB = countB / 10_000;
    // Allow ±5% tolerance around 20%
    expect(ratioB).toBeGreaterThan(0.15);
    expect(ratioB).toBeLessThan(0.25);
  });

  it('returns A for all users when splitPct is 0', () => {
    for (let i = 0; i < 100; i++) {
      expect(assignVariant(`user-${i}`, 'ab_zero', 0)).toBe('A');
    }
  });

  it('returns B for all users when splitPct is 100', () => {
    for (let i = 0; i < 100; i++) {
      expect(assignVariant(`user-${i}`, 'ab_full', 100)).toBe('B');
    }
  });
});

// ============================================================================
// Extra: Chi-squared uniformity test across all 100 buckets
// ============================================================================
//
// Verifies FNV-1a mod 100 is statistically uniform, not just the binary
// A/B split. Catches subtle distribution biases (e.g., certain buckets
// getting systematically more/fewer users) that a simple 50/50 check misses.
//
// Chi-squared test: sum((observed - expected)² / expected) for each bucket.
// With 99 degrees of freedom, the critical value at α = 0.01 is ≈ 135.8.
// A well-distributed hash should produce χ² well below this.
// ============================================================================

describe('fnv1aHash — chi-squared uniformity', () => {
  it('distributes uniformly across all 100 buckets (χ² test)', () => {
    const NUM_SAMPLES = 100_000;
    const NUM_BUCKETS = 100;
    const expected = NUM_SAMPLES / NUM_BUCKETS; // 1000 per bucket

    // Count how many hashes land in each bucket
    const buckets = new Array<number>(NUM_BUCKETS).fill(0);

    for (let i = 0; i < NUM_SAMPLES; i++) {
      const input = `chi-sq-user-${i}`;
      const bucket = fnv1aHash(input) % NUM_BUCKETS;
      buckets[bucket]!++;
    }

    // Compute chi-squared statistic
    let chiSquared = 0;
    for (let b = 0; b < NUM_BUCKETS; b++) {
      const observed = buckets[b]!;
      chiSquared += ((observed - expected) ** 2) / expected;
    }

    // Critical value for χ²(99) at α = 0.01 is ~135.8
    // A good hash should be well below this (typically 80–120 for 100K samples)
    expect(chiSquared).toBeLessThan(135.8);

    // Also verify no bucket is catastrophically empty or overfull
    // With 1000 expected, anything below 800 or above 1200 would be suspicious
    for (let b = 0; b < NUM_BUCKETS; b++) {
      expect(buckets[b]!).toBeGreaterThan(800);
      expect(buckets[b]!).toBeLessThan(1200);
    }
  });
});
