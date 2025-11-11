// Playwright + Axe-core quick a11y gate for the homepage.
// Expects dev server running in CI (or use Next.js preview URL in your pipeline).

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("homepage has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter(v => v.impact === "critical");
  expect(critical).toEqual([]);
});
