/**
 * FX eligibility ordering (single canonical direction per pair).
 * Stable: weight desc (fallback 0), then id asc for determinism.
 */
export type FxPair = { id: string; base?: string; quote?: string; weight?: number };

export function determineEligibilityOrder(pairs: readonly FxPair[]): FxPair[] {
  return [...pairs].sort((a, b) => {
    const wa = a.weight ?? 0;
    const wb = b.weight ?? 0;
    if (wa !== wb) return wb - wa;
    return a.id.localeCompare(b.id);
  });
}

export default determineEligibilityOrder;
