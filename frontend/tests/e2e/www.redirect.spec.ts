import { test, expect } from '@playwright/test';

test('www redirects to apex (301/308)', async ({ request }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const www = base.replace('://', '://www.');
  const res = await request.get(www, { maxRedirects: 0 });
  expect([301, 308]).toContain(res.status());
  const loc = res.headers()['location'] || '';
  expect(loc).toContain(base.replace('://www.', '://'));
});
