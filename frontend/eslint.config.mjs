import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  // Keep memory down: ignore non-source dirs
  {
    ignores: [
      ".next/**","node_modules/**","dist/**","build/**","out/**",
      "coverage/**","vercel/**",".vscode/**","_backup/**","backup-*/**","scripts/**"
    ],
  },

  // Base JS + lightweight TS (no type-checking)
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Register only the rules we reference in code/comments
  {
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
      // We don't turn on any Next rules globally; plugin is present so
      // file-level disable comments like @next/next/no-img-element work.
    }
  },

  // Node-style config files (silence 'module is not defined')
  {
    files: ["next.config.*","postcss.config.*","tailwind.config.*"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { module: "readonly", require: "readonly", process: "readonly", __dirname: "readonly" }
    }
  },

  // Relax a couple rules for now to cut noise
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  },

  // Allow triple-slash reference in this one legacy file for now
  { files: ["global.d.ts"], rules: { "@typescript-eslint/triple-slash-reference": "off" } }
];
