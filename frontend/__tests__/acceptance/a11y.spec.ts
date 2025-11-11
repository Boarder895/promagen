import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test.describe('Accessibility – Home', () => {
  test('has skip link, single H1, and landmarks', async ({ page }) => {
    await page.goto('/');

    // Skip link present & visible on focus
    const skip = page.locator('a[href^="#"], a[href="#main"]', { hasText: /skip/i });
    await skip.first().focus();
    await expect(skip.first()).toBeVisible();

    // Exactly one H1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Landmarks: header / main present
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
  });

  test('axe: no critical violations on Home', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: {
        // keep defaults; enable/disable rules here if needed later
      },
    });
  });
});
