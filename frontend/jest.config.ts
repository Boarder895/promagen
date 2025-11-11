// frontend/jest.config.ts
// Promagen — Jest config (merged to your best-code guide)
// - TypeScript via ts-jest
// - jsdom environment for React/Next components
// - Stable test discovery under src/
// - Path alias support for "@/…"
// - CSS Modules stubbed via identity-obj-proxy

import type { Config } from "jest";

const config: Config = {
  rootDir: ".",

  // Use ts-jest to transform TS/TSX without type-checking during tests (faster CI).
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.json",
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },

  // Simulate the browser for React component tests.
  testEnvironment: "jsdom",

  // Where to look for tests.
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.(spec|test).(ts|tsx)",
    "<rootDir>/src/**/?(*.)+(spec|test).(ts|tsx)",
  ],

  // Keep noise and build artefacts out of test runs.
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/dist/",
    "/build/",
    "/coverage/",
    "/public/",
    "/test-results/",
    "/e2e/",
    "/playwright/",
  ],

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Match Next.js/TS path aliases and stub non-TS assets cleanly.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|scss|sass|less)$": "identity-obj-proxy",
    // Static assets (optional: provide a tiny file mock if you import images in tests)
    "\\.(gif|jpg|jpeg|png|svg|webp|avif)$": "<rootDir>/tests/__mocks__/fileMock.cjs",
  },

  // Run any DOM matchers and custom setup (e.g., jest-dom) from here.
  setupFilesAfterEnv: ["<rootDir>/src/setuptests.ts"],

  // Be strict in CI: fail on TS or ESLint errors outside of tests, handled elsewhere.
  // (We keep Jest focused; type checking and linting run in separate scripts.)

  // Deterministic coverage collection from source files.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/index.{ts,tsx}",
    "!src/**/__tests__/**",
    "!src/**/__mocks__/**",
    "!src/**/types.{ts,tsx}",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text-summary", "lcov"],

  // Make console noise useful in CI.
  reporters: ["default"],

  // Keep transforms simple; don’t transpile node_modules.
  transformIgnorePatterns: ["/node_modules/"],
};

export default config;
