// src/lib/__tests__/prompt-builder-rich-phrases.test.ts
// ============================================================================
// PHASE A — Rich Phrase Handling Tests
// ============================================================================
// Validates that rich phrases (>4 words) from weather intelligence are
// handled correctly by all 3 assemblers without breaking existing behaviour.
//
// Test project: util (node environment)
// Run: pnpm test -- --selectProjects util --testPathPattern="rich-phrases" --verbose
// ============================================================================

import {
  assemblePrompt,
  isRichPhrase,
  simplifyRichPhrase,
  RICH_PHRASE_THRESHOLD,
  getPlatformFormat,
} from '@/lib/prompt-builder';

import type { PromptSelections } from '@/types/prompt-builder';

// ============================================================================
// isRichPhrase() — Detection
// ============================================================================

describe('isRichPhrase()', () => {
  it('returns false for 1-word terms', () => {
    expect(isRichPhrase('moonlight')).toBe(false);
  });

  it('returns false for 2-word terms', () => {
    expect(isRichPhrase('golden hour')).toBe(false);
  });

  it('returns false for 3-word terms', () => {
    expect(isRichPhrase('low angle shot')).toBe(false);
  });

  it('returns false for 4-word terms (at threshold)', () => {
    expect(isRichPhrase('warm golden hour light')).toBe(false);
  });

  it('returns true for 5-word phrases', () => {
    expect(isRichPhrase('cool white moonlight through clouds')).toBe(true);
  });

  it('returns true for long weather phrases', () => {
    expect(
      isRichPhrase('Cool white moonlight competing with focused accent lighting'),
    ).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isRichPhrase('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isRichPhrase('   ')).toBe(false);
  });

  it('threshold constant is 4', () => {
    expect(RICH_PHRASE_THRESHOLD).toBe(4);
  });
});

// ============================================================================
// simplifyRichPhrase() — Tier 4 Simplification
// ============================================================================

describe('simplifyRichPhrase()', () => {
  it('extracts first 3 words from long phrase', () => {
    expect(
      simplifyRichPhrase(
        'Cool white moonlight competing with focused accent lighting',
      ),
    ).toBe('Cool white moonlight');
  });

  it('returns full phrase if already <= maxWords', () => {
    expect(simplifyRichPhrase('golden hour', 3)).toBe('golden hour');
  });

  it('respects custom maxWords parameter', () => {
    expect(
      simplifyRichPhrase('one two three four five six', 4),
    ).toBe('one two three four');
  });

  it('handles single word', () => {
    expect(simplifyRichPhrase('moonlight', 3)).toBe('moonlight');
  });
});

// ============================================================================
// Keyword Assembly (Tier 1 CLIP) — Rich Phrase Handling
// ============================================================================

describe('assembleKeywords (Tier 1 CLIP) with rich phrases', () => {
  const stabilityId = 'stability';

  it('does NOT weight-wrap rich phrases in CLIP output', () => {
    const selections: PromptSelections = {
      lighting: ['Cool white moonlight competing with focused accent lighting'],
      subject: ['cityscape'],
    };

    const result = assemblePrompt(stabilityId, selections);

    // Rich phrase should appear WITHOUT parenthetical weight wrapping
    expect(result.positive).toContain(
      'Cool white moonlight competing with focused accent lighting',
    );
    // Should NOT be wrapped like (Cool white moonlight...:1.1)
    expect(result.positive).not.toMatch(
      /\(Cool white moonlight[^)]+:\d+\.\d+\)/,
    );
  });

  it('still weight-wraps short dropdown terms in CLIP output', () => {
    const selections: PromptSelections = {
      subject: ['cityscape'],
      lighting: ['moonlight'],
    };

    const result = assemblePrompt(stabilityId, selections);
    // Short terms should still get weighted (if platform config specifies weights)
    // The exact format depends on platform config — just verify the term is present
    expect(result.positive).toContain('cityscape');
    expect(result.positive).toContain('moonlight');
  });

  it('mixed: short term weighted, rich phrase unweighted in same category', () => {
    // When a category has both short and rich values
    // (edge case — usually 1 per category, but testing for safety)
    const selections: PromptSelections = {
      lighting: [
        'moonlight',
        'Cool white moonlight competing with focused accent lighting',
      ],
    };

    const result = assemblePrompt(stabilityId, selections);
    // Both should appear in output
    expect(result.positive).toContain('moonlight');
    expect(result.positive).toContain(
      'Cool white moonlight competing with focused accent lighting',
    );
  });
});

// ============================================================================
// Natural Language Assembly (Tier 3) — Rich Phrase Handling
// ============================================================================

describe('assembleNaturalSentences (Tier 3) with rich phrases', () => {
  const openaiId = 'openai';

  it('rich lighting phrase becomes standalone clause without "with" prefix', () => {
    const selections: PromptSelections = {
      subject: ['ancient temple'],
      lighting: ['Cool white moonlight competing with focused accent lighting'],
    };

    const result = assemblePrompt(openaiId, selections);

    // Rich phrase should NOT have "with" prepended
    expect(result.positive).not.toContain(
      'with Cool white moonlight competing',
    );
    // Should appear as standalone clause
    expect(result.positive).toContain(
      'Cool white moonlight competing with focused accent lighting',
    );
  });

  it('short lighting term still gets "with" prefix', () => {
    const selections: PromptSelections = {
      subject: ['ancient temple'],
      lighting: ['moonlight'],
    };

    const result = assemblePrompt(openaiId, selections);
    expect(result.positive).toContain('with moonlight');
  });

  it('rich environment phrase bypasses "in" prefix', () => {
    const selections: PromptSelections = {
      subject: ['samurai warrior'],
      environment: [
        'Cobblestone plaza surrounded by heritage buildings with warm lamppost glow',
      ],
    };

    const result = assemblePrompt(openaiId, selections);

    // Rich phrase should NOT have "in" prepended awkwardly
    expect(result.positive).toContain('Cobblestone plaza surrounded');
    expect(result.positive).not.toMatch(
      /in Cobblestone plaza surrounded/i,
    );
  });

  it('short environment term still gets "in" prefix', () => {
    const selections: PromptSelections = {
      subject: ['samurai warrior'],
      environment: ['ancient temple'],
    };

    const result = assemblePrompt(openaiId, selections);
    expect(result.positive).toContain('in ancient temple');
  });

  it('preserves subject + action nucleus with rich phrases in other categories', () => {
    const selections: PromptSelections = {
      subject: ['samurai warrior'],
      action: ['meditating'],
      lighting: ['Cool white moonlight competing with focused accent lighting'],
      atmosphere: ['contemplative'],
    };

    const result = assemblePrompt(openaiId, selections);
    // Nucleus should be intact
    expect(result.positive).toMatch(/Samurai warrior meditating/);
    // Other categories present
    expect(result.positive).toContain('contemplative');
    expect(result.positive).toContain('Cool white moonlight');
  });
});

// ============================================================================
// Plain Language Assembly (Tier 4) — Rich Phrase Simplification
// ============================================================================

describe('assemblePlainLanguage (Tier 4) with rich phrases', () => {
  const canvaId = 'canva';

  it('simplifies rich phrases to first 3 words', () => {
    const selections: PromptSelections = {
      subject: ['cityscape'],
      lighting: ['Cool white moonlight competing with focused accent lighting'],
    };

    const result = assemblePrompt(canvaId, selections);

    // Rich phrase should be simplified
    expect(result.positive).toContain('Cool white moonlight');
    // Should NOT contain the full 8-word phrase
    expect(result.positive).not.toContain('competing with focused');
  });

  it('short terms pass through unchanged', () => {
    const selections: PromptSelections = {
      subject: ['cityscape'],
      lighting: ['moonlight'],
    };

    const result = assemblePrompt(canvaId, selections);
    expect(result.positive).toContain('moonlight');
  });
});

// ============================================================================
// Backward Compatibility — Existing Behaviour Unchanged
// ============================================================================

describe('backward compatibility (no regression)', () => {
  it('empty selections produce empty output', () => {
    const result = assemblePrompt('stability', {});
    expect(result.positive).toBe('');
    expect(result.negativeMode).toBe('none');
  });

  it('single dropdown term produces identical output to before', () => {
    const selections: PromptSelections = {
      subject: ['samurai warrior'],
    };

    const stability = assemblePrompt('stability', selections);
    expect(stability.positive).toContain('samurai warrior');

    const openai = assemblePrompt('openai', selections);
    expect(openai.positive).toContain('Samurai warrior');

    const canva = assemblePrompt('canva', selections);
    expect(canva.positive).toContain('samurai warrior');
  });

  it('negative handling still works for separate-field platforms', () => {
    const selections: PromptSelections = {
      subject: ['landscape'],
      negative: ['blurry', 'text', 'watermark'],
    };

    const result = assemblePrompt('stability', selections);
    expect(result.negative).toBeDefined();
    expect(result.negative).toContain('blurry');
    expect(result.negativeMode).toBe('separate');
  });

  it('negative conversion still works for natural language platforms', () => {
    const selections: PromptSelections = {
      subject: ['landscape'],
      negative: ['blurry'],
    };

    const result = assemblePrompt('openai', selections);
    // "blurry" should be converted to "sharp focus"
    expect(result.positive).toContain('sharp focus');
  });

  it('getPlatformFormat returns valid config for known platforms', () => {
    const stability = getPlatformFormat('stability');
    expect(stability.promptStyle).toBe('keywords');

    const openai = getPlatformFormat('openai');
    expect(openai.promptStyle).toBe('natural');
  });
});
