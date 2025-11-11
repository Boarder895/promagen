// tools/acceptance/playwright/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://promagen.com";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  reporter: [["list"]],
});
