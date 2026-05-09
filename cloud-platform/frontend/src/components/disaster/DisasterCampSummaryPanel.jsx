'use client'

import { STATUS_META, statusColor } from './disasterData'

function StatRow({ label, value, tone, theme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${theme.border}1f`, fontSize: 10 }}>
      <span style={{ color: theme.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: tone || theme.t0, fontWeight: 700 }}>{value}</span>
    </div>
  )
}

export function DisasterCampSummaryPanel({ camp, detail, theme, onNavigate }) {
  const occupancy = Math.round((camp.displaced / camp.capacity) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: 10, border: `1px solid ${theme.border}`, borderRadius: 16, background: theme.surface, boxShadow: theme.mode === 'dark' ? '0 14px 22px rgba(0,0,0,0.18)' : '0 10px 18px rgba(19,47,74,0.07)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: theme.t0, lineHeight: 1.1 }}>{camp.name}</div>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: statusColor(camp.status, theme), textTransform: 'uppercase' }}>{STATUS_META[camp.status].label}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 7, marginTop: 8 }}>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 12, padding: 8, background: theme.mode === 'dark' ? '#09131f' : '#f8fbff' }}>
            <div style={{ fontSize: 7, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Displaced</div>
            <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: theme.orange }}>{camp.displaced.toLocaleString()}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 12, padding: 8, background: theme.mode === 'dark' ? '#09131f' : '#f8fbff' }}>
            <div style={{ fontSize: 7, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capacity</div>
            <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: theme.t0 }}>{camp.capacity.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 7, marginTop: 8 }}>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 12, padding: 8 }}>
            <div style={{ fontSize: 7, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Aid</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: theme.green, marginTop: 3 }}>{camp.aid}%</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}20`, borderRadius: 12, padding: 8 }}>
            <div style={{ fontSize: 7, color: theme.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Occupancy</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: theme.orange, marginTop: 3 }}>{occupancy}%</div>
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
          <StatRow label="Nearest river" value={detail.river} tone={theme.cyan} theme={theme} />
          <StatRow label="Station" value={detail.station} tone={theme.t1} theme={theme} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            onClick={onNavigate}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`,
              color: '#07111b',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            View Full Details
          </button>
        </div>
      </div>
    </div>
  )
}