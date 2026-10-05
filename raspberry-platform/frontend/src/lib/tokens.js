/* ------------------------------------------------------------------
 *  Centralized design tokens — single source of truth.
 *  Tailwind utilities come from the @theme block in src/index.css.
 *  These mirrors are needed where real color values are required at
 *  runtime (SVG / Recharts) where CSS custom properties cannot be used.
 * ------------------------------------------------------------------ */

const readVar = (name, fallback) => {
  if (typeof document === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim()
  return value || fallback
}

export const COLORS = {
  ink:       readVar('--color-ink', '#111827'),
  body:      readVar('--color-body', '#4B5563'),
  muted:     readVar('--color-muted', '#9CA3AF'),
  subtle:    readVar('--color-subtle', '#D1D5DB'),
  line:      readVar('--color-line', '#E5E7EB'),
  hairline:  readVar('--color-hairline', '#F3F4F6'),
  grid:      readVar('--color-grid', '#F9FAFB'),
  surface:   readVar('--color-surface', '#FFFFFF'),
  background: readVar('--color-background', '#F9FAFB'),
  brand:     readVar('--color-brand', '#059669'),
  brandHover: readVar('--color-brand-hover', '#047857'),
  brandSoft: readVar('--color-brand-soft', '#ECFDF5'),
  brandMuted: readVar('--color-brand-muted', '#D1FAE5'),
  trend:     readVar('--color-trend', '#84CC16'),
  danger:    readVar('--color-danger', '#DC2626'),
  dangerSoft: readVar('--color-danger-soft', '#FEF2F2'),
  warning:   readVar('--color-warning', '#D97706'),
  warningSoft: readVar('--color-warning-soft', '#FFFBEB'),
  info:      readVar('--color-info', '#2563EB'),
  infoSoft:  readVar('--color-info-soft', '#EFF6FF'),
}

/* Semantic tone map — used for status indicators, badges, alerts */
export const TONE = {
  brand:   { color: COLORS.brand,    bg: COLORS.brandSoft,    border: COLORS.brandMuted },
  warning: { color: COLORS.warning,  bg: COLORS.warningSoft,  border: '#FDE68A' },
  danger:  { color: COLORS.danger,   bg: COLORS.dangerSoft,   border: '#FECACA' },
  info:    { color: COLORS.info,     bg: COLORS.infoSoft,     border: '#BFDBFE' },
  violet:  { color: '#7C3AED',       bg: '#F5F3FF',           border: '#DDD6FE' },
  neutral: { color: COLORS.body,     bg: COLORS.grid,         border: COLORS.line },
}

export const SHADOW_CARD = 'none'
