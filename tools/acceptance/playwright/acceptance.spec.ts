// tools/acceptance/playwright/acceptance.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Promagen – accessibility & structure", () => {
  test("skip link, one <h1>, landmarks, live region", async ({ page }) => {
    await page.goto("/");
    // Skip link present and points to main
    const skip = page.locator('a[href="#main"]');
    await expect(skip).toHaveCount(1);

    // Exactly one h1
    await expect(page.locator("h1")).toHaveCount(1);

    // Landmarks
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator('aside[role="complementary"], aside')).toHaveCount(1);

    // Live region “polite”
    const live = page.locator('[aria-live="polite"]');
    await expect(live).toHaveCount(1);
  });

  test("axe-core a11y scan (critical rules only)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("trust & disclosure copy is visible", async ({ page }) => {
    await page.goto("/");
    // A simple “as-of” somewhere on the page
    const asof = page.getByText(/as-of/i);
    await expect(asof).toHaveCountGreaterThan(0);

    // Short affiliate disclosure appears somewhere relevant
    const disclosure = page.getByText(/affiliate|commission/i);
    await expect(disclosure).toHaveCountGreaterThan(0);
  });
});
