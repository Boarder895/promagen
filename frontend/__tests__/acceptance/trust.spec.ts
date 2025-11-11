import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function readRules() {
  try {
    const p = path.join(process.cwd(), 'src', 'data', 'acceptance-rules.json');
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as {
      asOfSelector?: string;
      liveRegionSelector?: string;
      deltaSelector?: string;
    };
  } catch {
    return {};
  }
}

const rules = readRules();

const AS_OF_SEL =
  rules.asOfSelector || '[data-asof], [data-as-of], text=/as[- ]?of/i';

const LIVE_REGION_SEL =
  rules.liveRegionSelector || '[aria-live="polite"]';

const DELTA_SEL =
  rules.deltaSelector || '[data-delta]';

test.describe('Trust & Disclosure – Home', () => {
  test('has an "as-of" timestamp near live-ish data', async ({ page }) => {
    await page.goto('/');
    const asOf = page.locator(AS_OF_SEL);
    await expect(asOf.first()).toBeVisible();
  });

  test('has a polite live region for async updates', async ({ page }) => {
    await page.goto('/');
    const polite = page.locator(LIVE_REGION_SEL);
    await expect(polite).toHaveCount(1);
  });

  test('colour-not-alone: deltas expose arrow or words', async ({ page }) => {
    await page.goto('/');
    const deltas = page.locator(DELTA_SEL);
    const count = await deltas.count();
    if (count === 0) test.skip(true, 'no deltas found on page');
    for (let i = 0; i < count; i++) {
      const el = deltas.nth(i);
      const name = (await el.innerText()).toLowerCase();
      const ok = /↑|↓|→|up|down|flat/.test(name);
      expect(ok).toBeTruthy();
    }
  });
});
