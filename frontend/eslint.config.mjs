// frontend/eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // don't report unused disable comments
  { linterOptions: { reportUnusedDisableDirectives: "off" } },

  // ignore build artifacts
  { ignores: ["node_modules/**", ".next/**", "dist/**", "public/**"] },

  // base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // project rules (apply to source files)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      // import guardrails
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/markets", message: "Use @/lib/markets instead." },
            {
              name: "@/lib/marketTime",
              message: "Use helpers in @/lib/markets instead of @/lib/marketTime.",
            },
          ],
        },
      ],

      // essential plugin rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@next/next/no-img-element": "off",

      // baseline during cleanup
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "prefer-const": "warn",
      "no-empty": "off",
    },
  },

  // declaration/types: allow loose typing & unuseds
  {
    files: ["src/**/*.d.ts", "src/types/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // file-specific: allow a temporary unused in markets.ts
  {
    files: ["src/lib/markets.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];


