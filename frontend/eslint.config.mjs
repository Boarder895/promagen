import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  { ignores: [
      '**/_backup/**','**/.backup/**','node_modules/**','.next/**','dist/**','out/**','coverage/**',
      '**/*.bak.*','app/page.autofix.bak.tsx','app/page.backup.tsx','app/page.original.tsx',
    ] },

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { import: importPlugin, 'unused-imports': unusedImports, react: reactPlugin, 'react-hooks': reactHooks },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
      }],
      'react/jsx-uses-react':'off','react/react-in-jsx-scope':'off',
      'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn',
      '@typescript-eslint/no-unsafe-assignment':'off',
      '@typescript-eslint/no-unsafe-member-access':'off',
      '@typescript-eslint/no-unsafe-call':'off',
      '@typescript-eslint/no-unsafe-return':'off',
    },
  },

  // Components: allow defaults & any
  { files: ['src/components/**/*.{ts,tsx}'], rules: { 'import/no-default-export':'off', '@typescript-eslint/no-explicit-any':'off' } },

  // Lib & Hooks: named exports; TEMP relax any
  { files: ['src/lib/**/*.{ts,tsx}','src/hooks/**/*.{ts,tsx}'], rules: { 'import/no-default-export':'error', '@typescript-eslint/no-explicit-any':'off' } },

  // NEW: Types helpers — allow any (these are declaration-like utilities)
  { files: ['src/types/**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-explicit-any':'off', 'import/no-default-export':'off' } },

  // Node scripts
  { files: ['scripts/**/*.{js,cjs}'], languageOptions:{sourceType:'script'}, rules:{ '@typescript-eslint/no-require-imports':'off','import/no-default-export':'off' } },

  // Declarations
  { files: ['**/*.d.ts'], rules: { 'import/no-default-export':'off', '@typescript-eslint/no-explicit-any':'off' } },

  // Next app & configs
  { files: ['app/**/*.{ts,tsx}','middleware.ts','next.config.{js,ts,mjs,cjs}','tailwind.config.{js,ts,mjs,cjs}'],
    rules: { 'import/no-default-export':'off' } },
];




