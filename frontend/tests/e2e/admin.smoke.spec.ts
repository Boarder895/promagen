import { test, expect } from '@playwright/test';

test('admin pages render tables', async ({ page }) => {
  await page.context().addCookies([{ name: 'promagen_admin', value: '1', url: 'http://localhost:3000' }]);
  await page.goto('/admin/exchanges');
  await expect(page.getByRole('table')).toBeVisible();

  await page.goto('/admin/providers');
  await expect(page.getByRole('table')).toBeVisible();
});
