/**
 * Promagen Gateway - ESLint Configuration
 * =========================================
 * Enforces architectural guardrails from GATEWAY-REFACTOR.md
 *
 * GUARDRAIL G3: Flat import convention (../lib/ or ./)
 * GUARDRAIL G6: One-way dependency flow (no circular deps)
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // =========================================================================
    // GUARDRAIL G6: No circular dependencies
    // =========================================================================
    'import/no-cycle': ['error', { maxDepth: 3 }],

    // =========================================================================
    // GUARDRAIL G3: Flat import convention
    // Provider modules can only import from:
    // - Their own folder (./)
    // - Shared lib (../lib/)
    // - NOT from other provider folders
    // =========================================================================
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // TwelveData cannot import from Marketstack or Fallback
          {
            group: ['**/marketstack/*', '**/fallback/*'],
            message:
              'G3 VIOLATION: twelvedata/ cannot import from other providers. Use ../lib/ for shared code.',
          },
          // Marketstack cannot import from TwelveData or Fallback
          {
            group: ['**/twelvedata/*', '**/fallback/*'],
            message:
              'G3 VIOLATION: marketstack/ cannot import from other providers. Use ../lib/ for shared code.',
          },
          // Fallback cannot import from TwelveData or Marketstack
          {
            group: ['**/twelvedata/*', '**/marketstack/*'],
            message:
              'G3 VIOLATION: fallback/ cannot import from other providers. Use ../lib/ for shared code.',
          },
          // Prevent deep imports from feeds (legacy)
          {
            group: ['**/feeds/fx', '**/feeds/crypto'],
            message:
              'MIGRATION: Use twelvedata/ for FX and Crypto feeds, not feeds/.',
          },
        ],
      },
    ],

    // =========================================================================
    // TypeScript strict rules
    // =========================================================================
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'off',

    // =========================================================================
    // Import ordering
    // =========================================================================
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',

    // =========================================================================
    // General code quality
    // =========================================================================
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
  },
  overrides: [
    // Server.ts CAN import from all providers (it's the index)
    {
      files: ['src/server.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    // Test files have relaxed rules
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
