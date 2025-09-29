import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,md,mdx}",
    "./src/app/**/*.{ts,tsx,md,mdx}",   // keep if you still have code there
    "./src/components/**/*.{ts,tsx,md,mdx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
