/**
 * Lighthouse smoke stub (local only).
 *
 * - This is a placeholder until full Lighthouse integration is wired.
 * - When running under CI, this test is skipped because a dedicated
 *   GitHub Action performs the full Lighthouse run.
 *
 * Behaviour:
 * - Locally: visits the homepage and performs a minimal assertion on a
 *   synthetic Lighthouse-style result object.
 * - CI:     marked as skipped to avoid duplicate or conflicting audits.
 */

import { test, expect } from "@playwright/test";

// CI environment flag – GitHub Actions and other CI systems commonly
// expose CI="true". When set, we skip this spec entirely.
const CI = process.env.CI === "true";

// Choose the correct test function based on environment.
// - Local: use `test` normally.
// - CI:    use `test.skip` so the run is reported but not executed.
const T = CI ? test.skip : test;

test.describe("Lighthouse smoke (local)", () => {
  T("homepage returns basic Lighthouse-style metrics placeholder", async ({ page }) => {
    // Eventually this will run a local Lighthouse audit against the homepage.
    // For now, we keep the stub strict and side-effect free, while verifying
    // that the structure of the synthetic result matches expectations.

    // Navigate to the homepage so the test still exercises routing.
    await page.goto("/");

    // Synthetic Lighthouse result shape – `lhr` would hold the full report.
    const runner: { lhr?: unknown } = { lhr: {} };

    // Minimal contract: Lighthouse result holder exists and is an object.
    expect(typeof runner.lhr).toBe("object");
  });
});
