// ESLint v9 flat config — Promagen frontend
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ignore build artefacts
  {
    ignores: [
      'node_modules/', '.next/', 'dist/', 'out/', 'coverage/',
      '**/*.d.ts', '_backup/**', 'backup-*/**'
    ],
  },

  // base JS/TS rules (lightweight; no type-aware project required)
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // project-wide tweaks + plugins
  {
    plugins: { import: importPlugin, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // TypeScript: relax during migration (warnings only)
      '@typescript-eslint/no-explicit-any': 'warn',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Enforce named exports in our source tree (soft for now = warn)
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'import/no-default-export': 'warn',
    },
  },

  // Allow default exports where Next.js encourages/forces it
  {
    files: [
      'app/**/*.{ts,tsx,js,jsx}',
      'pages/**/*.{ts,tsx,js,jsx}',
      'middleware.ts',
      'next.config.{js,cjs,mjs,ts}',
      'postcss.config.{js,cjs,mjs,ts}',
      'tailwind.config.{js,cjs,mjs,ts}',
      '*.config.{js,cjs,mjs,ts}',
      'scripts/**/*.{js,ts}'
    ],
    rules: { 'import/no-default-export': 'off' },
  },
];

