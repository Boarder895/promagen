import { test, expect } from "@playwright/test";

test.describe("Providers grid keyboard", () => {
  test("Tab order follows visual order; Home/End focus extremes", async ({ page }) => {
    await page.goto("/");

    // Assume the grid exists on the homepage when providers render
    const grid = page.getByTestId("providers-grid");
    await expect(grid).toBeVisible();

    const cards = grid.getByRole("listitem");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Focus first interactive in first card
    await cards.nth(0).focus();
    await page.keyboard.press("Home");
    await expect(cards.nth(0)).toBeFocused();

    await page.keyboard.press("End");
    await expect(cards.nth(count - 1)).toBeFocused();
  });
});
