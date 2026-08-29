/* ------------------------------------------------------------------
 *  Centralized design tokens — single source of truth.
 *  Tailwind utilities (bg-brand, text-muted, border-line, ...) come
 *  from the `@theme` block in src/index.css. These mirrors are needed
 *  where real color values are required at runtime (SVG / Recharts),
 *  where CSS custom properties cannot be applied.
 * ------------------------------------------------------------------ */

const readVar = (name, fallback) => {
  if (typeof document === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim()
  return value || fallback
}

export const COLORS = {
  ink: readVar('--color-ink', '#15191C'),
  body: readVar('--color-body', '#5B6169'),
  muted: readVar('--color-muted', '#9AA0A6'),
  line: readVar('--color-line', '#E7E8EA'),
  hairline: readVar('--color-hairline', '#F1F2F0'),
  grid: readVar('--color-grid', '#F0F1EF'),
  track: readVar('--color-track', '#EEF0ED'),
  noise: readVar('--color-noise', '#C7CCC8'),
  chip: readVar('--color-chip', '#D4D8D5'),
  brand: readVar('--color-brand', '#059669'),
  brandSoft: readVar('--color-brand-soft', '#ECFDF5'),
  trend: readVar('--color-trend', '#84CC16'),
}

export const SHADOW_CARD = readVar('--shadow-card', '0 8px 24px rgba(15, 23, 20, 0.08)')