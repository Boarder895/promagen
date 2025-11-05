// frontend/eslint.config.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Ignore junk/prototypes/build output
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "scripts/**",
      // prototypes you already had
      "src/providers/copypaste/**",
      "src/backup/**",
      // stage gating for Stage-1/2
      "src/app/api/**",
      "src/app/book/**"
    ],
  },

  // Main rules for your source
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        ecmaVersion: 2023,
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // Momentum helpers
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",

      // React hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Console allowed as warn generally
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // API routes: allow console fully
  {
    files: ["src/app/api/**/*.{ts,tsx,js,jsx}"],
    rules: { "no-console": "off" },
  },

  // Declaration files: do not run typed program (stops db.d.ts error)
  {
    files: ["src/**/*.d.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: false },
    },
    rules: {},
  }
);
