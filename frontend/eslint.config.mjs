// frontend/eslint.config.mjs
// -----------------------------------------------------------------------------
// Promagen ESLint (Flat Config, ESM-safe, strict core, pragmatic edges)
// -----------------------------------------------------------------------------

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // Ignore outputs
  { ignores: [".next/**", "node_modules/**", "dist/**", "coverage/**", "playwright-report/**"] },

  // Base JS + TS
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Strict core for TS app code
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname, // important: string path
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: {
      // TypeScript strictness
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-object-type": "error",

      // Hooks + Next rules (now available)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn", // guidance without blocking
      "@next/next/no-img-element": "warn",

      // Sensible JS rules
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
    },
  },

  // Declaration files: not type-aware; no noise
  {
    files: ["**/*.d.ts"],
    languageOptions: { parserOptions: { project: false } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // Adapters / providers / finance & markets edges
  // Keep velocity where you integrate external SDKs or vendor responses.
  {
    files: [
      "src/app/adapters/**",
      "src/providers/**",
      "src/lib/kv/**",
      "src/lib/finance/**",
      "src/lib/markets/**",
      "src/lib/fx/picker-ui.store.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },

  // Data seeds & schema builders — allow lightweight `any` for table-like maps
  {
    files: ["src/data/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Tests (Jest/Playwright) — allow require() and relax ‘any’ for fixtures
  {
    files: [
      "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "tests/**/*.ts",
      "src/__tests__/**", "src/app/**/tests/**", "src/components/**/__tests__/**"
    ],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // JS-only mocks/config with CommonJS globals
  {
    files: ["**/*.cjs", "**/*.mjs", "**/*.js", "**/__mocks__/**"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.node, ...globals.es2024, module: "writable", require: "readonly" },
    },
    rules: {
      "no-undef": "off",
    },
  },
];
