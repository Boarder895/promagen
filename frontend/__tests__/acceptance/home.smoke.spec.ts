import { test, expect } from "@playwright/test";

test.describe("Homepage smoke", () => {
  test("loads with a title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/promagen/i);
  });
});
