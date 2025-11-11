import { test, expect } from '@playwright/test';

test.describe('Error Pages', () => {
  test('404 page exists and is branded', async ({ page, request }) => {
    const res = await request.get('/definitely-not-a-route-xyz');
    expect(res.status()).toBe(404);

    await page.goto('/definitely-not-a-route-xyz');
    await expect(page.getByText(/not found|lost|404/i)).toBeVisible();
  });
});
