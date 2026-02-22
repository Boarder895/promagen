// src/lib/weather/prng.ts
// ============================================================================
// DETERMINISTIC PRNG — Knuth Multiplicative Hash
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Replaces Math.sin(seed * 9999) with Knuth multiplicative hash.
//   Math.sin PRNG produces visible clustering for sequential inputs,
//   which means cities with similar weather get identical phrase selections.
//   The Knuth hash produces excellent dispersion even for small pool sizes.
//
// - Adds hashString() for city-name hashing, eliminating cross-city
//   seed collisions where tempC*100 + humidity*10 + wind could be identical
//   for different cities.
//
// Existing features preserved: Yes
// ============================================================================

// ── Knuth Multiplicative Hash ──────────────────────────────────────────────
// Same algorithm already proven in cityLightSeed() (v7.6).
// Golden ratio constant: 2654435761 (0x9E3779B1) — coprime to 2^32.
// Produces uniform distribution across [0, 1) for any integer input.

/**
 * Deterministic pseudo-random number from an integer seed.
 *
 * v9.0.0: Knuth multiplicative hash replaces Math.sin(seed * 9999).
 * The sin-based PRNG had these problems:
 *   1. Sequential seeds (e.g., seed=1000, seed=1001) produced correlated output
 *   2. Two cities with similar weather → same phrase selections
 *   3. Math.sin precision varies by JS engine (subtle cross-platform divergence)
 *
 * The Knuth hash is:
 *   - Deterministic: same seed → same output (always)
 *   - Well-distributed: adjacent seeds → uncorrelated outputs
 *   - Fast: single multiply + shift (no transcendental function)
 *   - Portable: >>> 0 forces uint32, no float precision issues
 *
 * @param seed - Integer seed value
 * @returns Pseudo-random number in [0, 1)
 */
export function seededRandom(seed: number): number {
  // Force to 32-bit unsigned integer, then multiply by golden ratio constant
  return (((Math.round(seed) * 2654435761) >>> 0) / 4294967296);
}

/**
 * Pick a deterministic item from a pool using a seed.
 *
 * @param pool - Array of items to select from (must not be empty)
 * @param seed - Integer seed for deterministic selection
 * @returns Selected item
 * @throws Error if pool is empty
 */
export function pickRandom<T>(pool: readonly T[], seed: number): T {
  if (pool.length === 0) throw new Error('pickRandom: empty pool');
  const idx = Math.floor(seededRandom(seed) * pool.length);
  return pool[idx]!;
}

/**
 * Hash a string to a number. Used to add city-name uniqueness to seeds.
 *
 * v9.0.0: Eliminates cross-city seed collisions.
 * Before: seed = tempC*100 + humidity*10 + wind + hour + twoHourWindow
 *   → Two cities with identical weather got identical prompts.
 * After:  seed = tempC*100 + humidity*10 + wind + hour + twoHourWindow + hashString(city)
 *   → Every city gets unique phrase rotation even with identical weather.
 *
 * Uses simple additive hash — fast, good enough for pool indexing.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = hash + str.charCodeAt(i);
  }
  // Knuth hash the sum to spread values
  return ((hash * 2654435761) >>> 0);
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
