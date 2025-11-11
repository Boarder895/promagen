import { test, expect } from '@playwright/test';

test('og:image resolves with 200', async ({ request, page }) => {
  await page.goto('/');
  const url = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(url).toBeTruthy();
  const res = await request.get(url!);
  expect(res.status()).toBe(200);
  const type = res.headers()['content-type'] || '';
  expect(type).toMatch(/image\//);
});
