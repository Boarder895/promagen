/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,

  env: {
    browser: true,
    node: true,
    es2023: true,
  },

  // TypeScript-aware parser
  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    // No project: avoids perf/TS-Program issues for now
  },

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    // Next.js App Router + web vitals
    'next/core-web-vitals',
  ],

  plugins: ['@typescript-eslint'],

  rules: {
    // Use underscore naming to intentionally ignore unused bindings
    // (works for function args, variables, and caught errors)
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],

    // Reasonable TS defaults; keep strict but practical
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-ts-comment': [
      'warn',
      { 'ts-expect-error': 'allow-with-description' },
    ],
  },

  overrides: [
    // Declaration files often need broader types
    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    // Tests (if/when added)
    {
      files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
      env: { jest: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],

  ignorePatterns: [
    'node_modules/',
    '.next/',
    '.turbo/',
    'dist/',
    'out/',
    '**/*.bak',
  ],
};
