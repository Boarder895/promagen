import { test, expect } from '@playwright/test';

test('health endpoint responds ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.data?.status).toBe('healthy');
});
