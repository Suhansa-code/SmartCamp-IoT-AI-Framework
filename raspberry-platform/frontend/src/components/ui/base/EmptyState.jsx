import { COLORS } from '../../../lib/tokens'

export default function EmptyState({ icon: Icon, message, className = '' }) {
  if (Icon) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: COLORS.subtle }} />
        <p className="text-[13px]" style={{ color: COLORS.muted }}>{message}</p>
      </div>
    )
  }
  return (
    <p className={`text-[13px] text-center py-8 ${className}`} style={{ color: COLORS.muted }}>{message}</p>
  )
}
