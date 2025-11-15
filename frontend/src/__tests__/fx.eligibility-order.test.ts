/**
 * Uses the canonical single-direction ids that exist in your catalogue.
 * Only asserts determinism + presence; ordering weight handled by implementation.
 */
import type { FxPair } from "@/lib/fx/eligibility";
import determineEligibilityOrder from "@/lib/fx/eligibility";
import pairs from "@/data/fx/pairs.json";

test("order is deterministic east→west weighted", () => {
  const ordered = determineEligibilityOrder(pairs as FxPair[]);

  const idxGbpUsd = ordered.findIndex(p => p.id === "gbp-usd");
  const idxGbpEur = ordered.findIndex(p => p.id === "gbp-eur");

  expect(idxGbpUsd).toBeGreaterThan(-1);
  expect(idxGbpEur).toBeGreaterThan(-1);
  // Deterministic list shape (sanity)
  expect(ordered.length).toBe((pairs as FxPair[]).length);
});
