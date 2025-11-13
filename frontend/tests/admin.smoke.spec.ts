// admin.smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Smoke Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'promagen.admin',
        value: 'true',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ])
  })

  test('admin pages render tables', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/exchanges')
    await expect(page.getByTestId('grid-exchanges')).toBeVisible()
  })
})

// api.health.spec.ts
import { test, expect } from '@playwright/test';

test.describe('API Health Check', () => {
  test('health endpoint responds ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
  })
})

// paid.guard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Paid Area Guard', () => {
  test('anonymous users get redirected to home', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/paid')
    await expect(page).toHaveURL('/')
  })

  test('subscribed users access paid route', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'promagen.subscribed',
        value: 'true',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ])
    await page.goto('/paid')
    await expect(page.getByRole('main')).toBeVisible()
  })
})

// keyboard.providers.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation for Providers', () => {
  test('active row responds to keyboard navigation', async ({ page }) => {
    await page.goto('/providers')

    const list = page.getByRole('list')
    await expect(list).toBeVisible()

    const rows = list.locator('[data-testid^="provider-row-"]')
    await expect(rows.first()).toBeVisible()

    await rows.first().press('ArrowDown')
    const selected = list.locator('[aria-selected="true"]')
    await expect(selected).toHaveCount(1)
  })
})
