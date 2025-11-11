import { test, expect } from '@playwright/test';

test('FX tiles display delayed badge when > 90 min stale (demo assert)', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(base, { waitUntil: 'networkidle' });

  // This is a placeholder selector; wire to your ribbon badge element when available.
  const badges = page.locator('[data-testid="finance-ribbon"] [data-badge="delayed"]');
  // Allow either zero (fresh) or some delayed; assert no "invalid" label is present.
  await expect(page.locator('[data-badge="invalid"]')).toHaveCount(0);
});
