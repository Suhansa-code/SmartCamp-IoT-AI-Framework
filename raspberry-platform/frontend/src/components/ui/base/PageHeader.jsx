import { COLORS } from '../../../lib/tokens'

export default function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        {subtitle && (
          <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: COLORS.muted }}>
            {subtitle}
          </p>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.brandSoft }}>
              <Icon className="w-4.5 h-4.5" style={{ color: COLORS.brand }} strokeWidth={1.5} />
            </div>
          )}
          <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight tracking-tight">
            {title}
          </h1>
        </div>
        {children && (
          <p className="flex items-center gap-1.5 text-[12px] mt-1.5" style={{ color: COLORS.muted }}>
            {children}
          </p>
        )}
      </div>
    </div>
  )
}
