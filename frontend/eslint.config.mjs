/** @type {import("eslint").Linter.FlatConfig[]} */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unused from "eslint-plugin-unused-imports";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: [
      "_backup/**",
      "backup-*/**",
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "public/**",
      "scripts/**",
      "configs/**"
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
      "unused-imports": unused,
    },
    settings: { react: { version: "detect" } },
    rules: {
      "no-empty": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/non-nullable-type-assertion-style": "warn",
      "@typescript-eslint/triple-slash-reference": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react-hooks/exhaustive-deps": "warn",
      "import/no-default-export": "off",
      "unused-imports/no-unused-imports": "error"
    },
  },
  {
    files: ["**/*.d.ts", "**/*.config.*", "**/next.config.*", "scripts/**/*", "configs/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "import/no-default-export": "off"
    },
  },
];





