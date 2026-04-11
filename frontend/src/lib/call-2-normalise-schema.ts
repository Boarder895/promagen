// src/lib/call-2-normalise-schema.ts
// ============================================================================
// Call 2 Schema Repair Normaliser — Pre-validation tier-shape fixer
// ============================================================================
// GPT occasionally returns a tier as a flat string instead of the required
// { positive, negative } object. The v4.5 harness proof-of-life run showed
// 9/200 samples (4.5%) failing with SCHEMA_ERROR for exactly this reason —
// every one had `"tier1": "masterpiece, ..."` instead of
// `"tier1": { "positive": "masterpiece, ...", "negative": "blurry, ..." }`.
//
// This module runs BETWEEN JSON.parse() and Zod.safeParse(). It inspects
// each tier value and wraps flat strings into { positive: value, negative: "" }.
// Genuinely malformed data (null, number, array, deeply broken shapes) is
// left untouched — Zod will catch it and return the proper error.
//
// Design principle: deterministic code fix for a measured problem.
// This does NOT retry, re-prompt, or paper over other schema issues.
// It fixes exactly one pattern: flat string where object was expected.
//
// Authority: call-2-quality-architecture-v0_3_1_1.md §3 (Stage A validation)
// Test file: src/lib/__tests__/call-2-normalise-schema.test.ts
// ============================================================================

const TIER_KEYS = ['tier1', 'tier2', 'tier3', 'tier4'] as const;

export interface NormaliseResult {
  /** The normalised data — may be identical to input if no repair was needed */
  readonly data: unknown;
  /** Whether any tier was repaired (flat string → { positive, negative }) */
  readonly wasRepaired: boolean;
  /** Per-tier repair log — only populated for repaired tiers */
  readonly repairs: readonly string[];
}

/**
 * Normalise a parsed Call 2 engine response before Zod validation.
 *
 * For each of the four tier keys (tier1–tier4):
 * - If the value is a string → wrap as { positive: value, negative: "" }
 * - If the value is already an object → leave untouched
 * - If the value is anything else (null, undefined, number, array) → leave untouched
 *   (Zod will reject it with an appropriate error)
 *
 * Returns a new object — the input is never mutated.
 */
export function normaliseTierBundle(parsed: unknown): NormaliseResult {
  // Guard: if input isn't an object, there's nothing we can normalise
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { data: parsed, wasRepaired: false, repairs: [] };
  }

  const record = parsed as Record<string, unknown>;
  const repairs: string[] = [];
  let patched = false;

  // Shallow clone so we don't mutate the original
  const result: Record<string, unknown> = { ...record };

  for (const key of TIER_KEYS) {
    const value = record[key];

    if (typeof value === 'string') {
      // This is the exact failure pattern from the harness: GPT returns a flat
      // string instead of { positive, negative }. Wrap it.
      result[key] = { positive: value, negative: '' };
      repairs.push(
        `${key}: flat string (${value.length} chars) → wrapped as { positive, negative: "" }`,
      );
      patched = true;
    }
    // If value is already an object (correct shape or partial), leave it for
    // Zod to validate. If value is null/undefined/number/array, also leave it
    // for Zod — those are genuinely broken, not the flat-string pattern.
  }

  return {
    data: patched ? result : parsed,
    wasRepaired: patched,
    repairs,
  };
}
