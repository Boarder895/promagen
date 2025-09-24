/**
 * updateScores — take raw per-provider values and return normalised totals.
 * This is a tiny placeholder so the build stays green.
 */

export type ProviderValues = { provider: string; values: number[] };

/** Normalise to 0..100 by simple min-max per column, then average. */
export function updateScores(raw: ProviderValues[]) {
  if (!raw.length) return [];

  // Assume all rows share the same number of criteria
  const cols = raw[0].values.length;
  const mins = new Array<number>(cols).fill(Number.POSITIVE_INFINITY);
  const maxs = new Array<number>(cols).fill(Number.NEGATIVE_INFINITY);

  for (const r of raw) {
    for (let i = 0; i < cols; i++) {
      const v = r.values[i] ?? 0;
      if (v < mins[i]) mins[i] = v;
      if (v > maxs[i]) maxs[i] = v;
    }
  }

  return raw.map((r) => {
    const norm = r.values.map((v, i) => {
      const range = maxs[i] - mins[i];
      if (!isFinite(range) || range === 0) return 50; // flat column → mid
      return ((v - mins[i]) / range) * 100;
    });
    const avg = norm.reduce((a, b) => a + b, 0) / (norm.length || 1);
    return { provider: r.provider, score: Math.round(avg * 100) / 100, breakdown: norm };
  });
}
