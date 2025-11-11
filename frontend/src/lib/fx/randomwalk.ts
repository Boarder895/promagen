// Deterministic bounded random-walk used pre-login.
// Seed per pair + day so values "breathe" but remain stable within a session.

export type WalkParams = {
  maxStepPct?: number;    // e.g., 0.002 == 0.2%
  intervalMin?: number;   // 15..30 min jitter
  intervalMax?: number;
};

function mulberry32(a: number) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function seededStep(baseValue: number, seed: string, params?: WalkParams) {
  const { maxStepPct = 0.002 } = params ?? {};
  const n = hash(seed);
  const rng = mulberry32(n);
  const step = (rng() * 2 - 1) * maxStepPct; // [-max, +max]
  const next = baseValue * (1 + step);
  // clamp to +/- maxStepPct from base
  const lo = baseValue * (1 - maxStepPct);
  const hi = baseValue * (1 + maxStepPct);
  return Math.max(lo, Math.min(hi, next));
}

function hash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nextIntervalMillis(params?: WalkParams) {
  const { intervalMin = 15, intervalMax = 30 } = params ?? {};
  const mins = Math.floor(Math.random() * (intervalMax - intervalMin + 1)) + intervalMin;
  return mins * 60_000;
}
