// src/lib/__tests__/call-2-t3-four-zone.test.ts
// ============================================================================
// Tests for T3.char_count_in_range four-zone scorer split
// ============================================================================
// The T3 length rule was split from a binary 280–420 pass/fail into four zones
// after per-scene diagnostic data showed 71% of failures came from trap/stress
// scenes where the model was compressing appropriately.
//
// Zones:
//   HARD_UNDER (<220)  → FAIL    — genuinely thin output
//   SOFT_UNDER (220–279) → PASS  — sensible compression, diagnostic tag
//   Sweet spot (280–420) → PASS  — system prompt target
//   OVER (>420)         → FAIL   — P15 truncation catches at Stage B
//
// The system prompt target remains 280–420. This change only affects the scorer.
//
// Run: pnpm run test:util -- --testPathPattern="call-2-t3-four-zone"
// ============================================================================

import { describe, it, expect } from '@jest/globals';

import { T3_RULES } from '@/lib/call-2-harness/mechanical-scorer/t3-rules';
import type { TierBundle, RuleContext } from '@/lib/call-2-harness/mechanical-scorer/types';

// ── Helpers ──────────────────────────────────────────────────────────────

const INPUT = 'A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight.';

const defaultCtx: RuleContext = { input: INPUT };

function makeBundle(t3Positive: string): TierBundle {
  return {
    tier1: { positive: 'masterpiece, (samurai:1.4), sharp focus, 8K', negative: 'blurry' },
    tier2: { positive: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text', negative: '' },
    tier3: { positive: t3Positive, negative: '' },
    tier4: { positive: 'A samurai stands on a bridge at golden hour.', negative: '' },
  };
}

function runRule(t3Positive: string): { passed: boolean; details?: string } {
  const rule = T3_RULES.find((r) => r.id === 'T3.char_count_in_range');
  if (!rule) throw new Error('T3.char_count_in_range rule not found');
  return rule.check(makeBundle(t3Positive), defaultCtx);
}

// ============================================================================
// ZONE 1: HARD_UNDER (<220) — FAIL
// ============================================================================

describe('Zone 1: HARD_UNDER (<220)', () => {
  it('fails at 206 chars with HARD_UNDER tag', () => {
    const text =
      'A keeper at twilight. Waves crash below on rocks. Salt spray rises into the dark sky above. ' +
      'The beam sweeps warm golden light across the coastline. Mist drifts through cold air. Fine snow sweeps the ground.';
    expect(text.length).toBeLessThan(220);

    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('HARD_UNDER');
  });

  it('fails at exactly 219 chars (one below hard floor)', () => {
    const text = 'X'.repeat(219);
    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('HARD_UNDER');
  });

  it('includes actual length in details', () => {
    const text = 'A'.repeat(150);
    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('T3 length 150');
    expect(result.details).toContain('HARD_UNDER');
  });
});

// ============================================================================
// ZONE 2: SOFT_UNDER (220–279) — PASS with diagnostic
// ============================================================================

describe('Zone 2: SOFT_UNDER (220–279)', () => {
  it('passes at 254 chars with SOFT_UNDER diagnostic tag', () => {
    const text =
      'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck as enormous twilight waves detonate below. ' +
      'The beam sweeps through driving rain, casting a warm arc of golden light across the dark coastline.';
    expect(text.length).toBeGreaterThanOrEqual(220);
    expect(text.length).toBeLessThan(280);

    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toContain('SOFT_UNDER');
    expect(result.details).not.toContain('HARD_UNDER');
  });

  it('passes at exactly 220 chars (hard floor boundary — first passing under-length value)', () => {
    const text = 'X'.repeat(220);
    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toContain('SOFT_UNDER');
  });

  it('passes at exactly 279 chars (last soft-under value)', () => {
    const text = 'X'.repeat(279);
    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toContain('SOFT_UNDER');
  });

  it('includes actual length in diagnostic details', () => {
    const text = 'X'.repeat(250);
    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toContain('T3 length 250');
  });
});

// ============================================================================
// ZONE 3: SWEET SPOT (280–420) — PASS, no diagnostic
// ============================================================================

describe('Zone 3: Sweet spot (280–420)', () => {
  it('passes at 296 chars with no diagnostic tag', () => {
    const text =
      'From a low cinematic vantage on the storm-lashed coast, a lone figure grips the iron railing of a lighthouse gallery as twilight waves detonate against the rocks below. ' +
      'Salt spray rises high into the purple-and-copper sky while a single beacon cuts a pale gold arc through sheets of driving rain.';
    expect(text.length).toBeGreaterThanOrEqual(280);
    expect(text.length).toBeLessThanOrEqual(420);

    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toBeUndefined();
  });

  it('passes at exactly 280 chars (sweet spot boundary)', () => {
    const text = 'X'.repeat(280);
    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toBeUndefined();
  });

  it('passes at exactly 420 chars (ceiling boundary)', () => {
    const text = 'X'.repeat(420);
    const result = runRule(text);
    expect(result.passed).toBe(true);
    expect(result.details).toBeUndefined();
  });
});

// ============================================================================
// ZONE 4: OVER (>420) — FAIL
// ============================================================================

describe('Zone 4: OVER (>420)', () => {
  it('fails at 518 chars with OVER tag', () => {
    const text =
      'From a low cinematic vantage on the storm-lashed coast, a lone figure grips the iron railing of a lighthouse gallery as twilight waves detonate against the jagged rocks below, sending towers of white spray into the darkening sky. ' +
      'The lighthouse beam sweeps through sheets of driving rain, casting a warm golden arc across the turbulent dark coastline. ' +
      'Ancient weathered stones bear the deep scars of centuries of relentless Atlantic storms battering this remote and exposed headland with unending fury and devastation.';
    expect(text.length).toBeGreaterThan(420);

    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('OVER');
    expect(result.details).not.toContain('UNDER');
  });

  it('fails at exactly 421 chars (one above ceiling)', () => {
    const text = 'X'.repeat(421);
    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('OVER');
  });
});

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

describe('Backward compatibility', () => {
  it('existing short fixtures (<220) still fail — no silent regressions', () => {
    // This is the fixture from the original scorer test (39 chars)
    const text = 'A short scene. Two sentences only here.';
    expect(text.length).toBeLessThan(220);

    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('HARD_UNDER');
  });

  it('existing long fixtures (>420) still fail', () => {
    const text = 'A '.repeat(260) + 'long scene.';
    expect(text.length).toBeGreaterThan(420);

    const result = runRule(text);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('OVER');
  });

  it('HARD_UNDER details still contain the word UNDER (for existing test compatibility)', () => {
    // Tests that do toContain('UNDER') will still pass because HARD_UNDER contains UNDER
    const result = runRule('X'.repeat(100));
    expect(result.details).toContain('UNDER');
  });

  it('SOFT_UNDER details still contain the word UNDER (for existing test compatibility)', () => {
    const result = runRule('X'.repeat(250));
    expect(result.details).toContain('UNDER');
  });
});
