// Alert severity badge with pulse animation for high-severity

const SEVERITY_STYLES = {
  high:   { bg: '#FEE2E2', text: '#DC2626', label: '🔴 High · ඉහළ' },
  medium: { bg: '#FEF3C7', text: '#D97706', label: '🟡 Medium · මධ්‍යම' },
  low:    { bg: '#DCFCE7', text: '#16A34A', label: '🟢 Low · පහළ' },
}

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
