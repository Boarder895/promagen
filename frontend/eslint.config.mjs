// frontend/eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // ignore generated/build artifacts
  { ignores: ['node_modules/**', '.next/**', 'dist/**', 'coverage/**'] },

  // base JS rules
  js.configs.recommended,

  // TS rules with type-checking
  ...tseslint.configs.recommendedTypeChecked,

  {
    name: 'project-rules',
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // let TS “project service” find your tsconfig automatically
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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
      // keep CI green with --quiet: warnings are OK, errors are not
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // default off here; we’ll turn it on for src/** below
      'import/no-default-export': 'off',

      // react hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Enforce named exports inside src/**
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'import/no-default-export': 'error' },
  },

  // Allow defaults in app/**, config files, and .d.ts
  {
    files: [
      'app/**/*.{ts,tsx}',
      '**/*.{config,cjs,mjs}.{js,ts}',
      '**/*.d.ts',
    ],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);


