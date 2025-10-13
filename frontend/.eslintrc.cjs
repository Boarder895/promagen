<<<<<<< HEAD
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  plugins: ["import", "unused-imports"],
  rules: {
    // Kill dead code
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],

    // Deterministic import order with blank lines between groups
    "import/order": ["warn", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
      "newlines-between": "always",
      "alphabetize": { order: "asc", caseInsensitive: true }
    }],

    // Keep React hooks honest (don’t disable unless justified)
    "react-hooks/exhaustive-deps": "error",
  },
  settings: {
    next: { rootDir: ["./"] },
=======
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
>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955
  },
};
