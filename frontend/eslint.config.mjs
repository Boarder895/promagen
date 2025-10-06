// C:\Users\Martin Yarnold\Projects\promagen\frontend\eslint.config.mjs
import js from '@eslint/js';
import next from 'eslint-config-next';
import pluginImport from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default [
  // 1) Ignore heavy/build folders
  {
    ignores: [
      '.next/',
      'node_modules/',
      'dist/',
      'build/',
      'out/',
      'coverage/',
      'vercel/',
      '.vscode/'
    ],
  },

  // 2) Base JS + Next.js Core Web Vitals
  js.configs.recommended,
  ...next,

  // 3) TypeScript (type-aware)
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      import: pluginImport
    },
    rules: {
      // Promagen locked rule: named exports only
      'import/no-default-export': 'error',

      // Useful hygiene
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },

  // 4) Allow default exports for Next App Router files that require them
  {
    files: ['**/*page.tsx', '**/*layout.tsx', 'next.config.*'],
    rules: {
      'import/no-default-export': 'off'
    }
  }
];


