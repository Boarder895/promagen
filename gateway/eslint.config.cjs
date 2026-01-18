/**
 * Promagen Gateway - ESLint (Flat Config for ESLint v9)
 * =====================================================
 * Enforces architectural guardrails from GATEWAY-REFACTOR.md
 *
 * GUARDRAIL G3: Flat import convention (../lib/ or ./)
 * GUARDRAIL G6: One-way dependency flow (no circular deps)
 *
 * Notes:
 * - ESLint v9 uses "flat config" (eslint.config.*). This file is intentionally CJS.
 * - We lint only TypeScript sources in /src.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');

module.exports = [
  // ---------------------------------------------------------------------------
  // Global ignores (build output + deps)
  // ---------------------------------------------------------------------------
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js'],
  },

  // ---------------------------------------------------------------------------
  // TypeScript (src/**/*.ts)
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      // Make eslint-plugin-import understand TypeScript files + TS path resolution
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // Base recommended rules (ported into this TS block)
      ...(js.configs.recommended?.rules ?? {}),
      ...(tsPlugin.configs.recommended?.rules ?? {}),

      // TypeScript already type-checks undefined identifiers; disable base rule to avoid false positives
      'no-undef': 'off',

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
  },

  // ---------------------------------------------------------------------------
  // Overrides
  // ---------------------------------------------------------------------------

  // server.ts CAN import from all providers (it's the index)
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
];

