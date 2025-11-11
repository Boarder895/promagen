// Promagen ESLint v9 flat-config (typed/untyped split + proper plugin binding)

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Globs that should NOT use typed rules (fast + avoids "requires type info" errors)
const UNTYPED = [
  "**/*.config.*",
  "**/*.conf.*",
  "**/*.setup.*",
  "**/scripts/**/*.*",
  "**/tests/**/*.*",
  "**/__tests__/**/*.*",
  "**/__mocks__/**/*.*",
];

// Global ignores
const IGNORES = [
  "node_modules/**",
  ".next/**",
  "dist/**",
  "coverage/**",
  ".playwright/**",
  "**/*.snap",
];

export default [
  // Base JS everywhere
  js.configs.recommended,

  // ----------------- UNTYPED (tests/config/scripts) -----------------
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/**/*.{ts,tsx}", ...IGNORES],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // no "project" => UNTYPED mode
        ecmaVersion: 2023,
        sourceType: "module",
      },
    },
    plugins: {
      // bind @typescript-eslint plugin so namespaced rules resolve
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules, // untyped TS rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
    },
    linterOptions: { reportUnusedDisableDirectives: true },
  },

  // ----------------- TYPED (app source only) -----------------
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: new URL(".", import.meta.url),
        ecmaVersion: 2023,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked.rules,
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ----------------- Global ignores -----------------
  { ignores: IGNORES },
];
