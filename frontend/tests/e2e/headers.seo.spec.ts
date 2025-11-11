import { test, expect } from '@playwright/test';

test('robots headers are sane', async ({ request }) => {
  const res = await request.get('/');
  const robots = res.headers()['x-robots-tag'];
  // Either undefined (fine) or something like "index, follow"
  if (robots) {
    expect(robots.toLowerCase()).toMatch(/index|noindex/);
  }
});
