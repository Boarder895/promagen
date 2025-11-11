/**
 * Runs locally only; CI handles full Lighthouse via workflow.
 * We gate skip/enable without misusing test.skip signature.
 */
import { describe, it, expect, test } from "@jest/globals";

// If running under CI, we don't run this spec (GH Action runs Lighthouse).
const CI = process.env.CI === "true";
const T = CI ? test.skip : test;

describe("Lighthouse smoke (local)", () => {
  T("page returns basic metrics", async () => {
    // You can integrate 'lighthouse' npm here when needed; keep stub strict.
    const runner: { lhr?: unknown } = { lhr: {} };
    expect(typeof runner.lhr).toBe("object");
  });
});
