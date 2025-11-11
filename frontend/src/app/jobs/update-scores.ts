// BACKEND
type ProviderValues = { provider: string; values: number[] };

export function updateScores(raw: ProviderValues[]) {
  // Simple average placeholder
  return raw.map((r) => ({
    provider: r.provider,
    total: r.values.length ? r.values.reduce((a, b) => a + b, 0) / r.values.length : 0,
  }));
}







