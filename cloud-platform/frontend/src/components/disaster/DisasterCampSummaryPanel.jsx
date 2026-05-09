'use client'

import { STATUS_META, statusColor } from './disasterData'

function StatRow({ label, value, tone, theme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${theme.border}1f`, fontSize: 12 }}>
      <span style={{ color: theme.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: tone || theme.t0, fontWeight: 700 }}>{value}</span>
    </div>
  )
}

export function DisasterCampSummaryPanel({ camp, detail, theme, onNavigate }) {
  const occupancy = Math.round((camp.displaced / camp.capacity) * 100)
  const waterTone = detail.wl > detail.alertL ? theme.red : detail.wl > 0 ? theme.yellow : theme.cyan

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: 16, border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.surface, boxShadow: theme.mode === 'dark' ? '0 18px 30px rgba(0,0,0,0.25)' : '0 10px 24px rgba(19,47,74,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.t0, lineHeight: 1.2 }}>{camp.name}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{camp.type} · {camp.code}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: statusColor(camp.status, theme) }}>{STATUS_META[camp.status].label}</span>
            <span style={{ fontSize: 11, color: theme.t2 }}>{camp.workers} responders</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 14, padding: 12, background: theme.mode === 'dark' ? '#09131f' : '#f8fbff' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: theme.t2, textTransform: 'uppercase' }}>Displaced</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: theme.orange }}>{camp.displaced.toLocaleString()}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 14, padding: 12, background: theme.mode === 'dark' ? '#09131f' : '#f8fbff' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: theme.t2, textTransform: 'uppercase' }}>Capacity</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: theme.t0 }}>{camp.capacity.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 10, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Aid</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.green, marginTop: 5 }}>{camp.aid}%</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 10, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Occupancy</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.orange, marginTop: 5 }}>{occupancy}%</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 10, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Water</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: waterTone, marginTop: 5 }}>{detail.wl} m</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <StatRow label="Nearest river" value={detail.river} tone={theme.cyan} theme={theme} />
          <StatRow label="Station" value={detail.station} tone={theme.t1} theme={theme} />
          <StatRow label="Rainfall" value={`${detail.rain} mm`} tone={detail.rain > 10 ? theme.orange : theme.t1} theme={theme} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            onClick={onNavigate}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`,
              color: '#07111b',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            View Full Details
          </button>
        </div>
      </div>

      <div style={{ padding: 14, border: `1px solid ${theme.border}`, borderRadius: 18, background: theme.mode === 'dark' ? '#07111b' : '#f7fbff' }}>
        <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Quick context</div>
        <div style={{ color: theme.t1, fontSize: 12, lineHeight: 1.6 }}>
          The detail page carries the full operational record, while this overview keeps only the most important signals for fast triage.
        </div>
      </div>
    </div>
  )
}
