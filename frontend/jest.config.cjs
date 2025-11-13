// frontend/jest.config.cjs
/** @type {import('jest').Config} */
module.exports = {
  // Scope to your app code only
  roots: ['<rootDir>/src'],

  // Browser-like env for component/unit tests
  testEnvironment: 'jsdom',

  // Single setup file
  setupFilesAfterEnv: ['<rootDir>/src/setuptests.ts'],

  // Only pick up *.test.* files (NOT *.spec.* → keeps Playwright out)
  testRegex: '.*\\.test\\.(ts|tsx|js|jsx)$',

  // Keep Jest away from Playwright/e2e + Next build output + API routes
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '^/tests/',            // repo-root Playwright folder
    '/playwright/',        // any playwright artefacts
    '/e2e/',               // any e2e folder
    '/src/app/api/'        // App Router API route tests (excluded)
  ],

  // SWC transformer only (no Babel anywhere)
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } }
        },
        module: { type: 'commonjs' }
      }
    ]
  },

  // Resolve "@/..." to src/, and stub styles/assets
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss|sass|less)$': '<rootDir>/src/__mocks__/style.mock.ts',
    '\\.(png|jpg|jpeg|gif|svg|webp|avif)$': '<rootDir>/src/__mocks__/file.mock.ts'
  },

  transformIgnorePatterns: ['/node_modules/'],

  cacheDirectory: '<rootDir>/.jest-cache',
  reporters: ['default']
};
