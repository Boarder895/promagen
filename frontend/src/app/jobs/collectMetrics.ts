// BACKEND
export type RawMetric = { provider: string; category: string; value: number; source: string };

export async function collectMetrics(): Promise<RawMetric[]> {
  // Placeholder: return empty array for now
  return [];
}




