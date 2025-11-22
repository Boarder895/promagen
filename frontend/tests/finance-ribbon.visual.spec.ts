// tests/finance-ribbon.visual.spec.ts

import { test, expect } from '@playwright/test';

test.describe('FinanceRibbon – homepage visual', () => {
  test('renders FX ribbon on the homepage and matches the baseline snapshot', async ({ page }) => {
    await page.goto('/');

    // Make sure the ribbon and FX row are actually there.
    await expect(page.getByTestId('finance-ribbon')).toBeVisible();
    await expect(page.getByTestId('finance-ribbon-row-fx')).toBeVisible();

    // Visual regression guard for the ribbon region.
    const ribbon = page.getByTestId('finance-ribbon');
    await expect(ribbon).toHaveScreenshot('finance-ribbon.png');
  });
});
