// src/lib/__tests__/call-3-harness-builder-refinement.test.ts
// ============================================================================
// PHASE 7 — Builder refinement tooling tests
// ============================================================================

import {
  generateSurgicalTemplate,
  validateBuilderPrompt,
} from '@/lib/call-3-harness/builder-refinement';
import { getDNA } from '@/data/platform-dna';
import type { PlatformDNA } from '@/data/platform-dna/types';

/** Get a DNA profile or throw. */
function dnaFor(id: string): PlatformDNA {
  const dna = getDNA(id);
  if (!dna) throw new Error(`No DNA for ${id}`);
  return dna;
}

// ============================================================================
// SURGICAL TEMPLATE GENERATOR
// ============================================================================

describe('generateSurgicalTemplate', () => {
  it('generates a template for a GPT platform', () => {
    const dna = dnaFor('recraft');
    const template = generateSurgicalTemplate(dna, 'Recraft');

    // Must have RULE ZERO
    expect(template).toContain('RULE ZERO');
    expect(template).toContain('ANCHOR PRESERVATION');

    // Must list GPT transforms
    expect(template).toContain('YOUR TASKS');

    // Must have banned behaviours
    expect(template).toContain('BANNED');
    expect(template).toContain('scaffolding');

    // Must have platform constraints
    expect(template).toContain(dna.encoderFamily);
    expect(template).toContain(String(dna.charCeiling));

    // Must have JSON output format
    expect(template).toContain('JSON');
    expect(template).toContain('optimised');

    // Must have pre-flight check
    expect(template).toContain('PRE-FLIGHT');
  });

  it('generates a template for a deterministic platform', () => {
    const dna = dnaFor('stability');
    const template = generateSurgicalTemplate(dna, 'Stability AI');

    // Should still have RULE ZERO and bans
    expect(template).toContain('RULE ZERO');
    expect(template).toContain('BANNED');

    // Deterministic platform — all transforms handled by code
    expect(template).toContain('ALREADY HANDLED BY CODE');
  });

  it('lists known failure modes', () => {
    const dna = dnaFor('recraft');
    const template = generateSurgicalTemplate(dna, 'Recraft');

    expect(template).toContain('KNOWN FAILURE MODES');
  });

  it('includes WRONG/RIGHT example placeholders', () => {
    const dna = dnaFor('recraft');
    const template = generateSurgicalTemplate(dna, 'Recraft');

    expect(template).toContain('WRONG');
    expect(template).toContain('RIGHT');
  });

  it('generates different templates for different platforms', () => {
    const recraftTemplate = generateSurgicalTemplate(dnaFor('recraft'), 'Recraft');
    const fluxTemplate = generateSurgicalTemplate(dnaFor('flux'), 'Flux');

    // Should differ in platform-specific sections
    expect(recraftTemplate).not.toBe(fluxTemplate);
  });
});

// ============================================================================
// BUILDER PROMPT VALIDATION
// ============================================================================

describe('validateBuilderPrompt', () => {
  it('passes a well-formed surgical prompt', () => {
    const dna = dnaFor('recraft');
    const template = generateSurgicalTemplate(dna, 'Recraft');

    const result = validateBuilderPrompt(template, dna);

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('fails an empty prompt', () => {
    const dna = dnaFor('recraft');

    const result = validateBuilderPrompt('', dna);

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(50);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('fails a prompt with meta-language', () => {
    const dna = dnaFor('recraft');
    const badPrompt = 'You are a creative prompt optimizer that captures the essence of visual storytelling and breathes life into prompts. Output JSON.';

    const result = validateBuilderPrompt(badPrompt, dna);

    const metaCheck = result.checks.find((c) => c.name === 'no_meta_language');
    expect(metaCheck?.passed).toBe(false);
  });

  it('flags missing WRONG/RIGHT examples', () => {
    const dna = dnaFor('recraft');
    const prompt = 'You optimise prompts. Every anchor MUST appear in output. Do NOT invent content. BANNED: foreground/midground/background. JSON output: optimised, negative, changes, charCount. Pre-flight check: verify anchors.';

    const result = validateBuilderPrompt(prompt, dna);

    const exampleCheck = result.checks.find((c) => c.name === 'wrong_right_examples');
    expect(exampleCheck?.passed).toBe(false);
    expect(result.suggestions.some((s) => s.includes('WRONG/RIGHT'))).toBe(true);
  });

  it('provides actionable suggestions for each failed check', () => {
    const dna = dnaFor('recraft');

    const result = validateBuilderPrompt('Optimize the prompt.', dna);

    // Every failed check should have a corresponding suggestion
    const failedCount = result.checks.filter((c) => !c.passed).length;
    expect(result.suggestions.length).toBeGreaterThanOrEqual(failedCount);
  });

  it('scores a generated template at 90+ (validates the generator itself)', () => {
    const dna = dnaFor('openai');
    const template = generateSurgicalTemplate(dna, 'DALL-E 3');

    const result = validateBuilderPrompt(template, dna);

    // The generator should produce prompts that pass its own validator
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});

// ============================================================================
// EXISTING BUILDER VALIDATION
// ============================================================================

describe('Existing builder validation (diagnostic)', () => {
  it('validates the recraft builder system prompt', () => {
    // Read the actual recraft builder system prompt
    const { buildRecraftPrompt } = require('@/lib/optimise-prompts/group-recraft');
    const mockContext = {
      name: 'Recraft',
      tier: 3,
      promptStyle: 'natural',
      sweetSpot: 200,
      tokenLimit: 500,
      maxChars: 500,
      idealMin: 150,
      idealMax: 400,
      negativeSupport: 'separate' as const,
      groupKnowledge: '',
      qualityPrefix: [],
      weightingSyntax: '',
      supportsWeighting: false,
      categoryOrder: [],
    };

    const result = buildRecraftPrompt('recraft', mockContext);
    const dna = dnaFor('recraft');
    const validation = validateBuilderPrompt(result.systemPrompt, dna);

    // This is a diagnostic — existing builders pre-date the surgical approach
    // They may not pass yet, but the score gives us a baseline to improve from
    console.log(`Recraft builder validation score: ${validation.score}/100`);
    console.log('Suggestions:', validation.suggestions.join('\n  '));

    // The test doesn't assert pass/fail — it captures the current state
    expect(validation.score).toBeGreaterThanOrEqual(0);
    expect(validation.checks.length).toBeGreaterThan(0);
  });
});
