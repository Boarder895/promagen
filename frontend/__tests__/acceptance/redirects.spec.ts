import { test, expect } from '@playwright/test';

const base = process.env.BASE_URL || 'http://localhost:3000';
const isLocal = /localhost|127\.0\.0\.1/.test(base);

test.describe('WWW → apex redirect', () => {
  test.skip(isLocal, 'Redirect check only runs against deployed URL');

  test('www host 301/308-redirects to apex', async ({ request }) => {
    const url = new URL(base);
    const www = `https://www.${url.host.replace(/^www\./, '')}/`;
    const res = await request.fetch(www, { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    const loc = (res.headers() as any)['location'] || (res.headers() as any).get?.('location');
    expect(loc).toBeTruthy();
  });
});
