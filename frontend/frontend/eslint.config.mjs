// frontend/eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'dist/**', 'coverage/**', '**/_backup/**', 'backup-*/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'project-base',
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: false },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { import: importPlugin, 'react-hooks': reactHooks },
    settings: { 'import/resolver': { typescript: true, node: true } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      'no-empty': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-default-export': 'off'
    },
  },
  { files: ['src/**/*.{ts,tsx}'], rules: { 'import/no-default-export': 'warn' } },
  {
    files: ['app/**/*.{ts,tsx}', '**/*.d.ts', '**/*.{config,cjs,mjs}.{js,ts}', 'scripts/**/*.{js,ts,cjs,mjs}'],
    rules: { 'import/no-default-export': 'off' },
  },
);
