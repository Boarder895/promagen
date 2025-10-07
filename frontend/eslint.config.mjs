// frontend/eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Ignore build and backup artefacts
  { ignores: ['node_modules/**', '.next/**', 'dist/**', 'coverage/**', '**/_backup/**', 'backup-*/**'] },

  // Non type-checked base (keeps CI fast & non-blocking)
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    name: 'project-base',
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // no projectService -> no type-aware rules or "project service" errors
        projectService: false,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      'import/resolver': { typescript: true, node: true },
    },
    rules: {
      // keep CI green: warnings are fine, errors are not
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // hooks stay enforced
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // default off globally; we'll scope it below
      'import/no-default-export': 'off',
    },
  },

  // Scope: nudge toward named exports in real code, but as a warning for now
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'import/no-default-export': 'warn' },
  },

  // Allow defaults in app/**, d.ts, configs and scripts
  {
    files: [
      'app/**/*.{ts,tsx}',
      '**/*.d.ts',
      '**/*.{config,cjs,mjs}.{js,ts}',
      'scripts/**/*.{js,ts,cjs,mjs}',
    ],
    rules: { 'import/no-default-export': 'off' },
  },
);


