'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/admin/alerts/page.jsx — PAGES Admin Welfare Alert Dashboard
// Next.js 14 App Router · Requires Cognito auth (middleware-guarded)
//
// Layout
//  · bg #0A2540 (dark navy) · sidebar camp list · main alert cards
//
// Alert cards
//  · card bg #1E3A5F · left border amber (pending) / green (resolved)
//  · Child ID anonymised (e.g. HMG-012)
//  · Score trend: recharts ResponsiveContainer → LineChart sparkline
//  · Actions: Mark Reviewed (teal) · Escalate (amber)
//
// Data: GET /api/admin/alerts → loading skeleton → filter + sort
// Filters: All · Pending · Resolved · Escalated
// Sort:    Most recent · Oldest · Camp
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  navy:        '#0A2540',
  navyCard:    '#1E3A5F',
  navyLight:   '#243B5E',
  teal:        '#0D9488',
  amber:       '#F59E0B',
  green:       '#10B981',
  textPrimary: '#FFFFFF',
  textMuted:   '#94A3B8',
  border:      '#2D4A70',
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

// ── Days since helper ─────────────────────────────────────────────────────────
function daysSince(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return '1 day ago'
  return `${d} days ago`
}

// ── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const map = {
    high:   { bg: '#450A0A', color: '#FCA5A5', label: '🔴 High' },
    medium: { bg: '#451A03', color: '#FCD34D', label: '🟡 Medium' },
    low:    { bg: '#022C22', color: '#6EE7B7', label: '🟢 Low' },
  }
  const s = map[severity] ?? map.low
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      borderRadius: '9999px',
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
  const last = scores[scores.length - 1]?.score ?? 0
  const lineColor = last >= 70 ? C.green : last >= 50 ? C.amber : '#F87171'

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#0A2540', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '4px 10px' }}>
        <p style={{ color: 'white', fontSize: '0.78rem', fontWeight: 700, margin: 0 }}>
          S{payload[0]?.payload?.session}: {payload[0]?.value}
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 64 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scores} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={50} stroke={C.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
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

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: C.navyCard,
      borderRadius: '1rem',
      borderLeft: `6px solid ${C.border}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {[160, 120, 80, 64].map((w, i) => (
        <div key={i} style={{
          height: i === 3 ? 52 : 14,
          width: `${Math.min(100, (w / 2))}%`,
          background: C.navyLight,
          borderRadius: '9999px',
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────
function AlertCard({ alert, onAction }) {
  const [actionLoading, setActionLoading] = useState(null)

  const borderColor = alert.status === 'resolved' ? C.green
    : alert.status === 'escalated'               ? '#A78BFA'
    : C.amber   // pending

  async function doAction(action) {
    setActionLoading(action)
    try {
      await fetch(`/api/alerts/${alert.id}/${action}`, { method: 'POST' })
      onAction(alert.id, action)
    } catch { /* offline */ }
    finally { setActionLoading(null) }
  }

  const statusLabel = {
    pending:   { color: C.amber,   label: '● Pending'   },
    resolved:  { color: C.green,   label: '● Resolved'  },
    escalated: { color: '#A78BFA', label: '● Escalated' },
  }[alert.status] ?? { color: C.textMuted, label: '● Unknown' }

  return (
    <div style={{
      background: C.navyCard,
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
              fontFamily: "'Baloo 2',cursive",
              fontSize: '1.35rem',
              fontWeight: 900,
              color: C.textPrimary,
            }}>
              {alert.childId}
            </span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p style={{ fontSize: '0.85rem', color: C.textMuted, marginTop: '2px', fontWeight: 600 }}>
            🏕️ {alert.campName}
          </p>
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: statusLabel.color }}>
          {statusLabel.label}
        </span>
      </div>

      {/* ── Alert type + time ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '0.75rem',
        padding: '0.6rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
          ⚠️ {alert.alertType}
        </span>
        <span style={{ fontSize: '0.8rem', color: C.textMuted, fontWeight: 600 }}>
          🕐 {daysSince(alert.triggeredAt)}
        </span>
      </div>

      {/* ── Score trend sparkline ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 600 }}>
            Last 5 sessions
          </span>
          <span style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 600 }}>
            Score →
          </span>
        </div>
        <ScoreSparkline scores={alert.scores} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          {alert.scores.map((s, i) => (
            <span key={i} style={{ fontSize: '0.7rem', color: C.textMuted, fontWeight: 600 }}>
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
              background: actionLoading === 'review' ? '#0A7670' : C.teal,
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
                background: actionLoading === 'escalate' ? '#92400E' : 'rgba(245,158,11,0.15)',
                color: C.amber,
                borderRadius: '0.75rem',
                border: `2px solid ${C.amber}`,
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

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ camps, selectedCamp, onSelect, alertCounts }) {
  return (
    <aside style={{
      width: '240px',
      background: '#071B30',
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      {/* Sidebar header */}
      <div style={{ padding: '1.25rem 1rem 0.75rem' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Camps
        </p>
      </div>

      {/* Camp list */}
      {camps.map(camp => {
        const count   = alertCounts[camp.id] ?? camp.count
        const active  = selectedCamp === camp.id
        return (
          <button
            key={camp.id}
            onClick={() => onSelect(camp.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: active ? C.navyCard : 'transparent',
              border: 'none',
              borderLeft: active ? `3px solid ${C.teal}` : '3px solid transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: active ? 700 : 600, color: active ? 'white' : C.textMuted, fontSize: '0.9rem' }}>
              {camp.name}
            </span>
            {count > 0 && (
              <span style={{
                background: C.amber,
                color: '#1C1917',
                borderRadius: '9999px',
                padding: '1px 8px',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </aside>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminAlertsPage() {
  const [alerts,      setAlerts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('all')      // all|pending|resolved|escalated
  const [sortBy,      setSortBy]      = useState('recent')   // recent|oldest|camp
  const [selectedCamp,setSelectedCamp]= useState('all')
  const [adminName,   setAdminName]   = useState('Admin')    // from Cognito session

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/alerts')
      if (res.ok) {
        setAlerts(await res.json())
      } else {
        throw new Error('API error')
      }
    } catch {
      // Use mock data in dev / offline
      setAlerts(mockAlerts())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  // ── Cognito name (stub — replace with actual Cognito SDK call) ─────────────
  useEffect(() => {
    // Example: import { fetchAuthSession } from 'aws-amplify/auth'
    // const session = await fetchAuthSession()
    // setAdminName(session.tokens.idToken.payload.name)
    setAdminName('Dr. Perera')
  }, [])

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
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800;900&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 9999px; }
      `}</style>

      <div style={{
        minHeight: '100svh',
        background: C.navy,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Nunito', sans-serif",
        color: C.textPrimary,
      }}>

        {/* ══ Header bar ══════════════════════════════════════════════════════ */}
        <header style={{
          background: '#071B30',
          borderBottom: `1px solid ${C.border}`,
          padding: '0 1.5rem',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 10,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 34, height: 34,
              borderRadius: '0.6rem',
              background: C.teal,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '1rem', color: 'white',
              fontFamily: "'Baloo 2',cursive",
            }}>
              P
            </div>
            <div>
              <span style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 800, fontSize: '1.15rem', color: 'white' }}>
                PAGES
              </span>
              <span style={{ fontSize: '0.72rem', color: C.textMuted, marginLeft: '8px', fontWeight: 600 }}>
                Admin Console
              </span>
            </div>
          </div>

          {/* Admin info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{adminName}</p>
              <p style={{ fontSize: '0.72rem', color: C.textMuted }}>Administrator</p>
            </div>
            <div style={{
              width: 36, height: 36,
              borderRadius: '50%',
              background: C.navyCard,
              border: `2px solid ${C.teal}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
            }}>
              👤
            </div>
          </div>
        </header>

        {/* ══ Body: sidebar + main ═════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', maxWidth: 1280, margin: '0 auto', width: '100%' }}>

          {/* ── Sidebar ── */}
          <Sidebar
            camps={MOCK_CAMPS}
            selectedCamp={selectedCamp}
            onSelect={setSelectedCamp}
            alertCounts={alertCounts}
          />

          {/* ── Main content ── */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

            {/* Page title */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h1 style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>
                ⚠️ Welfare Alerts
              </h1>
              <p style={{ fontSize: '0.85rem', color: C.textMuted, marginTop: '2px', fontWeight: 600 }}>
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
                        background: active ? C.teal : 'transparent',
                        color: active ? 'white' : C.textMuted,
                        border: `2px solid ${active ? C.teal : C.border}`,
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
                        background: active ? 'rgba(255,255,255,0.25)' : C.navyCard,
                        borderRadius: '9999px',
                        padding: '0 6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: active ? 'white' : C.textMuted,
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
                  background: C.navyCard,
                  color: C.textPrimary,
                  border: `2px solid ${C.border}`,
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
                background: C.navyCard,
                borderRadius: '1.25rem',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</p>
                <p style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>
                  No alerts here
                </p>
                <p style={{ fontSize: '0.9rem', color: C.textMuted, marginTop: '4px' }}>
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
