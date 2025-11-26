// frontend/src/lib/fx/eligibility.ts
/**
 * FX eligibility ordering (single canonical direction per pair).
 *
 * Stable sort:
 *   1. weight descending (fallback 0)
 *   2. id ascending for determinism
 */

export type FxPair = {
  id: string;
  base?: string;
  quote?: string;
  weight?: number;
};

export function determineEligibilityOrder(pairs: ReadonlyArray<FxPair>): FxPair[] {
  return [...pairs].sort((a, b) => {
    const weightA = a.weight ?? 0;
    const weightB = b.weight ?? 0;

    if (weightA !== weightB) {
      return weightB - weightA;
    }

    return a.id.localeCompare(b.id);
  });
}

export default determineEligibilityOrder;
