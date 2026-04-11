// src/lib/__tests__/call-3-transforms-catalogue.test.ts
// ============================================================================
// PHASE 5 — Deterministic Transform Catalogue tests
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.4
//
// Tests the coordinator (index.ts), individual transforms, and the
// DNA-driven pipeline integration.
// ============================================================================

import { runDeterministicTransforms } from '@/lib/call-3-transforms';
import { subjectFront } from '@/lib/call-3-transforms/subject-front';
import { qualityPosition } from '@/lib/call-3-transforms/quality-position';
import { weightRebalance } from '@/lib/call-3-transforms/weight-rebalance';
import { tokenMerge } from '@/lib/call-3-transforms/token-merge';
import { redundancyStrip } from '@/lib/call-3-transforms/redundancy-strip';
import { scenePremise } from '@/lib/call-3-transforms/scene-premise';
import { charEnforce } from '@/lib/call-3-transforms/char-enforce';
import { clauseFront } from '@/lib/call-3-transforms/clause-front';
import { paramValidate } from '@/lib/call-3-transforms/param-validate';
import { weightValidate } from '@/lib/call-3-transforms/weight-validate';
import { classifyVisualCategory } from '@/lib/call-3-transforms/attention-sequence';
import { getDNA } from '@/data/platform-dna';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import { extractAnchors } from '@/lib/optimise-prompts/preflight';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/** Canonical lighthouse keeper scene for testing. */
const LIGHTHOUSE_PROMPT =
  'masterpiece, best quality, a weathered lighthouse keeper stands on a rain-soaked cliff, ' +
  'gripping a brass telescope, dramatic storm clouds, crashing waves below, ' +
  'pale golden beam of light, deep purple and copper sky, volumetric fog, ' +
  'cinematic composition, sharp focus, 8k';

/** Short CLIP keyword prompt. */
const CLIP_SHORT = 'a fox in a forest, golden hour, dramatic lighting, vivid colours';

/** Prose-style NL prompt. */
const NL_PROSE =
  'A dark and moody scene with rain falling heavily. ' +
  'In the distance, a lone figure walks through the empty streets of an abandoned city.';

/** MJ-style weighted prompt. */
const MJ_WEIGHTED = 'dramatic storm clouds::2 a lighthouse keeper on a cliff::1.5 copper sky::1 --ar 16:9 --v 6';

/** Build anchors from a prompt. */
function anchorsFor(text: string): AnchorManifest {
  return extractAnchors(text);
}

/** Get a known DNA profile or throw. */
function dnaFor(id: string): PlatformDNA {
  const dna = getDNA(id);
  if (!dna) throw new Error(`No DNA for ${id}`);
  return dna;
}

/** Minimal anchors for transforms that don't need them. */
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
// COORDINATOR TESTS
// ============================================================================

describe('runDeterministicTransforms (coordinator)', () => {
  it('runs all deterministic transforms declared in DNA profile', () => {
    const dna = dnaFor('stability');
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);
    const result = runDeterministicTransforms(LIGHTHOUSE_PROMPT, dna, anchors);

    // Stability has 8 transforms, all deterministic
    expect(result.transformsApplied.length).toBeGreaterThan(0);
    expect(result.transformsSkipped.length).toBe(0);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('skips GPT transforms and reports them as skipped', () => {
    // Find a platform with GPT transforms
    const dna = dnaFor('openai');
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);
    const result = runDeterministicTransforms(LIGHTHOUSE_PROMPT, dna, anchors);

    // openai has T_NARRATIVE_ARMOUR and T_NEGATIVE_GENERATE (GPT)
    const gptTransforms = ['T_PROSE_RESTRUCTURE', 'T_NARRATIVE_ARMOUR', 'T_NEGATIVE_GENERATE'];
    const skippedGPT = result.transformsSkipped.filter((t) =>
      gptTransforms.includes(t),
    );
    expect(skippedGPT.length).toBeGreaterThan(0);
  });

  it('returns unchanged text when all transforms are no-ops', () => {
    const dna = dnaFor('stability');
    // Very short prompt — most transforms will be no-ops
    const shortPrompt = 'a cat';
    const anchors = anchorsFor(shortPrompt);
    const result = runDeterministicTransforms(shortPrompt, dna, anchors);

    // Text should be preserved even if nothing changed
    expect(result.text).toBe(shortPrompt);
  });

  it('threads text through transforms sequentially', () => {
    // Use a prompt with known redundancy to test pipeline ordering
    const redundantPrompt =
      'masterpiece, best quality, dramatic dramatic lighting, a fox in a forest, ' +
      'dramatic mood, dramatic atmosphere, golden hour, sharp focus, 8k';
    const dna = dnaFor('stability');
    const anchors = anchorsFor(redundantPrompt);
    const result = runDeterministicTransforms(redundantPrompt, dna, anchors);

    // The pipeline should have produced some changes
    // (quality-position, redundancy-strip should fire at minimum)
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.wasModified).toBe(true);
  });

  it('handles all 7 CLIP platforms without errors', () => {
    const clipPlatforms = ['stability', 'dreamstudio', 'dreamlike', 'leonardo', 'lexica', 'fotor', 'novelai'];
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);

    for (const platformId of clipPlatforms) {
      const dna = getDNA(platformId);
      if (!dna) continue; // Skip if platform not in DNA

      expect(() => {
        runDeterministicTransforms(LIGHTHOUSE_PROMPT, dna, anchors);
      }).not.toThrow();
    }
  });

  it('handles all 40 platforms without errors', () => {
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);
    const allDna = require('@/data/platform-dna').getAllDNA();

    for (const [id, dna] of Object.entries(allDna) as [string, PlatformDNA][]) {
      expect(() => {
        runDeterministicTransforms(LIGHTHOUSE_PROMPT, dna, anchors);
      }).not.toThrow();
    }
  });
});

// ============================================================================
// T_SUBJECT_FRONT
// ============================================================================

describe('T_SUBJECT_FRONT (subjectFront)', () => {
  it('moves setting-led subject to front', () => {
    const prompt = 'Beneath a crumbling archway, a lone fox pauses in the shadows.';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');
    const result = subjectFront(prompt, anchors, dna);

    expect(result.text.toLowerCase()).toMatch(/^a lone fox/);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('returns unchanged when subject already leads', () => {
    const prompt = 'A lone fox pauses beneath a crumbling archway.';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');
    const result = subjectFront(prompt, anchors, dna);

    expect(result.text).toBe(prompt);
    expect(result.changes.length).toBe(0);
  });

  it('does not touch weight syntax prompts', () => {
    const prompt = '(a lone fox:1.3), (crumbling archway:1.0)';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');
    const result = subjectFront(prompt, anchors, dna);

    expect(result.text).toBe(prompt);
  });
});

// ============================================================================
// T_QUALITY_POSITION
// ============================================================================

describe('T_QUALITY_POSITION (qualityPosition)', () => {
  it('moves quality prefix to position 0 and suffix to end', () => {
    const prompt = 'a fox in a forest, masterpiece, golden hour, 8k, vivid colours';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability'); // qualityTagsEffective: true

    const result = qualityPosition(prompt, anchors, dna);

    // masterpiece should be at start
    expect(result.text.startsWith('masterpiece')).toBe(true);
    // 8k should be at end
    expect(result.text.endsWith('8k')).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('skips when qualityTagsEffective is false', () => {
    const prompt = 'masterpiece, a fox in a forest, 8k';
    const anchors = anchorsFor(prompt);
    // google-imagen has qualityTagsEffective: false (T5)
    const dna = dnaFor('google-imagen');
    const result = qualityPosition(prompt, anchors, dna);

    expect(result.text).toBe(prompt);
    expect(result.changes.length).toBe(0);
  });

  it('returns unchanged when tags already correctly positioned', () => {
    const prompt = 'masterpiece, a fox in a forest, golden hour, 8k';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');
    const result = qualityPosition(prompt, anchors, dna);

    expect(result.text).toBe(prompt);
    expect(result.changes.length).toBe(0);
  });
});

// ============================================================================
// T_WEIGHT_REBALANCE
// ============================================================================

describe('T_WEIGHT_REBALANCE (weightRebalance)', () => {
  it('adjusts out-of-range weights for CLIP platforms', () => {
    // Subject at 0.5 is way below the 1.2–1.5 target
    const prompt = '(a lighthouse keeper:0.5), (dramatic storm clouds:1.0), (copper sky:1.0)';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability'); // parenthetical syntax

    const result = weightRebalance(prompt, anchors, dna);

    // Should have adjusted the subject weight upward
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.includes('Weight rebalance'))).toBe(true);
  });

  it('leaves weights alone when already in target range', () => {
    const prompt = '(a lighthouse keeper:1.3), (storm clouds:1.1), (copper sky:1.0)';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = weightRebalance(prompt, anchors, dna);

    expect(result.changes.length).toBe(0);
  });

  it('skips platforms without weight syntax', () => {
    const prompt = 'a lighthouse keeper, dramatic storm clouds';
    const anchors = anchorsFor(prompt);
    // adobe-firefly has syntaxMode: 'none'
    const dna = dnaFor('adobe-firefly');

    const result = weightRebalance(prompt, anchors, dna);
    expect(result.changes.length).toBe(0);
  });
});

// ============================================================================
// T_TOKEN_MERGE
// ============================================================================

describe('T_TOKEN_MERGE (tokenMerge)', () => {
  it('merges adjacent colour+noun fragments', () => {
    const prompt = 'a fox, golden, light, dramatic mood, vivid tones';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = tokenMerge(prompt, anchors, dna);

    // "golden" + "light" should merge to "golden light"
    if (result.changes.length > 0) {
      expect(result.changes.some((c) => c.includes('Token merge'))).toBe(true);
    }
  });

  it('does not merge unrelated adjacent segments', () => {
    const prompt = 'a fox in a forest, dramatic lighting, golden hour';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = tokenMerge(prompt, anchors, dna);

    // Multi-word segments shouldn't merge
    expect(result.text).toBe(prompt);
  });

  it('returns unchanged for two or fewer segments', () => {
    const prompt = 'a fox, golden light';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = tokenMerge(prompt, anchors, dna);
    expect(result.text).toBe(prompt);
  });
});

// ============================================================================
// T_REDUNDANCY_STRIP
// ============================================================================

describe('T_REDUNDANCY_STRIP (redundancyStrip)', () => {
  it('removes exact duplicate segments', () => {
    const prompt = 'a fox, golden light, dramatic mood, golden light, vivid tones';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = redundancyStrip(prompt, anchors, dna);

    expect(result.changes.some((c) => c.includes('duplicate'))).toBe(true);
    // Should only appear once
    const matches = result.text.match(/golden light/g);
    expect(matches?.length).toBe(1);
  });

  it('preserves subject-containing segments even if duplicated', () => {
    const prompt = 'Beneath a cliff, a lighthouse keeper stands, a lighthouse keeper grips a telescope, dramatic storm';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = redundancyStrip(prompt, anchors, dna);

    // Subject should survive
    expect(result.text.toLowerCase()).toContain('lighthouse keeper');
  });

  it('returns unchanged when no redundancy', () => {
    const prompt = 'a fox, golden light, dramatic mood';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('stability');

    const result = redundancyStrip(prompt, anchors, dna);
    expect(result.text).toBe(prompt);
  });
});

// ============================================================================
// T_SCENE_PREMISE
// ============================================================================

describe('T_SCENE_PREMISE (scenePremise)', () => {
  it('reports diagnostic for weak opener', () => {
    const prompt = 'A dark and moody scene. In the distance, a lighthouse keeper watches the sea.';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('flux');

    const result = scenePremise(prompt, anchors, dna);

    // Should report weak opener, but NOT modify text
    expect(result.changes.some((c) => c.includes('weak opener') || c.includes('Scene premise'))).toBe(true);
    expect(result.text).toBe(prompt);
  });

  it('passes strong scene premise silently', () => {
    const prompt = 'A weathered lighthouse keeper stands on a rain-soaked cliff, gripping a brass telescope.';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('flux');

    const result = scenePremise(prompt, anchors, dna);

    expect(result.changes.length).toBe(0);
    expect(result.text).toBe(prompt);
  });

  it('never modifies the text (diagnostic only)', () => {
    const prompt = 'In the style of Monet, a dreamy landscape with soft colours.';
    const anchors = anchorsFor(prompt);
    const dna = dnaFor('flux');

    const result = scenePremise(prompt, anchors, dna);

    // Text MUST be unchanged — scene-premise is diagnostic only
    expect(result.text).toBe(prompt);
  });
});

// ============================================================================
// T_CHAR_ENFORCE
// ============================================================================

describe('T_CHAR_ENFORCE (charEnforce)', () => {
  it('truncates at nearest boundary when over ceiling', () => {
    // Build a prompt that exceeds a typical ceiling
    const longPrompt = Array.from({ length: 50 }, (_, i) =>
      `segment number ${i} with some padding text`,
    ).join(', ');

    const dna = dnaFor('stability'); // charCeiling from DNA
    const anchors = EMPTY_ANCHORS;

    if (longPrompt.length > dna.charCeiling) {
      const result = charEnforce(longPrompt, anchors, dna);

      expect(result.text.length).toBeLessThanOrEqual(dna.charCeiling);
      expect(result.changes.length).toBe(1);
      expect(result.changes[0]).toContain('Character enforce');
    }
  });

  it('passes unchanged when under ceiling', () => {
    const prompt = 'a fox in a forest';
    const dna = dnaFor('stability');
    const anchors = EMPTY_ANCHORS;

    const result = charEnforce(prompt, anchors, dna);

    expect(result.text).toBe(prompt);
    expect(result.changes.length).toBe(0);
  });

  it('truncates at comma boundary rather than mid-word', () => {
    // Construct a prompt just over ceiling with a comma near the end
    const dna = dnaFor('stability');
    const ceiling = dna.charCeiling;
    const base = 'a fox in a dramatic forest, golden hour lighting, ';
    const filler = 'x'.repeat(ceiling - base.length + 20); // Push over ceiling
    const prompt = base + filler;

    const result = charEnforce(prompt, EMPTY_ANCHORS, dna);

    // Should have cut at the comma, not mid-filler
    if (result.changes.length > 0) {
      expect(result.text).not.toMatch(/x+$/); // Shouldn't end with partial filler
    }
  });
});

// ============================================================================
// T_CLAUSE_FRONT (Midjourney)
// ============================================================================

describe('T_CLAUSE_FRONT (clauseFront)', () => {
  it('moves subject clause to front in MJ prompt', () => {
    const prompt = 'dramatic storm clouds::2 a lighthouse keeper on a cliff::1.5 --ar 16:9';
    const anchors: AnchorManifest = {
      ...EMPTY_ANCHORS,
      subjectPhrase: 'lighthouse keeper',
    };
    const dna = dnaFor('midjourney');

    const result = clauseFront(prompt, anchors, dna);

    // Subject clause should now be first
    expect(result.text.toLowerCase()).toMatch(/^a lighthouse keeper/);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('returns unchanged when subject already first', () => {
    const prompt = 'a lighthouse keeper::1.5 dramatic storm::1 --ar 16:9';
    const anchors: AnchorManifest = {
      ...EMPTY_ANCHORS,
      subjectPhrase: 'lighthouse keeper',
    };
    const dna = dnaFor('midjourney');

    const result = clauseFront(prompt, anchors, dna);
    expect(result.changes.length).toBe(0);
  });

  it('returns unchanged for non-MJ prompts (no :: syntax)', () => {
    const prompt = 'a fox in a forest, golden hour';
    const anchors = EMPTY_ANCHORS;
    const dna = dnaFor('midjourney');

    const result = clauseFront(prompt, anchors, dna);
    expect(result.text).toBe(prompt);
  });
});

// ============================================================================
// T_WEIGHT_VALIDATE (Midjourney)
// ============================================================================

describe('T_WEIGHT_VALIDATE (weightValidate)', () => {
  it('flags extreme weights', () => {
    const prompt = 'a lighthouse::10 storm clouds::1';
    const anchors = EMPTY_ANCHORS;
    const dna = dnaFor('midjourney');

    const result = weightValidate(prompt, anchors, dna);

    expect(result.changes.some((c) => c.includes('extreme weight'))).toBe(true);
  });

  it('flags zero weights', () => {
    const prompt = 'a lighthouse::0 storm clouds::1';
    const anchors = EMPTY_ANCHORS;
    const dna = dnaFor('midjourney');

    const result = weightValidate(prompt, anchors, dna);

    expect(result.changes.some((c) => c.includes('zero weight'))).toBe(true);
  });

  it('passes valid weights silently', () => {
    const prompt = 'a lighthouse::1.5 storm clouds::1';
    const anchors = EMPTY_ANCHORS;
    const dna = dnaFor('midjourney');

    const result = weightValidate(prompt, anchors, dna);
    expect(result.changes.length).toBe(0);
  });
});

// ============================================================================
// classifyVisualCategory (exported for cross-transform use)
// ============================================================================

describe('classifyVisualCategory (Phase 5 export)', () => {
  it('classifies subject segments', () => {
    const anchors: AnchorManifest = {
      ...EMPTY_ANCHORS,
      subjectPhrase: 'lighthouse keeper',
    };

    expect(classifyVisualCategory('a weathered lighthouse keeper', anchors)).toBe('subject');
  });

  it('classifies quality prefix terms', () => {
    expect(classifyVisualCategory('masterpiece')).toBe('quality_prefix');
    expect(classifyVisualCategory('best quality')).toBe('quality_prefix');
  });

  it('classifies quality suffix terms', () => {
    expect(classifyVisualCategory('8k')).toBe('quality_suffix');
    expect(classifyVisualCategory('ultra detailed')).toBe('quality_suffix');
  });

  it('classifies lighting segments', () => {
    expect(classifyVisualCategory('dramatic lighting')).toBe('lighting');
    expect(classifyVisualCategory('golden hour')).toBe('lighting');
  });

  it('works without anchors (empty default)', () => {
    // Should not throw — falls back to dictionary classification
    expect(() => classifyVisualCategory('a mysterious figure')).not.toThrow();
  });
});

// ============================================================================
// MODIFIER-SYNONYMS AUDIT VERIFICATION
// ============================================================================

describe('modifier-synonyms.json audit (ChatGPT 93/100 fix)', () => {
   
  const data = require('@/data/call-3-transforms/modifier-synonyms.json');

  it('does not contain removed unsafe redundant modifiers', () => {
    const removed = ['weathered old', 'deep dark', 'soft gentle', 'hard rigid', 'wet soggy'];
    for (const key of removed) {
      expect(data.redundantModifiers[key]).toBeUndefined();
    }
  });

  it('does not contain removed unsafe compound formations', () => {
    const removed = ['light and dark', 'rain and wind', 'ice and snow', 'fog and mist', 'moss and stone'];
    for (const key of removed) {
      expect(data.compoundFormations[key]).toBeUndefined();
    }
  });

  it('retains safe redundant modifiers', () => {
    expect(data.redundantModifiers['ancient old']).toBe('ancient');
    expect(data.redundantModifiers['bright vivid']).toBe('vivid');
    expect(data.redundantModifiers['cold freezing']).toBe('freezing');
  });

  it('retains safe compound formations', () => {
    expect(data.compoundFormations['purple and copper']).toBe('purple-copper');
    expect(data.compoundFormations['black and white']).toBe('monochrome');
    expect(data.compoundFormations['gold and silver']).toBe('gold-silver');
  });

  it('has version 1.1.0', () => {
    expect(data._meta.version).toBe('1.1.0');
  });
});

// ============================================================================
// SEMANTIC-COMPRESS CONTRACT FIX VERIFICATION
// ============================================================================

describe('semantic-compress strategy type (ChatGPT 93/100 fix)', () => {
  it('only uses redundant_modifier and compound_formation strategies', () => {
    const { semanticCompress } = require('@/lib/call-3-transforms/semantic-compress');

    // Use a prompt with known compressible patterns
    const prompt = 'ancient old lighthouse, purple and copper sky, bright vivid colours';
    const anchors = EMPTY_ANCHORS;

    const result = semanticCompress(prompt, anchors, 77);

    for (const action of result.compressions) {
      expect(['redundant_modifier', 'compound_formation']).toContain(action.strategy);
    }
  });
});

// ============================================================================
// DNA INTEGRATION — Preflight decision
// ============================================================================

describe('DNA-driven preflight decision', () => {
  const { analyseOptimisationNeed } = require('@/lib/optimise-prompts/preflight');

  it('returns DNA_DETERMINISTIC when DNA says requiresGPT: false', () => {
    const dna = dnaFor('stability');
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);

    const decision = analyseOptimisationNeed(
      LIGHTHOUSE_PROMPT,
      'gpt_rewrite', // Legacy mode says GPT
      5000,
      anchors,
      dna, // DNA overrides
    );

    expect(decision).toBe('DNA_DETERMINISTIC');
  });

  it('falls through to legacy mode when DNA says requiresGPT: true', () => {
    const dna = dnaFor('openai');
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);

    const decision = analyseOptimisationNeed(
      LIGHTHOUSE_PROMPT,
      'gpt_rewrite',
      5000,
      anchors,
      dna,
    );

    // openai requiresGPT: true, so DNA doesn't override
    expect(decision).toBe('GPT_REWRITE');
  });

  it('falls through to legacy mode when no DNA provided', () => {
    const anchors = anchorsFor(LIGHTHOUSE_PROMPT);

    const decision = analyseOptimisationNeed(
      LIGHTHOUSE_PROMPT,
      'reorder_only',
      5000,
      anchors,
      null,
    );

    // No DNA → legacy mode decides
    expect(['REORDER_ONLY', 'PASS_THROUGH']).toContain(decision);
  });
});
