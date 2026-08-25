import { motion } from 'framer-motion'
import { COLORS } from '../../../lib/tokens'

/* ------------------------------------------------------------------ */
/*  SEMANTIC COLOUR MAP — same tones used across the app               */
/* ------------------------------------------------------------------ */

const TONE = {
  brand:   { color: COLORS.brand, bg: `${COLORS.brand}14` },
  warning: { color: '#D97706',    bg: '#FFFBEB' },
  danger:  { color: '#DC2626',    bg: '#FEF2F2' },
  info:    { color: '#0284C7',    bg: '#F0F9FF' },
  violet:  { color: '#7C3AED',    bg: '#F5F3FF' },
  neutral: { color: COLORS.body,  bg: '#F5F6F5' },
}

// Back-compat aliases for old `color` prop values used across call sites
const LEGACY_ALIAS = {
  teal: 'brand', emerald: 'brand',
  red: 'danger', rose: 'danger',
  blue: 'info', sky: 'info',
  amber: 'warning', orange: 'warning',
  indigo: 'violet', purple: 'violet',
  gray: 'neutral', slate: 'neutral',
}

export default function StatCard({ label, value, icon: Icon, hint, accent }) {
  return (
    <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10.5px] uppercase tracking-[0.08em] font-mono" style={{ color: COLORS.muted }}>
          {label}
        </span>
        <div className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ borderColor: COLORS.line }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accent || COLORS.brand }} strokeWidth={1.7} />
        </div>
      </div>
      <p className="font-serif font-medium text-[24px] sm:text-[28px] leading-none tracking-tight" style={{ color: COLORS.ink }}>
        {value}
      </p>
      {hint && <p className="text-[11px] font-mono mt-2" style={{ color: COLORS.muted }}>{hint}</p>}
    </div>
  );
}