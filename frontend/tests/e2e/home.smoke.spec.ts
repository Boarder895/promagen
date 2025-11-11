import { test, expect } from '@playwright/test';

test('homepage renders three regions and ribbon', async ({ page }) => {
  await page.goto('/');
  // Regions from your homepage markup (main + rails)
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByTestId('east-rail')).toBeVisible();
  await expect(page.getByTestId('west-rail')).toBeVisible();

  // Ribbon present
  await expect(page.getByTestId('finance-ribbon')).toBeVisible();

  // Providers grid (loosely)
  const providerCards = page.locator('[data-testid^="provider-"]');
  await expect(providerCards.first()).toBeVisible();
});
