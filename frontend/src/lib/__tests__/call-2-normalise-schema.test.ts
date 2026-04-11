// src/lib/__tests__/call-2-normalise-schema.test.ts
// ============================================================================
// Tests for Call 2 Schema Repair Normaliser
// ============================================================================
// Covers the flat-string → { positive, negative } repair pattern that caused
// 9/200 (4.5%) SCHEMA_ERROR failures in the v4.5 harness proof-of-life run.
//
// Run: pnpm run test:util -- --testPathPattern="call-2-normalise-schema"
// ============================================================================

import { normaliseTierBundle } from '@/lib/call-2-normalise-schema';

describe('normaliseTierBundle', () => {
  // ── No-op: already correct shape ────────────────────────────────────────

  it('returns correct data unchanged — no repair needed', () => {
    const input = {
      tier1: { positive: 'masterpiece, (samurai:1.4)', negative: 'blurry' },
      tier2: { positive: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text', negative: '' },
      tier3: { positive: 'An elderly samurai stands on a bridge.', negative: 'blurry' },
      tier4: { positive: 'A samurai on a bridge at golden hour.', negative: 'blurry' },
    };

    const result = normaliseTierBundle(input);
    expect(result.wasRepaired).toBe(false);
    expect(result.repairs).toHaveLength(0);
    expect(result.data).toBe(input); // Same reference — no clone needed
  });

  // ── Single tier flat string ─────────────────────────────────────────────

  it('wraps a single flat-string tier into { positive, negative }', () => {
    const input = {
      tier1: 'masterpiece, best quality, (samurai:1.4), sharp focus',
      tier2: { positive: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text', negative: '' },
      tier3: { positive: 'An elderly samurai stands on a bridge.', negative: 'blurry' },
      tier4: { positive: 'A samurai on a bridge at golden hour.', negative: 'blurry' },
    };

    const result = normaliseTierBundle(input);
    expect(result.wasRepaired).toBe(true);
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0]).toContain('tier1');
    expect(result.repairs[0]).toContain('flat string');

    const data = result.data as Record<string, Record<string, string>>;
    expect(data.tier1).toEqual({
      positive: 'masterpiece, best quality, (samurai:1.4), sharp focus',
      negative: '',
    });
    // Other tiers untouched
    expect(data.tier2).toBe(input.tier2);
    expect(data.tier3).toBe(input.tier3);
    expect(data.tier4).toBe(input.tier4);
  });

  // ── All four tiers flat strings (worst case from harness) ───────────────

  it('wraps all four flat-string tiers', () => {
    const input = {
      tier1: 'masterpiece, (samurai:1.4)',
      tier2: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text',
      tier3: 'An elderly samurai stands on a bridge at golden hour.',
      tier4: 'A samurai on a bridge at golden hour.',
    };

    const result = normaliseTierBundle(input);
    expect(result.wasRepaired).toBe(true);
    expect(result.repairs).toHaveLength(4);

    const data = result.data as Record<string, Record<string, string>>;
    for (const key of ['tier1', 'tier2', 'tier3', 'tier4']) {
      expect(data[key]).toHaveProperty('positive');
      expect(data[key]).toHaveProperty('negative', '');
    }
  });

  // ── Mixed: some flat, some correct, some missing ────────────────────────

  it('repairs flat-string tiers and leaves other shapes for Zod', () => {
    const input = {
      tier1: 'masterpiece, (samurai:1.4)',
      tier2: { positive: 'samurai on bridge::2.0', negative: '' },
      tier3: null,
      tier4: undefined,
    };

    const result = normaliseTierBundle(input);
    expect(result.wasRepaired).toBe(true);
    expect(result.repairs).toHaveLength(1); // Only tier1 is a flat string
    expect(result.repairs[0]).toContain('tier1');

    const data = result.data as Record<string, unknown>;
    // tier1 repaired
    expect(data.tier1).toEqual({ positive: 'masterpiece, (samurai:1.4)', negative: '' });
    // tier2 unchanged (already correct)
    expect(data.tier2).toBe(input.tier2);
    // tier3 (null) and tier4 (undefined) left for Zod to reject
    expect(data.tier3).toBeNull();
    expect(data.tier4).toBeUndefined();
  });

  // ── Input is not an object ──────────────────────────────────────────────

  it('passes through non-object input unchanged', () => {
    for (const input of [null, undefined, 42, 'hello', [1, 2, 3], true]) {
      const result = normaliseTierBundle(input);
      expect(result.wasRepaired).toBe(false);
      expect(result.data).toBe(input);
    }
  });

  // ── Does not mutate the original object ─────────────────────────────────

  it('does not mutate the input when repairs are made', () => {
    const input = {
      tier1: 'masterpiece, (samurai:1.4)',
      tier2: { positive: 'samurai on bridge', negative: '' },
      tier3: { positive: 'A samurai stands on a bridge.', negative: '' },
      tier4: { positive: 'A samurai at golden hour.', negative: '' },
    };

    const originalTier1 = input.tier1;
    normaliseTierBundle(input);

    // Original still has the flat string
    expect(input.tier1).toBe(originalTier1);
    expect(typeof input.tier1).toBe('string');
  });

  // ── Preserves extra fields (passthrough-safe) ───────────────────────────

  it('preserves unexpected extra fields in the object', () => {
    const input = {
      tier1: { positive: 'test', negative: '' },
      tier2: { positive: 'test', negative: '' },
      tier3: { positive: 'test', negative: '' },
      tier4: { positive: 'test', negative: '' },
      extraField: 'should survive',
    };

    const result = normaliseTierBundle(input);
    expect(result.wasRepaired).toBe(false);
    const data = result.data as Record<string, unknown>;
    expect(data.extraField).toBe('should survive');
  });
});
