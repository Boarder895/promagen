// frontend/postcss.config.mjs
// PostCSS pipeline for Promagen frontend (Tailwind v4 + Autoprefixer)

import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: {
    tailwindcss,
    autoprefixer,
  },
};
