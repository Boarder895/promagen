// frontend/app/services/liveScoring.ts
// Clean scoring utilities with named exports and zero unused vars.

export type Criteria = {
  adoption: number; // ecosystem & usage
  quality: number; // output quality
  speed: number; // latency/uptime
  cost: number; // affordability/free tier
  trust: number; // safety/reliability
  innovation: number; // pace of improvement
  ethics: number; // environmental/ethical stance
};

export type Weights = {
  adoption: number;
  quality: number;
  speed: number;
  cost: number;
  trust: number;
  innovation: number;
  ethics: number;
};

export type ProviderScoreInput = {
  criteria: Criteria;
  weights?: Partial<Weights>;
  manualAdjustment?: number;
  hardOverrideScore?: number | null;
};

export type ProviderScore = {
  autoScore: number; // 0..100
  finalScore: number; // 0..100
};

export const DEFAULT_WEIGHTS: Weights = {
  adoption: 0.18,
  quality: 0.22,
  speed: 0.14,
  cost: 0.1,
  trust: 0.14,
  innovation: 0.16,
  ethics: 0.06,
};

export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v));
}

export function normalize01(v: number): number {
  const x = clamp(v, 0, 100);
  return x / 100;
}

export function resolveWeights(partial?: Partial<Weights>): Weights {
  const w = { ...DEFAULT_WEIGHTS, ...(partial || {}) } as Weights;
  const sum = w.adoption + w.quality + w.speed + w.cost + w.trust + w.innovation + w.ethics || 1;
  return {
    adoption: w.adoption / sum,
    quality: w.quality / sum,
    speed: w.speed / sum,
    cost: w.cost / sum,
    trust: w.trust / sum,
    innovation: w.innovation / sum,
    ethics: w.ethics / sum,
  };
}

export function weightedScore(criteria: Criteria, weights?: Partial<Weights>): number {
  const w = resolveWeights(weights);
  const c = criteria;
  const s =
    normalize01(c.adoption) * w.adoption +
    normalize01(c.quality) * w.quality +
    normalize01(c.speed) * w.speed +
    normalize01(c.cost) * w.cost +
    normalize01(c.trust) * w.trust +
    normalize01(c.innovation) * w.innovation +
    normalize01(c.ethics) * w.ethics;

  return clamp(s * 100, 0, 100);
}

export function mergeManualOverride(
  autoScore: number,
  manualAdjustment = 0,
  hardOverrideScore?: number | null,
): number {
  if (typeof hardOverrideScore === 'number') {
    return clamp(hardOverrideScore, 0, 100);
  }
  return clamp(autoScore + manualAdjustment, 0, 100);
}

/** Primary entrypoint for computing a single provider score. */
export function computeLiveScore(input: ProviderScoreInput): ProviderScore {
  const autoScore = weightedScore(input.criteria, input.weights);
  const finalScore = mergeManualOverride(
    autoScore,
    input.manualAdjustment ?? 0,
    input.hardOverrideScore ?? null,
  );
  return { autoScore, finalScore };
}

/**
 * Compatibility wrapper (zero-arg) for cron callers.
 * In this frontend build it’s a no-op so the import compiles cleanly.
 * If/when you have a backend job, wire it there.
 */
export async function computeLiveScores(): Promise<void> {
  return;
}

/** Optional helper for deltas. */
export function applyDelta(base: number, delta: number): number {
  return clamp(base + delta, 0, 100);
}
