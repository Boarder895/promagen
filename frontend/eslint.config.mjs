// C:\Users\Martin Yarnold\Projects\promagen\frontend\eslint.config.mjs  (REPLACE)
// ESLint v9 flat config, ESM
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  // Central ignore list (replaces .eslintignore)
  {
    ignores: [
      '**/_backup/**',
      '**/.backup/**',
      'node_modules/**',
      '.next/**',
      'dist/**',
      'out/**',
      'coverage/**',
      '**/*.bak.*',
      'app/page.autofix.bak.tsx',
      'app/page.backup.tsx',
      'app/page.original.tsx'
    ],
  },

  // Base TypeScript rules (non type-checked — faster CI, no parserServices)
  ...tseslint.configs.recommended,

  // Global defaults
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // Promagen: keep code tidy
      'unused-imports/no-unused-imports': 'error',

      // React
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Turn off type-aware rules (no parser services here)
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Enforce named exports ONLY in src/** for now
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'error',
    },
  },

  // Next.js & transitional allowances: allow default exports in app/** & middleware
  {
    files: [
      'app/**/*.{ts,tsx}',
      'middleware.ts',
      'next.config.{js,ts,mjs,cjs}',
      'tailwind.config.{js,ts,mjs,cjs}',
    ],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // .d.ts type declaration files: allow any + default exports where needed
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-default-export': 'off',
    },
  },

  // Node scripts (CommonJS/JS): allow require()
  {
    files: ['scripts/**/*.{js,cjs}'],
    languageOptions: { sourceType: 'script' },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-default-export': 'off',
    },
  },
];

