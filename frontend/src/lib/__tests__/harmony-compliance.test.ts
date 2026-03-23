// src/lib/__tests__/harmony-compliance.test.ts
// ============================================================================
// HARMONY COMPLIANCE GATE — Regression Tests
// ============================================================================
// Tests all compliance functions AND locks in B1–B7 fixes permanently.
// Each bug that was fixed gets a named regression test so it can never return.
//
// Fixture data: Real GPT outputs from Round 1 and Round 2 of the samurai
// stress test (23 March 2026).
//
// Jest project: util (testMatch: '<rootDir>/src/lib/__tests__/**/*.test.ts')
// Authority: harmony-round1-fixes.md, harmonizing-claude-openai.md
// ============================================================================

import {
  parentheticalToDoubleColon,
  doubleColonToParenthetical,
  stripAllWeights,
  enforceT1Syntax,
  enforceMjParameters,
  detectT4MetaLanguage,
  detectT3BannedPhrases,
  runFullCompliance,
  RULE_CEILING,
  CURRENT_RULE_COUNT,
  RULE_INVENTORY,
} from '../harmony-compliance';

// ============================================================================
// FIXTURES — Real GPT outputs from harmony rounds
// ============================================================================

/** Round 1 T1 generic output (parenthetical syntax, correct for generic) */
const R1_T1_GENERIC =
  'masterpiece, best quality, highly detailed, (elderly Japanese samurai:1.4), (weathered katana:1.3), (crumbling stone bridge:1.3), (golden hour:1.2), amber backlight, cherry blossom petals, volumetric god rays, koi fish, mirror-still water, burning sky reflection, snow-capped Mount Fuji, low clouds, pink clouds, violet clouds, oil painting texture, cinematic photograph, wide composition, low angle, central subject, sharp focus, 8K, intricate textures.';

/** Round 1 T2 output — MISSING --ar, --v, --s (the B4 bug) */
const R1_T2_MISSING_PARAMS =
  'elderly Japanese samurai::2.0 standing alone on a crumbling stone bridge at golden hour, his weathered katana catching the last amber light as cherry blossom petals spiral through volumetric god rays::1.4, koi fish drifting below in mirror-still water reflecting the burning sky, snow-capped Mount Fuji rising in the distance through low pink and violet clouds, oil painting and cinematic photography::1.2, wide cinematic framing, quiet bittersweet atmosphere --no modern clothing, extra people, duplicate samurai, warped bridge, blurry details, flat lighting, text, watermark, logo, cropped subject.';

/** Round 2 T2 output — HAS --ar, --v, --s, --no (B4 fixed) */
const R2_T2_WITH_PARAMS =
  'elderly Japanese samurai::2.0 standing alone on a crumbling stone bridge at golden hour, his weathered katana catching the last amber light, cherry blossom petals spiraling through volumetric god rays, koi fish drifting below in mirror-still water that reflects the burning sky, snow-capped Mount Fuji rising through low pink and violet clouds, oil painting crossed with cinematic photography::1.3, wide cinematic framing, emotionally quiet detail, central subject --ar 16:9 --v 7 --s 500 --no modern buildings, text, watermark, cropped figure, blurry details, murky water, dark shadows';

/** Round 1 T4 output — THE B1 BUG (self-correction hallucination) */
const R1_T4_SELF_CORRECTION =
  'An elderly Japanese samurai stands alone on a crumbling stone bridge at golden hour. His katana catches amber light, and cherry blossom petals drift around him. Below, koi fish move through still water reflecting the burning sky. The scene is underwater? No, it is an outdoor landscape with Mount Fuji in the distance.';

/** Round 2 T4 output — B1 fixed, but has T4 meta-language */
const R2_T4_META_LANGUAGE =
  'An elderly Japanese samurai stands alone on a crumbling stone bridge at golden hour, holding a weathered katana with cherry blossom petals falling around him. Below, koi fish drift through still water that reflects the glowing sky, with Mount Fuji in the distance. The scene has a quiet, bittersweet feeling with soft light and rich detail.';

/** Round 2 T3 output — slight meta-language */
const R2_T3_NATURAL =
  'An elderly Japanese samurai stands alone on a crumbling stone bridge at golden hour, his weathered katana catching the last amber light in a luminous oil-painting-meets-cinematic-photograph scene. Cherry blossom petals spiral downward through volumetric sunbeams, while koi fish drift beneath the bridge in mirror-still water that reflects the burning sky. In the distance, snow-capped Mount Fuji rises through low clouds brushed with pink and violet, with a wide cinematic view and a centered figure.';

// ============================================================================
// SYNTAX CONVERSION TESTS
// ============================================================================

describe('parentheticalToDoubleColon', () => {
  it('converts standard parenthetical weights', () => {
    expect(parentheticalToDoubleColon('(elderly samurai:1.4)')).toBe('elderly samurai::1.4');
  });

  it('converts multiple weights in a prompt', () => {
    const input = 'masterpiece, (samurai:1.4), (katana:1.3), cherry blossoms';
    const expected = 'masterpiece, samurai::1.4, katana::1.3, cherry blossoms';
    expect(parentheticalToDoubleColon(input)).toBe(expected);
  });

  it('handles multi-word terms', () => {
    expect(parentheticalToDoubleColon('(crumbling stone bridge:1.3)')).toBe(
      'crumbling stone bridge::1.3',
    );
  });

  it('leaves prompt unchanged when no parenthetical weights present', () => {
    const input = 'masterpiece, elderly samurai::1.4, sharp focus';
    expect(parentheticalToDoubleColon(input)).toBe(input);
  });

  it('handles decimal weights without trailing digits', () => {
    expect(parentheticalToDoubleColon('(term:1)')).toBe('term::1');
  });
});

describe('doubleColonToParenthetical', () => {
  it('converts standard double-colon weights', () => {
    const result = doubleColonToParenthetical('elderly samurai::1.4');
    expect(result).toContain('(elderly samurai:1.4)');
  });

  it('converts multiple weights in comma-separated prompt', () => {
    const input = 'masterpiece, samurai::1.4, katana::1.3, cherry blossoms';
    const result = doubleColonToParenthetical(input);
    expect(result).toContain('(samurai:1.4)');
    expect(result).toContain('(katana:1.3)');
    expect(result).toContain('cherry blossoms');
  });

  it('leaves prompt unchanged when no double-colon weights present', () => {
    const input = 'masterpiece, (samurai:1.4), sharp focus';
    expect(doubleColonToParenthetical(input)).toBe(input);
  });
});

describe('stripAllWeights', () => {
  it('strips parenthetical weights', () => {
    expect(stripAllWeights('(elderly samurai:1.4), (katana:1.3)')).toBe(
      'elderly samurai, katana',
    );
  });

  it('strips double-colon weights', () => {
    expect(stripAllWeights('elderly samurai::1.4, katana::1.3')).toBe(
      'elderly samurai, katana',
    );
  });

  it('strips mixed weights', () => {
    const input = '(samurai:1.4), katana::1.3, cherry blossoms';
    const result = stripAllWeights(input);
    expect(result).toBe('samurai, katana, cherry blossoms');
  });

  it('handles no weights gracefully', () => {
    const input = 'masterpiece, cherry blossoms, sharp focus';
    expect(stripAllWeights(input)).toBe(input);
  });
});

// ============================================================================
// B2 REGRESSION: T1 Syntax Compliance
// ============================================================================

describe('enforceT1Syntax (B2 regression lock)', () => {
  const LEONARDO_CTX = {
    weightingSyntax: '{term}::{weight}',
    supportsWeighting: true,
    providerName: 'Leonardo AI',
    tier: 1,
  };

  const STABILITY_CTX = {
    weightingSyntax: '({term}:{weight})',
    supportsWeighting: true,
    providerName: 'Stability AI',
    tier: 1,
  };

  const CANVA_CTX = {
    weightingSyntax: null,
    supportsWeighting: false,
    providerName: 'Canva',
    tier: 4,
  };

  it('B2: converts parenthetical to double-colon for Leonardo', () => {
    const result = enforceT1Syntax(R1_T1_GENERIC, LEONARDO_CTX);
    expect(result.wasFixed).toBe(true);
    expect(result.text).toContain('elderly Japanese samurai::1.4');
    expect(result.text).not.toMatch(/\([^()]+:\d/); // No parenthetical weights
    expect(result.fixes.length).toBeGreaterThan(0);
  });

  it('B2: leaves double-colon unchanged for Leonardo', () => {
    const leonardoPrompt =
      'masterpiece, best quality, highly detailed, elderly Japanese samurai::1.4, katana::1.3';
    const result = enforceT1Syntax(leonardoPrompt, LEONARDO_CTX);
    expect(result.wasFixed).toBe(false);
    expect(result.text).toBe(leonardoPrompt);
  });

  it('B2: leaves parenthetical unchanged for Stability', () => {
    const result = enforceT1Syntax(R1_T1_GENERIC, STABILITY_CTX);
    expect(result.wasFixed).toBe(false); // Already parenthetical
  });

  it('strips all weights for non-weighting providers', () => {
    const result = enforceT1Syntax(R1_T1_GENERIC, CANVA_CTX);
    expect(result.wasFixed).toBe(true);
    expect(result.text).not.toMatch(/\(/);
    expect(result.text).not.toMatch(/::\d/);
    expect(result.text).toContain('elderly Japanese samurai');
  });

  it('B2: Leonardo should NEVER output parenthetical syntax', () => {
    // This is the exact regression test for B2 — if this fails, B2 has regressed
    const genericOutputWithWrongSyntax =
      'masterpiece, (elderly samurai:1.4), (katana:1.3), sharp focus, 8K';
    const result = enforceT1Syntax(genericOutputWithWrongSyntax, LEONARDO_CTX);
    expect(result.text).not.toMatch(/\([^()]+:\d/);
    expect(result.text).toContain('elderly samurai::1.4');
  });
});

// ============================================================================
// B4 REGRESSION: T2 Midjourney Parameters
// ============================================================================

describe('enforceMjParameters (B4 regression lock)', () => {
  it('B4: detects missing --ar, --v, --s in Round 1 output', () => {
    const result = enforceMjParameters(R1_T2_MISSING_PARAMS);
    // R1 output had --no but was missing --ar, --v, --s
    expect(result.missingParams).toContain('--ar');
    expect(result.missingParams).toContain('--v');
    expect(result.missingParams).toContain('--s');
    expect(result.wasFixed).toBe(true);
  });

  it('B4: adds missing parameters before --no block', () => {
    const result = enforceMjParameters(R1_T2_MISSING_PARAMS);
    const arIndex = result.text.indexOf('--ar');
    const noIndex = result.text.indexOf('--no');
    expect(arIndex).toBeGreaterThan(-1);
    expect(noIndex).toBeGreaterThan(-1);
    expect(arIndex).toBeLessThan(noIndex); // --ar before --no
  });

  it('B4: leaves Round 2 output unchanged (all params present)', () => {
    const result = enforceMjParameters(R2_T2_WITH_PARAMS);
    expect(result.wasFixed).toBe(false);
    expect(result.missingParams).toHaveLength(0);
  });

  it('adds --no when completely missing', () => {
    const noNoBlock = 'samurai::2.0 on a bridge --ar 16:9 --v 7 --s 500';
    const result = enforceMjParameters(noNoBlock);
    expect(result.text).toContain('--no');
    expect(result.missingParams).toContain('--no');
  });

  it('handles prompt with no parameters at all', () => {
    const barePrompt = 'samurai::2.0 on a bridge at golden hour';
    const result = enforceMjParameters(barePrompt);
    expect(result.text).toContain('--ar');
    expect(result.text).toContain('--v 7');
    expect(result.text).toContain('--s 500');
    expect(result.text).toContain('--no');
    expect(result.missingParams).toHaveLength(4);
  });
});

// ============================================================================
// B1 REGRESSION: T4 Self-Correction Detection
// ============================================================================

describe('detectT4MetaLanguage (B1 regression lock)', () => {
  it('B1: detects self-correction pattern from Round 1', () => {
    const result = detectT4MetaLanguage(R1_T4_SELF_CORRECTION);
    expect(result.hasSelfCorrection).toBe(true);
    expect(result.patterns).toContain('self-correction ("? No, it is...")');
  });

  it('B1: Round 2 output has no self-correction', () => {
    const result = detectT4MetaLanguage(R2_T4_META_LANGUAGE);
    expect(result.hasSelfCorrection).toBe(false);
  });

  it('detects "the scene has" meta-language from Round 2', () => {
    const result = detectT4MetaLanguage(R2_T4_META_LANGUAGE);
    expect(result.hasMetaLanguage).toBe(true);
    expect(result.patterns).toEqual(expect.arrayContaining([expect.stringContaining('scene has')]));
  });

  it('clean T4 output passes all checks', () => {
    const clean =
      'An elderly samurai stands on a stone bridge at golden hour, surrounded by cherry blossoms and warm amber light. Below, koi fish drift through still water reflecting the sky, with Mount Fuji in the distance.';
    const result = detectT4MetaLanguage(clean);
    expect(result.hasMetaLanguage).toBe(false);
    expect(result.hasSelfCorrection).toBe(false);
    expect(result.patterns).toHaveLength(0);
  });
});

// ============================================================================
// T3 BANNED PHRASES
// ============================================================================

describe('detectT3BannedPhrases', () => {
  it('detects "rendered as"', () => {
    const prompt = 'A samurai rendered as a cinematic painting.';
    expect(detectT3BannedPhrases(prompt)).toContain('rendered as');
  });

  it('detects "the scene feels"', () => {
    const prompt = 'The scene feels emotionally quiet.';
    expect(detectT3BannedPhrases(prompt)).toContain('the scene feels');
  });

  it('detects multiple banned phrases', () => {
    const prompt = 'The mood is bittersweet, rendered as an oil painting.';
    const found = detectT3BannedPhrases(prompt);
    expect(found).toContain('the mood is');
    expect(found).toContain('rendered as');
  });

  it('Round 2 T3 passes (no banned phrases)', () => {
    const found = detectT3BannedPhrases(R2_T3_NATURAL);
    expect(found).toHaveLength(0);
  });
});

// ============================================================================
// FULL COMPLIANCE CHECK
// ============================================================================

describe('runFullCompliance', () => {
  it('reports all issues for Round 1 outputs with Leonardo context', () => {
    const report = runFullCompliance(
      {
        tier1: R1_T1_GENERIC,
        tier2: R1_T2_MISSING_PARAMS,
        tier3: R2_T3_NATURAL,
        tier4: R1_T4_SELF_CORRECTION,
      },
      {
        weightingSyntax: '{term}::{weight}',
        supportsWeighting: true,
        providerName: 'Leonardo AI',
        tier: 1,
      },
    );

    expect(report.allPassing).toBe(false);
    expect(report.tier1.wasFixed).toBe(true); // B2: wrong syntax
    expect(report.tier2.wasFixed).toBe(true); // B4: missing params
    expect(report.tier4.hasSelfCorrection).toBe(true); // B1: self-correction
    expect(report.totalFixes).toBeGreaterThan(0);
  });

  it('generic context (null) skips provider-specific T1 check', () => {
    const report = runFullCompliance(
      {
        tier1: R1_T1_GENERIC,
        tier2: R2_T2_WITH_PARAMS,
        tier3: R2_T3_NATURAL,
        tier4: 'A samurai stands on a bridge at sunset with cherry blossoms.',
      },
      null,
    );

    expect(report.tier1.wasFixed).toBe(false); // No provider = no syntax check
    expect(report.tier2.wasFixed).toBe(false); // R2 T2 has all params
  });
});

// ============================================================================
// RULE CEILING ENFORCEMENT
// ============================================================================

describe('Rule ceiling enforcement', () => {
  it('current rule count does not exceed ceiling', () => {
    expect(CURRENT_RULE_COUNT).toBeLessThanOrEqual(RULE_CEILING);
  });

  it('rule inventory total matches declared count', () => {
    const total =
      RULE_INVENTORY.tier1.length +
      RULE_INVENTORY.tier2.length +
      RULE_INVENTORY.tier3.length +
      RULE_INVENTORY.tier4.length +
      RULE_INVENTORY.global.length;
    expect(total).toBe(CURRENT_RULE_COUNT);
  });

  it('ceiling is exactly 27 (raise requires explicit approval)', () => {
    // If this test fails, someone raised the ceiling without updating the test.
    // That's intentional — the ceiling should only change with a documented decision.
    expect(RULE_CEILING).toBe(27);
  });
});
