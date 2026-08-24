'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Radio, Activity, Gauge, Layers, Zap, Server, Terminal, CheckCircle2, ShieldCheck } from 'lucide-react'
import SideNav from '@/components/common/SideNav'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import KpiCard from '@/components/dashboard/KpiCard'
import DashboardCard from '@/components/dashboard/DashboardCard'
import StatusDonut from '@/components/dashboard/StatusDonut'
import { useTheme } from '@/components/common/ThemeProvider'
import { BLUE, STATE_COLOR, PRIO_COLOR, STATUS_COLOR, QOS_MATRIX } from '@/data/network.data'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

function valColor(T, v, warn, crit, invert = false) {
  if (invert ? v < warn : v > crit) return T.red
  if (invert ? v > warn * 1.5 : v > warn * 1.5) return T.amber
  return T.green
}

const fmt = (v, d = 1) => (v == null ? '—' : (typeof v === 'number' ? v.toFixed(v > 99 ? 0 : d) : v))

async function fetchNetworkMetrics() {
  const res = await fetch(`${API_BASE}/api/network/metrics`)
  if (!res.ok) return null
  return res.json()
}

// ── shared bits ───────────────────────────────────────────────────────────────

function Chip({ children, color = '#64748B', style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
      background: `${color}1a`, border: `1px solid ${color}44`, color, whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </span>
  )
}

function LogRow({ msg, T }) {
  const status = msg.status || 'sent'
  const sc = STATUS_COLOR[status] || T.muted
  const pc = PRIO_COLOR[msg.priority] || T.muted
  const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')
  const statusLabel = { sent: `QoS ${msg.qos_assigned || msg.qos}`, buffered: 'BUFFERED', dropped: 'DROPPED', delayed: 'DELAYED' }[status] || String(status).toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc, boxShadow: `0 0 5px ${sc}`, flexShrink: 0 }} />
      <div style={{ flex: '1 1 120px', minWidth: 100 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: T.ink, textTransform: 'capitalize' }}>{msg.source || msg.source_type || '—'}</div>
        <div style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600, textTransform: 'capitalize' }}>{(msg.action || '').replace(/_/g, ' ')}</div>
      </div>
      <span style={{ flex: '2 1 140px', minWidth: 120, fontFamily: 'monospace', fontSize: '0.68rem', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={msg.topic}>{msg.topic || '—'}</span>
      <Chip color={pc}>{String(msg.priority || '').slice(0, 4)}</Chip>
      <Chip color={sc}>{statusLabel}</Chip>
      <span style={{ fontSize: '0.66rem', color: T.muted, fontFamily: 'monospace', flexShrink: 0 }}>{timeStr}</span>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { T } = useTheme()
  const [connected, setConnected] = useState(false)
  const [networkState, setNetworkState] = useState('GOOD')
  const [metrics, setMetrics] = useState(null)
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({})
  const [buffer, setBuffer] = useState([])
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const updateData = useCallback(async () => {
    try {
      const data = await fetchNetworkMetrics()
      if (data) {
        setMetrics(data.metrics)
        setNetworkState(data.network_state?.network_state || 'GOOD')
        setConnected(data.connected ?? false)
        setStats(data.stats || {})
        setMessages(data.messages || [])
        setBuffer(data.buffer || [])
        setHistory(data.history || [])
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await updateData()
    setRefreshing(false)
  }, [updateData])

  useEffect(() => {
    updateData()
    const interval = setInterval(updateData, 5000)
    return () => clearInterval(interval)
  }, [updateData])

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m) =>
      `${m.source || m.source_type || ''}`.toLowerCase().includes(q)
      || `${m.action || ''}`.toLowerCase().includes(q)
      || `${m.topic || ''}`.toLowerCase().includes(q)
      || `${m.priority || ''}`.toLowerCase().includes(q)
      || `${m.status || ''}`.toLowerCase().includes(q),
    )
  }, [messages, search])

  const m = metrics || {}
  const stateColor = STATE_COLOR[networkState] || T.green
  const bridgeAlive = m.bridge_alive

  const s = stats || {}
  const totalCrit = (s.critical_sent || 0) + (s.critical_buffered || 0)
  const deliveryRate = totalCrit > 0 ? ((s.critical_sent / totalCrit) * 100).toFixed(1) : '100.0'
  const drColor = +deliveryRate < 70 ? T.red : +deliveryRate < 95 ? T.amber : T.green

  const delivered = s.total_sent || 0
  const buffered = s.total_buffered || 0
  const dropped = s.total_dropped || 0

  const sparkFor = (key) => history.map((h) => h[key] ?? 0)
  const lastTwo = history.slice(-2)
  const trendFor = (key) => {
    if (lastTwo.length !== 2) return null
    const t = lastTwo[1][key] - lastTwo[0][key]
    return typeof t === 'number' && !Number.isNaN(t) ? t : null
  }
  const trendLabel = (key, invert = false) => {
    const t = trendFor(key)
    if (t == null) return undefined
    const good = invert ? t > 0 : t < 0
    return `${t > 0 ? '▲' : '▼'} ${Math.abs(t).toFixed(1)} · ${good ? 'good' : 'watch'}`
  }

  const kpis = [
    { label: 'RTT Average',  value: fmt(m.rtt_avg),  unit: 'ms',    color: valColor(T, m.rtt_avg || 0, 100, 300),  icon: <Activity size={16} />, spark: sparkFor('rtt_avg'),     delta: trendLabel('rtt_avg') },
    { label: 'Packet Loss',  value: fmt(m.packet_loss), unit: '%', color: valColor(T, m.packet_loss || 0, 5, 20),  icon: <Gauge size={16} />,     spark: sparkFor('packet_loss'), delta: trendLabel('packet_loss') },
    { label: 'Queue Depth',  value: fmt(m.queue_depth, 0), unit: 'msgs', color: valColor(T, m.queue_depth || 0, 10, 50), icon: <Layers size={16} />, spark: sparkFor('queue_depth'), delta: trendLabel('queue_depth') },
    { label: 'Throughput',   value: fmt(m.throughput), unit: 'msg/s', color: valColor(T, m.throughput || 0, 5, 12, true), icon: <Zap size={16} />, spark: sparkFor('throughput'),  delta: trendLabel('throughput', true) },
  ]

  const stateIndex = ['GOOD', 'WEAK', 'POOR', 'OFFLINE'].indexOf(networkState)

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 9999px; }
        @keyframes netPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .net-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .net-hero { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; }
        .net-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 1150px) { .net-hero, .net-two { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .net-kpi { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .net-donut-wrap { display: none !important; } }
        @media (max-width: 560px) { .net-kpi { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ minHeight: '100svh', background: T.outer, fontFamily: "'Inter',sans-serif", color: T.ink, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
        <SideNav />

        <div className='header-wrapper'>

          <main style={{ background: T.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <HeaderShell>
              <PageHeader
                title="SAAMP Network Monitor"
                subtitle={
                  connected
                    ? `Predictive MQTT link quality · Random Forest · 19 features · 60s ahead`
                    : `Awaiting cloud backend on port ${API_BASE.replace('http://localhost:', '')}…`
                }
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: 'Filter log by source, action, topic…',
                  onRefresh: refresh,
                  refreshing,
                }}
              />
            </HeaderShell>

            <div style={{ padding: '0rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── KPI row ────────────────────────────────────────────── */}
              <div className="net-kpi">
                {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
              </div>

              {/* ── Hero — Live Link Quality with embedded delivery donut ── */}
              <div className="net-hero">
                {/* left copy panel */}
                <div style={{ position: 'relative', overflow: 'hidden', background: T.panelSoft, borderRadius: '1.5rem', padding: 'clamp(1.25rem, 3vw, 2.25rem)', minHeight: 250, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', width: 'fit-content', background: T.card, borderRadius: 999, padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                    <Radio size={13} color={T.teal} /> Live Link Quality
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: 'clamp(2rem, 3vw, 2.6rem)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: stateColor }}>
                      {networkState}
                    </h2>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: stateColor, boxShadow: `0 0 14px ${stateColor}`, animation: 'netPulse 2s infinite' }} />
                  </div>

                  <p style={{ fontSize: '0.8rem', color: T.muted, fontWeight: 600, margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
                    Predicted 60s ahead by a Random Forest over 19 live link features.
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: 300 }}>
                    <Chip color={T.green}>✓ {delivered} sent</Chip>
                    <Chip color={T.amber}>⟳ {buffered} buffered</Chip>
                    <Chip color={T.red}>✕ {dropped} dropped</Chip>
                  </div>

                  {/* embedded delivery donut */}
                  <div className="net-donut-wrap" style={{ position: 'absolute', right: 'clamp(0.5rem, 3vw, 2.5rem)', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StatusDonut
                      segments={[
                        { color: T.green, value: delivered },
                        { color: T.amber, value: buffered },
                        { color: T.red, value: dropped },
                      ]}
                      size={190}
                      center={`${deliveryRate}%`}
                      label="Delivered"
                    />
                  </div>
                </div>

                {/* right widget stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div style={{ background: '#0F172A', color: '#fff', borderRadius: '1.25rem', padding: '1.1rem 1.25rem', boxShadow: '0 30px 70px rgba(20,30,40,0.25)' }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      ML Prediction · 60s ahead
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span style={{ fontSize: '1.9rem', fontWeight: 800, color: stateColor, letterSpacing: '-0.02em' }}>{networkState}</span>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: stateColor, boxShadow: `0 0 12px ${stateColor}`, animation: 'netPulse 2s infinite' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                      <span style={{ background: '#D8F24E', color: '#0F172A', borderRadius: 999, padding: '3px 11px', fontSize: '0.62rem', fontWeight: 800 }}><Zap size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Pi 5</span>
                      <span style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, padding: '3px 11px', fontSize: '0.62rem', fontWeight: 800 }}>19 features</span>
                      <span style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, padding: '3px 11px', fontSize: '0.62rem', fontWeight: 800 }}>&lt;5ms</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.95rem', borderRadius: 12, background: bridgeAlive ? `${T.green}14` : `${T.red}14`, border: `1px solid ${bridgeAlive ? `${T.green}44` : `${T.red}44`}` }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Server size={15} color={bridgeAlive ? T.green : T.red} /> Cloud Bridge
                    </span>
                    <Chip color={bridgeAlive ? T.green : T.red}>{bridgeAlive ? 'CONNECTED' : 'OFFLINE'} · {m.clients || 0} clients</Chip>
                  </div>
                </div>
              </div>

              {/* ── QoS matrix + delivery stats ───────────────────────── */}
              <div className="net-two">
                <DashboardCard
                  title="QoS Decision Matrix"
                  subtitle="Priority handling per predicted link state"
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '82px repeat(4, 1fr)', gap: 6 }}>
                    <div />
                    {['GOOD', 'WEAK', 'POOR', 'OFF'].map((h) => (
                      <div key={h} style={{
                        textAlign: 'center', padding: '0.45rem 0', borderRadius: 8,
                        background: T.cardSoft, border: `1px solid ${T.border}`,
                        fontSize: '0.62rem', fontWeight: 800, color: T.muted, letterSpacing: '0.06em',
                      }}>{h}</div>
                    ))}
                    {Object.entries(QOS_MATRIX).map(([priority, cells]) => (
                      <div key={priority} style={{ display: 'contents' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: PRIO_COLOR[priority], display: 'flex', alignItems: 'center' }}>{priority}</div>
                        {cells.map((cell, ci) => {
                          const isActive = stateIndex === ci
                          const cellColor = cell === 'Buffer' ? T.amber : cell === 'Drop' ? T.red : T.green
                          return (
                            <div key={ci} style={{
                              textAlign: 'center', padding: '0.5rem 0', borderRadius: 8,
                              fontSize: '0.68rem', fontWeight: isActive ? 800 : 600, color: cellColor,
                              background: isActive ? `${cellColor}22` : T.cardSoft,
                              border: isActive ? `2px solid ${cellColor}` : `1px solid ${T.border}`,
                              opacity: isActive ? 1 : 0.6,
                            }}>
                              {cell}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem' }}>
                    Buffer flush order on reconnect
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: '1st — CRITICAL',  color: T.red },
                      { label: '2nd — IMPORTANT', color: T.amber },
                      { label: '3rd — ROUTINE',   color: BLUE },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.76rem', fontWeight: 700, color: T.ink }}>
                        <span style={{ width: 26, height: 6, borderRadius: 99, background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
                        {row.label}
                      </div>
                    ))}
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="Delivery Statistics"
                  subtitle="Session totals · target ≥ 95% critical delivery"
                  right={<Chip color={drColor}>{+deliveryRate >= 95 ? 'ON TARGET' : 'BELOW TARGET'}</Chip>}
                >
                  <div>
                    {[
                      { label: 'Total Sent',        value: s.total_sent || 0,        color: T.green },
                      { label: 'Total Buffered',    value: s.total_buffered || 0,    color: T.amber },
                      { label: 'Total Dropped',     value: s.total_dropped || 0,     color: T.red },
                      { label: 'Critical Sent',     value: s.critical_sent || 0,     color: T.green },
                      { label: 'Critical Buffered', value: s.critical_buffered || 0, color: T.amber },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: `1px solid ${T.border}`, fontSize: '0.82rem' }}>
                        <span style={{ color: T.muted, fontWeight: 600 }}>{row.label}</span>
                        <span style={{ color: row.color, fontWeight: 800 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </DashboardCard>
              </div>

              {/* ── Live log + priority buffer ────────────────────────── */}
              <div className="net-two">
                <DashboardCard
                  title="Live Message Log"
                  subtitle="Semantic classification in action"
                  right={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', fontWeight: 800, color: T.green, background: T.cardSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '3px 10px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}`, animation: 'netPulse 2s infinite' }} />
                      LIVE · {filteredMessages.length} MSG
                    </span>
                  }
                  bodyStyle={{ gap: '0.4rem' }}
                >
                  <div id="net-log" />
                  {filteredMessages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: T.muted }}>
                      <Terminal size={38} style={{ opacity: 0.4 }} />
                      <p style={{ fontWeight: 800, fontSize: '0.9rem', marginTop: 10, color: T.ink }}>
                        {search.trim() ? 'No matching messages' : 'Awaiting Traffic'}
                      </p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.75, textAlign: 'center' }}>
                        {search.trim() ? 'Try a different filter' : 'Monitoring MQTT broker for messages'}
                      </p>
                    </div>
                  ) : (
                    filteredMessages.slice(0, 24).map((msg, i) => <LogRow key={msg.id || i} msg={msg} T={T} />)
                  )}
                </DashboardCard>

                <DashboardCard
                  title="Priority Buffer"
                  subtitle="Queued locally while the link is degraded"
                  right={<Chip color={buffer.length > 0 ? T.amber : T.green}>{buffer.length} QUEUED</Chip>}
                  bodyStyle={{ gap: '0.55rem' }}
                >
                  {buffer.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: T.muted }}>
                      <CheckCircle2 size={38} style={{ opacity: 0.5, color: T.green }} />
                      <p style={{ fontWeight: 800, fontSize: '0.9rem', marginTop: 8, color: T.ink }}>Buffer Empty</p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.75 }}>All messages delivered to cloud</p>
                    </div>
                  ) : (
                    buffer.slice(0, 10).map((msg, i) => {
                      const pc = PRIO_COLOR[msg.priority] || T.muted
                      const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—')
                      return (
                        <div key={msg.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0.6rem 0.8rem', borderRadius: 10, background: T.panelSoft, border: `1px solid ${T.border}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: T.ink, textTransform: 'capitalize' }}>
                              {msg.source || msg.source_type} <span style={{ color: T.muted }}>·</span> {(msg.action || '').replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>{timeStr}</div>
                          </div>
                          <Chip color={pc}>{String(msg.priority || '').slice(0, 4)}</Chip>
                        </div>
                      )
                    })
                  )}
                  {networkState !== 'OFFLINE' && buffer.length > 0 && (
                    <div style={{ padding: '0.6rem 0.8rem', borderRadius: 10, background: `${T.green}14`, border: `1px solid ${T.green}44`, fontSize: '0.76rem', fontWeight: 700, color: T.green, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <ShieldCheck size={15} /> Reconnected — flushing CRITICAL records first
                    </div>
                  )}
                </DashboardCard>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
