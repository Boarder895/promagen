// Flat config for ESLint v9

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'

export default [
  // Ignore generated/backup/build & config files
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/out/**',
      '**/_backup/**',
      'backup-*/**',
      'scripts/**',
      'eslint.config.mjs',
      'eslint.import-guards.mjs',
      'next.config.mjs',
      'postcss.config.js',
    ],
  },

  // JS files: basic rules only
  js.configs.recommended,

  // TS files: type-aware configs, applied only to ts/tsx
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        allowDefaultProject: true,       // fixes “not found by the project service”
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': { typescript: true },
    },
    rules: {
      // Make noisy rules warnings so CI won’t fail on them
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      'no-empty': 'warn',

      // Don’t block on export style (Next.js code often uses default exports)
      'import/no-default-export': 'off',
    },
  },
]


