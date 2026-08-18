import { P } from '@/data/theme.data'

// Labeled progress bar — used for resource distribution and camp status shares.
export default function ProgressBar({ icon, label, value, pct, tone = P.teal }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.78rem', fontWeight: 700, color: P.inkSoft, minWidth: 0 }}>
          {icon && <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </span>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: tone, whiteSpace: 'nowrap' }}>{value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: P.cardSoft, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${tone}88, ${tone})`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}