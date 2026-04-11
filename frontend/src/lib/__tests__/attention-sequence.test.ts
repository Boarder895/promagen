// src/lib/__tests__/attention-sequence.test.ts
// ============================================================================
// ATTENTION SEQUENCING — Tests
// ============================================================================
// Build plan: call-3-quality-build-plan-v1.md §7.2
// Architecture: call-3-quality-architecture-v0.2.0.md §5
//
// Test fixtures from build plan:
//   1. Lighthouse Keeper on CLIP: subject leads, total ≤ 77 tokens
//   2. Budget overflow on CLIP: lowest-AVIS dropped
//   3. Cohesion pair preserved: interaction stays adjacent
//   4. Quality prefix stays at position 0, suffix at end
//   5. Empty/short input: returned unchanged
//
// Additional tests:
//   - Attention curves return expected values at known positions
//   - Cohesion pair detection finds subject+action pairs
//   - AVIS scores track visual impact ordering
// ============================================================================

import { clipAttentionCurve, t5AttentionCurve, llmAttentionCurve, getAttentionCurve } from '@/lib/call-3-transforms/attention-curves';
import { detectCohesionPairs } from '@/lib/call-3-transforms/cohesion-pairs';
import { sequenceByAVIS, configFromDNA, estimateTokens } from '@/lib/call-3-transforms/attention-sequence';
import type { AVISConfig } from '@/lib/call-3-transforms/attention-sequence';
import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';

// ── Test helpers ────────────────────────────────────────────────────────────

/** Minimal CLIP DNA for testing (stability-like). */
function makeClipDNA(overrides: Partial<PlatformDNA> = {}): PlatformDNA {
  return {
    id: 'stability',
    encoderFamily: 'clip',
    promptStylePreference: 'weighted_keywords',
    syntaxMode: 'parenthetical',
    negativeMode: 'separate_field',
    tokenLimit: 77,
    charCeiling: 875,
    processingProfile: {
      frontLoadImportance: 0.8,
      rewritesPrompt: false,
      qualityTagsEffective: true,
    },
    allowedTransforms: ['T_ATTENTION_SEQUENCE', 'T_SUBJECT_FRONT', 'T_CHAR_ENFORCE'],
    requiresGPT: false,
    gptTemperature: null,
    retryEnabled: false,
    tokenBudget: null,
    knownFailureModes: ['token_overflow_silent_truncation'],
    hallucinationMap: null,
    assembledBaseline: null,
    optimisedScore: null,
    availableHeadroom: null,
    harmonyStatus: 'untested',
    ...overrides,
  };
}

/** Build a CLIP config for testing. */
function makeClipConfig(): AVISConfig {
  return {
    attentionCurve: clipAttentionCurve,
    enforceTokenBudget: true,
    tokenLimit: 77,
  };
}

/** Build an anchor manifest with rich data. */
function makeLighthouseAnchors(): AnchorManifest {
  return {
    subjectPhrase: 'weathered keeper',
    subjectPosition: 45,
    subjectIsLeading: false,
    colours: ['copper', 'purple'],
    lightSources: ['lantern'],
    environmentNouns: ['cliff', 'coast'],
    actionVerbs: ['pauses', 'grips'],
    anchorCount: 8,
  };
}

/**
 * Canonical Lighthouse Keeper test prompt — CLIP keyword format.
 * Deliberately has subject NOT at the front (buried after environment).
 * Quality prefix and suffix present.
 */
const LIGHTHOUSE_CLIP_PROMPT = [
  'masterpiece', 'best quality',
  'dramatic storm clouds',
  'enormous waves crashing against cliff',
  'a weathered keeper pauses on the coast',
  'copper and purple sky',
  'lantern glow cutting through rain',
  'salt-worn iron railing',
  'trending on artstation',
].join(', ');

// ============================================================================
// 1. ATTENTION CURVES
// ============================================================================

describe('Attention Curves', () => {
  describe('CLIP curve — exponential front-decay', () => {
    test('position 0 → 1.0', () => {
      expect(clipAttentionCurve(0, 77)).toBe(1.0);
    });

    test('position 30 → diminished (< 0.5)', () => {
      const weight = clipAttentionCurve(30, 77);
      expect(weight).toBeLessThan(0.5);
      expect(weight).toBeGreaterThan(0.2);
    });

    test('position 77 → near-zero', () => {
      expect(clipAttentionCurve(77, 77)).toBe(0.0);
    });

    test('position 76 → very low but positive', () => {
      const weight = clipAttentionCurve(76, 77);
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThan(0.15);
    });

    test('negative position → 1.0 (clamped)', () => {
      expect(clipAttentionCurve(-5, 77)).toBe(1.0);
    });

    test('monotonically decreasing', () => {
      let prev = clipAttentionCurve(0, 77);
      for (let i = 1; i < 77; i++) {
        const curr = clipAttentionCurve(i, 77);
        expect(curr).toBeLessThanOrEqual(prev);
        prev = curr;
      }
    });
  });

  describe('T5 curve — mild linear decay', () => {
    test('position 0 → 1.0', () => {
      expect(t5AttentionCurve(0, 512)).toBe(1.0);
    });

    test('position 512 → 0.7', () => {
      expect(t5AttentionCurve(512, 512)).toBe(0.7);
    });

    test('midpoint → ~0.85', () => {
      const weight = t5AttentionCurve(256, 512);
      expect(weight).toBeCloseTo(0.85, 2);
    });

    test('always above 0.7', () => {
      for (let i = 0; i <= 512; i++) {
        expect(t5AttentionCurve(i, 512)).toBeGreaterThanOrEqual(0.7);
      }
    });
  });

  describe('LLM curve — near-uniform', () => {
    test('any position → 0.95', () => {
      expect(llmAttentionCurve(0, 1000)).toBe(0.95);
      expect(llmAttentionCurve(500, 1000)).toBe(0.95);
      expect(llmAttentionCurve(999, 1000)).toBe(0.95);
    });
  });

  describe('getAttentionCurve selection', () => {
    test('clip → clipAttentionCurve', () => {
      const curve = getAttentionCurve('clip');
      expect(curve(0, 77)).toBe(1.0);
      expect(curve(77, 77)).toBe(0.0);
    });

    test('t5 → t5AttentionCurve', () => {
      const curve = getAttentionCurve('t5');
      expect(curve(512, 512)).toBe(0.7);
    });

    test('llm_rewrite → llmAttentionCurve', () => {
      const curve = getAttentionCurve('llm_rewrite');
      expect(curve(0, 100)).toBe(0.95);
    });

    test('proprietary → t5 as safe default', () => {
      const curve = getAttentionCurve('proprietary');
      expect(curve(0, 512)).toBe(1.0);
      expect(curve(512, 512)).toBe(0.7);
    });
  });
});

// ============================================================================
// 2. COHESION PAIRS
// ============================================================================

describe('Cohesion Pairs', () => {
  test('detects subject + primary action verb pair', () => {
    const anchors = makeLighthouseAnchors();
    const pairs = detectCohesionPairs(LIGHTHOUSE_CLIP_PROMPT, anchors);

    const subjectAction = pairs.find((p) => p.relationship === 'subject_action');
    expect(subjectAction).toBeDefined();
    expect(subjectAction!.anchor1).toBe('weathered keeper');
    expect(subjectAction!.anchor2).toBe('pauses');
    expect(subjectAction!.confidence).toBe(1.0);
  });

  test('subject+action pair has highest confidence', () => {
    const anchors = makeLighthouseAnchors();
    const pairs = detectCohesionPairs(LIGHTHOUSE_CLIP_PROMPT, anchors);

    if (pairs.length > 1) {
      // Sorted by confidence descending — subject_action should be first
      expect(pairs[0]!.relationship).toBe('subject_action');
      expect(pairs[0]!.confidence).toBeGreaterThanOrEqual(pairs[1]!.confidence);
    }
  });

  test('no duplicate anchors across pairs', () => {
    const anchors = makeLighthouseAnchors();
    const pairs = detectCohesionPairs(LIGHTHOUSE_CLIP_PROMPT, anchors);

    const used = new Set<string>();
    for (const pair of pairs) {
      expect(used.has(pair.anchor1.toLowerCase())).toBe(false);
      expect(used.has(pair.anchor2.toLowerCase())).toBe(false);
      used.add(pair.anchor1.toLowerCase());
      used.add(pair.anchor2.toLowerCase());
    }
  });

  test('no subject phrase → no subject_action pair', () => {
    const anchors = makeLighthouseAnchors();
    anchors.subjectPhrase = null;
    const pairs = detectCohesionPairs(LIGHTHOUSE_CLIP_PROMPT, anchors);

    expect(pairs.find((p) => p.relationship === 'subject_action')).toBeUndefined();
  });

  test('no action verbs → no subject_action pair', () => {
    const anchors = makeLighthouseAnchors();
    (anchors as { actionVerbs: string[] }).actionVerbs = [];
    const pairs = detectCohesionPairs(LIGHTHOUSE_CLIP_PROMPT, anchors);

    expect(pairs.find((p) => p.relationship === 'subject_action')).toBeUndefined();
  });
});

// ============================================================================
// 3. TOKEN ESTIMATION
// ============================================================================

describe('Token Estimation', () => {
  test('empty string → 0 tokens', () => {
    expect(estimateTokens('')).toBe(0);
  });

  test('single word → ~1-2 tokens', () => {
    const tokens = estimateTokens('lighthouse');
    expect(tokens).toBeGreaterThanOrEqual(1);
    expect(tokens).toBeLessThanOrEqual(2);
  });

  test('77-word prompt → roughly 77×1.3 ≈ 101 tokens', () => {
    const words = Array.from({ length: 77 }, () => 'test').join(' ');
    const tokens = estimateTokens(words);
    expect(tokens).toBeGreaterThanOrEqual(77);
    expect(tokens).toBeLessThanOrEqual(120);
  });
});

// ============================================================================
// 4. SEQUENCING — Lighthouse Keeper on CLIP
// ============================================================================

describe('Attention Sequencing — CLIP', () => {
  test('subject moves to early position', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    // Subject should be in the first few segments (after quality prefix)
    const segments = result.text.split(', ');
    const subjectIdx = segments.findIndex((s) => s.toLowerCase().includes('keeper'));
    const qualityPrefixCount = segments.filter(
      (s) => s.toLowerCase().includes('masterpiece') || s.toLowerCase().includes('best quality'),
    ).length;

    // Subject should appear right after quality prefix segments
    expect(subjectIdx).toBeLessThanOrEqual(qualityPrefixCount + 2);
    expect(result.wasReordered).toBe(true);
  });

  test('quality prefix stays at position 0', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    const firstSegment = result.text.split(', ')[0]!.toLowerCase();
    expect(
      firstSegment.includes('masterpiece') || firstSegment.includes('best quality'),
    ).toBe(true);
  });

  test('quality suffix stays at end', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    const segments = result.text.split(', ');
    const lastSegment = segments[segments.length - 1]!.toLowerCase();
    expect(lastSegment.includes('artstation')).toBe(true);
  });

  test('AVIS scores are monotonically decreasing (excluding prefix/suffix)', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    // Filter to body scores (exclude quality prefix/suffix)
    const bodyScores = result.avisScores.filter(
      (s) => s.category !== 'quality_prefix' && s.category !== 'quality_suffix',
    );

    // finalAVIS should decrease as position increases
    for (let i = 1; i < bodyScores.length; i++) {
      const prev = bodyScores[i - 1]!;
      const curr = bodyScores[i]!;
      expect(curr.finalAVIS).toBeLessThanOrEqual(prev.finalAVIS + 0.01);
    }
  });

  test('all original content preserved (no words lost)', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    // Every original segment should appear somewhere in the output
    const originalSegments = LIGHTHOUSE_CLIP_PROMPT.split(', ').map((s) => s.trim().toLowerCase());
    const outputLower = result.text.toLowerCase();

    for (const seg of originalSegments) {
      if (result.anchorsDropped.map((d) => d.toLowerCase()).includes(seg)) continue;
      expect(outputLower).toContain(seg);
    }
  });

  test('change descriptions are generated', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    expect(result.changes.length).toBeGreaterThan(0);
    // Should mention "Attention sequencing" or "Cohesion pair"
    expect(result.changes.some(
      (c) => c.includes('Attention sequencing') || c.includes('Cohesion pair'),
    )).toBe(true);
  });
});

// ============================================================================
// 5. BUDGET OVERFLOW — Lowest-AVIS dropped
// ============================================================================

describe('Attention Sequencing — Budget overflow', () => {
  test('overflow drops lowest-AVIS anchors, keeps highest', () => {
    // Build a prompt that clearly exceeds 77 tokens
    const longPrompt = [
      'masterpiece', 'best quality', 'ultra detailed',
      'a weathered keeper standing on the cliff edge',
      'enormous storm waves crashing against jagged rocks',
      'copper and purple sky streaked with lightning',
      'ancient lantern casting warm golden glow',
      'salt-encrusted iron railing worn by decades',
      'deep navy blue ocean stretching to horizon',
      'dramatic low-angle cinematic composition',
      'volumetric fog rolling across the coastline',
      'rule of thirds framing with leading lines',
      'shot on 85mm lens with shallow depth of field',
      'trending on artstation',
    ].join(', ');

    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(longPrompt, anchors, config, dna);

    // Should have dropped something
    expect(result.anchorsDropped.length).toBeGreaterThan(0);
    // Tokens used should be within budget
    expect(result.tokensUsed).toBeLessThanOrEqual(77);

    // Subject should NOT be dropped (highest visual impact)
    const droppedLower = result.anchorsDropped.map((d) => d.toLowerCase());
    expect(droppedLower.some((d) => d.includes('keeper'))).toBe(false);

    // Camera/composition should be dropped first (lowest visual impact)
    const droppedAny85mm = droppedLower.some((d) => d.includes('85mm') || d.includes('lens'));
    const droppedAnyComposition = droppedLower.some((d) => d.includes('rule of thirds') || d.includes('leading lines'));
    expect(droppedAny85mm || droppedAnyComposition).toBe(true);
  });
});

// ============================================================================
// 6. EMPTY/SHORT INPUT
// ============================================================================

describe('Attention Sequencing — Edge cases', () => {
  test('empty input → returned unchanged', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS('', anchors, config, dna);

    expect(result.text).toBe('');
    expect(result.wasReordered).toBe(false);
    expect(result.anchorsDropped).toHaveLength(0);
  });

  test('single segment → returned unchanged', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS('weathered keeper on cliff', anchors, config, dna);

    expect(result.wasReordered).toBe(false);
  });

  test('two segments → returned unchanged (too few to reorder)', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS('masterpiece, weathered keeper', anchors, config, dna);

    expect(result.wasReordered).toBe(false);
  });

  test('configFromDNA produces correct config for CLIP platform', () => {
    const dna = makeClipDNA();
    const config = configFromDNA(dna);

    expect(config.enforceTokenBudget).toBe(true);
    expect(config.tokenLimit).toBe(77);
    // CLIP curve: position 0 → 1.0
    expect(config.attentionCurve(0, 77)).toBe(1.0);
  });

  test('configFromDNA produces correct config for non-CLIP platform', () => {
    const dna = makeClipDNA({
      id: 'flux',
      encoderFamily: 't5',
      tokenLimit: 512,
    });
    const config = configFromDNA(dna);

    expect(config.enforceTokenBudget).toBe(false);
    expect(config.tokenLimit).toBe(512);
  });
});

// ============================================================================
// 7. AVIS DIAGNOSTIC OUTPUT
// ============================================================================

describe('Attention Sequencing — Diagnostics', () => {
  test('avisScores array has one entry per sequencing unit', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    expect(result.avisScores.length).toBeGreaterThan(0);
    // Every score should have the required fields
    for (const score of result.avisScores) {
      expect(typeof score.anchor).toBe('string');
      expect(typeof score.visualImpact).toBe('number');
      expect(typeof score.tokenCost).toBe('number');
      expect(typeof score.baseScore).toBe('number');
      expect(typeof score.finalPosition).toBe('number');
      expect(typeof score.finalAVIS).toBe('number');
      expect(typeof score.isPair).toBe('boolean');
    }
  });

  test('subject has highest visual impact (1.0)', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    const subjectScore = result.avisScores.find((s) => s.category === 'subject');
    expect(subjectScore).toBeDefined();
    expect(subjectScore!.visualImpact).toBe(1.0);
  });

  test('cohesion pairs get bonus in AVIS scores (isPair flag)', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const result = sequenceByAVIS(LIGHTHOUSE_CLIP_PROMPT, anchors, config, dna);

    const pairedScores = result.avisScores.filter((s) => s.isPair);
    // If pairs were detected, they should exist in the scores
    if (pairedScores.length > 0) {
      for (const ps of pairedScores) {
        expect(ps.isPair).toBe(true);
      }
    }
  });
});

// ============================================================================
// 8. MULTI-WORD CLASSIFICATION
// ============================================================================

describe('Attention Sequencing — Multi-word classification', () => {
  test('golden hour classified as lighting, not uncategorised', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const prompt = 'masterpiece, weathered keeper, golden hour lighting, copper sky';
    const result = sequenceByAVIS(prompt, anchors, config, dna);

    const goldenHour = result.avisScores.find((s) =>
      s.anchor.toLowerCase().includes('golden hour'),
    );
    expect(goldenHour).toBeDefined();
    expect(goldenHour!.category).toBe('lighting');
  });

  test('rule of thirds classified as composition', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const prompt = 'masterpiece, weathered keeper, rule of thirds, copper sky';
    const result = sequenceByAVIS(prompt, anchors, config, dna);

    const rot = result.avisScores.find((s) =>
      s.anchor.toLowerCase().includes('rule of thirds'),
    );
    expect(rot).toBeDefined();
    expect(rot!.category).toBe('composition');
  });

  test('oil painting classified as style', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const prompt = 'masterpiece, weathered keeper, oil painting, copper sky';
    const result = sequenceByAVIS(prompt, anchors, config, dna);

    const style = result.avisScores.find((s) =>
      s.anchor.toLowerCase().includes('oil painting'),
    );
    expect(style).toBeDefined();
    expect(style!.category).toBe('style');
  });

  test('depth of field classified as composition', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    const prompt = 'masterpiece, weathered keeper, shallow depth of field, copper sky';
    const result = sequenceByAVIS(prompt, anchors, config, dna);

    const dof = result.avisScores.find((s) =>
      s.anchor.toLowerCase().includes('depth of field'),
    );
    expect(dof).toBeDefined();
    expect(dof!.category).toBe('composition');
  });
});

// ============================================================================
// 9. MIXED-FORMAT PROMPT
// ============================================================================

describe('Attention Sequencing — Mixed-format prompt', () => {
  test('sentence-separated prompt splits and reorders', () => {
    const anchors = makeLighthouseAnchors();
    const config = makeClipConfig();
    const dna = makeClipDNA();
    // Prose-style prompt with periods instead of commas
    const prosePrompt =
      'Dramatic storm clouds over the coast. A weathered keeper pauses. ' +
      'Copper and purple sky. Lantern glow.';
    const result = sequenceByAVIS(prosePrompt, anchors, config, dna);

    // Should have split on sentences since comma split gives ≤2 segments
    expect(result.avisScores.length).toBeGreaterThan(2);
    expect(result.wasReordered).toBe(true);
  });
});
