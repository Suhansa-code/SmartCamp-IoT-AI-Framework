// Alert severity badge with pulse animation for high-severity

import { SEVERITY_STYLES } from '@/data/theme.data'

export default function AlertBadge({ severity = 'medium' }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${severity === 'high' ? 'pulse-alert' : ''}`}
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}
