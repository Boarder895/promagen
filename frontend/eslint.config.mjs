// frontend/eslint.config.mjs
// -----------------------------------------------------------------------------
// Promagen ESLint – Flat config, React + Next + JSX a11y + TypeScript
// - Non type-aware TS rules (strict types enforced via `pnpm -C frontend typecheck`)
// - Smart overrides for scripts, tests, adapters, and data
// -----------------------------------------------------------------------------

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // 1. Global ignores (replacement for .eslintignore)
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".turbo/**",
      ".vercel/**",
      "public/build/**",
      "public/generated/**",
      // Old alt config, not a lint target
      "eslint.config.light.mjs"
    ]
  },

  // 2. Base JS + TS recommended (non type-aware)
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. Main app: React + Hooks + A11y + Next
  {
    files: ["**/*.{ts,tsx,js,jsx}"],

    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
        JSX: true
      }
    },

    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@next/next": nextPlugin
    },

    settings: {
      react: {
        version: "detect"
      }
    },

    rules: {
      // React core
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Accessibility – keep, but not so shouty
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/html-has-lang": "warn",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["href", "to"],
          aspects: ["noHref", "invalidHref", "preferButton"]
        }
      ],

      // Next.js specifics
      "@next/next/no-img-element": "warn",

      // TypeScript hygiene
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false
        }
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-object-type": "error",

      // General hygiene
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
      "no-debugger": "error",
      "no-alert": "warn",

      // React tweaks
      "react/prop-types": "off",
      "react/no-unknown-property": [
        "error",
        {
          ignore: ["jsx"] // allow <style jsx> etc.
        }
      ],
      "react/jsx-no-target-blank": "warn",
      "react/no-unescaped-entities": "warn"
    }
  },

  // 4. Declaration files: let them be loose
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off"
    }
  },

  // 5. Scripts: allow console + any + require
  {
    files: ["scripts/**/*.{js,ts,tsx,mjs,cjs}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off"
    }
  },

  // 6. Adapters / providers / financial plumbing – pragmatic exceptions
  {
    files: [
      "src/app/adapters/**",
      "src/providers/**",
      "src/lib/kv/**",
      "src/lib/finance/**",
      "src/lib/markets/**",
      "src/lib/fx/picker-ui.store.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "@typescript-eslint/ban-ts-comment": "off"
    }
  },

  // 7. Data seeds & schema builders
  {
    files: ["src/data/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },

  // 8. Tests (Jest / Playwright)
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "tests/**/*.ts",
      "tests/**/*.tsx",
      "src/__tests__/**",
      "src/app/**/tests/**",
      "src/components/**/__tests__/**"
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off"
    }
  },

  // 9. JS-only mocks/config (CJS/MJS) – relax redeclare/undef
  {
    files: ["**/*.cjs", "**/*.mjs", "**/*.js", "**/__mocks__/**"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.es2024,
        module: "writable",
        require: "readonly",
        __dirname: "writable",
        __filename: "writable"
      }
    },
    rules: {
      "no-undef": "off",
      "no-redeclare": "off"
    }
  },

  // 10. Prettier: turn off style rules that would fight our formatter
  eslintConfigPrettier
);
