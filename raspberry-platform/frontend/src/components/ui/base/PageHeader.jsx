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
        <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight mt-1.5">
          {title}
        </h1>
        {children && (
          <p className="flex items-center gap-1.5 text-[12.5px] mt-2" style={{ color: COLORS.muted }}>
            {children}
          </p>
        )}
      </div>
    </div>
  )
}