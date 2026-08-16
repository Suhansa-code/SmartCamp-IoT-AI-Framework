import { motion } from 'framer-motion'
import { COLORS } from '../../lib/tokens'

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

export default function StatCard({ label, value, icon: Icon, unit, color = 'brand', delay = 0 }) {
  const key = TONE[color] ? color : LEGACY_ALIAS[color] || 'brand'
  const t = TONE[key]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-xl border bg-white p-4 sm:p-5 relative overflow-hidden group hover:shadow-[0_4px_12px_rgba(15,23,20,0.06)] transition-shadow duration-300"
      style={{ borderColor: COLORS.line }}
    >
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"
        style={{ backgroundColor: t.bg }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color: t.color }} strokeWidth={1.8} />}
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[22px] sm:text-[24px] font-semibold font-mono tracking-tight" style={{ color: COLORS.ink }}>{value ?? '—'}</span>
          {unit && <span className="text-[12.5px]" style={{ color: COLORS.muted }}>{unit}</span>}
        </div>
      </div>
    </motion.div>
  )
}