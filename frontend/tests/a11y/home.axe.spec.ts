import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no critical accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules([
      // Relax rules that tend to false-positive on demo data
      'color-contrast', // your palette may tune this later
    ])
    .analyze();

  const critical = results.violations.filter((v) => (v.impact ?? '').toLowerCase() === 'critical');
  if (critical.length) {
     
    console.error(JSON.stringify(critical, null, 2));
  }
  expect(critical.length, 'No critical a11y violations expected').toBe(0);
});
