/** @type {import('jest').Config} */

// ─────────────────────────────────────────────────────────────────────────────
// Shared configuration — every project inherits these settings.
//
// SPEED OPTIMIZATION (v2.0.0):
// - cacheDirectory: persistent transform cache — SWC output survives between
//   runs so the 30K+ lines of intelligence JSON and all TS transforms only
//   parse once. Subsequent runs reuse cached transforms.
// ─────────────────────────────────────────────────────────────────────────────
const sharedConfig = {
  setupFilesAfterEnv: ['<rootDir>/src/setuptests.ts'],

  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',

    // Centralised Next `server-only` stub for Jest (single place)
    '^server-only$': '<rootDir>/src/__mocks__/server-only.ts',

    // Clerk auth stubs – prevents ESM parse errors from @clerk/backend
    '^@clerk/nextjs$': '<rootDir>/src/__mocks__/clerk-nextjs.ts',
    '^@clerk/nextjs/server$': '<rootDir>/src/__mocks__/clerk-nextjs-server.ts',

    // CSS + asset stubs
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/style.mock.ts',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|avif)$': '<rootDir>/src/__mocks__/file.mock.ts',
  },

  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}', '!<rootDir>/src/**/*.d.ts'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Project definitions — 8 isolated test groups.
//
// Run individually:  pnpm run test:data
// Run all:           pnpm run test:ci
// Run combination:   pnpm test -- --selectProjects data,util --verbose
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Persistent cache — SWC transforms + JSON parses survive between runs.
  // First run: normal speed. Subsequent runs: significantly faster.
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  projects: [
    // ── 1. DATA — JSON SSOT integrity, schemas, shapes ──────────────────
    {
      ...sharedConfig,
      displayName: 'data',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/data/**/*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/*.integrity.test.{ts,tsx}',
        '<rootDir>/src/__tests__/schemas.test.{ts,tsx}',
        '<rootDir>/src/__tests__/schemas.catalogs.test.{ts,tsx}',
        '<rootDir>/src/__tests__/providers.schema.test.{ts,tsx}',
        '<rootDir>/src/__tests__/fx-pairs.test.{ts,tsx}',
        '<rootDir>/src/__tests__/platform-dna/**/*.test.{ts,tsx}',
        '<rootDir>/src/components/providers/__tests__/phase-4-evolution.test.{ts,tsx}',
      ],
    },

    // ── 2. LEARNING — ML scoring engine ─────────────────────────────────
    {
      ...sharedConfig,
      displayName: 'learning',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/src/lib/learning/__tests__/learning-test-setup.ts'],
      testMatch: ['<rootDir>/src/lib/learning/**/*.test.{ts,tsx}'],
    },

    // ── 3. INTELLIGENCE — Prompt scoring engines ────────────────────────
    {
      ...sharedConfig,
      displayName: 'intelligence',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/lib/prompt-intelligence/**/*.test.{ts,tsx}'],
    },

    // ── 4. HOOKS — React hooks ──────────────────────────────────────────
    {
      ...sharedConfig,
      displayName: 'hooks',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/hooks/**/*.test.{ts,tsx}'],
    },

    // ── 5. COMPONENTS — React component rendering ───────────────────────
    {
      ...sharedConfig,
      displayName: 'components',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/components/**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/.next/',
        '/dist/',
        'phase-4-evolution\\.test\\.',
      ],
    },

    // ── 6. API — Route handler contracts ────────────────────────────────
    {
      ...sharedConfig,
      displayName: 'api',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/src/app/api/tests/api-test-setup.ts'],
      testMatch: [
        '<rootDir>/src/app/api/**/*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/api.*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/go.*.test.{ts,tsx}',
      ],
      coverageThreshold: {
        global: {
          lines: 50,
          branches: 40,
          functions: 50,
          statements: 50,
        },
      },
    },

    // ── 7. UTIL — Pure library/utility functions ────────────────────────
    {
      ...sharedConfig,
      displayName: 'util',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/lib/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/src/lib/fx/**/*.test.{ts,tsx}',
        '<rootDir>/src/lib/ribbon/**/*.test.{ts,tsx}',
        '<rootDir>/src/lib/tests/**/*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/format.*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/fx.*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/exchange-order.test.{ts,tsx}',
        '<rootDir>/src/__tests__/sentinel/**/*.test.{ts,tsx}',
      ],
    },

    // ── 8. APP — App-scoped integration / catch-all ─────────────────────
    {
      ...sharedConfig,
      displayName: 'app',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/__tests__/a11y.*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/compression.test.{ts,tsx}',
        '<rootDir>/src/__tests__/conversion-*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/finance-ribbon.*.test.{ts,tsx}',
        '<rootDir>/src/__tests__/holiday-detector.test.{ts,tsx}',
        '<rootDir>/src/__tests__/plans.matrix.test.{ts,tsx}',
        '<rootDir>/src/__tests__/promagen-users.*.test.{ts,tsx}',
      ],
    },
  ],
};
