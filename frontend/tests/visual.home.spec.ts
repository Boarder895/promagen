import { test, expect } from "@playwright/test";

test("Home visual – rails + ribbon", async ({ page }) => {
  await page.goto("/");
  // Mask dynamic time so diffs stay stable
  const asof = page.getByTestId("fx-asof");
  await expect(page).toHaveScreenshot("home.png", {
    fullPage: false,
    mask: [asof],
    maxDiffPixelRatio: 0.0015,
  });
});
