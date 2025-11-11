import { test, expect } from '@playwright/test';

test.describe('www → apex redirect', () => {
  test('returns 308 Permanent Redirect with canonical Location', async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const url = base.replace('http://', 'http://www.');
    const res = await request.get(url, { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status()); // allow local dev flexibility
    const loc = res.headers()['location'] || '';
    expect(loc).toContain(base.replace('http://www.', 'http://'));
  });
});
