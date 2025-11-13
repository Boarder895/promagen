import { test, expect, request as playwrightRequest } from '@playwright/test'

test('og:image resolves with 200', async () => {
  const request = await playwrightRequest.newContext()
  const res = await request.get('http://localhost:3000')
  const html = await res.text()
  const match = html.match(/<meta property="og:image" content="(.*?)"/)

  expect(match).not.toBeNull()
  const url = match?.[1]
  expect(url).toBeTruthy()

  const imageRes = await request.get(url!)
  expect(imageRes.status()).toBe(200)
  expect(imageRes.headers()['content-type']).toMatch(/^image\//)
})
