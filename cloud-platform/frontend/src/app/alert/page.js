'use client'

// Welfare Alert Dashboard — "nitec" reference layout
// Hero + widget-grid composition (search header · big left headline panel ·
// stacked right widget cards · 3-up bottom row) with real alert data mapped
// into every slot. Full filterable/sortable alert list lives below the fold.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import {
  Search, RefreshCw, Bell, TriangleAlert, ArrowUpRight, Radio,
  Users, Flame, CheckCircle2, ListChecks,
} from 'lucide-react'
import SideNav from '@/components/common/SideNav'
import { daysSince } from '@/components/common/utils'

// ── "nitec"-style palette — fixed light/lime look, independent of app theme ──
const P = {
  outer:     'linear-gradient(135deg, #9FB0BE 0%, #C3D0D6 45%, #DEE7E0 100%)',
  panel:     '#EEF2E7',
  panelSoft: '#E7EDDD',
  card:      '#FFFFFF',
  cardSoft:  '#F6F8F1',
  ink:       '#14171A',
  inkSoft:   '#3A4149',
  muted:     '#78838C',
  border:    '#E3E7DA',
  lime:      '#D8F24E',
  limeDark:  '#B9DD2E',
  dark:      '#14171A',
  red:       '#EF4444',
  amber:     '#F59E0B',
  green:     '#22C55E',
  purple:    '#8B5CF6',
  teal:      '#0D9488',
}

// ── Mock camp list (replace with API data) ────────────────────────────────────
const MOCK_CAMPS = [
  { id: 'all',   name: 'All Camps',        code: 'ALL', count: 0 },
  { id: 'hmg',   name: 'Hambantota Main',  code: 'HMG', count: 3 },
  { id: 'gal',   name: 'Galle North',      code: 'GAL', count: 2 },
  { id: 'mat',   name: 'Matara East',      code: 'MAT', count: 1 },
  { id: 'kal',   name: 'Kalutara South',   code: 'KAL', count: 4 },
]

// ── Mock alert data (replace with real API) ───────────────────────────────────
function mockAlerts() {
  return [
    {
      id: 'a1', childId: 'HMG-012', campId: 'hmg', campName: 'Hambantota Main',
      alertType: 'Low inhibition score', severity: 'high',
      status: 'pending', triggeredAt: Date.now() - 86400000 * 2,
      scores: [
        { session: 1, score: 72 }, { session: 2, score: 65 },
        { session: 3, score: 58 }, { session: 4, score: 49 }, { session: 5, score: 44 },
      ],
    },
    {
      id: 'a2', childId: 'GAL-007', campId: 'gal', campName: 'Galle North',
      alertType: 'High false-tap rate', severity: 'medium',
      status: 'pending', triggeredAt: Date.now() - 86400000 * 1,
      scores: [
        { session: 1, score: 80 }, { session: 2, score: 74 },
        { session: 3, score: 68 }, { session: 4, score: 60 }, { session: 5, score: 53 },
      ],
    },
    {
      id: 'a3', childId: 'HMG-019', campId: 'hmg', campName: 'Hambantota Main',
      alertType: 'Repeated missed targets', severity: 'medium',
      status: 'escalated', triggeredAt: Date.now() - 86400000 * 4,
      scores: [
        { session: 1, score: 55 }, { session: 2, score: 50 },
        { session: 3, score: 45 }, { session: 4, score: 40 }, { session: 5, score: 38 },
      ],
    },
    {
      id: 'a4', childId: 'KAL-003', campId: 'kal', campName: 'Kalutara South',
      alertType: 'Slow reaction time trend', severity: 'low',
      status: 'resolved', triggeredAt: Date.now() - 86400000 * 6,
      scores: [
        { session: 1, score: 60 }, { session: 2, score: 65 },
        { session: 3, score: 70 }, { session: 4, score: 74 }, { session: 5, score: 78 },
      ],
    },
    {
      id: 'a5', childId: 'MAT-011', campId: 'mat', campName: 'Matara East',
      alertType: 'High RT variability', severity: 'low',
      status: 'pending', triggeredAt: Date.now() - 86400000 * 0.5,
      scores: [
        { session: 1, score: 76 }, { session: 2, score: 72 },
        { session: 3, score: 69 }, { session: 4, score: 64 }, { session: 5, score: 57 },
      ],
    },
    {
      id: 'a6', childId: 'KAL-021', campId: 'kal', campName: 'Kalutara South',
      alertType: 'Session abandoned mid-task', severity: 'high',
      status: 'escalated', triggeredAt: Date.now() - 86400000 * 3,
      scores: [
        { session: 1, score: 82 }, { session: 2, score: 75 },
        { session: 3, score: 62 }, { session: 4, score: 51 }, { session: 5, score: 41 },
      ],
    },
  ]
}

const SEVERITY_COLOR = { high: P.red, medium: P.amber, low: P.green }
const SEVERITY_RANK  = { high: 3, medium: 2, low: 1 }
const STATUS_COLOR   = { pending: P.amber, escalated: P.purple, resolved: P.teal }

// ── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const color = SEVERITY_COLOR[severity] ?? P.green
  const label = severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low'
  return (
    <span style={{
      background: `${color}1a`, color, borderRadius: '9999px',
      border: `1px solid ${color}55`, padding: '3px 12px',
      fontSize: '0.72rem', fontWeight: 700,
    }}>
      ● {label}
    </span>
  )
}

// ── Score sparkline (recharts) ────────────────────────────────────────────────
function ScoreSparkline({ scores }) {
  const last = scores[scores.length - 1]?.score ?? 0
  const lineColor = last >= 70 ? P.green : last >= 50 ? P.amber : P.red

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: P.dark, border: `1px solid ${P.dark}`, borderRadius: '8px', padding: '4px 10px' }}>
        <p style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700, margin: 0 }}>
          S{payload[0]?.payload?.session}: {payload[0]?.value}
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 56 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scores} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={50} stroke={P.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2.5}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: lineColor }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Full alert card (used in the "All Alerts" list below the hero) ───────────
function AlertCard({ alert, onAction, highlighted }) {
  const [actionLoading, setActionLoading] = useState(null)
  const borderColor = STATUS_COLOR[alert.status] ?? P.amber

  async function doAction(action) {
    setActionLoading(action)
    try {
      const endpoint = `/api/alerts/${alert.id}/resolve`
      const body = action === 'escalate' ? { notes: 'Escalated by admin' } : { notes: 'Reviewed by admin' }
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onAction(alert.id, action)
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const statusLabel = {
    pending:   { color: P.amber,  label: '● Pending' },
    resolved:  { color: P.teal,   label: '● Resolved' },
    escalated: { color: P.purple, label: '● Escalated' },
  }[alert.status] ?? { color: P.muted, label: '● Unknown' }

  return (
    <div id={`alert-${alert.id}`} style={{
      background: P.card,
      border: `1px solid ${P.border}`,
      borderRadius: '1.25rem',
      borderLeft: `6px solid ${borderColor}`,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: highlighted ? `0 0 0 3px ${P.lime}, 0 8px 28px rgba(20,23,26,0.12)` : '0 4px 18px rgba(20,23,26,0.06)',
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: P.ink }}>{alert.childId}</span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p style={{ fontSize: '0.85rem', color: P.muted, marginTop: '2px', fontWeight: 600 }}>
            {alert.campName}
          </p>
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: statusLabel.color }}>
          {statusLabel.label}
        </span>
      </div>

      <div style={{
        background: P.cardSoft, borderRadius: '0.75rem', padding: '0.6rem 1rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: P.ink }}>{alert.alertType}</span>
        <span style={{ fontSize: '0.8rem', color: P.muted, fontWeight: 600 }}>{daysSince(alert.triggeredAt)}</span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: P.muted, fontWeight: 600 }}>Last 5 sessions</span>
          <span style={{ fontSize: '0.75rem', color: P.muted, fontWeight: 600 }}>Score →</span>
        </div>
        <ScoreSparkline scores={alert.scores} />
      </div>

      {alert.status !== 'resolved' && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => doAction('review')}
            disabled={!!actionLoading}
            style={{
              flex: 1, minHeight: '44px', background: P.lime, color: P.dark,
              borderRadius: '0.75rem', border: 'none', fontWeight: 800, fontSize: '0.9rem',
              cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading === 'review' ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
          >
            {actionLoading === 'review' ? '⏳' : <CheckCircle2 size={16} />} Mark Reviewed
          </button>
          {alert.status !== 'escalated' && (
            <button
              onClick={() => doAction('escalate')}
              disabled={!!actionLoading}
              style={{
                flex: 1, minHeight: '44px', background: 'transparent', color: P.ink,
                borderRadius: '0.75rem', border: `2px solid ${P.dark}`, fontWeight: 800, fontSize: '0.9rem',
                cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading === 'escalate' ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              }}
            >
              {actionLoading === 'escalate' ? '⏳' : <TriangleAlert size={16} />} Escalate
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Small round icon-arrow badge used on widget cards (nitec's "↗" chip) ─────
function ArrowChip({ dark }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: dark ? 'rgba(255,255,255,0.16)' : P.dark,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <ArrowUpRight size={16} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [alerts,       setAlerts]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('all')
  const [sortBy,       setSortBy]       = useState('recent')
  const [selectedCamp, setSelectedCamp] = useState('all')
  const [search,       setSearch]       = useState('')
  const [highlightId,  setHighlightId]  = useState(null)
  const listRef = useRef(null)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/alerts?status=${filter === 'all' ? '' : filter}&camp=${selectedCamp === 'all' ? '' : selectedCamp}`)
      if (res.ok) {
        const data = await res.json()
        const transformed = data.alerts.map(a => ({
          id: a.alert_id,
          childId: a.child_id.replace(/TEST-CHILD-/, '').replace(/CHILD-/, ''),
          campId: a.camp_id?.toLowerCase() ?? 'unknown',
          campName: a.camp_id ?? 'Unknown Camp',
          alertType: a.alert_type ?? 'Unknown Alert',
          severity: a.alert_type?.includes('Low') || a.alert_type?.includes('low') ? 'low'
            : a.alert_type?.includes('High') || a.alert_type?.includes('high') ? 'high'
            : 'medium',
          status: a.status === 'pending' ? 'pending' : 'resolved',
          triggeredAt: new Date(a.triggered_at).getTime(),
          scores: (a.recent_scores || []).map((score, idx) => ({ session: idx + 1, score })),
        }))
        setAlerts(transformed)
      } else {
        throw new Error('API error')
      }
    } catch (err) {
      console.log('Fetching real alerts failed, using mock data:', err.message)
      setAlerts(mockAlerts())
    } finally {
      setLoading(false)
    }
  }, [filter, selectedCamp])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  function handleAction(alertId, action) {
    setAlerts(prev => prev.map(a => {
      if (a.id !== alertId) return a
      if (action === 'review')   return { ...a, status: 'resolved' }
      if (action === 'escalate') return { ...a, status: 'escalated' }
      return a
    }))
  }

  const visible = alerts
    .filter(a => {
      if (selectedCamp !== 'all' && a.campId !== selectedCamp) return false
      if (filter !== 'all' && a.status !== filter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!a.childId.toLowerCase().includes(q) && !a.campName.toLowerCase().includes(q) && !a.alertType.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return b.triggeredAt - a.triggeredAt
      if (sortBy === 'oldest') return a.triggeredAt - b.triggeredAt
      if (sortBy === 'camp')   return a.campName.localeCompare(b.campName)
      return 0
    })

  const alertCounts = alerts.reduce((acc, a) => {
    if (a.status !== 'resolved') {
      acc[a.campId] = (acc[a.campId] ?? 0) + 1
      acc['all']    = (acc['all']    ?? 0) + 1
    }
    return acc
  }, {})

  const pendingCount   = alerts.filter(a => a.status === 'pending').length
  const escalatedCount = alerts.filter(a => a.status === 'escalated').length
  const resolvedCount  = alerts.filter(a => a.status === 'resolved').length
  const totalCount     = alerts.length || 1
  const activeCount    = pendingCount + escalatedCount

  const mostCritical = useMemo(() => {
    const open = alerts.filter(a => a.status !== 'resolved')
    if (!open.length) return null
    return [...open].sort((a, b) => {
      const rank = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
      if (rank !== 0) return rank
      return (a.scores.at(-1)?.score ?? 0) - (b.scores.at(-1)?.score ?? 0)
    })[0]
  }, [alerts])

  const trending = useMemo(() => {
    if (!alerts.length) return null
    return [...alerts].sort((a, b) => b.triggeredAt - a.triggeredAt)[0]
  }, [alerts])

  const pendingDeg   = (pendingCount / totalCount) * 360
  const escalatedDeg = (escalatedCount / totalCount) * 360

  function jumpToList(opts = {}) {
    if (opts.filter)       setFilter(opts.filter)
    if (opts.campId)       setSelectedCamp(opts.campId)
    if (opts.highlightId)  setHighlightId(opts.highlightId)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const FILTER_OPTIONS = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'resolved',  label: 'Resolved' },
    { key: 'escalated', label: 'Escalated' },
  ]

  const SORT_OPTIONS = [
    { key: 'recent', label: 'Most Recent' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'camp',   label: 'Camp A–Z' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes spinOnce { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .nitec-hero-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; }
        .nitec-bottom-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
        .nitec-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .nitec-search { flex: 1; min-width: 200px; max-width: 480px; }
        @media (max-width: 900px) {
          .nitec-hero-grid { grid-template-columns: 1fr; }
          .nitec-bottom-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .hero-donut-wrap { display: none !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100svh',
        background: P.outer,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', sans-serif",
        paddingLeft: 'var(--rail-width, 236px)',
        transition: 'padding-left 0.2s ease',
      }}>
        <SideNav />

        <main style={{ flex: 1 }}>
          {/* ══ Big rounded panel — mirrors the reference composition ══ */}
          <div style={{
            background: P.panel,
            padding: 'clamp(1rem, 2vw, 1.75rem)',
            boxShadow: '0 30px 70px rgba(20,30,40,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>

            {/* ── Header: logo · search · icons · admin ── */}
            <div className="nitec-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '0.7rem', background: P.dark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <TriangleAlert size={18} />
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: P.ink }}>smartcamp.</span>
              </div>

              <div className="nitec-search" style={{
                display: 'flex', alignItems: 'center', background: P.card,
                borderRadius: '9999px', padding: '4px 4px 4px 18px', border: `1px solid ${P.border}`,
              }}>
                <Search size={16} color={P.muted} style={{ flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search child ID, camp, alert type…"
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    padding: '8px 10px', fontSize: '0.88rem', fontWeight: 600, color: P.ink,
                  }}
                />
                <button
                  onClick={fetchAlerts}
                  aria-label="Refresh alerts"
                  style={{
                    width: 34, height: 34, borderRadius: '50%', background: P.dark, border: 'none',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <RefreshCw size={15} style={loading ? { animation: 'spinOnce 0.8s linear infinite' } : undefined} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  onClick={() => jumpToList({ filter: 'pending' })}
                  style={{
                    position: 'relative', width: 40, height: 40, borderRadius: '50%', background: P.card,
                    border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Pending alerts"
                >
                  <Bell size={17} color={P.ink} />
                  {pendingCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, background: P.amber, color: '#fff',
                      borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px',
                    }}>{pendingCount}</span>
                  )}
                </button>
                <button
                  onClick={() => jumpToList({ filter: 'escalated' })}
                  style={{
                    position: 'relative', width: 40, height: 40, borderRadius: '50%', background: P.card,
                    border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Escalated alerts"
                >
                  <TriangleAlert size={17} color={P.ink} />
                  {escalatedCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, background: P.purple, color: '#fff',
                      borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px',
                    }}>{escalatedCount}</span>
                  )}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.3rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: P.ink }}>Dr. Perera</span>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #14B8A6, #0D9488)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem',
                  }}>DP</div>
                </div>
              </div>
            </div>

            {/* ── Hero: left copy panel + right widget stack ── */}
            <div className="nitec-hero-grid">

              {/* Left hero copy */}
              <div style={{
                background: P.panelSoft, borderRadius: '1.5rem', padding: 'clamp(1.25rem, 3vw, 2.25rem)',
                display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', overflow: 'hidden',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem', width: 'fit-content',
                  background: P.card, borderRadius: '9999px', padding: '5px 14px', fontSize: '0.78rem',
                  fontWeight: 700, color: P.inkSoft, border: `1px solid ${P.border}`,
                }}>
                  <Radio size={13} color={P.green} /> Live Monitoring
                </span>

                <h1 style={{
                  fontSize: 'clamp(2rem, 4vw, 3.1rem)', fontWeight: 800, color: P.ink, lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                }}>
                  Welfare Alerts<br />Overview.
                </h1>

                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', maxWidth: 360 }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 300, color: P.muted, flexShrink: 0 }}>01</span>
                  <div style={{ width: 34, height: 2, background: P.muted, marginTop: '0.9rem', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '1.05rem', fontWeight: 800, color: P.ink }}>Score Trends</p>
                    <p style={{ fontSize: '0.88rem', color: P.muted, marginTop: '2px', lineHeight: 1.5 }}>
                      Inhibition, tap-accuracy &amp; reaction-time drift tracked every session — so at-risk children surface before it becomes a pattern.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => jumpToList({})}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem', width: 'fit-content',
                    background: P.lime, color: P.dark, borderRadius: '9999px', border: 'none',
                    padding: '10px 10px 10px 22px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer',
                  }}
                >
                  View All Alerts
                  <span style={{
                    width: 30, height: 30, borderRadius: '50%', background: P.dark, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><ArrowUpRight size={15} /></span>
                </button>

                {/* Decorative stat donut, standing in for the hero product shot */}
                <div style={{
                  position: 'absolute', right: 'clamp(0.5rem, 3vw, 2.5rem)', top: '50%', transform: 'translateY(-50%)',
                  width: 190, height: 190, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }} className="hero-donut-wrap">
                  <div style={{
                    position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                    background: `conic-gradient(${P.amber} 0deg ${pendingDeg}deg, ${P.purple} ${pendingDeg}deg ${pendingDeg + escalatedDeg}deg, ${P.teal} ${pendingDeg + escalatedDeg}deg 360deg)`,
                  }} />
                  <div style={{
                    position: 'absolute', width: '68%', height: '68%', borderRadius: '50%', background: P.panelSoft,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 0 0 1px rgba(20,23,26,0.06)',
                  }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: P.ink }}>{activeCount}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</span>
                  </div>
                  <div style={{
                    position: 'absolute', top: -8, left: 10, width: 16, height: 16, borderRadius: '50%',
                    background: P.red, animation: 'floatY 3.2s ease-in-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: 4, right: -10, width: 22, height: 22, borderRadius: '50%',
                    background: P.card, border: `2px solid ${P.dark}`, animation: 'floatY 4s ease-in-out infinite 0.4s',
                  }} />
                  <div style={{
                    position: 'absolute', top: '20%', right: -18, width: 10, height: 10, borderRadius: '50%',
                    background: P.green, animation: 'floatY 2.6s ease-in-out infinite 0.8s',
                  }} />
                </div>

                {/* Camp filter row (stands in for the "Follow us on" row) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: P.muted }}>Filter camp:</span>
                  {MOCK_CAMPS.map(c => {
                    const active = selectedCamp === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCamp(c.id)}
                        title={c.name}
                        style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: active ? P.dark : P.card,
                          color: active ? '#fff' : P.inkSoft,
                          border: `1px solid ${active ? P.dark : P.border}`,
                          fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer',
                        }}
                      >
                        {c.code === 'ALL' ? '✦' : c.code.slice(0, 2)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right widget stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Severity legend */}
                <div style={{ background: P.card, borderRadius: '1.25rem', padding: '1.1rem 1.25rem', border: `1px solid ${P.border}` }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 800, color: P.ink, marginBottom: '0.7rem' }}>Severity Legend</p>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    {[['High', P.red], ['Medium', P.amber], ['Low', P.green], ['Escalated', P.purple], ['Resolved', P.teal]].map(([label, color]) => (
                      <span key={label} title={label} style={{
                        width: 26, height: 26, borderRadius: '50%', background: color,
                        border: '2px solid #fff', boxShadow: `0 0 0 1px ${P.border}`,
                      }} />
                    ))}
                  </div>
                </div>

                {/* Most critical */}
                <div
                  onClick={() => mostCritical && jumpToList({ highlightId: mostCritical.id })}
                  style={{
                    background: `linear-gradient(155deg, ${P.dark} 0%, #2A2F35 100%)`, borderRadius: '1.25rem',
                    padding: '1.1rem 1.25rem', color: '#fff', cursor: mostCritical ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>Most Critical</p>
                    <ArrowChip dark />
                  </div>
                  {mostCritical ? (
                    <>
                      <p style={{ fontSize: '1.3rem', fontWeight: 800 }}>{mostCritical.childId}</p>
                      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>{mostCritical.alertType}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: '0.95rem', fontWeight: 700 }}>All clear 🎉</p>
                  )}
                </div>

                {/* Escalated queue */}
                <div
                  onClick={() => jumpToList({ filter: 'escalated' })}
                  style={{
                    background: `linear-gradient(160deg, #EDE4FB 0%, ${P.card} 70%)`, borderRadius: '1.25rem',
                    padding: '1.1rem 1.25rem', flex: 1, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '0.5rem', border: `1px solid ${P.border}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: P.muted }}>Escalated Queue</p>
                    <ArrowChip />
                  </div>
                  <p style={{ fontSize: '2rem', fontWeight: 800, color: P.ink }}>{escalatedCount}</p>
                  <p style={{ fontSize: '0.82rem', color: P.muted, fontWeight: 600 }}>Needs supervisor sign-off</p>
                </div>
              </div>
            </div>

            {/* ── Bottom row: 3 summary cards ── */}
            <div className="nitec-bottom-grid">
              <div
                onClick={() => jumpToList({})}
                style={{
                  background: P.card, borderRadius: '1.25rem', padding: '1.25rem', border: `1px solid ${P.border}`,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: P.ink }}>All Alerts</p>
                    <p style={{ fontSize: '0.82rem', color: P.muted, fontWeight: 600 }}>{alerts.length} total logged</p>
                  </div>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', background: P.cardSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${P.border}`,
                  }}><ListChecks size={16} color={P.ink} /></div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[['Pending', P.amber, pendingCount], ['Escalated', P.purple, escalatedCount], ['Resolved', P.teal, resolvedCount]].map(([label, color, n]) => (
                    <span key={label} style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem', background: `${color}14`,
                      color, borderRadius: '9999px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800,
                    }}>{n} {label}</span>
                  ))}
                </div>
              </div>

              <div style={{
                background: P.card, borderRadius: '1.25rem', padding: '1.25rem', border: `1px solid ${P.border}`,
                display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                  {['DP', 'RM', 'SK'].map((initials, i) => (
                    <div key={initials} style={{
                      width: 34, height: 34, borderRadius: '50%', marginLeft: -8,
                      background: ['#14B8A6', '#F59E0B', '#8B5CF6'][i], color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.68rem', border: '2px solid #fff',
                    }}>{initials}</div>
                  ))}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', marginLeft: -8, background: P.dark, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                    fontWeight: 800, border: '2px solid #fff',
                  }}><Users size={14} /></div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ink }}>3 Admins</p>
                <span style={{
                  background: `${P.green}16`, color: P.green, borderRadius: '9999px', padding: '3px 10px',
                  fontSize: '0.72rem', fontWeight: 800,
                }}>● On duty now</span>
              </div>

              <div
                onClick={() => trending && jumpToList({ highlightId: trending.id })}
                style={{
                  background: P.card, borderRadius: '1.25rem', padding: '1.25rem', border: `1px solid ${P.border}`,
                  cursor: trending ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: `${P.red}14`,
                    color: P.red, borderRadius: '9999px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800,
                  }}><Flame size={12} /> Newest</span>
                  <ArrowChip />
                </div>
                {trending ? (
                  <>
                    <p style={{ fontSize: '0.98rem', fontWeight: 800, color: P.ink }}>{trending.alertType}</p>
                    <p style={{ fontSize: '0.8rem', color: P.muted, fontWeight: 600 }}>{trending.childId} · {trending.campName} · {daysSince(trending.triggeredAt)}</p>
                  </>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: P.muted, fontWeight: 600 }}>No alerts yet</p>
                )}
              </div>
            </div>
          </div>

          {/* ══ Full alert list — filters, sort, review/escalate actions ══ */}
          <div ref={listRef} id="all-alerts" style={{ paddingTop: '1.75rem' }}>
            <div style={{ marginBottom: '1.1rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: P.ink }}>All Alerts</h2>
              <p style={{ fontSize: '0.85rem', color: P.muted, marginTop: '2px', fontWeight: 600 }}>
                {loading ? 'Loading…' : `${visible.length} alert${visible.length !== 1 ? 's' : ''} · ${selectedCamp === 'all' ? 'All camps' : MOCK_CAMPS.find(c => c.id === selectedCamp)?.name}`}
              </p>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {FILTER_OPTIONS.map(f => {
                  const active = filter === f.key
                  const cnt = f.key === 'all' ? alerts.length : alerts.filter(a => a.status === f.key).length
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      style={{
                        background: active ? P.dark : P.card, color: active ? '#fff' : P.inkSoft,
                        border: `2px solid ${active ? P.dark : P.border}`, borderRadius: '9999px',
                        padding: '4px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                      }}
                    >
                      {f.label}
                      <span style={{
                        background: active ? 'rgba(255,255,255,0.25)' : P.cardSoft, borderRadius: '9999px',
                        padding: '0 6px', fontSize: '0.72rem', fontWeight: 800, color: active ? '#fff' : P.muted,
                      }}>{cnt}</span>
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{
                    background: P.card, color: P.ink, border: `2px solid ${P.border}`, borderRadius: '0.6rem',
                    padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', outline: 'none',
                  }}
                >
                  {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select
                  value={selectedCamp} onChange={e => setSelectedCamp(e.target.value)}
                  style={{
                    background: P.card, color: P.ink, border: `2px solid ${P.border}`, borderRadius: '0.6rem',
                    padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', outline: 'none',
                  }}
                >
                  {MOCK_CAMPS.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({alertCounts[c.id] ?? c.count})</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    background: P.card, borderRadius: '1.25rem', border: `1px solid ${P.border}`,
                    borderLeft: `6px solid ${P.border}`, padding: '1.25rem', display: 'flex',
                    flexDirection: 'column', gap: '0.75rem',
                  }}>
                    {[160, 120, 80, 52].map((w, j) => (
                      <div key={j} style={{
                        height: j === 3 ? 44 : 14, width: `${Math.min(100, w / 2)}%`, background: P.cardSoft,
                        borderRadius: '9999px', animation: 'floatY 1.5s ease-in-out infinite', animationDelay: `${j * 0.1}s`,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div style={{ background: P.card, borderRadius: '1.25rem', padding: '3rem 2rem', textAlign: 'center', border: `1px solid ${P.border}` }}>
                <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 800, color: P.ink }}>No alerts here</p>
                <p style={{ fontSize: '0.9rem', color: P.muted, marginTop: '4px' }}>
                  {filter !== 'all' ? `No ${filter} alerts for this selection.` : 'All clear!'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
                {visible.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onAction={handleAction} highlighted={highlightId === alert.id} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
