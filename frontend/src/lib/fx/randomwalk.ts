// frontend/src/lib/fx/randomwalk.ts
// Deterministic bounded random-walk used for demo / pre-login FX values.
// Seed per pair + context so values "breathe" but remain stable within a session.

export type WalkParams = {
  /**
   * Maximum step as a fraction of the base value, e.g. 0.002 == 0.2 %.
   */
  maxStepPct?: number;
  /**
   * Minimum refresh interval in minutes (inclusive).
   */
  intervalMin?: number;
  /**
   * Maximum refresh interval in minutes (inclusive).
   */
  intervalMax?: number;
};

function mulberry32(a: number) {
  return function mulberry32Inner() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string) {
  // FNV-1a 32-bit
  let h = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Single bounded random step around a base value, seeded by the given string.
 * The caller controls how the seed is constructed (e.g. pairId + day).
 */
export function seededStep(baseValue: number, seed: string, params?: WalkParams): number {
  const { maxStepPct = 0.002 } = params ?? {};
  const n = hash(seed);
  const rng = mulberry32(n);
  const step = (rng() * 2 - 1) * maxStepPct; // [-max, +max]
  const next = baseValue * (1 + step);

  const lower = baseValue * (1 - maxStepPct);
  const upper = baseValue * (1 + maxStepPct);

  return Math.max(lower, Math.min(upper, next));
}

/**
 * Returns the next refresh interval in milliseconds, with simple jitter.
 */
export function nextIntervalMillis(params?: WalkParams): number {
  const { intervalMin = 15, intervalMax = 30 } = params ?? {};
  const span = intervalMax - intervalMin + 1;
  const minutes = Math.floor(Math.random() * span) + intervalMin;
  return minutes * 60_000;
}
