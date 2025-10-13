import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";
import nextPlugin from "@next/eslint-plugin-next";

const NEXT_SPECIAL_GLOBS = [
  "app/**/page.tsx",
  "app/**/layout.tsx",
  "app/**/template.tsx",
  "app/**/default.tsx",
  "app/**/loading.tsx",
  "app/**/error.tsx",
  "app/**/global-error.tsx",
  "app/**/not-found.tsx",
  "app/**/route.ts",
  "pages/**/[[]*[]].tsx",
  "pages/**/index.tsx",
  "pages/**/_app.tsx",
  "pages/**/_document.tsx",
];

export default [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  nextPlugin.configs["core-web-vitals"],

  { ignores: [".next/**","node_modules/**","dist/**"] },

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin, "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "import/no-default-export": "off",
    },
  },

  // Enforce named exports first in library-ish code
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/data/**/*.{ts,tsx}",
      "src/types/**/*.{ts,tsx}",
      "src/utils/**/*.{ts,tsx}",
      "src/services/**/*.{ts,tsx}",
    ],
    rules: { "import/no-default-export": "error" },
  },

  // Allow Next special files to use default exports
  { files: NEXT_SPECIAL_GLOBS, rules: { "import/no-default-export": "off" } },

  // Allow in .d.ts
  { files: ["**/*.d.ts"], rules: { "import/no-default-export": "off" } },

  // TEMP: relax for components during Phase 1 migration
  {
    files: [ "components/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}" ],
    rules: { "import/no-default-export": "off" },
  },
];