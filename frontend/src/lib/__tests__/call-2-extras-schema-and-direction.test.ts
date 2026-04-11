// src/lib/__tests__/call-2-extras-schema-and-direction.test.ts
// ============================================================================
// Tests for Call 2 Extras:
//   1. T3 over/under direction tagging in mechanical scorer
//   2. Schema normaliser integration proof (normaliser unit tests are separate)
// ============================================================================
// These two extras were built to answer specific open questions from the
// v4.5 harness proof-of-life run:
//   - Direction tagging: ChatGPT flagged that T3.char_count_in_range fail rate
//     (17.28%) doesn't distinguish over-length (fixable by P15) from under-length
//     (prompt quality issue). The next harness run will now tag each failure.
//   - Schema normaliser: 9/200 samples (4.5%) were dead 502s because GPT
//     returned flat strings. The normaliser rescues them into scoreable samples.
//
// Run: pnpm run test:util -- --testPathPattern="call-2-extras-schema-and-direction"
// ============================================================================

import { T3_RULES } from '@/lib/call-2-harness/mechanical-scorer/t3-rules';
import type { TierBundle, RuleContext } from '@/lib/call-2-harness/mechanical-scorer/types';
import { normaliseTierBundle } from '@/lib/call-2-normalise-schema';

// ── Shared test helpers ───────────────────────────────────────────────────

function makeBundle(t3Positive: string): TierBundle {
  return {
    tier1: { positive: 'masterpiece, (samurai:1.4), sharp focus, 8K', negative: 'blurry' },
    tier2: { positive: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text', negative: '' },
    tier3: { positive: t3Positive, negative: 'blurry' },
    tier4: { positive: 'A samurai stands on a bridge at golden hour.', negative: 'blurry' },
  };
}

const defaultCtx: RuleContext = { input: 'An elderly samurai standing on a stone bridge at golden hour' };

function runCharCountRule(bundle: TierBundle): { passed: boolean; details?: string } {
  const rule = T3_RULES.find((r) => r.id === 'T3.char_count_in_range');
  if (!rule) throw new Error('T3.char_count_in_range rule not found');
  return rule.check(bundle, defaultCtx);
}

// ============================================================================
// EXTRA 1: T3 OVER/UNDER DIRECTION TAGGING
// ============================================================================

describe('T3.char_count_in_range — direction tagging', () => {
  it('tags OVER when T3 exceeds 420 chars', () => {
    // Build a string that's clearly over 420
    const longText =
      'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck as twilight waves detonate against the jagged rocks below. ' +
      'The beam sweeps through driving rain, casting a warm arc of golden light across the dark and turbulent coastline. ' +
      'Ancient stones bear the deep scars of relentless Atlantic storms battering this remote headland for centuries of unending fury and destruction.';
    expect(longText.length).toBeGreaterThan(420);

    const result = runCharCountRule(makeBundle(longText));
    expect(result.passed).toBe(false);
    expect(result.details).toContain('OVER');
    expect(result.details).not.toContain('UNDER');
  });

  it('tags UNDER when T3 is below 280 chars', () => {
    const shortText = 'A keeper stands on the gallery deck at twilight. Waves crash below.';
    expect(shortText.length).toBeLessThan(280);

    const result = runCharCountRule(makeBundle(shortText));
    expect(result.passed).toBe(false);
    expect(result.details).toContain('UNDER');
    expect(result.details).not.toContain('OVER');
  });

  it('passes when T3 is within [280, 420] — no direction tag', () => {
    // Build a string that's within range
    const validText =
      'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck as enormous twilight waves detonate below. ' +
      'The beam sweeps through driving rain, casting a warm arc of golden light across the dark and turbulent coastline where ancient stones endure.';
    expect(validText.length).toBeGreaterThanOrEqual(280);
    expect(validText.length).toBeLessThanOrEqual(420);

    const result = runCharCountRule(makeBundle(validText));
    expect(result.passed).toBe(true);
    expect(result.details).toBeUndefined();
  });

  it('includes the actual length in the details string', () => {
    const overText = 'A '.repeat(220) + 'scene ends here.';
    expect(overText.length).toBeGreaterThan(420);

    const result = runCharCountRule(makeBundle(overText));
    expect(result.details).toContain(`T3 length ${overText.length}`);
  });
});

// ============================================================================
// EXTRA 2: SCHEMA NORMALISER → ZOD VALIDATION CHAIN
// ============================================================================

describe('Schema normaliser → Zod validation chain', () => {
  // This tests the real integration path: normalise first, then validate
  // with the same Zod schema shape both routes use.

  it('normalised flat-string bundle passes Zod-equivalent shape check', () => {
    const rawFromGPT = {
      tier1: 'masterpiece, best quality, (samurai:1.4), sharp focus, 8K',
      tier2: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text',
      tier3: 'An elderly samurai stands on a stone bridge at golden hour.',
      tier4: 'A samurai stands on a bridge.',
    };

    const result = normaliseTierBundle(rawFromGPT);
    expect(result.wasRepaired).toBe(true);

    // Verify the normalised data has the shape Zod expects
    const data = result.data as Record<string, unknown>;
    for (const key of ['tier1', 'tier2', 'tier3', 'tier4']) {
      const tier = data[key] as Record<string, unknown>;
      expect(typeof tier.positive).toBe('string');
      expect(typeof tier.negative).toBe('string');
      expect(tier.positive).toBeTruthy(); // Non-empty — the original flat string
      expect(tier.negative).toBe(''); // Default empty negative
    }
  });

  it('normalised data preserves the original prompt content exactly', () => {
    const originalT1 = 'masterpiece, best quality, (samurai:1.4), sharp focus, 8K';
    const rawFromGPT = {
      tier1: originalT1,
      tier2: { positive: 'test', negative: '' },
      tier3: { positive: 'test', negative: '' },
      tier4: { positive: 'test', negative: '' },
    };

    const result = normaliseTierBundle(rawFromGPT);
    const data = result.data as { tier1: { positive: string; negative: string } };

    // The positive field must be byte-identical to the original flat string
    expect(data.tier1.positive).toBe(originalT1);
  });

  it('already-valid bundle passes through without repair — zero overhead path', () => {
    const validBundle = {
      tier1: { positive: 'masterpiece', negative: 'blurry' },
      tier2: { positive: 'test', negative: '' },
      tier3: { positive: 'test', negative: 'noise' },
      tier4: { positive: 'test', negative: '' },
    };

    const result = normaliseTierBundle(validBundle);
    expect(result.wasRepaired).toBe(false);
    expect(result.data).toBe(validBundle); // Same reference — no clone overhead
  });
});
