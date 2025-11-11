import { test, expect } from '@playwright/test';

test('Home visual snapshot (mask dynamic)', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(base, { waitUntil: 'networkidle' });
  const mask = [page.locator('time'), page.locator('[data-testid="finance-ribbon"]')];
  await expect(page).toHaveScreenshot('home-desktop.png', { fullPage: true, maxDiffPixelRatio: 0.0015, mask });
});
