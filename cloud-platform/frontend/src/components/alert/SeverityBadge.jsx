'use client'

import { P, SEVERITY_COLOR } from '@/data/theme.data'

export default function SeverityBadge({ severity }) {
  const color = SEVERITY_COLOR[severity] ?? P.green
  const label = severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low'
  return (
    <span style={{
      background: `${color}1a`, color, borderRadius: '9999px',
      border: `1px solid ${color}55`, padding: '3px 12px',
      fontSize: '0.68rem', fontWeight: 700,
    }}>
      ● {label}
    </span>
  )
}