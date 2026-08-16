import { Waves, AlertTriangle } from 'lucide-react'

const BADGE_STYLES = {
  pregnant: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-100',
    icon: Waves,
    label: 'Pregnant',
  },
  chronic: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
    icon: AlertTriangle,
    label: 'Chronic Illness',
  },
}

export default function StatusBadge({ type, className = '' }) {
  const style = BADGE_STYLES[type]
  if (!style) return null
  const Icon = style.icon

  return (
    <span className={`${style.bg} ${style.text} text-xs font-medium px-2.5 py-1 rounded-md border ${style.border} inline-flex items-center gap-1.5 ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {style.label}
    </span>
  )
}
