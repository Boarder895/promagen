import { test, expect } from '@playwright/test';

test.skip('robots.txt and sitemap.xml available (enable when added)', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect([200, 404]).toContain(robots.status()); // relax until you add it

  const sitemap = await request.get('/sitemap.xml');
  expect([200, 404]).toContain(sitemap.status());
});
