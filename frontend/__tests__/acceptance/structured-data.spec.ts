import { test, expect } from '@playwright/test';

test.describe('Structured Data – Home', () => {
  test('WebSite JSON-LD present', async ({ page }) => {
    await page.goto('/');
    const texts = await page.locator('script[type="application/ld+json"]').allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);

    const hasWebSite = texts.some(txt => {
      try {
        const obj = JSON.parse(txt);
        const arr = Array.isArray(obj) ? obj : [obj];
        return arr.some(o => o['@type'] === 'WebSite' || (Array.isArray(o['@type']) && o['@type'].includes('WebSite')));
      } catch { return false; }
    });

    expect(hasWebSite).toBeTruthy();
  });

  test('ItemList reserved for providers (optional)', async ({ page }) => {
    await page.goto('/');
    const texts = await page.locator('script[type="application/ld+json"]').allInnerTexts();

    const hasItemList = texts.some(txt => {
      try {
        const obj = JSON.parse(txt);
        const arr = Array.isArray(obj) ? obj : [obj];
        return arr.some(o => o['@type'] === 'ItemList');
      } catch { return false; }
    });

    test.skip(!hasItemList, 'ItemList will arrive with leaderboard schema');
  });
});
