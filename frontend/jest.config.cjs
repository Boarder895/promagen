/** @type {import('jest').Config} */
module.exports = {
  // Use jsdom by default. Individual tests can override with @jest-environment node.
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setuptests.ts'],

  testMatch: ['<rootDir>/src/**/__tests__/**/*.(test|spec).(ts|tsx|js)'],

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

    // CSS + asset stubs
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/style.mock.ts',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|avif)$': '<rootDir>/src/__mocks__/file.mock.ts',
  },

  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/src/app/api/'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}', '!<rootDir>/src/**/*.d.ts'],
};
