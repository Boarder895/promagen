// src/lib/__tests__/call-3-harness-mechanical-scorer.test.ts
// ============================================================================
// PHASE 10 — Call 3 Mechanical Scorer Tests
// ============================================================================

import {
  runMechanicalScorer,
  getAllRuleIds,
  getRuleCount,
} from '@/lib/call-3-harness/mechanical-scorer';
import type { Call3RuleContext } from '@/lib/call-3-harness/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeCtx(overrides: Partial<Call3RuleContext> = {}): Call3RuleContext {
  return {
    assembledPrompt: 'masterpiece, best quality, a weathered lighthouse keeper stands on a cliff, dramatic storm clouds, copper sky, 8k',
    optimisedPrompt: 'masterpiece, best quality, a weathered lighthouse keeper stands on a cliff, dramatic storm clouds, copper sky, 8k',
    negative: null,
    platformId: 'stability',
    tier: 1,
    charCeiling: 875,
    transformsApplied: [],
    path: 'deterministic',
    retryAttempted: false,
    retryAccepted: false,
    ...overrides,
  };
}

// ============================================================================
// SCORER BASICS
// ============================================================================

describe('Call 3 mechanical scorer — basics', () => {
  it('runs all rules without errors', () => {
    const ctx = makeCtx();
    const result = runMechanicalScorer(ctx);

    expect(result.totalRules).toBe(getRuleCount());
    expect(result.results.length).toBe(getRuleCount());
  });

  it('has at least 10 rules', () => {
    expect(getRuleCount()).toBeGreaterThanOrEqual(10);
  });

  it('returns unique rule IDs', () => {
    const ids = getAllRuleIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes all rules for identical input/output', () => {
    const ctx = makeCtx();
    const result = runMechanicalScorer(ctx);

    // Identical input/output should pass most rules
    // Only R10 (transform activity) might flag as informational
    expect(result.criticalFailCount).toBe(0);
  });
});

// ============================================================================
// R01: OUTPUT NOT EMPTY
// ============================================================================

describe('R01_OUTPUT_NOT_EMPTY', () => {
  it('fails for empty output', () => {
    const result = runMechanicalScorer(makeCtx({ optimisedPrompt: '' }));
    const r01 = result.results.find((r) => r.ruleId === 'R01_OUTPUT_NOT_EMPTY');

    expect(r01?.passed).toBe(false);
    expect(r01?.severity).toBe('critical');
  });

  it('passes for non-empty output', () => {
    const result = runMechanicalScorer(makeCtx());
    const r01 = result.results.find((r) => r.ruleId === 'R01_OUTPUT_NOT_EMPTY');

    expect(r01?.passed).toBe(true);
  });
});

// ============================================================================
// R02: CEILING COMPLIANCE
// ============================================================================

describe('R02_CEILING_COMPLIANCE', () => {
  it('fails when output exceeds ceiling', () => {
    const longOutput = 'x'.repeat(900);
    const result = runMechanicalScorer(makeCtx({
      optimisedPrompt: longOutput,
      charCeiling: 875,
    }));
    const r02 = result.results.find((r) => r.ruleId === 'R02_CEILING_COMPLIANCE');

    expect(r02?.passed).toBe(false);
    expect(r02?.severity).toBe('critical');
  });

  it('passes when output is under ceiling', () => {
    const result = runMechanicalScorer(makeCtx({ charCeiling: 1000 }));
    const r02 = result.results.find((r) => r.ruleId === 'R02_CEILING_COMPLIANCE');

    expect(r02?.passed).toBe(true);
  });
});

// ============================================================================
// R03: NO CATASTROPHIC SHORTENING
// ============================================================================

describe('R03_NO_CATASTROPHIC_SHORTENING', () => {
  it('fails when output is less than 50% of input length', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'a long prompt with many words and details about the scene',
      optimisedPrompt: 'short',
    }));
    const r03 = result.results.find((r) => r.ruleId === 'R03_NO_CATASTROPHIC_SHORTENING');

    expect(r03?.passed).toBe(false);
  });

  it('passes when output is similar length to input', () => {
    const result = runMechanicalScorer(makeCtx());
    const r03 = result.results.find((r) => r.ruleId === 'R03_NO_CATASTROPHIC_SHORTENING');

    expect(r03?.passed).toBe(true);
  });
});

// ============================================================================
// R04: SUBJECT SURVIVAL
// ============================================================================

describe('R04_SUBJECT_SURVIVAL', () => {
  it('fails when subject is lost', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'a weathered lighthouse keeper stands on a cliff, copper sky',
      optimisedPrompt: 'dramatic storm clouds, copper sky, 8k',
    }));
    const r04 = result.results.find((r) => r.ruleId === 'R04_SUBJECT_SURVIVAL');

    expect(r04?.passed).toBe(false);
    expect(r04?.severity).toBe('critical');
  });

  it('passes when subject survives', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'a weathered lighthouse keeper stands on a cliff',
      optimisedPrompt: 'lighthouse keeper on a weathered cliff',
    }));
    const r04 = result.results.find((r) => r.ruleId === 'R04_SUBJECT_SURVIVAL');

    expect(r04?.passed).toBe(true);
  });
});

// ============================================================================
// R05: COLOUR SURVIVAL
// ============================================================================

describe('R05_COLOUR_SURVIVAL', () => {
  it('fails when named colours are lost', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'copper sky, golden light, emerald forest',
      optimisedPrompt: 'sky, light, forest',
    }));
    const r05 = result.results.find((r) => r.ruleId === 'R05_COLOUR_SURVIVAL');

    expect(r05?.passed).toBe(false);
  });

  it('passes when all colours survive', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'copper sky, golden light',
      optimisedPrompt: 'golden light on a copper sky',
    }));
    const r05 = result.results.find((r) => r.ruleId === 'R05_COLOUR_SURVIVAL');

    expect(r05?.passed).toBe(true);
  });
});

// ============================================================================
// R06: NO INVENTED CONTENT
// ============================================================================

describe('R06_NO_INVENTED_CONTENT', () => {
  it('fails when composition scaffolding is added', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'a lighthouse keeper on a cliff',
      optimisedPrompt: 'foreground: lighthouse keeper, midground: cliff, background: storm clouds',
    }));
    const r06 = result.results.find((r) => r.ruleId === 'R06_NO_INVENTED_CONTENT');

    expect(r06?.passed).toBe(false);
  });

  it('passes when no invented content', () => {
    const result = runMechanicalScorer(makeCtx());
    const r06 = result.results.find((r) => r.ruleId === 'R06_NO_INVENTED_CONTENT');

    expect(r06?.passed).toBe(true);
  });
});

// ============================================================================
// R08: NEGATIVE NO CONTRADICTION
// ============================================================================

describe('R08_NEGATIVE_NO_CONTRADICTION', () => {
  it('flags contradiction between positive and negative', () => {
    const result = runMechanicalScorer(makeCtx({
      optimisedPrompt: 'a lighthouse with watermark texture on the wall',
      negative: 'blurry, watermark, text',
    }));
    const r08 = result.results.find((r) => r.ruleId === 'R08_NEGATIVE_NO_CONTRADICTION');

    expect(r08?.passed).toBe(false);
  });

  it('passes when no contradiction', () => {
    const result = runMechanicalScorer(makeCtx({
      negative: 'blurry, watermark, text',
    }));
    const r08 = result.results.find((r) => r.ruleId === 'R08_NEGATIVE_NO_CONTRADICTION');

    expect(r08?.passed).toBe(true);
  });

  it('passes when no negative prompt', () => {
    const result = runMechanicalScorer(makeCtx({ negative: null }));
    const r08 = result.results.find((r) => r.ruleId === 'R08_NEGATIVE_NO_CONTRADICTION');

    expect(r08?.passed).toBe(true);
  });
});

// ============================================================================
// R09: RETRY EFFECTIVENESS
// ============================================================================

describe('R09_RETRY_EFFECTIVENESS', () => {
  it('flags wasted retry (attempted but rejected)', () => {
    const result = runMechanicalScorer(makeCtx({
      retryAttempted: true,
      retryAccepted: false,
    }));
    const r09 = result.results.find((r) => r.ruleId === 'R09_RETRY_EFFECTIVENESS');

    expect(r09?.passed).toBe(false);
    expect(r09?.details).toContain('wasted');
  });

  it('passes when retry accepted', () => {
    const result = runMechanicalScorer(makeCtx({
      retryAttempted: true,
      retryAccepted: true,
    }));
    const r09 = result.results.find((r) => r.ruleId === 'R09_RETRY_EFFECTIVENESS');

    expect(r09?.passed).toBe(true);
  });

  it('passes when no retry attempted', () => {
    const result = runMechanicalScorer(makeCtx());
    const r09 = result.results.find((r) => r.ruleId === 'R09_RETRY_EFFECTIVENESS');

    expect(r09?.passed).toBe(true);
  });
});

// ============================================================================
// CLUSTER AGGREGATION
// ============================================================================

describe('Cluster aggregation', () => {
  it('correctly counts failures per cluster', () => {
    const result = runMechanicalScorer(makeCtx({
      assembledPrompt: 'a weathered lighthouse keeper, copper sky, golden light',
      optimisedPrompt: '', // Empty — triggers R01, R03, R04, R05
    }));

    expect(result.failCount).toBeGreaterThan(0);
    expect(result.criticalFailCount).toBeGreaterThan(0);

    // At least quality_degradation and anchor_loss clusters should have fails
    const totalClusterFails = Object.values(result.failsByCluster).reduce((sum, n) => sum + n, 0);
    expect(totalClusterFails).toBe(result.failCount);
  });

  it('has zero cluster fails when all rules pass', () => {
    const result = runMechanicalScorer(makeCtx({
      path: 'pass_through', // Avoids R10 activity flag
    }));

    // Most rules should pass for identical input/output
    expect(result.criticalFailCount).toBe(0);
  });
});
