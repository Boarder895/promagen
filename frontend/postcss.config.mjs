// frontend/postcss.config.mjs
// PostCSS pipeline for Promagen frontend (Tailwind v4 + Autoprefixer)

export default {
  plugins: {
    // Tailwind CSS v4 – processes @import "tailwindcss" in globals.css
    "@tailwindcss/postcss": {},

    // Keep vendor prefixes (Next’s default behaviour) when using a custom config
    autoprefixer: {},
  },
};
