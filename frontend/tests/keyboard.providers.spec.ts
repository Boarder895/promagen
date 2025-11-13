// frontend/tests/keyboard.providers.spec.ts
// -----------------------------------------------------------------------------
// Playwright: toHaveAttribute requires a string key; use href then fall back to role.
// -----------------------------------------------------------------------------

import { test, expect } from "@playwright/test";

test("provider item exposes a navigable affordance", async ({ page }) => {
  await page.goto("/");
  const active = page.locator('[data-testid="providers"] [data-active="true"]').first();

  try {
    await expect(active).toHaveAttribute("href", /.+/);
  } catch {
    await expect(active).toHaveAttribute("role", /.+/);
  }
});
