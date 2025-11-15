// Lightweight ESLint config (no TS project) for e2e specs, configs, scripts
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'e2e/**/*.{ts,tsx,js}',
      '**/*.config.{ts,js,cjs,mjs}',
      'scripts/**/*.{ts,js}'
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    plugins: {
      import: importPlugin,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/no-duplicates': 'error',
      'no-console': 'off'
    }
  }
);
