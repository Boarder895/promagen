import { test, expect } from '@playwright/test';

test('paid guard redirects anonymous/free to home', async ({ page }) => {
  const res = await page.goto('/paid/area', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBeGreaterThanOrEqual(200);
  // We expect to land on "/" because middleware redirects
  await expect(page).toHaveURL(/\/\?upgrade=1|\/$/);
});
