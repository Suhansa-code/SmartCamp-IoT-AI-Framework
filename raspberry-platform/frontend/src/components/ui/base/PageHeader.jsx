import { COLORS } from '../../../lib/tokens'

export default function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        {subtitle && (
          <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>
            {subtitle}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {Icon && (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 border" style={{ backgroundColor: `${COLORS.brand}14`, borderColor: `${COLORS.brand}33` }}>
              <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" style={{ color: COLORS.brand }} strokeWidth={1.7} />
            </div>
          )}
          <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight">
            {title}
          </h1>
        </div>
        {children && (
          <p className="flex items-center gap-1.5 text-[12.5px] mt-2" style={{ color: COLORS.muted }}>
            {children}
          </p>
        )}
      </div>
    </div>
  )
}