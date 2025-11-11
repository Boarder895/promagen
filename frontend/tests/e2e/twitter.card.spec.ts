import { test, expect } from '@playwright/test';

test('twitter:card value is valid', async ({ page }) => {
  await page.goto('/');
  const card = await page.locator('meta[name="twitter:card"]').getAttribute('content');
  expect(card).toMatch(/^(summary|summary_large_image)$/);
});
