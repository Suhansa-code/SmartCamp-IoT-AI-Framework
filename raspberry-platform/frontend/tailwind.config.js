/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Libre Baskerville', 'ui-serif', 'Georgia', 'serif'],
        mono: ['Space Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#15191C',
        body: '#5B6169',
        muted: '#9AA0A6',
        line: '#E7E8EA',
        hairline: '#F1F2F0',
        grid: '#F0F1EF',
        track: '#EEF0ED',
        noise: '#C7CCC8',
        chip: '#D4D8D5',
        brand: '#059669',
        'brand-soft': '#ECFDF5',
        trend: '#B45309',
      },
      boxShadow: {
        card: '0 8px 24px rgba(15, 23, 20, 0.08)',
      },
    },
  },
  plugins: [],
};
