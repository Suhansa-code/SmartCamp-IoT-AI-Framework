import { Waves, AlertTriangle } from 'lucide-react'

const BADGE_STYLES = {
  pregnant: {
    bg: '#F5F3FF',
    text: '#7C3AED',
    icon: Waves,
    label: 'Pregnant',
  },
  chronic: {
    bg: '#FFFBEB',
    text: '#D97706',
    icon: AlertTriangle,
    label: 'Chronic Illness',
  },
}

export default function StatusBadge({ type, className = '' }) {
  const style = BADGE_STYLES[type]
  if (!style) return null
  const Icon = style.icon

  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 ${className}`}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      <Icon className="w-3 h-3" />
      {style.label}
    </span>
  )
}
