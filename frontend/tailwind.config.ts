// frontend/tailwind.config.ts
// Promagen — Tailwind config (merged to your best-code guide)
// - Next.js + App Router in src/
// - shadcn/ui tokens (CSS variables) + animations
// - Dark mode via class
// - Sensible plugins: animate, typography, forms, container-queries
// - Small, safe safelist for dynamic states used on homepage rails

import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";
import forms from "@tailwindcss/forms";
import containerQueries from "@tailwindcss/container-queries";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/styles/**/*.{ts,tsx,mdx,css}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1rem",
        md: "2rem",
        lg: "2rem",
        xl: "2.5rem",
        "2xl": "3rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      // shadcn/ui token bridge (reads from CSS variables set in globals.css)
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Promagen semantic accents for rails and trends
        trend: {
          up: "hsl(var(--trend-up, 142 70% 45%))",     // green
          down: "hsl(var(--trend-down, 0 72% 50%))",   // red
          flat: "hsl(var(--trend-flat, 215 16% 47%))", // zinc-ish
        },
        rail: {
          east: "hsl(var(--rail-east, 217 89% 61%))",
          west: "hsl(var(--rail-west, 271 81% 56%))",
        },
      },

      borderRadius: {
        lg: "var(--radius, 0.5rem)",
        md: "calc(var(--radius, 0.5rem) - 2px)",
        sm: "calc(var(--radius, 0.5rem) - 4px)",
        "2xl": "calc(var(--radius, 0.5rem) + 8px)",
      },

      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },

      // Motion — shadcn defaults + tiny extras used in homepage rails
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(.98)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".6" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 200ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },

      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 3px 1px rgb(0 0 0 / 0.08)",
        hover: "0 6px 30px -6px rgb(0 0 0 / 0.15)",
        focus: "0 0 0 2px hsl(var(--ring))",
      },

      // Subtle, dusk-to-dawn gradient used by the homepage background
      backgroundImage: {
        "dusk-dawn":
          "linear-gradient(180deg, hsl(var(--bg-top, 240 33% 12%)) 0%, hsl(var(--bg-mid, 250 30% 14%)) 50%, hsl(var(--bg-bottom, 260 28% 16%)) 100%)",
      },
    },
  },

  // Minimal safelist for dynamic classes created from data (e.g., trend states)
  safelist: [
    { pattern: /text-(green|red|zinc)-(500|600|700)/ },
    { pattern: /bg-(green|red|zinc)-(50|100|200)/ },
    { pattern: /border-(green|red|zinc)-(200|300)/ },
    // rail accents (when toggled)
    "bg-rail-east",
    "bg-rail-west",
    "text-rail-east",
    "text-rail-west",
  ],

  plugins: [animate, typography, forms, containerQueries],
};

export default config;
