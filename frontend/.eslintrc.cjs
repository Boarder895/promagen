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
  },
};
