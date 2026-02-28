// src/lib/learning/ab-assignment.ts
// ============================================================================
// A/B TESTING — Deterministic Assignment Engine
// ============================================================================
//
// Pure functions for deterministic A/B test assignment.
//
// FNV-1a hash: fast, well-distributed, deterministic. No crypto dependency.
// Same (abHash + testId) always maps to the same variant — stable across
// sessions, tabs, and page reloads.
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 6 (7.6a)
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

// ============================================================================
// FNV-1a HASH
// ============================================================================

/**
 * FNV-1a 32-bit hash.
 *
 * Fowler–Noll–Vo is a non-cryptographic hash function designed for fast
 * hash-table lookups. The "1a" variant XORs before multiplying, which
 * gives better avalanche behaviour (small input changes → large output changes).
 *
 * We use it here because:
 * - Deterministic: same input → same output (no randomness)
 * - Fast: ~10ns per call, no crypto overhead
 * - Well-distributed: near-uniform bucket assignment across inputs
 * - Zero dependencies: 6 lines of code, no external library
 *
 * @param input — String to hash (typically `abHash + testId`)
 * @returns Unsigned 32-bit integer (0 to 4,294,967,295)
 */
export function fnv1aHash(input: string): number {
  // FNV offset basis (32-bit)
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    // XOR with byte
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (32-bit), keep within 32-bit unsigned range
    // Math.imul returns a signed 32-bit result; >>> 0 converts to unsigned
    hash = (Math.imul(hash, 0x01000193)) >>> 0;
  }

  return hash;
}

// ============================================================================
// VARIANT ASSIGNMENT
// ============================================================================

/**
 * Determine which variant a user belongs to for a specific A/B test.
 *
 * Assignment is deterministic: same (abHash, testId) always returns
 * the same variant. This ensures a user sees consistent behaviour
 * across sessions without storing assignment state.
 *
 * @param abHash   — Stable anonymous browser UUID (from localStorage)
 * @param testId   — A/B test identifier (e.g. 'ab_xxxxxxxx-xxxx-...')
 * @param splitPct — Percentage of users assigned to variant B (default: 50)
 * @returns 'A' (control) or 'B' (variant)
 *
 * @example
 * ```ts
 * assignVariant('uuid-abc', 'ab_test-1');       // → 'A' or 'B' (deterministic)
 * assignVariant('uuid-abc', 'ab_test-1');       // → same result as above
 * assignVariant('uuid-abc', 'ab_test-1', 30);  // → 30% chance of 'B'
 * ```
 */
export function assignVariant(
  abHash: string,
  testId: string,
  splitPct: number = 50,
): 'A' | 'B' {
  // Concatenate hash + test ID for a unique per-test assignment
  const bucket = fnv1aHash(abHash + testId) % 100;

  // bucket in [0, splitPct) → variant B; [splitPct, 99] → control A
  return bucket < splitPct ? 'B' : 'A';
}
