// .eslintrc.cjs
/** Promagen ESLint config: add import guardrails. */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'public/',
  ],
  rules: {
    // 🚧 Import guardrails
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@/markets',
          message: "Use '@/lib/markets' as the canonical import.",
        },
        {
          name: '@/lib/marketTime',
          importNames: ['computeMarket'],
          message: "Import computeMarket from '@/lib/markets', not from marketTime.",
        },
      ],
      patterns: [
        // Catch stray variants like '@/markets/foo'
        { group: ['@/markets', '@/markets/*'], message: "Use '@/lib/markets' only." },
      ],
    }],
  },
};
