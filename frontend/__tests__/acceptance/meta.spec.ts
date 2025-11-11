import { test, expect } from '@playwright/test';

test.describe('Metadata & Sharing – Home', () => {
  test('title and meta description exist', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/promagen/i);

    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveCount(1);
    const content = await desc.first().getAttribute('content');
    expect(content && content.trim().length).toBeGreaterThan(0);
  });

  test('Open Graph & Twitter card present', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDesc  = page.locator('meta[property="og:description"]');
    const ogImage = page.locator('meta[property="og:image"]');

    await expect(ogTitle).toHaveCount(1);
    await expect(ogDesc).toHaveCount(1);
    await expect(ogImage).toHaveCount(1);

    const twCard = page.locator('meta[name="twitter:card"]');
    await expect(twCard).toHaveCount(1);
    const card = await twCard.first().getAttribute('content');
    expect(card?.toLowerCase()).toMatch(/summary/); // summary or summary_large_image
  });

  test('canonical link exists', async ({ page }) => {
    await page.goto('/');
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    const href = await canonical.first().getAttribute('href');
    expect(href && href.startsWith('http')).toBeTruthy();
  });

  test('robots.txt and sitemap.xml respond', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    const robotsText = await robots.text();
    expect(robotsText.toLowerCase()).toMatch(/user-agent:/);

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    const xml = await sitemap.text();
    expect(xml).toMatch(/<urlset|<sitemapindex/);
  });
});
