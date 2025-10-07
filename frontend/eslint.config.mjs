// ESLint v9 flat config — Promagen frontend (Phase 1)
// Enforce named exports in src/** now; temporarily allow defaults in app/**
// Ignore backups and scripts; allow Next App Router special files.

import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import("eslint").Linter.FlatConfig[]} */
const config = [
  // 0) Global ignores
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '_backup/**',
      'backup-*/**',
      'app/**/*.backup.*',
      'app/*backup*.*',
      'scripts/**', // skip scripts for now
    ],
  },

  // 1) Base TS rules
  ...tseslint.configs.recommended,

  // 2) Project rules — enforce named exports in src/**
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { import: importPlugin, 'react-hooks': reactHooks },
    rules: {
      'import/no-default-export': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },

  // 3) App Router special files — allow default exports (Next requires)
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

  // 4) App (temporary) — allow defaults while we prep a codemod
  {
    files: ['app/**/*.ts', 'app/**/*.tsx'],
    rules: { 'import/no-default-export': 'off' },
  },

  // 5) Config/decl
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
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
];

export default config;

