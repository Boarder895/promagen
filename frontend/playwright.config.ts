import type { PlaywrightTestConfig } from '@playwright/test';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const config: PlaywrightTestConfig = {
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'en-GB'
  },
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium-light',
      use: { colorScheme: 'light' }
    },
    {
      name: 'chromium-dark',
      use: { colorScheme: 'dark' }
    }
  ]
};

export default config;
