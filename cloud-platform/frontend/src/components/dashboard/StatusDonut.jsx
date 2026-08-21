import { useTheme } from '@/components/common/ThemeProvider'

// Conic-gradient donut (alert-page style) with a centered readout.
// segments: [{ color, value }] — proportions are derived from values.
export default function StatusDonut({ segments, size = 190, center, label }) {
  const { T } = useTheme()
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1
  let acc = 0
  const stops = segments
    .map((s) => {
      if (!s.value) return null
      const from = (acc / total) * 360
      acc += s.value
      const to = (acc / total) * 360
      return `${s.color} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`
    })
    .filter(Boolean)
    .join(', ')

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(${stops || `${T.border} 0deg 360deg`})` }} />
      <div
        style={{
          position: 'absolute',
          inset: '16%',
          borderRadius: '50%',
          background: T.card,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(20,23,26,0.06)',
        }}
      >
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: T.textPrimary }}>{center}</span>
        {label && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>}
      </div>
    </div>
  )
}