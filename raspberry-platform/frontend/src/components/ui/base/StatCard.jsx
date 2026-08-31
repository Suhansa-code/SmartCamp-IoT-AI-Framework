import { COLORS, TONE } from '../../../lib/tokens'

const LEGACY_ALIAS = {
  teal: 'brand', emerald: 'brand',
  red: 'danger', rose: 'danger',
  blue: 'info', sky: 'info',
  amber: 'warning', orange: 'warning',
  indigo: 'violet', purple: 'violet',
  gray: 'neutral', slate: 'neutral',
}

export default function StatCard({ label, value, icon: Icon, hint, accent }) {
  const toneKey = LEGACY_ALIAS[accent] || accent
  const tone = TONE[toneKey] || TONE.brand

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>
          {label}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: tone.bg }}>
            <Icon className="w-3.5 h-3.5" style={{ color: tone.color }} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <p className="text-[22px] sm:text-[26px] font-semibold leading-none tracking-tight" style={{ color: COLORS.ink }}>
        {value}
      </p>
      {hint && <p className="text-[11px] mt-1.5" style={{ color: COLORS.muted }}>{hint}</p>}
    </div>
  )
}
