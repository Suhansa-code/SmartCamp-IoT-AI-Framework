'use client'

// Welfare Alert Dashboard
// Layout: dark navy bg · sidebar camp list · main alert cards
// Alert cards: card bg #1E3A5F · left border amber (pending) / green (resolved)
//   · Child ID anonymised · Score trend sparkline · Actions: Review / Escalate
// Data: GET /api/alerts → loading skeleton → filter + sort

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import CampSidebar from '@/components/common/CampSidebar'
import SkeletonCard from '@/components/common/SkeletonCard'
import SideNav from '@/components/common/SideNav'
import { useTheme } from '@/components/common/ThemeProvider'
import { daysSince } from '@/components/common/utils'

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

// ── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const { T } = useTheme()
  const map = {
    high:   { bg: `${T.red}1a`, color: T.red, label: '🔴 High' },
    medium: { bg: `${T.amber}1a`, color: T.amber, label: '🟡 Medium' },
    low:    { bg: `${T.green}1a`, color: T.green, label: '🟢 Low' },
  }
  const s = map[severity] ?? map.low
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      borderRadius: '9999px',
      border: `1px solid ${s.color}55`,
      padding: '3px 12px',
      fontSize: '0.75rem',
      fontWeight: 700,
    }}>
      {s.label}
    </span>
  )
}

// ── Score sparkline (recharts) ────────────────────────────────────────────────
function ScoreSparkline({ scores }) {
  const { T } = useTheme()
  const last = scores[scores.length - 1]?.score ?? 0
  const lineColor = last >= 70 ? T.green : last >= 50 ? T.amber : T.red

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '4px 10px' }}>
        <p style={{ color: T.textPrimary, fontSize: '0.78rem', fontWeight: 700, margin: 0 }}>
          S{payload[0]?.payload?.session}: {payload[0]?.value}
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 64 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scores} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={50} stroke={T.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: lineColor }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────
function AlertCard({ alert, onAction }) {
  const { T } = useTheme()
  const [actionLoading, setActionLoading] = useState(null)

  const borderColor = alert.status === 'resolved' ? T.green
    : alert.status === 'escalated'               ? T.purple
    : T.amber   // pending

  async function doAction(action) {
    setActionLoading(action)
    try {
      let endpoint = `/api/alerts/${alert.id}/resolve`
      let method = 'POST'
      let body = {}

      if (action === 'review') {
        // Mark as resolved
        body = { notes: 'Reviewed by admin' }
      } else if (action === 'escalate') {
        // Escalate - for future implementation
        body = { notes: 'Escalated by admin' }
      }

      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        onAction(alert.id, action)
      }
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const statusLabel = {
    pending:   { color: T.amber,   label: '● Pending'   },
    resolved:  { color: T.green,   label: '● Resolved'  },
    escalated: { color: T.purple,  label: '● Escalated' },
  }[alert.status] ?? { color: T.muted, label: '● Unknown' }

  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`,
      borderRadius: '1rem',
      borderLeft: `6px solid ${borderColor}`,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: `0 4px 24px rgba(0,0,0,0.25)`,
      transition: 'transform 0.15s',
    }}>
      {/* ── Top row: child ID + badges ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontFamily: "'Inter',sans-serif",
              fontSize: '1.35rem',
              fontWeight: 800,
              color: T.textPrimary,
            }}>
              {alert.childId}
            </span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p style={{ fontSize: '0.85rem', color: T.muted, marginTop: '2px', fontWeight: 600 }}>
            🏕️ {alert.campName}
          </p>
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: statusLabel.color }}>
          {statusLabel.label}
        </span>
      </div>

      {/* ── Alert type + time ── */}
      <div style={{
        background: T.bgSoft,
        borderRadius: '0.75rem',
        padding: '0.6rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: T.textPrimary }}>
          ⚠️ {alert.alertType}
        </span>
        <span style={{ fontSize: '0.8rem', color: T.muted, fontWeight: 600 }}>
          🕐 {daysSince(alert.triggeredAt)}
        </span>
      </div>

      {/* ── Score trend sparkline ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 600 }}>
            Last 5 sessions
          </span>
          <span style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 600 }}>
            Score →
          </span>
        </div>
        <ScoreSparkline scores={alert.scores} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          {alert.scores.map((s, i) => (
            <span key={i} style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 600 }}>
              {s.score}
            </span>
          ))}
        </div>
      </div>

      {/* ── Action buttons ── */}
      {alert.status !== 'resolved' && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => doAction('review')}
            disabled={!!actionLoading}
            style={{
              flex: 1,
              minHeight: '44px',
              background: actionLoading === 'review' ? T.tealDim : T.teal,
              color: 'white',
              borderRadius: '0.75rem',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            {actionLoading === 'review' ? '⏳' : '✅'} Mark Reviewed
          </button>

          {alert.status !== 'escalated' && (
            <button
              onClick={() => doAction('escalate')}
              disabled={!!actionLoading}
              style={{
                flex: 1,
                minHeight: '44px',
                background: actionLoading === 'escalate' ? T.amber : `${T.amber}1f`,
                color: T.amber,
                borderRadius: '0.75rem',
                border: `2px solid ${T.amber}`,
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              {actionLoading === 'escalate' ? '⏳' : '🔺'} Escalate
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { T } = useTheme()
  const [alerts,      setAlerts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('all')      // all|pending|resolved|escalated
  const [sortBy,      setSortBy]      = useState('recent')   // recent|oldest|camp
  const [selectedCamp,setSelectedCamp]= useState('all')

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/api/alerts?status=${filter === 'all' ? '' : filter}&camp=${selectedCamp === 'all' ? '' : selectedCamp}`)
      if (res.ok) {
        const data = await res.json()
        // Transform API response to UI format
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
      // Use mock data in dev / offline
      setAlerts(mockAlerts())
    } finally {
      setLoading(false)
    }
  }, [filter, selectedCamp])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  // ── Alert action handler ────────────────────────────────────────────────────
  function handleAction(alertId, action) {
    setAlerts(prev => prev.map(a => {
      if (a.id !== alertId) return a
      if (action === 'review')   return { ...a, status: 'resolved' }
      if (action === 'escalate') return { ...a, status: 'escalated' }
      return a
    }))
  }

  // ── Filtering + sorting ─────────────────────────────────────────────────────
  const visible = alerts
    .filter(a => {
      if (selectedCamp !== 'all' && a.campId !== selectedCamp) return false
      if (filter !== 'all' && a.status !== filter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return b.triggeredAt - a.triggeredAt
      if (sortBy === 'oldest') return a.triggeredAt - b.triggeredAt
      if (sortBy === 'camp')   return a.campName.localeCompare(b.campName)
      return 0
    })

  // ── Alert counts per camp (for sidebar badges) ──────────────────────────────
  const alertCounts = alerts.reduce((acc, a) => {
    if (a.status !== 'resolved') {
      acc[a.campId] = (acc[a.campId] ?? 0) + 1
      acc['all']    = (acc['all']    ?? 0) + 1
    }
    return acc
  }, {})

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
        @keyframes skeletonPulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 9999px; }
      `}</style>

      <div style={{
        minHeight: '100svh',
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', sans-serif",
        color: T.text,
        paddingLeft: 'var(--rail-width, 236px)',
        transition: 'padding-left 0.2s ease',
      }}>

        <SideNav />

        {/* ══ Body: sidebar + main ═════════════════════════════════════════════ */}
        <div className="dash-body" style={{ overflow: 'hidden' }}>

          {/* ── Sidebar ── */}
          <CampSidebar
            camps={MOCK_CAMPS}
            selectedCamp={selectedCamp}
            onSelect={setSelectedCamp}
            counts={alertCounts}
          />

          {/* ── Main content ── */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

            {/* Page title */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.6rem', fontWeight: 800, color: T.textPrimary }}>
                ⚠️ Welfare Alerts
              </h1>
              <p style={{ fontSize: '0.85rem', color: T.muted, marginTop: '2px', fontWeight: 600 }}>
                {loading ? 'Loading…' : `${visible.length} alert${visible.length !== 1 ? 's' : ''} · ${selectedCamp === 'all' ? 'All camps' : MOCK_CAMPS.find(c => c.id === selectedCamp)?.name}`}
              </p>
            </div>

            {/* Filter + sort bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}>
              {/* Filter pills */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {FILTER_OPTIONS.map(f => {
                  const active = filter === f.key
                  const cnt    = f.key === 'all'
                    ? alerts.length
                    : alerts.filter(a => a.status === f.key).length
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      style={{
                        background: active ? T.teal : 'transparent',
                        color: active ? '#fff' : T.muted,
                        border: `2px solid ${active ? T.teal : T.border}`,
                        borderRadius: '9999px',
                        padding: '4px 14px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      {f.label}
                      <span style={{
                        background: active ? 'rgba(255,255,255,0.25)' : T.navyCard,
                        borderRadius: '9999px',
                        padding: '0 6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: active ? '#fff' : T.muted,
                      }}>
                        {cnt}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Sort select */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  background: T.navyCard,
                  color: T.textPrimary,
                  border: `2px solid ${T.border}`,
                  borderRadius: '0.6rem',
                  padding: '6px 12px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* ── Alert list ── */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : visible.length === 0 ? (
              <div style={{
                background: T.navyCard,
                borderRadius: '1.25rem',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.4rem', fontWeight: 800, color: T.textPrimary }}>
                  No alerts here
                </p>
                <p style={{ fontSize: '0.9rem', color: T.muted, marginTop: '4px' }}>
                  {filter !== 'all' ? `No ${filter} alerts for this selection.` : 'All clear!'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {visible.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onAction={handleAction} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}