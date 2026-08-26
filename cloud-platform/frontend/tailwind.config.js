/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Tailwind v4 resolves content automatically; these globs are kept
  // explicit so the whole app (pages, components, layouts) is always scanned.
  // The colour palette / theme lives in src/app/globals.css under `@theme`
  // (CSS-first config). JS tokens mirror it in src/components/common/theme.js.
  content: [
    './src/pages/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1E3A5F',
          deep: '#162D4A',
          card: '#1E3A5F',
          light: '#2A4A6E',
        },
        brand: {
          DEFAULT: '#2563EB',
          mid: '#3B82F6',
          light: '#DBEAFE',
          dim: '#1D4ED8',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#0891B2',
      },
    },
  },
  plugins: [],
}
