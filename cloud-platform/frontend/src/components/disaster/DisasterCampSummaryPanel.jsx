'use client'

import { Droplets, MapPin } from 'lucide-react'
import { STATUS_META } from './disasterData'
import Button from '@/components/common/Button'
import { P } from '@/components/alert/alertPalette'

const STATUS_COLOR = { critical: P.red, high: '#F97316', medium: P.amber, stable: P.teal, recovery: P.green }

function Mini({ label, value, color, icon }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: '0.9rem', padding: '0.6rem 0.75rem' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  )
}

export function DisasterCampSummaryPanel({ camp, detail }) {
  const occupancy = Math.round((camp.displaced / camp.capacity) * 100)
  const color = STATUS_COLOR[camp.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: P.ink, lineHeight: 1.15 }}>{camp.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.66rem', fontWeight: 800, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {STATUS_META[camp.status]?.label}
          </span>
          <span style={{ fontSize: '0.62rem', color: P.muted, letterSpacing: '0.08em' }}>{camp.code} · {camp.type}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.55rem' }}>
        <Mini label="Displaced" value={camp.displaced.toLocaleString()} color="#F97316" icon={<Droplets size={11} />} />
        <Mini label="Capacity" value={camp.capacity.toLocaleString()} color={P.ink} icon={<MapPin size={11} />} />
        <Mini label="Aid" value={`${camp.aid}%`} color={P.green} icon={<Droplets size={11} />} />
        <Mini label="Occupancy" value={`${occupancy}%`} color={P.amber} icon={<MapPin size={11} />} />
      </div>

      <div style={{ display: 'grid', gap: 5 }}>
        {[
          { label: 'Nearest river', value: detail?.river || '—', color: P.teal },
          { label: 'Station', value: detail?.station || '—', color: P.inkSoft },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: `1px solid ${P.border}`, fontSize: '0.72rem' }}>
            <span style={{ color: P.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>{row.label}</span>
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