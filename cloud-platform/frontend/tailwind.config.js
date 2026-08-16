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
    extend: {},
  },
  plugins: [],
}