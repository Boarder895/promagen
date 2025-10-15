<<<<<<< HEAD
/** Keep linting, but don't fail builds on import spacing */
=======
/** @type {import("eslint").Linter.Config} */
>>>>>>> origin/main
module.exports = {
  extends: ['next', 'next/core-web-vitals'],
  rules: {
<<<<<<< HEAD
    // Stop builds failing on import group spacing/order
    'import/order': 'warn',
=======
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
>>>>>>> origin/main
  },
};