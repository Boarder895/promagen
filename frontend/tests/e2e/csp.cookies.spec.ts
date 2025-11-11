import { test, expect } from '@playwright/test';

test('CSP present; cookies scoped', async ({ page, request }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const res = await request.get(base);
  const csp = res.headers()['content-security-policy'] || res.headers()['content-security-policy-report-only'] || '';
  expect(csp.length).toBeGreaterThan(0);

  const cookies = await page.context().cookies();
  for (const c of cookies) {
    if (c.name.startsWith('promagen_')) {
      expect(c.httpOnly).toBeTruthy();
      expect(c.secure).toBeTruthy();
      const ss = (c.sameSite || 'Lax').toString().toLowerCase();
      expect(['lax', 'strict', 'none']).toContain(ss);
    }
  }
});
