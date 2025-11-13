import { test, expect, request as playwrightRequest } from '@playwright/test'

const isCI = (): boolean => {
  return (process.env.NODE_ENV as string)?.toLowerCase() === 'ci'
}

test('www redirects to apex (301/308)', async () => {
  if (!isCI()) {
    test.skip(true, 'Skipping in local env (no www.localhost)')
    return
  }

  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
  const www = base.replace('://', '://www.')

  const req = await playwrightRequest.newContext()
  const res = await req.get(www, { maxRedirects: 0 })

  expect([301, 308]).toContain(res.status())
  const loc = res.headers()['location'] || ''
  expect(loc).toContain(base.replace('://www.', '://'))
})
