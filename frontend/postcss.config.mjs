// frontend/postcss.config.mjs
// PostCSS pipeline for Promagen frontend (Tailwind v4 + Autoprefixer)

import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    tailwindcss,
    autoprefixer,
  ],
};

export default config;
