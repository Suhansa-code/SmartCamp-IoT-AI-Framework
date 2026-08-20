import { P } from '@/data/theme.data'

// Compact labeled stat used inside domain panels (Education / Resources / Disaster).
export default function MiniStat({ label, value, icon, color = P.ink, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: '0.9rem', padding: '0.7rem 0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.64rem', fontWeight: 800, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.28rem', fontWeight: 800, color, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.66rem', color: P.muted, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}