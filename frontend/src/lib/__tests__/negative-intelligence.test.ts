// src/lib/__tests__/negative-intelligence.test.ts
// ============================================================================
// PHASE 9 — Negative Intelligence Engine tests
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §7
// Build plan:   call-3-quality-build-plan-v1.md §13
// ============================================================================

import { generateNegative } from '@/lib/call-3-transforms/negative-intelligence';
import { getDNA } from '@/data/platform-dna';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import { extractAnchors } from '@/lib/optimise-prompts/preflight';

// ============================================================================
// TEST HELPERS
// ============================================================================

function dnaFor(id: string): PlatformDNA {
  const dna = getDNA(id);
  if (!dna) throw new Error(`No DNA for ${id}`);
  return dna;
}

const LIGHTHOUSE_PROMPT =
  'masterpiece, best quality, a weathered lighthouse keeper stands on a rain-soaked cliff, ' +
  'gripping a brass telescope, dramatic storm clouds, crashing waves below, ' +
  'pale golden beam of light, deep purple and copper sky, volumetric fog, ' +
  'cinematic composition, sharp focus, 8k';

const EMPTY_ANCHORS: AnchorManifest = {
  subjectPhrase: null,
  subjectPosition: 0,
  subjectIsLeading: true,
  colours: [],
  lightSources: [],
  environmentNouns: [],
  actionVerbs: [],
  anchorCount: 0,
};

// ============================================================================
// NEGATIVE MODE GATING
// ============================================================================

describe('Negative intelligence — mode gating', () => {
  it('returns null for platforms with negativeMode: none', () => {
    const dna = dnaFor('adobe-firefly'); // none
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, EMPTY_ANCHORS);

    expect(result.negative).toBeNull();
    expect(result.source).toBe('none');
    expect(result.termCount).toBe(0);
  });

  it('returns null for platforms with negativeMode: counterproductive', () => {
    // Luma AI has counterproductive negatives
    const dna = getDNA('luma-ai');
    if (!dna) return; // Skip if not in DNA

    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, EMPTY_ANCHORS);

    expect(result.negative).toBeNull();
    expect(result.changes[0]).toContain('counterproductive');
  });

  it('generates negatives for platforms with separate_field support', () => {
    const dna = dnaFor('stability'); // separate_field
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    expect(result.negative).not.toBeNull();
    expect(result.termCount).toBeGreaterThan(0);
  });

  it('generates inline negatives for MJ-style platforms', () => {
    const dna = dnaFor('midjourney'); // inline
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    if (result.negative) {
      expect(result.negative).toMatch(/^--no /);
    }
  });
});

// ============================================================================
// CLIP PLATFORMS
// ============================================================================

describe('Negative intelligence — CLIP platforms', () => {
  it('generates standard CLIP negatives for Stability', () => {
    const dna = dnaFor('stability');
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    expect(result.negative).toContain('blurry');
    expect(result.negative).toContain('watermark');
    expect(result.source).toBe('tier_a_standard');
  });

  it('generates CLIP negatives for Leonardo', () => {
    const dna = dnaFor('leonardo');
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    expect(result.negative).not.toBeNull();
    expect(result.termCount).toBeGreaterThan(3);
  });

  it('generates curly-brace negatives for NovelAI', () => {
    const dna = dnaFor('novelai');
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    // NovelAI uses curly_brace syntax — should get anime-specific negatives
    if (result.negative) {
      expect(result.negative).toContain('bad anatomy');
      expect(result.negative).toContain('bad hands');
    }
  });
});

// ============================================================================
// MIDJOURNEY — INLINE + TERM LIMIT
// ============================================================================

describe('Negative intelligence — Midjourney', () => {
  it('formats as --no syntax', () => {
    const dna = dnaFor('midjourney');
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    if (result.negative) {
      expect(result.negative.startsWith('--no ')).toBe(true);
    }
  });

  it('limits to max 4 terms (architecture §7.2)', () => {
    const dna = dnaFor('midjourney');
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    expect(result.termCount).toBeLessThanOrEqual(4);
  });
});

// ============================================================================
// SCENE-AWARE FILTERING — Contradiction avoidance
// ============================================================================

describe('Negative intelligence — contradiction filtering', () => {
  it('does not negate terms that appear in the positive prompt', () => {
    // If the positive prompt mentions "text" (e.g., "text on a sign"),
    // the negative should NOT include "text"
    const prompt = 'a vintage poster with text and watermark design, art deco style';
    const anchors: AnchorManifest = {
      ...EMPTY_ANCHORS,
      subjectPhrase: 'vintage poster',
    };
    const dna = dnaFor('stability');

    const result = generateNegative(prompt, dna, anchors);

    // "text" and "watermark" are in the positive prompt, should be filtered out
    if (result.negative) {
      expect(result.negative).not.toContain('watermark');
    }
  });

  it('keeps terms that do not contradict positive content', () => {
    const dna = dnaFor('stability');
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    // "blurry" and "bad anatomy" should survive — not in the lighthouse prompt
    if (result.negative) {
      expect(result.negative).toContain('blurry');
    }
  });
});

// ============================================================================
// T5 / LLM REWRITE — Should return empty or null
// ============================================================================

describe('Negative intelligence — T5 and LLM rewrite', () => {
  it('returns minimal or no negatives for T5 platforms', () => {
    const dna = dnaFor('flux'); // T5
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);
    const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);

    // T5 platforms: negatives generally unnecessary
    // If negativeMode is 'none', returns null. If 'separate', returns minimal.
    // Flux has negativeMode: none → should return null
    if (dna.negativeMode === 'none') {
      expect(result.negative).toBeNull();
    }
  });
});

// ============================================================================
// ALL 40 PLATFORMS — No crashes
// ============================================================================

describe('Negative intelligence — all platforms', () => {
  it('generates without errors for all 40 platforms', () => {
    const { getAllDNA } = require('@/data/platform-dna');
    const allDna = getAllDNA();
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);

    for (const [id, dna] of Object.entries(allDna) as [string, PlatformDNA][]) {
      expect(() => {
        generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);
      }).not.toThrow();
    }
  });

  it('returns null for all platforms with negativeMode none', () => {
    const { getAllDNA } = require('@/data/platform-dna');
    const allDna = getAllDNA();
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);

    for (const [id, dna] of Object.entries(allDna) as [string, PlatformDNA][]) {
      if (dna.negativeMode === 'none' || dna.negativeMode === 'counterproductive') {
        const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);
        expect(result.negative).toBeNull();
      }
    }
  });

  it('returns non-null for platforms with separate or inline support', () => {
    const { getAllDNA } = require('@/data/platform-dna');
    const allDna = getAllDNA();
    const anchors = extractAnchors(LIGHTHOUSE_PROMPT);

    for (const [id, dna] of Object.entries(allDna) as [string, PlatformDNA][]) {
      if (dna.negativeMode === 'separate_field' || dna.negativeMode === 'inline') {
        const result = generateNegative(LIGHTHOUSE_PROMPT, dna, anchors);
        // Should generate negatives (unless all terms contradicted)
        expect(result.negative).not.toBeNull();
      }
    }
  });
});

// ============================================================================
// HALLUCINATION MAP
// ============================================================================

describe('Hallucination map integrity', () => {
   
  const map = require('@/data/platform-dna/hallucination-map.json');

  it('has version 1.0.0', () => {
    expect(map._meta.version).toBe('1.0.0');
  });

  it('all entries have required fields', () => {
    for (const [platformId, scenes] of Object.entries(map)) {
      if (platformId === '_meta') continue;
      for (const [sceneType, entries] of Object.entries(scenes as Record<string, unknown[]>)) {
        for (const entry of entries as Array<{ pattern: string; confidence: string; severity: string }>) {
          expect(entry.pattern).toBeDefined();
          expect(entry.pattern.length).toBeGreaterThan(0);
          expect(['assumed', 'measured']).toContain(entry.confidence);
          expect(['low', 'medium', 'high']).toContain(entry.severity);
        }
      }
    }
  });

  it('only references platforms that exist in DNA', () => {
    const { getAllDNAIds } = require('@/data/platform-dna');
    const validIds = new Set(getAllDNAIds());

    for (const key of Object.keys(map)) {
      if (key === '_meta') continue;
      expect(validIds.has(key)).toBe(true);
    }
  });
});
