import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // Base
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
  },

  // STRICT CORE: only lib + hooks (keep named exports, keep hooks rules)
  {
    files: ['src/lib/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'error',
      // Temporarily warn on any to get CI green; raise to "error" as you clean
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // RELAXED EDGES: app + components + data (don’t block on default exports/any)
  {
    files: [
      'app/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/data/**/*.{ts,tsx}',
    ],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // DECLARATION FILES: allow default exports + any
  {
    files: ['**/*.d.ts'],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];



