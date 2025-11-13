import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Lazy-loaded routes data', () => {
  // Serve real JSON data for API calls to avoid 503 errors
  test.beforeEach(({ page }) => {
    // Intercept /api/exchanges calls and fulfill with real selected exchanges data
    page.route('**/api/exchanges', async route => {
      const catalog = JSON.parse(fs.readFileSync('src/data/exchanges.catalog.json', 'utf-8'));
      const selected = JSON.parse(fs.readFileSync('src/data/exchanges.selected.json', 'utf-8'));
      // Determine which exchanges to return: use selected ids or top N from catalog
      let exchangesList = [];
      const ids = selected.ids ?? [];
      if (ids.length) {
        // Return details for the selected exchange IDs in order
        exchangesList = ids.map((id: string) => catalog.find((ex: any) => ex.id === id));
      } else {
        // Fallback: take the first N exchanges from the sorted catalog
        const count = selected.count ?? 12;
        // Assume catalog is pre-sorted east→west; slice top `count`
        exchangesList = catalog.slice(0, count);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(exchangesList)
      });
    });
    // Intercept /api/fx calls and fulfill with real FX pairs data
    page.route('**/api/fx', async route => {
      const pairs = JSON.parse(fs.readFileSync('src/data/fx/pairs.json', 'utf-8'));
      const freePairs = ['eur-usd','gbp-usd','gbp-eur'];  // free-tier trio:contentReference[oaicite:3]{index=3}
      // Prepare a response with the free pair data, including current demo values
      const fxData = pairs
        .filter((p: any) => freePairs.includes(p.id))
        .map((p: any) => ({
          id: p.id,
          label: p.label,
          rate: p.demo.value,
          prevClose: p.demo.prevClose,
          asOf: new Date().toISOString()
        }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fxData)
      });
    });
  });

  test('loads exchanges and FX data without errors', async ({ page }) => {
    await page.goto('/some-lazy-route'); // e.g. a route that triggers lazy data loading
    // The page should display exchange cards and FX rates using the mocked data
    const exchangeItems = page.getByTestId(/^exchange-/);  // assume data-testid on exchange items
    await expect(exchangeItems.first()).toBeVisible();
    const fxTiles = page.getByRole('listitem', { name: /FX pair/i });
    await expect(fxTiles.nth(0)).toContainText('GBP / USD');
    // (Additional assertions can verify that data appears correctly using the real catalog values)
  });
});
