import tsParser from '@typescript-eslint/parser';

/** Guard-only ESLint config: parses TS and forbids legacy imports */
export default [
  // What to ignore (replaces .eslintignore for this run)
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/*.d.ts'] },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      // ❌ forbid these imports anywhere in the frontend
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@/markets', message: 'Use "@/lib/markets" (and helpers) instead.' },
          { name: '@/lib/marketTime', message: 'Use "@/lib/useMarketTimes" or "@/lib/markets" instead.' },
        ],
        patterns: ['@/lib/marketTime/*'],
      }],

      // explicitly turn off noisy general rules – we only want the guard
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
];
