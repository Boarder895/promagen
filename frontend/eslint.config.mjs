// ESLint v9 flat config — Phase 1.0 (green CI)
// Goal: warnings for TS strictness everywhere; allow defaults in app/**;
// temporarily WARN (not error) on default exports in src/** until migration.

import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import("eslint").Linter.FlatConfig[]} */
const config = [
  // Ignore build output and backups
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '_backup/**',
      'backup-*/**',
      'scripts/**',
    ],
  },

  // Base TS rules
  ...tseslint.configs.recommended,

  // Global TS/React sanity (apply to ALL ts/tsx)
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { import: importPlugin, 'react-hooks': reactHooks },
    rules: {
      // keep velocity — don’t fail PRs on these
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // react hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Allow default exports for Next.js App Router special files
  {
    files: [
      'app/**/page.tsx',
      'app/**/layout.tsx',
      'app/**/loading.tsx',
      'app/**/error.tsx',
      'app/**/not-found.tsx',
    ],
    rules: { 'import/no-default-export': 'off' },
  },

  // Temporarily allow defaults in the rest of app/**
  {
    files: ['app/**/*.ts', 'app/**/*.tsx'],
    rules: { 'import/no-default-export': 'off' },
  },

  // Enforce policy in src/**, but as a WARNING (for now)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: { 'import/no-default-export': 'warn' },
  },

  // Config/decl
  {
    files: [
      'next.config.*',
      'postcss.config.*',
      'tailwind.config.*',
      'eslint.config.*',
      '**/*.d.ts',
    ],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default config;
