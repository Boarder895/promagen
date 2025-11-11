// postcss.config.cjs
// Promagen — PostCSS config (best-code guide, CJS for maximum loader compatibility)

module.exports = {
  plugins: {
    // Tailwind’s official PostCSS plugin (v4+ style)
    "@tailwindcss/postcss": {},
    // Add vendor prefixes based on Browserslist
    autoprefixer: {},
  },
};
