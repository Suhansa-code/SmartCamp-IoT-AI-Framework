import { useTheme } from '@/components/common/ThemeProvider'

// Large KPI card — value, icon chip, delta, sparkline and progress bar (alert-page styling).
export default function KpiCard({ label, value, icon, color, delta, pct = 100, spark }) {
  const { T } = useTheme()
  const accent = color || T.teal
  const max = spark?.length ? Math.max(...spark, 1) : 1
  const line = spark?.map((v, i) => `${i},${28 - (v / max) * 24 - 2}`).join(' ')

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: '1.25rem',
        padding: '1.05rem 1.15rem',
      }}
    >
      <div style={{ position: 'absolute', top: -26, right: -26, width: 96, height: 96, borderRadius: '50%', background: `${accent}24`, filter: 'blur(28px)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `${accent}1f`, border: `1px solid ${accent}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: T.textPrimary, lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</span>
        {delta && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted }}>{delta}</span>}
      </div>
      {spark && spark.length > 1 && (
        <svg width="100%" height={28} viewBox={`0 0 ${spark.length - 1} 28`} preserveAspectRatio="none" style={{ marginTop: 12, display: 'block' }}>
          <polygon points={`0,28 ${line} ${spark.length - 1},28`} fill={accent} opacity={0.08} />
          <polyline points={line} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
        </svg>
      )}
      <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: T.bar, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${accent}88, ${accent})`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}