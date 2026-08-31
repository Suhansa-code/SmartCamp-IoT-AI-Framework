import { COLORS } from '../../../lib/tokens'

export default function SectionHeader({ icon: Icon, title, subtitle, color = 'brand' }) {
  const colors = {
    brand:   { bg: COLORS.brandSoft, text: COLORS.brand },
    info:    { bg: COLORS.infoSoft, text: COLORS.info },
    warning: { bg: COLORS.warningSoft, text: COLORS.warning },
    danger:  { bg: COLORS.dangerSoft, text: COLORS.danger },
    violet:  { bg: '#F5F3FF', text: '#7C3AED' },
  }[color] || { bg: COLORS.brandSoft, text: COLORS.brand }

  return (
    <div className="flex items-center gap-2.5 mb-4">
      {Icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.bg }}>
          <Icon className="w-4 h-4" style={{ color: colors.text }} strokeWidth={1.5} />
        </div>
      )}
      <div>
        <h2 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>{title}</h2>
        {subtitle && <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>{subtitle}</p>}
      </div>
    </div>
  )
}
