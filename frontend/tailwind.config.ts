// Promagen Tailwind config (v4-ready). Keep simple and predictable.
import type { Config } from 'tailwindcss';

export default <Config>{
  darkMode: 'media',
  content: [
    './src/app/**/*.{ts,tsx,mdx,css}',
    './src/components/**/*.{ts,tsx}',
    './src/pages/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      keyframes: {
        'ribbon-shimmer': {
          '0%': { transform: 'translateX(-30%)', opacity: '0.7' },
          '50%': { transform: 'translateX(0%)', opacity: '1' },
          '100%': { transform: 'translateX(30%)', opacity: '0.7' }
        }
      },
      animation: {
        'ribbon-shimmer': 'ribbon-shimmer 180s linear infinite'
      }
    }
  },
  plugins: [],
  future: { hoverOnlyWhenSupported: true }
};
