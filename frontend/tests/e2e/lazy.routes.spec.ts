import { test, expect } from '@playwright/test';

// Simple crawl of key routes you may have now or soon.
// Add to this list as your app grows.
const routes = ['/', '/api/health', '/api/exchanges', '/api/providers', '/api/fx'];

for (const path of routes) {
  test(`route ${path} responds`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(500);
  });
}
