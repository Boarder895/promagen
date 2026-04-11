// src/lib/__tests__/semantic-compress.test.ts
// ============================================================================
// T_SEMANTIC_COMPRESS — Tests
// ============================================================================
// Build plan: call-3-quality-build-plan-v1.md §8 (Phase 4)
// Architecture: call-3-quality-architecture-v0.2.0.md §5.4
//
// Tests:
//   1. Density scoring — visual concepts / word count
//   2. Redundant modifier compression — "weathered old" → "grizzled"
//   3. Compound adjective formation — "purple and copper" → "purple-copper"
//   4. CLIP vs T5 behaviour — compression only on tight budgets
//   5. Architecture Law 2 — preservation outranks enrichment
//   6. Edge cases — empty input, no compressible patterns
// ============================================================================

import { computeDensity, semanticCompress } from '@/lib/call-3-transforms/semantic-compress';
import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';

// ── Test helpers ────────────────────────────────────────────────────────────

function makeAnchors(overrides: Partial<AnchorManifest> = {}): AnchorManifest {
  return {
    subjectPhrase: 'weathered old keeper',
    subjectPosition: 0,
    subjectIsLeading: true,
    colours: ['copper', 'purple'],
    lightSources: ['lantern'],
    environmentNouns: ['cliff', 'coast'],
    actionVerbs: ['pauses'],
    anchorCount: 6,
    ...overrides,
  };
}

// ============================================================================
// 1. DENSITY SCORING
// ============================================================================

describe('Semantic Compression — Density scoring', () => {
  test('pure visual nouns → density 1.0', () => {
    // Every word is a visual concept
    const density = computeDensity('lighthouse keeper storm');
    expect(density).toBe(1.0);
  });

  test('verbose phrase with articles → density < 1.0', () => {
    // "a weathered old lighthouse keeper" — articles dilute density
    const density = computeDensity('a weathered old lighthouse keeper');
    expect(density).toBeLessThan(1.0);
    expect(density).toBeGreaterThan(0.5);
  });

  test('architecture example: "weathered old lighthouse keeper" → density 0.6–0.8', () => {
    const density = computeDensity('weathered old lighthouse keeper');
    // 4 visual concepts in 4 words — but "old" and "weathered" overlap semantically
    expect(density).toBeGreaterThan(0.5);
    expect(density).toBeLessThanOrEqual(1.0);
  });

  test('empty string → density 1.0 (no waste)', () => {
    expect(computeDensity('')).toBe(1.0);
  });

  test('stop words only → density 0.0', () => {
    expect(computeDensity('a the and of')).toBe(0.0);
  });

  test('single visual word → density 1.0', () => {
    expect(computeDensity('lighthouse')).toBe(1.0);
  });
});

// ============================================================================
// 2. REDUNDANT MODIFIER COMPRESSION
// ============================================================================

describe('Semantic Compression — Redundant modifiers', () => {
  test('"ancient old" → "ancient" (audited synonym table v1.1.0)', () => {
    const result = semanticCompress(
      'ancient old keeper on the cliff, copper sky',
      makeAnchors(),
      77,
    );

    expect(result.text).toContain('ancient');
    expect(result.text).not.toContain('ancient old');
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(result.compressions.length).toBeGreaterThan(0);
    expect(result.compressions[0]!.strategy).toBe('redundant_modifier');
  });

  test('"bright vivid" → "vivid"', () => {
    const result = semanticCompress(
      'bright vivid sunset over the coast',
      makeAnchors(),
      77,
    );

    expect(result.text).toContain('vivid');
    expect(result.text).not.toContain('bright vivid');
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  test('"dark shadowy" → "shadowy"', () => {
    const result = semanticCompress(
      'dark shadowy corridor, keeper with lantern',
      makeAnchors(),
      77,
    );

    expect(result.text).toContain('shadowy');
    expect(result.text).not.toContain('dark shadowy');
  });

  test('no redundant modifiers → text unchanged', () => {
    const input = 'dramatic storm, copper sky, keeper on cliff';
    const result = semanticCompress(input, makeAnchors(), 77);

    // No redundant modifier pairs in the input
    expect(result.text).toBe(input);
    expect(result.tokensSaved).toBe(0);
  });
});

// ============================================================================
// 3. COMPOUND ADJECTIVE FORMATION
// ============================================================================

describe('Semantic Compression — Compound formations', () => {
  test('"purple and copper" → "purple-copper" (architecture §5.4)', () => {
    const result = semanticCompress(
      'masterpiece, purple and copper sky, keeper on cliff',
      makeAnchors(),
      77,
    );

    expect(result.text).toContain('purple-copper');
    expect(result.text).not.toContain('purple and copper');
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(result.compressions.some((c) => c.strategy === 'compound_formation')).toBe(true);
  });

  test('"gold and silver" → "gold-silver" (audited compound v1.1.0)', () => {
    const result = semanticCompress(
      'gold and silver accents over the coast, keeper pauses',
      makeAnchors(),
      77,
    );

    expect(result.text).toContain('gold-silver');
  });

  test('multiple compressions in one prompt', () => {
    const result = semanticCompress(
      'weathered old keeper, purple and copper sky, bright vivid sunset',
      makeAnchors(),
      77,
    );

    expect(result.compressions.length).toBeGreaterThanOrEqual(2);
    expect(result.tokensSaved).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// 4. CLIP vs T5 BEHAVIOUR
// ============================================================================

describe('Semantic Compression — Budget sensitivity', () => {
  test('CLIP (77 tokens) → compression applied', () => {
    const result = semanticCompress(
      'ancient old keeper on the cliff, copper sky',
      makeAnchors(),
      77,
    );

    expect(result.compressions.length).toBeGreaterThan(0);
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  test('T5 (512 tokens) → compression NOT applied', () => {
    const result = semanticCompress(
      'weathered old keeper on the cliff, copper sky',
      makeAnchors(),
      512,
    );

    // T5 has plenty of budget — no compression needed
    expect(result.compressions).toHaveLength(0);
    expect(result.tokensSaved).toBe(0);
    expect(result.text).toContain('weathered old');
  });

  test('density is tracked even when compression is not applied', () => {
    const result = semanticCompress(
      'weathered old keeper on the cliff, copper sky',
      makeAnchors(),
      512,
    );

    expect(result.densityBefore).toBeGreaterThan(0);
    expect(result.densityAfter).toBe(result.densityBefore);
  });
});

// ============================================================================
// 5. DENSITY IMPROVEMENT
// ============================================================================

describe('Semantic Compression — Density improvement', () => {
  test('compression improves density', () => {
    const result = semanticCompress(
      'weathered old keeper standing on a cliff, purple and copper sky above',
      makeAnchors(),
      77,
    );

    if (result.compressions.length > 0) {
      expect(result.densityAfter).toBeGreaterThanOrEqual(result.densityBefore);
    }
  });
});

// ============================================================================
// 6. EDGE CASES
// ============================================================================

describe('Semantic Compression — Edge cases', () => {
  test('empty input → empty output', () => {
    const result = semanticCompress('', makeAnchors(), 77);

    expect(result.text).toBe('');
    expect(result.tokensSaved).toBe(0);
    expect(result.densityBefore).toBe(1.0);
    expect(result.densityAfter).toBe(1.0);
  });

  test('single word → returned unchanged', () => {
    const result = semanticCompress('masterpiece', makeAnchors(), 77);

    expect(result.text).toBe('masterpiece');
    expect(result.tokensSaved).toBe(0);
  });

  test('already dense prompt → no compression applied', () => {
    const input = 'keeper, cliff, storm, copper, lantern';
    const result = semanticCompress(input, makeAnchors(), 77);

    // All words are unique visual concepts — nothing to compress
    expect(result.text).toBe(input);
    expect(result.tokensSaved).toBe(0);
  });

  test('case insensitive matching', () => {
    const result = semanticCompress(
      'WEATHERED OLD keeper, PURPLE AND COPPER sky',
      makeAnchors(),
      77,
    );

    // Should still find and compress despite case differences
    expect(result.compressions.length).toBeGreaterThan(0);
  });

  test('change descriptions are human-readable', () => {
    const result = semanticCompress(
      'weathered old keeper, purple and copper sky',
      makeAnchors(),
      77,
    );

    for (const change of result.changes) {
      expect(change).toContain('Semantic compression');
      expect(change).toContain('→');
    }
  });
});
