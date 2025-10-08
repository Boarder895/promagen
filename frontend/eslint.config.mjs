// ESLint v9 flat config (scoped)
// Allows default exports in src/components/** for now.
// Enforces named exports in src/lib/** and src/hooks/**.
// Relaxes no-explicit-any in components; keeps it on in lib/hooks.
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  {
    // replaces .eslintignore
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
      'app/page.original.tsx',
    ],
  },

  // Base TS rules (non type-checked)
  ...tseslint.configs.recommended,

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
      'unused-imports/no-unused-imports': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // turn off type-aware rules (no parserServices)
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // TEMP: Components can default-export; relax "any" there
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Enforce named exports + stricter "any" in lib and hooks
  {
    files: ['src/lib/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Node scripts: allow require/default
  {
    files: ['scripts/**/*.{js,cjs}'],
    languageOptions: { sourceType: 'script' },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-default-export': 'off',
    },
  },

  // Type decl files: allow default + any
  {
    files: ['**/*.d.ts'],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Next configs: allow default exports
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
];


