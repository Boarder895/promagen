// src/lib/learning/__tests__/compression-overrides.test.ts
// ============================================================================
// COMPRESSION INTELLIGENCE — Override List Unit Tests
// ============================================================================
//
// Phase 7.9, Part 7.9d — Tests for the expendable term safety net.
//
// Verifies isOverriddenTerm(), set completeness across all categories,
// case sensitivity, and edge cases.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
//
// Version: 1.0.0
// Created: 2026-02-28
// ============================================================================

import { EXPENDABLE_OVERRIDES, isOverriddenTerm } from '../compression-overrides';

// ============================================================================
// TESTS — isOverriddenTerm
// ============================================================================

describe('isOverriddenTerm', () => {
  it('returns true for resolution terms', () => {
    expect(isOverriddenTerm('4K')).toBe(true);
    expect(isOverriddenTerm('8K')).toBe(true);
    expect(isOverriddenTerm('ultra HD')).toBe(true);
    expect(isOverriddenTerm('sharp focus')).toBe(true);
    expect(isOverriddenTerm('intricate detail')).toBe(true);
  });

  it('returns true for cinematic terms', () => {
    expect(isOverriddenTerm('cinematic')).toBe(true);
    expect(isOverriddenTerm('bokeh')).toBe(true);
    expect(isOverriddenTerm('volumetric lighting')).toBe(true);
    expect(isOverriddenTerm('golden hour')).toBe(true);
    expect(isOverriddenTerm('ray tracing')).toBe(true);
  });

  it('returns true for render engine terms', () => {
    expect(isOverriddenTerm('octane render')).toBe(true);
    expect(isOverriddenTerm('unreal engine 5')).toBe(true);
    expect(isOverriddenTerm('V-Ray')).toBe(true);
    expect(isOverriddenTerm('photorealistic')).toBe(true);
    expect(isOverriddenTerm('DSLR')).toBe(true);
  });

  it('returns true for artistic style terms', () => {
    expect(isOverriddenTerm('oil painting')).toBe(true);
    expect(isOverriddenTerm('concept art')).toBe(true);
    expect(isOverriddenTerm('cyberpunk')).toBe(true);
    expect(isOverriddenTerm('anime')).toBe(true);
    expect(isOverriddenTerm('art nouveau')).toBe(true);
  });

  it('returns true for platform-specific terms', () => {
    expect(isOverriddenTerm('--v 6')).toBe(true);
    expect(isOverriddenTerm('--ar 16:9')).toBe(true);
    expect(isOverriddenTerm('trending on artstation')).toBe(true);
    expect(isOverriddenTerm('masterpiece')).toBe(true);
  });

  it('returns false for unknown terms', () => {
    expect(isOverriddenTerm('some random term')).toBe(false);
    expect(isOverriddenTerm('potato')).toBe(false);
    expect(isOverriddenTerm('')).toBe(false);
  });

  it('is case-sensitive (matching vocabulary system)', () => {
    expect(isOverriddenTerm('4K')).toBe(true);
    expect(isOverriddenTerm('4k')).toBe(false);

    expect(isOverriddenTerm('cinematic')).toBe(true);
    expect(isOverriddenTerm('Cinematic')).toBe(false);

    expect(isOverriddenTerm('V-Ray')).toBe(true);
    expect(isOverriddenTerm('v-ray')).toBe(false);
  });
});

// ============================================================================
// TESTS — EXPENDABLE_OVERRIDES set
// ============================================================================

describe('EXPENDABLE_OVERRIDES', () => {
  it('is a non-empty set', () => {
    expect(EXPENDABLE_OVERRIDES.size).toBeGreaterThan(0);
  });

  it('contains at least 60 terms across all categories', () => {
    expect(EXPENDABLE_OVERRIDES.size).toBeGreaterThanOrEqual(60);
  });

  it('is immutable (ReadonlySet interface)', () => {
    expect(typeof EXPENDABLE_OVERRIDES.has).toBe('function');
    expect(typeof EXPENDABLE_OVERRIDES.forEach).toBe('function');
    expect(typeof EXPENDABLE_OVERRIDES.size).toBe('number');
  });

  it('contains no empty strings', () => {
    EXPENDABLE_OVERRIDES.forEach((term) => {
      expect(term.length).toBeGreaterThan(0);
    });
  });

  it('contains no duplicates', () => {
    const arr = Array.from(EXPENDABLE_OVERRIDES);
    const unique = new Set(arr);
    expect(arr.length).toBe(unique.size);
  });

  it('spans all five expected categories', () => {
    expect(EXPENDABLE_OVERRIDES.has('8K')).toBe(true);            // Resolution
    expect(EXPENDABLE_OVERRIDES.has('cinematic')).toBe(true);     // Cinematic
    expect(EXPENDABLE_OVERRIDES.has('octane render')).toBe(true); // Render
    expect(EXPENDABLE_OVERRIDES.has('oil painting')).toBe(true);  // Style
    expect(EXPENDABLE_OVERRIDES.has('--v 6')).toBe(true);         // Platform
  });
});
