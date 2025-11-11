import { test, expect } from '@playwright/test';

/**
 * Visual regression snapshots using Playwright built-ins.
 * Snapshots are stored per-project automatically in:
 *   frontend/tests/visual/__screenshots__/
 * The CI workflow already uploads the Playwright report artefact.
 */

test.describe('Promagen – visual confidence', () => {
  test('homepage: initial render', async ({ page }) => {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    // Normalise dynamic bits that could flicker between runs
    await page.evaluate(() => {
      // Freeze clocks if the app renders "now" anywhere
      // @ts-ignore
      Date.now = () => 1710000000000;
      // Reduce motion if the UI conditionally animates
      const style = document.createElement('style');
      style.textContent =
        '* { animation-duration: 0s !important; transition-duration: 0s !important; }';
      document.head.appendChild(style);
    });
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      timeout: 30000
    });
  });

  test('admin/exchanges: grid visible', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/exchanges', { waitUntil: 'networkidle' });
    // Ensure the editable grid mounted
    const grid = page.getByTestId('grid-exchanges');
    await expect(grid).toBeVisible();
    await expect(page).toHaveScreenshot('admin-exchanges.png', {
      fullPage: true,
      animations: 'disabled',
      timeout: 30000
    });
  });
});
