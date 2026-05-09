'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCampById, CAMP_DETAIL, STATUS_META, statusColor } from '@/components/disaster/disasterData'

const DARK = {
  mode: 'dark',
  bg: '#03080f',
  surface: '#06101a',
  border: '#0e2030',
  t0: '#e2edf7',
  t1: '#93b7d2',
  t2: '#6790aa',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  cyan: '#22d3ee',
  green: '#4ade80',
}

function InfoCard({ label, value, tone, theme }) {
  return <div style={{ border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, padding: 18, minHeight: 110, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div style={{ fontSize: 11, color: theme.t2, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 28, fontWeight: 800, color: tone || theme.t0, lineHeight: 1.1 }}>{value}</div></div>
}

function Section({ title, children, theme }) {
  return <section style={{ border: `1px solid ${theme.border}`, borderRadius: 22, background: theme.surface, padding: 18 }}><div style={{ fontSize: 11, color: theme.t2, letterSpacing: '0.18em', marginBottom: 14, textTransform: 'uppercase' }}>{title}</div>{children}</section>
}

function Row({ label, value, tone, theme }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: `1px solid ${theme.border}20`, fontSize: 14 }}><span style={{ color: theme.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span><span style={{ color: tone || theme.t0, fontWeight: 700, textAlign: 'right' }}>{value}</span></div>
}

export default function DisasterCampDetailPage() {
  const router = useRouter()
  const params = useParams()
  const campId = Array.isArray(params?.campId) ? params.campId[0] : params?.campId
  const camp = useMemo(() => getCampById(campId), [campId])
  const theme = DARK

  if (!camp) {
    return <div style={{ minHeight: '100vh', background: theme.bg, display: 'grid', placeItems: 'center', color: theme.t0, fontFamily: "'Inter','Segoe UI',sans-serif", padding: 24 }}><div style={{ maxWidth: 560, width: '100%', border: `1px solid ${theme.border}`, borderRadius: 24, padding: 24, background: theme.surface, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Camp not found</div><div style={{ color: theme.t2, lineHeight: 1.7, marginBottom: 18 }}>The selected camp id is not available in the disaster dashboard data set.</div><button onClick={() => router.push('/admin/disaster')} style={{ border: 'none', borderRadius: 999, padding: '12px 18px', background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`, color: '#07111b', fontWeight: 800, cursor: 'pointer' }}>Back to disaster dashboard</button></div></div>
  }

  const detail = CAMP_DETAIL[camp.id]
  const occupancy = Math.round((camp.displaced / camp.capacity) * 100)
  const waterTone = detail.wl > detail.alertL ? theme.red : detail.wl > 0 ? theme.yellow : theme.cyan

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Top Image Banner */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: `linear-gradient(135deg, ${theme.cyan}20, ${theme.green}15)` }}>
        <img src="/disaster/terrain-topography.jpg" alt="Camp location terrain" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(3,8,15,0) 40%, rgba(3,8,15,0.95) 100%)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: theme.t2, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Camp Location Record</div>
          <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900, color: theme.t0, lineHeight: 1.1 }}>{camp.name}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.cyan, letterSpacing: '0.1em' }}>{camp.type} · {camp.code} · {STATUS_META[camp.status].label}</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: 24 }}>
        {/* Top KPI Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Displaced</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.orange }}>{camp.displaced.toLocaleString()}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Capacity</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.t0 }}>{camp.capacity.toLocaleString()}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Occupancy</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.orange }}>{occupancy}%</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Aid Coverage</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.green }}>{camp.aid}%</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Responders</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.cyan }}>{camp.workers}</div>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 18, marginBottom: 24 }}>
          <Section title="Overview" theme={theme}><Row label="Status" value={STATUS_META[camp.status].label} tone={statusColor(camp.status, theme)} theme={theme} /><Row label="Disaster type" value={camp.type} tone={theme.t0} theme={theme} /><Row label="Camp code" value={camp.code} tone={theme.t1} theme={theme} /><Row label="Location" value={`${camp.lat.toFixed(2)}°N, ${camp.lng.toFixed(2)}°E`} tone={theme.t0} theme={theme} /></Section>
          <Section title="Water network" theme={theme}><Row label="Water path" value={detail.waterPath} tone={theme.cyan} theme={theme} /><Row label="River" value={detail.river} tone={theme.cyan} theme={theme} /><Row label="Station" value={detail.station} tone={theme.t1} theme={theme} /><Row label="Distance to station" value={`${(detail.stDist / 1000).toFixed(2)} km`} tone={theme.t0} theme={theme} /></Section>
          <Section title="Alert profile" theme={theme}><Row label="Current level" value={`${detail.wl} m`} tone={waterTone} theme={theme} /><Row label="Rainfall" value={`${detail.rain} mm`} tone={detail.rain > 10 ? theme.orange : theme.t0} theme={theme} /><Row label="Alert level" value={`${detail.alertL} m`} tone={theme.yellow} theme={theme} /><Row label="Major flood" value={`${detail.majorL} m`} tone={theme.red} theme={theme} /></Section>
        </div>

        {/* Hydrology & Weather Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, marginBottom: 24 }}>
          <Section title="Hydrology details" theme={theme}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}><InfoCard label="Gauge location" value={`${detail.gauLat.toFixed(4)}°N`} tone={theme.cyan} theme={theme} /><InfoCard label="Gauge longitude" value={`${detail.gauLng.toFixed(4)}°E`} tone={theme.cyan} theme={theme} /><InfoCard label="Upstream distance" value={`${detail.upDist.toFixed(0)} m`} tone={theme.t0} theme={theme} /><InfoCard label="Minor flood" value={`${detail.minorL} m`} tone={theme.orange} theme={theme} /></div></Section>
          <Section title="Weather snapshot" theme={theme}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}><InfoCard label="Min temp" value={`${detail.minT}°C`} tone={theme.t0} theme={theme} /><InfoCard label="Max temp" value={`${detail.maxT}°C`} tone={theme.t0} theme={theme} /><InfoCard label="Humidity" value={`${detail.hum}%`} tone={theme.cyan} theme={theme} /><InfoCard label="Pressure" value={`${detail.pres} hPa`} tone={theme.t0} theme={theme} /></div></Section>
        </div>

        {/* Operational Summary */}
        <Section title="Operational summary" theme={theme}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}><InfoCard label="Precipitation 24h" value={`${detail.precip.toFixed(1)} mm`} tone={theme.orange} theme={theme} /><InfoCard label="Hourly peak" value={`${detail.maxHrPrec} mm`} tone={theme.yellow} theme={theme} /><InfoCard label="Max wind" value={`${detail.maxWind} km/h`} tone={theme.t0} theme={theme} /><InfoCard label="Cloud cover" value={`${detail.cloud}%`} tone={theme.t1} theme={theme} /></div></Section>

        {/* Back Button */}
        <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => router.push('/admin/disaster')} style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.t1, borderRadius: 8, padding: '12px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Back to Overview</button>
        </div>
      </div>
    </div>
  )
}
