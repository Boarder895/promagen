import { test, expect } from '@playwright/test'

test.describe('Promagen – visual confidence', () => {
  test('homepage: initial render', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

    await page.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = `
        * { animation-duration: 0s !important; transition-duration: 0s !important; }
      `
      document.head.appendChild(style)
    })

    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      timeout: 30000
    })
  })

  test('admin/exchanges: grid visible', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/exchanges', { waitUntil: 'networkidle' })

    const grid = page.getByTestId('grid-exchanges')
    await expect(grid).toBeVisible()

    await expect(page).toHaveScreenshot('admin-exchanges.png', {
      fullPage: true,
      animations: 'disabled',
      timeout: 30000
    })
  })
})
