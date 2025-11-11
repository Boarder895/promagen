import { test, expect } from '@playwright/test';

test.describe('Keyboard sanity (Home fragments)', () => {
  test('Home/End moves focus extremes within providers grid', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    await page.goto(base, { waitUntil: 'networkidle' });

    const items = page.locator('[data-testid="providers-grid"] [role="list"] li a, [data-testid="providers-grid"] [role="list"] li button, [data-testid="providers-grid"] [role="list"] li article');
    const count = await items.count();
    if (count < 2) test.skip(true, 'Not enough provider cards');

    await items.first().focus();
    await page.keyboard.press('End');
    await expect(items.nth(count - 1)).toBeFocused();

    await page.keyboard.press('Home');
    await expect(items.first()).toBeFocused();
  });
});
