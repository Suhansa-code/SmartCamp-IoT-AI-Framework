'use client'

import { Droplets, MapPin } from 'lucide-react'
import { STATUS_META, STATUS_COLOR } from '@/data/disaster.data'
import Button from '@/components/common/Button'
import { useTheme } from '@/components/common/ThemeProvider'

function StatCard({ label, value, accent, gradient, T }) {
  return (
    <div style={{ padding: '0.75rem 0.85rem', borderRadius: 14, background: gradient, border: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.6 }} />
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: accent, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

export function DisasterCampSummaryPanel({ camp, detail }) {
  const { T } = useTheme()
  const occupancy = Math.round((camp.displaced / camp.capacity) * 100)
  const color = STATUS_COLOR[camp.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: T.ink, lineHeight: 1.15 }}>{camp.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.66rem', fontWeight: 800, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {STATUS_META[camp.status]?.label}
          </span>
          <span style={{ fontSize: '0.62rem', color: T.muted, letterSpacing: '0.08em' }}>{camp.code} · {camp.type}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.55rem' }}>
        <StatCard label="Displaced" value={camp.displaced.toLocaleString()} accent="#0F172A"  T={T} />
        <StatCard label="Capacity" value={camp.capacity.toLocaleString()} accent="#0F172A"  T={T} />
        <StatCard label="Aid" value={`${camp.aid}%`} accent="#0F172A"   T={T} />
        <StatCard label="Occupancy" value={`${occupancy}%`} accent="#0F172A"   T={T} />
      </div>

      <div style={{ display: 'grid', gap: 5 }}>
        {[
          { label: 'Nearest river', value: detail?.river || '—', color: T.teal },
          { label: 'Station', value: detail?.station || '—', color: T.inkSoft },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: `1px solid ${T.border}`, fontSize: '0.72rem' }}>
            <span style={{ color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>{row.label}</span>
            <span style={{ color: row.color, fontWeight: 800 }}>{row.value}</span>
          </div>
        ))}
      </div>

      <Button href={`/disaster/${camp.id}`} icon={<MapPin size={15} />}>
        View Full Details
      </Button>
    </div>
  )
}
