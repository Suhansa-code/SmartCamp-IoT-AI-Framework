import { COLORS } from '../../../lib/tokens'

export default function InfoField({ label, icon: Icon, editing, value, children }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: COLORS.grid }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: COLORS.muted }}>
        {Icon && <Icon className="w-3 h-3" />}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      {editing ? children : <p className="text-[13px] font-medium" style={{ color: COLORS.ink }}>{value || '—'}</p>}
    </div>
  )
}
