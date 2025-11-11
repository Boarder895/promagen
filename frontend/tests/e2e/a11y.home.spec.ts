import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Homepage has no critical/serious Axe violations', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(base, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze();
  const critical = results.violations.filter(v => v.impact === 'critical');
  const serious = results.violations.filter(v => v.impact === 'serious');
  if (critical.length || serious.length) console.log(JSON.stringify({ critical, serious }, null, 2));
  expect(critical.length).toBe(0);
  expect(serious.length).toBe(0);
});
