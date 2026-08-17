'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Radio, RefreshCw, Activity, Gauge, Layers, Zap, Cpu, Network, ShieldCheck, Server, Terminal, CheckCircle2, ArrowDown } from 'lucide-react'
import SideNav from '@/components/common/SideNav'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import Button from '@/components/common/Button'
import KpiCard from '@/components/dashboard/KpiCard'
import MiniStat from '@/components/dashboard/MiniStat'
import DashboardCard from '@/components/dashboard/DashboardCard'
import StatusDonut from '@/components/dashboard/StatusDonut'
import { P } from '@/components/alert/alertPalette'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const BLUE = '#60A5FA'

const STATE_COLOR  = { GOOD: P.green, WEAK: P.amber, POOR: '#F97316', OFFLINE: P.red }
const PRIO_COLOR   = { CRITICAL: P.red, IMPORTANT: P.amber, ROUTINE: BLUE }
const STATUS_COLOR = { sent: P.green, buffered: P.amber, dropped: P.red, delayed: P.amber }

const QOS_MATRIX = {
  CRITICAL:  ['QoS 2', 'QoS 2', 'QoS 2', 'Buffer'],
  IMPORTANT: ['QoS 2', 'QoS 1', 'QoS 1', 'Buffer'],
  ROUTINE:   ['QoS 0', 'QoS 0', 'Drop',  'Drop'],
}

function valColor(v, warn, crit, invert = false) {
  if (invert ? v < warn : v > crit) return P.red
  if (invert ? v > warn * 1.5 : v > warn * 1.5) return P.amber
  return P.green
}

const fmt = (v, d = 1) => (v == null ? '—' : (typeof v === 'number' ? v.toFixed(v > 99 ? 0 : d) : v))

async function fetchNetworkMetrics() {
  const res = await fetch(`${API_BASE}/api/network/metrics`)
  if (!res.ok) return null
  return res.json()
}

// ── shared bits ───────────────────────────────────────────────────────────────

function Chip({ children, color = P.muted, style }) {
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

function FeatureRow({ num, title, body }) {
  return (
    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.4rem', fontWeight: 300, color: P.muted, flexShrink: 0 }}>{num}</span>
      <div style={{ width: 34, height: 2, background: P.muted, marginTop: '0.9rem', flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: '0.95rem', fontWeight: 800, color: P.ink, margin: 0 }}>{title}</p>
        <p style={{ fontSize: '0.82rem', color: P.muted, marginTop: '2px', lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  )
}

function LogRow({ msg }) {
  const status = msg.status || 'sent'
  const sc = STATUS_COLOR[status] || P.muted
  const pc = PRIO_COLOR[msg.priority] || P.muted
  const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')
  const statusLabel = { sent: `QoS ${msg.qos_assigned || msg.qos}`, buffered: 'BUFFERED', dropped: 'DROPPED', delayed: 'DELAYED' }[status] || String(status).toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0', borderBottom: `1px solid ${P.border}`, flexWrap: 'wrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc, boxShadow: `0 0 5px ${sc}`, flexShrink: 0 }} />
      <div style={{ flex: '1 1 120px', minWidth: 100 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: P.ink, textTransform: 'capitalize' }}>{msg.source || msg.source_type || '—'}</div>
        <div style={{ fontSize: '0.68rem', color: P.muted, fontWeight: 600, textTransform: 'capitalize' }}>{(msg.action || '').replace(/_/g, ' ')}</div>
      </div>
      <span style={{ flex: '2 1 140px', minWidth: 120, fontFamily: 'monospace', fontSize: '0.68rem', color: P.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={msg.topic}>{msg.topic || '—'}</span>
      <Chip color={pc}>{String(msg.priority || '').slice(0, 4)}</Chip>
      <Chip color={sc}>{statusLabel}</Chip>
      <span style={{ fontSize: '0.66rem', color: P.muted, fontFamily: 'monospace', flexShrink: 0 }}>{timeStr}</span>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function NetworkPage() {
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
  const stateColor = STATE_COLOR[networkState] || P.green
  const bridgeAlive = m.bridge_alive

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  // ── derived ──────────────────────────────────────────────────────────────────
  const s = stats || {}
  const totalCrit = (s.critical_sent || 0) + (s.critical_buffered || 0)
  const deliveryRate = totalCrit > 0 ? ((s.critical_sent / totalCrit) * 100).toFixed(1) : '100.0'
  const drColor = +deliveryRate < 70 ? P.red : +deliveryRate < 95 ? P.amber : P.green

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
    { label: 'RTT Average',  value: fmt(m.rtt_avg),  unit: 'ms',    color: valColor(m.rtt_avg || 0, 100, 300),  icon: <Activity size={16} />, spark: sparkFor('rtt_avg'),     delta: trendLabel('rtt_avg') },
    { label: 'Packet Loss',  value: fmt(m.packet_loss), unit: '%', color: valColor(m.packet_loss || 0, 5, 20),  icon: <Gauge size={16} />,     spark: sparkFor('packet_loss'), delta: trendLabel('packet_loss') },
    { label: 'Queue Depth',  value: fmt(m.queue_depth, 0), unit: 'msgs', color: valColor(m.queue_depth || 0, 10, 50), icon: <Layers size={16} />, spark: sparkFor('queue_depth'), delta: trendLabel('queue_depth') },
    { label: 'Throughput',   value: fmt(m.throughput), unit: 'msg/s', color: valColor(m.throughput || 0, 5, 12, true), icon: <Zap size={16} />, spark: sparkFor('throughput'),  delta: trendLabel('throughput', true) },
  ]

  const stateIndex = ['GOOD', 'WEAK', 'POOR', 'OFFLINE'].indexOf(networkState)

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 9999px; }
        @keyframes netPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes netSpin { to { transform: rotate(360deg); } }
        .net-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .net-hero { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; }
        .net-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .net-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.9rem; }
        @media (max-width: 1150px) { .net-hero, .net-two { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .net-kpi { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) {
          .net-kpi { grid-template-columns: 1fr; }
          .net-strip { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div style={{ minHeight: '100svh', background: P.outer, fontFamily: "'Inter',sans-serif", color: P.ink, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
        <SideNav />

        <div className='header-wrapper'>

          <main style={{ background: P.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <HeaderShell>
              <PageHeader
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

              {/* ── Title row ─────────────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: P.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
                    Network Intelligence · Semantic-Aware
                  </div>
                  <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: P.ink }}>
                    SAAMP Network Monitor
                  </h1>
                  <p style={{ color: P.muted, fontSize: '0.82rem', marginTop: 4, fontWeight: 600 }}>
                    {connected
                      ? `Predictive MQTT link quality · Random Forest · 19 features · 60s ahead`
                      : `Awaiting cloud backend on port ${API_BASE.replace('http://localhost:', '')}…`}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: P.muted, fontWeight: 600 }}>{today}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: connected ? P.green : P.red }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? P.green : P.red, boxShadow: `0 0 8px ${connected ? P.green : P.red}`, animation: 'netPulse 2s infinite' }} />
                    {connected ? 'LIVE' : 'DISCONNECTED'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${stateColor}14`, border: `1px solid ${stateColor}44`, borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800, color: stateColor }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor, boxShadow: `0 0 8px ${stateColor}` }} />
                    {networkState}
                  </span>
                  <Button variant="circle" onClick={refresh} disabled={refreshing} aria-label="Refresh data">
                    <RefreshCw size={16} style={refreshing ? { animation: 'netSpin 0.8s linear infinite' } : undefined} />
                  </Button>
                </div>
              </div>

              {/* ── KPI row ────────────────────────────────────────────── */}
              <div className="net-kpi">
                {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
              </div>

              {/* ── Hero — alert-page composition ─────────────────────── */}
              <div className="net-hero">
                {/* left copy panel */}
                <div style={{ position: 'relative', overflow: 'hidden', background: P.panel, border: `1px solid ${P.border}`, borderRadius: '1.75rem', padding: 'clamp(1.1rem, 2.5vw, 1.75rem)', boxShadow: '0 30px 70px rgba(20,30,40,0.18)', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: P.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
                      <Radio size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Live Link Quality
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: '2.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: stateColor }}>
                        {networkState}
                      </h2>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: stateColor, boxShadow: `0 0 14px ${stateColor}`, animation: 'netPulse 2s infinite' }} />
                    </div>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                      Predicted state · 60 seconds ahead
                    </p>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: P.ink, lineHeight: 1.35, margin: 0 }}>
                    Adaptive MQTT routing that never drops a critical message.
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: P.muted, lineHeight: 1.6, margin: 0 }}>
                    The Semantic-Aware Adaptive Message Protocol inspects every hop in near real-time, classifies link health, and re-routes priority traffic before quality degrades.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.25rem' }}>
                    <FeatureRow num="01" title="ML Classification" body="A Random Forest model scores 19 live link features to forecast state 60s ahead." />
                    <FeatureRow num="02" title="Adaptive QoS" body="Delivery guarantees adapt per priority class and predicted state, from QoS 0 to QoS 2." />
                    <FeatureRow num="03" title="Smart Buffering" body="Critical records queue locally and flush in priority order the moment the bridge reconnects." />
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <Chip color={P.teal}><Cpu size={11} /> Random Forest · 19 features</Chip>
                    <Chip color={P.purple}><Zap size={11} /> &lt;5ms inference · Pi 5</Chip>
                    <Chip color={BLUE}><Network size={11} /> QoS 0–2</Chip>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <Button onClick={() => document.getElementById('net-log')?.scrollIntoView({ behavior: 'smooth' })} icon={<ArrowDown size={15} />}>
                      Follow Live Log
                    </Button>
                    <MiniStat label="Inference" value="<5ms" icon={<Zap size={12} />} color={P.purple} />
                    <MiniStat label="Features" value="19" icon={<Cpu size={12} />} color={P.teal} />
                    <MiniStat label="Bridge" value={bridgeAlive ? 'UP' : 'DOWN'} icon={<Server size={12} />} color={bridgeAlive ? P.green : P.red} />
                  </div>

                  {/* floating decor dots */}
                  <span style={{ position: 'absolute', top: 34, right: 44, width: 12, height: 12, borderRadius: '50%', background: P.teal, opacity: 0.5, animation: 'netPulse 4s ease-in-out infinite' }} />
                  <span style={{ position: 'absolute', top: 74, right: 70, width: 7, height: 7, borderRadius: '50%', background: P.lime, opacity: 0.8, animation: 'netPulse 5s ease-in-out infinite' }} />
                  <span style={{ position: 'absolute', bottom: 46, right: 36, width: 9, height: 9, borderRadius: '50%', background: P.purple, opacity: 0.35, animation: 'netPulse 4.5s ease-in-out infinite' }} />
                </div>

                {/* right widget stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <DashboardCard
                    title="Delivery Rate"
                    subtitle="Critical messages · target ≥ 95%"
                    right={<Chip color={drColor}>{deliveryRate}%</Chip>}
                    bodyStyle={{ alignItems: 'center' }}
                  >
                    <StatusDonut
                      segments={[
                        { color: P.green, value: delivered },
                        { color: P.amber, value: buffered },
                        { color: P.red, value: dropped },
                      ]}
                      size={176}
                      center={`${deliveryRate}%`}
                      label="Delivered"
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Chip color={P.green}>✓ {delivered} sent</Chip>
                      <Chip color={P.amber}>⟳ {buffered} buffered</Chip>
                      <Chip color={P.red}>✕ {dropped} dropped</Chip>
                    </div>
                  </DashboardCard>

                  <div style={{ background: P.dark, color: '#fff', borderRadius: '1.25rem', padding: '1.1rem 1.25rem', boxShadow: '0 30px 70px rgba(20,30,40,0.25)' }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      ML Prediction · 60s ahead
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span style={{ fontSize: '1.9rem', fontWeight: 800, color: stateColor, letterSpacing: '-0.02em' }}>{networkState}</span>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: stateColor, boxShadow: `0 0 12px ${stateColor}`, animation: 'netPulse 2s infinite' }} />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', margin: '6px 0 0', lineHeight: 1.5 }}>
                      Random Forest classification over 19 live link features, inferring on-device in under five milliseconds.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                      <span style={{ background: P.lime, color: P.dark, borderRadius: 999, padding: '3px 11px', fontSize: '0.62rem', fontWeight: 800 }}><Zap size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Pi 5</span>
                      <span style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, padding: '3px 11px', fontSize: '0.62rem', fontWeight: 800 }}>19 features</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.95rem', borderRadius: 12, background: bridgeAlive ? `${P.green}14` : `${P.red}14`, border: `1px solid ${bridgeAlive ? `${P.green}44` : `${P.red}44`}` }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: P.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Server size={15} color={bridgeAlive ? P.green : P.red} /> Cloud Bridge
                    </span>
                    <Chip color={bridgeAlive ? P.green : P.red}>{bridgeAlive ? 'CONNECTED' : 'OFFLINE'} · {m.clients || 0} clients</Chip>
                  </div>
                </div>
              </div>

              {/* ── QoS matrix + delivery stats ───────────────────────── */}
              <div className="net-two">
                <DashboardCard
                  title="QoS Decision Matrix"
                  subtitle="How each priority class is treated per predicted link state"
                  right={<Chip color={P.teal}><Network size={11} /> Adaptive</Chip>}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '82px repeat(4, 1fr)', gap: 6 }}>
                    <div />
                    {['GOOD', 'WEAK', 'POOR', 'OFF'].map((h) => (
                      <div key={h} style={{
                        textAlign: 'center', padding: '0.45rem 0', borderRadius: 8,
                        background: P.cardSoft, border: `1px solid ${P.border}`,
                        fontSize: '0.62rem', fontWeight: 800, color: P.muted, letterSpacing: '0.06em',
                      }}>{h}</div>
                    ))}
                    {Object.entries(QOS_MATRIX).map(([priority, cells]) => (
                      <div key={priority} style={{ display: 'contents' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: PRIO_COLOR[priority], display: 'flex', alignItems: 'center' }}>{priority}</div>
                        {cells.map((cell, ci) => {
                          const isActive = stateIndex === ci
                          const cellColor = cell === 'Buffer' ? P.amber : cell === 'Drop' ? P.red : P.green
                          return (
                            <div key={ci} style={{
                              textAlign: 'center', padding: '0.5rem 0', borderRadius: 8,
                              fontSize: '0.68rem', fontWeight: isActive ? 800 : 600, color: cellColor,
                              background: isActive ? `${cellColor}22` : P.cardSoft,
                              border: isActive ? `2px solid ${cellColor}` : `1px solid ${P.border}`,
                              opacity: isActive ? 1 : 0.6,
                            }}>
                              {cell}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.4rem' }}>
                    Buffer flush order on reconnect
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: '1st — CRITICAL',  color: P.red },
                      { label: '2nd — IMPORTANT', color: P.amber },
                      { label: '3rd — ROUTINE',   color: BLUE },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.76rem', fontWeight: 700, color: P.ink }}>
                        <span style={{ width: 26, height: 6, borderRadius: 99, background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
                        {row.label}
                      </div>
                    ))}
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="Delivery Statistics"
                  subtitle="Message outcomes since session start"
                  right={<Chip color={drColor}>{+deliveryRate >= 95 ? 'ON TARGET' : 'BELOW TARGET'}</Chip>}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Critical Delivery Rate</div>
                    <div style={{ fontSize: '2.6rem', fontWeight: 800, color: drColor, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                      {deliveryRate}<span style={{ fontSize: '1.3rem' }}>%</span>
                    </div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>target ≥ 95%</div>
                    <div style={{ height: 8, borderRadius: 99, background: P.cardSoft, overflow: 'hidden', marginTop: 12 }}>
                      <div style={{ width: `${Math.min(+deliveryRate, 100)}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${drColor}88, ${drColor})`, transition: 'width 1.2s ease' }} />
                    </div>
                  </div>
                  <div>
                    {[
                      { label: 'Total Sent',        value: s.total_sent || 0,        color: P.green },
                      { label: 'Total Buffered',    value: s.total_buffered || 0,    color: P.amber },
                      { label: 'Total Dropped',     value: s.total_dropped || 0,     color: P.red },
                      { label: 'Critical Sent',     value: s.critical_sent || 0,     color: P.green },
                      { label: 'Critical Buffered', value: s.critical_buffered || 0, color: P.amber },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: `1px solid ${P.border}`, fontSize: '0.82rem' }}>
                        <span style={{ color: P.muted, fontWeight: 600 }}>{row.label}</span>
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
                  subtitle="SAAMP semantic classification in action"
                  right={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', fontWeight: 800, color: P.green, background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: 999, padding: '3px 10px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.green, boxShadow: `0 0 6px ${P.green}`, animation: 'netPulse 2s infinite' }} />
                      LIVE · {filteredMessages.length} MSG
                    </span>
                  }
                  bodyStyle={{ gap: '0.4rem' }}
                >
                  <div id="net-log" />
                  {filteredMessages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: P.muted }}>
                      <Terminal size={38} style={{ opacity: 0.4 }} />
                      <p style={{ fontWeight: 800, fontSize: '0.9rem', marginTop: 10, color: P.ink }}>
                        {search.trim() ? 'No matching messages' : 'Awaiting Traffic'}
                      </p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.75, textAlign: 'center' }}>
                        {search.trim() ? 'Try a different filter' : 'Monitoring MQTT broker for messages'}
                      </p>
                    </div>
                  ) : (
                    filteredMessages.slice(0, 24).map((msg, i) => <LogRow key={msg.id || i} msg={msg} />)
                  )}
                </DashboardCard>

                <DashboardCard
                  title="Priority Buffer"
                  subtitle="Queued locally while the link is degraded"
                  right={<Chip color={buffer.length > 0 ? P.amber : P.green}>{buffer.length} QUEUED</Chip>}
                  bodyStyle={{ gap: '0.55rem' }}
                >
                  {buffer.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: P.muted }}>
                      <CheckCircle2 size={38} style={{ opacity: 0.5, color: P.green }} />
                      <p style={{ fontWeight: 800, fontSize: '0.9rem', marginTop: 8, color: P.ink }}>Buffer Empty</p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.75 }}>All messages delivered to cloud</p>
                    </div>
                  ) : (
                    buffer.slice(0, 10).map((msg, i) => {
                      const pc = PRIO_COLOR[msg.priority] || P.muted
                      const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—')
                      return (
                        <div key={msg.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0.6rem 0.8rem', borderRadius: 10, background: P.panelSoft, border: `1px solid ${P.border}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: P.ink, textTransform: 'capitalize' }}>
                              {msg.source || msg.source_type} <span style={{ color: P.muted }}>·</span> {(msg.action || '').replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: P.muted, fontFamily: 'monospace', marginTop: 2 }}>{timeStr}</div>
                          </div>
                          <Chip color={pc}>{String(msg.priority || '').slice(0, 4)}</Chip>
                        </div>
                      )
                    })
                  )}
                  {networkState !== 'OFFLINE' && buffer.length > 0 && (
                    <div style={{ padding: '0.6rem 0.8rem', borderRadius: 10, background: `${P.green}14`, border: `1px solid ${P.green}44`, fontSize: '0.76rem', fontWeight: 700, color: P.green, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <ShieldCheck size={15} /> Reconnected — flushing CRITICAL records first
                    </div>
                  )}
                </DashboardCard>
              </div>

              {/* ── bottom metric strip ───────────────────────────────── */}
              <div className="net-strip">
                <MiniStat label="Jitter" value={`${fmt(m.jitter)}ms`} icon={<Activity size={12} />} color={valColor(m.jitter || 0, 15, 50)} />
                <MiniStat label="Bandwidth" value={`${m.bandwidth || 0} Mbps`} icon={<Activity size={12} />} color={BLUE} />
                <MiniStat label="Drop Rate" value={`${m.drop_rate || 0}/s`} icon={<Layers size={12} />} color={m.drop_rate > 2 ? P.red : m.drop_rate > 0 ? '#F97316' : P.green} />
                <MiniStat label="WiFi Clients" value={m.clients || 0} icon={<Radio size={12} />} color={P.green} />
                <MiniStat label="Throughput" value={`${fmt(m.throughput)} msg/s`} icon={<Zap size={12} />} color={valColor(m.throughput || 0, 5, 12, true)} />
                <MiniStat label="Queue Δ" value={`${(m.queue_delta || 0) >= 0 ? '+' : ''}${m.queue_delta || 0}`} icon={<Gauge size={12} />} color={m.queue_delta > 10 ? '#F97316' : m.queue_delta > 0 ? P.amber : P.green} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}