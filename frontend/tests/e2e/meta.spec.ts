import { test, expect } from '@playwright/test';

test('homepage has title, description, canonical, OG, Twitter', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/.{4,}/);

  const desc = page.locator('meta[name="description"]');
  await expect(desc).toHaveAttribute('content', /.{10,}/);

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /https?:\/\//);

  // OG
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /https?:\/\//);

  // Twitter
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', /summary|summary_large_image/);
});
