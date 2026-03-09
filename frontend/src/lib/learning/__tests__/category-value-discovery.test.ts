// src/lib/learning/__tests__/category-value-discovery.test.ts
// ============================================================================
// SELF-IMPROVING SCORER — Category Value Discovery Tests
// ============================================================================
//
// Verifies that category value discovery correctly identifies high-value
// and low-value categories based on outcome data.
//
// Authority: phase-6-self-improving-scorer-buildplan.md § 4.4
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import {
  computeCategoryValues,
  MIN_EVENTS_PER_CATEGORY,
  MIN_EVENTS_FOR_DISCOVERY,
  KNOWN_CATEGORIES,
} from '../category-value-discovery';

import type { CategoryValueMap } from '../category-value-discovery';
import type { PromptEventRow } from '../database';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a mock event with specified filled categories and outcome.
 *
 * @param filledCategories — Which categories have selections
 * @param outcome — Outcome signals
 * @param tier — Platform tier
 */
function mockEvent(opts: {
  filledCategories?: string[];
  copied?: boolean;
  saved?: boolean;
  returnedWithin60s?: boolean;
  reusedFromLibrary?: boolean;
  tier?: number;
}): PromptEventRow {
  const filled = opts.filledCategories ?? ['style', 'lighting'];

  // Build selections: filled categories get a value, others are absent
  const selections: Record<string, string[]> = {};
  for (const cat of filled) {
    selections[cat] = [`test-${cat}-value`];
  }

  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    session_id: 'sess_test',
    attempt_number: 1,
    selections,
    category_count: filled.length,
    char_length: 100,
    score: 92,
    score_factors: { categoryCount: 20, coherence: 18 },
    platform: 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: {
      copied: opts.copied ?? false,
      saved: opts.saved ?? false,
      returnedWithin60s: opts.returnedWithin60s ?? false,
      reusedFromLibrary: opts.reusedFromLibrary ?? false,
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate N events where a specific category is always filled in
 * high-outcome events and never filled in low-outcome events.
 *
 * This creates a clear signal: the category is valuable.
 */
function generateHighValueCategoryEvents(
  n: number,
  valuableCategory: string,
  tier: number = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  const half = Math.floor(n / 2);

  // First half: high outcome + category filled
  for (let i = 0; i < half; i++) {
    events.push(
      mockEvent({
        filledCategories: ['subject', 'style', valuableCategory],
        copied: true,
        saved: true,
        reusedFromLibrary: true,
        tier,
      }),
    );
  }

  // Second half: low outcome + category NOT filled
  for (let i = 0; i < n - half; i++) {
    events.push(
      mockEvent({
        filledCategories: ['subject', 'style'],
        copied: true,
        saved: false,
        returnedWithin60s: true,
        tier,
      }),
    );
  }

  return events;
}

/**
 * Generate N events where a category is randomly filled/empty
 * regardless of outcome (no correlation → value near 0).
 */
function generateIrrelevantCategoryEvents(
  n: number,
  irrelevantCategory: string,
  tier: number = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];

  for (let i = 0; i < n; i++) {
    const isHighOutcome = i % 2 === 0;
    const isFilled = i % 3 !== 0; // Random-ish fill pattern

    const cats = ['subject', 'style'];
    if (isFilled) cats.push(irrelevantCategory);

    events.push(
      mockEvent({
        filledCategories: cats,
        copied: true,
        saved: isHighOutcome,
        reusedFromLibrary: isHighOutcome,
        returnedWithin60s: !isHighOutcome,
        tier,
      }),
    );
  }

  return events;
}

// ============================================================================
// Cold Start
// ============================================================================

describe('computeCategoryValues — cold start', () => {
  it('returns empty result for no events', () => {
    const result = computeCategoryValues([]);
    expect(result.eventCount).toBe(0);
    expect(Object.keys(result.global.categories)).toHaveLength(0);
  });

  it('returns empty result when below MIN_EVENTS_FOR_DISCOVERY', () => {
    const events = Array.from(
      { length: MIN_EVENTS_FOR_DISCOVERY - 1 },
      () => mockEvent({}),
    );
    const result = computeCategoryValues(events);
    expect(Object.keys(result.global.categories)).toHaveLength(0);
  });

  it('includes version and generatedAt', () => {
    const result = computeCategoryValues([]);
    expect(result.version).toBe('2.0.0');
    expect(result.generatedAt).toBeTruthy();
    expect(result.feedbackEventCount).toBe(0);
  });

  it('has all four tiers in output', () => {
    const result = computeCategoryValues([]);
    expect(result.tiers['1']).toBeDefined();
    expect(result.tiers['2']).toBeDefined();
    expect(result.tiers['3']).toBeDefined();
    expect(result.tiers['4']).toBeDefined();
  });
});

// ============================================================================
// High-Value Category Detection
// ============================================================================

describe('computeCategoryValues — high-value categories', () => {
  it('category always filled in high-outcome events gets high value', () => {
    const events = generateHighValueCategoryEvents(200, 'lighting');
    const result = computeCategoryValues(events);

    const lightingValue = result.global.categories['lighting']?.value ?? 0;

    // Should be clearly positive — filled with high outcomes vs empty with low
    expect(lightingValue).toBeGreaterThan(0.05);
  });

  it('high-value category has higher meanFilled than meanEmpty', () => {
    const events = generateHighValueCategoryEvents(200, 'atmosphere');
    const result = computeCategoryValues(events);

    const atmo = result.global.categories['atmosphere'];
    expect(atmo).toBeDefined();
    expect(atmo!.meanFilled).toBeGreaterThan(atmo!.meanEmpty);
  });

  it('filledCount and emptyCount are tracked correctly', () => {
    const events = generateHighValueCategoryEvents(200, 'colour');
    const result = computeCategoryValues(events);

    const colour = result.global.categories['colour'];
    expect(colour).toBeDefined();
    expect(colour!.filledCount).toBeGreaterThan(0);
    expect(colour!.emptyCount).toBeGreaterThan(0);
    expect(colour!.filledCount + colour!.emptyCount).toBe(200);
  });
});

// ============================================================================
// Irrelevant Category Detection
// ============================================================================

describe('computeCategoryValues — irrelevant categories', () => {
  it('category with no outcome correlation gets value near 0', () => {
    const events = generateIrrelevantCategoryEvents(200, 'materials');
    const result = computeCategoryValues(events);

    const materialsValue = result.global.categories['materials']?.value ?? 0;

    // Should be near 0 (or 0 from clamping)
    expect(materialsValue).toBeLessThan(0.15);
  });
});

// ============================================================================
// No Negative Penalisation
// ============================================================================

describe('computeCategoryValues — no negative penalisation', () => {
  it('category values are never negative (clamped at 0)', () => {
    // Create events where filling "camera" correlates with WORSE outcomes
    const events: PromptEventRow[] = [];

    // Camera filled → low outcome
    for (let i = 0; i < 60; i++) {
      events.push(
        mockEvent({
          filledCategories: ['subject', 'style', 'camera'],
          copied: true,
          saved: false,
          returnedWithin60s: true,
          tier: 2,
        }),
      );
    }

    // Camera empty → high outcome
    for (let i = 0; i < 60; i++) {
      events.push(
        mockEvent({
          filledCategories: ['subject', 'style'],
          copied: true,
          saved: true,
          reusedFromLibrary: true,
          tier: 2,
        }),
      );
    }

    const result = computeCategoryValues(events);
    const cameraValue = result.global.categories['camera']?.value ?? -1;

    // Must be clamped at 0, not negative
    expect(cameraValue).toBeGreaterThanOrEqual(0);
  });

  it('all category values are >= 0 across all tiers', () => {
    const events = generateHighValueCategoryEvents(200, 'lighting');
    const result = computeCategoryValues(events);

    // Check global
    for (const [, cat] of Object.entries(result.global.categories)) {
      expect(cat.value).toBeGreaterThanOrEqual(0);
    }

    // Check per-tier
    for (const [, tier] of Object.entries(result.tiers)) {
      for (const [, cat] of Object.entries(tier.categories)) {
        expect(cat.value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ============================================================================
// Per-Tier Differentiation
// ============================================================================

describe('computeCategoryValues — per-tier', () => {
  it('same category can have different values on different tiers', () => {
    // Tier 1: lighting is valuable
    const tier1Events = generateHighValueCategoryEvents(200, 'lighting', 1);

    // Tier 3: lighting is irrelevant
    const tier3Events = generateIrrelevantCategoryEvents(200, 'lighting', 3);

    const result = computeCategoryValues([...tier1Events, ...tier3Events]);

    const tier1Value = result.tiers['1']?.categories['lighting']?.value ?? 0;
    const tier3Value = result.tiers['3']?.categories['lighting']?.value ?? 0;

    // Tier 1 should have higher value for lighting
    expect(tier1Value).toBeGreaterThan(tier3Value);
  });

  it('tier with insufficient events uses neutral values', () => {
    // Only tier 2 events
    const events = generateHighValueCategoryEvents(200, 'lighting', 2);
    const result = computeCategoryValues(events);

    // Tier 1 has 0 events → neutral
    expect(result.tiers['1']!.eventCount).toBe(0);
    for (const [, cat] of Object.entries(result.tiers['1']!.categories)) {
      expect(cat.value).toBe(0);
    }

    // Tier 2 has data → non-zero
    expect(result.tiers['2']!.eventCount).toBe(200);
  });
});

// ============================================================================
// Category Discovery
// ============================================================================

describe('computeCategoryValues — category discovery', () => {
  it('discovers categories from event data', () => {
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 60; i++) {
      events.push(
        mockEvent({
          filledCategories: ['style', 'custom_category_xyz'],
          copied: true,
          saved: true,
          tier: 2,
        }),
      );
    }

    const result = computeCategoryValues(events);

    // Should discover the custom category from data
    expect(result.global.categories['custom_category_xyz']).toBeDefined();
  });

  it('includes all KNOWN_CATEGORIES', () => {
    const events = generateHighValueCategoryEvents(200, 'style');
    const result = computeCategoryValues(events);

    for (const known of KNOWN_CATEGORIES) {
      expect(result.global.categories[known]).toBeDefined();
    }
  });
});

// ============================================================================
// Minimum Events Guard
// ============================================================================

describe('computeCategoryValues — minimum events guard', () => {
  it('category with < MIN_EVENTS_PER_CATEGORY filled gets value 0', () => {
    // Create events where 'fidelity' is rarely filled
    const events: PromptEventRow[] = [];

    // A few events with fidelity filled
    for (let i = 0; i < MIN_EVENTS_PER_CATEGORY - 1; i++) {
      events.push(
        mockEvent({
          filledCategories: ['style', 'fidelity'],
          copied: true,
          saved: true,
          reusedFromLibrary: true,
        }),
      );
    }

    // Many events without fidelity
    for (let i = 0; i < 100; i++) {
      events.push(
        mockEvent({
          filledCategories: ['style', 'lighting'],
          copied: true,
          saved: false,
        }),
      );
    }

    const result = computeCategoryValues(events);
    const fidelityValue = result.global.categories['fidelity']?.value ?? -1;

    // Not enough data → neutral (0)
    expect(fidelityValue).toBe(0);
  });
});

// ============================================================================
// Constants Sanity
// ============================================================================

describe('Category value constants', () => {
  it('MIN_EVENTS_PER_CATEGORY is reasonable', () => {
    expect(MIN_EVENTS_PER_CATEGORY).toBeGreaterThanOrEqual(5);
    expect(MIN_EVENTS_PER_CATEGORY).toBeLessThanOrEqual(100);
  });

  it('MIN_EVENTS_FOR_DISCOVERY is reasonable', () => {
    expect(MIN_EVENTS_FOR_DISCOVERY).toBeGreaterThanOrEqual(20);
    expect(MIN_EVENTS_FOR_DISCOVERY).toBeLessThanOrEqual(500);
  });

  it('KNOWN_CATEGORIES includes the standard set', () => {
    const expected = [
      'style',
      'lighting',
      'colour',
      'atmosphere',
      'fidelity',
      'negative',
    ];
    for (const cat of expected) {
      expect(KNOWN_CATEGORIES).toContain(cat);
    }
  });
});
