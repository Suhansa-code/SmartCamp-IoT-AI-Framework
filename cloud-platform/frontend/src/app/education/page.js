'use client'

import { useState, useEffect, useMemo } from 'react'
import SideNav from '@/components/common/SideNav'
import { useTheme } from '@/components/common/ThemeProvider'
import { GraduationCap, Users, BookOpen, BellRing, ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

// ── Cloud backend base URL (same as the network / disaster pages) ────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ── Display metadata for known camp ids ──────────────────────────────────────
const CAMP_META = {
  'CAMP-B-HOMAGAMA':   { name: 'Homagama Relief',   location: 'Colombo',      code: 'HMG' },
  'CAMP-B-GALLE':      { name: 'Galle Seafront',    location: 'Galle',        code: 'GAL' },
  'CAMP-B-RATHNAPURA': { name: 'Rathnapura Valley', location: 'Sabaragamuwa', code: 'RTP' },
  'CAMP-B-MATARA':     { name: 'Matara East',       location: 'Matara',       code: 'MAT' },
  'CAMP-B-KALUTARA':   { name: 'Kalutara South',    location: 'Kalutara',     code: 'KAL' },
  'CAMP-B-BATTICALOA': { name: 'Batticaloa North',  location: 'Eastern',      code: 'BAT' },
}

function campMeta(id) {
  if (CAMP_META[id]) return CAMP_META[id]
  const pretty = (id || '').replace(/^CAMP[_-]?B?[_-]?/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()).trim()
  return { name: pretty || id, location: 'Sector', code: (pretty || id).slice(0, 3).toUpperCase() }
}

// ── Demo fallback data (shown when the cloud backend is unreachable) ─────────
const MOCK_CAMPS = [
  { id: 'CAMP-B-HOMAGAMA',   children: 214, sessions: 468, avg_composite: 68.5, flagged_sessions: 17, total_alerts: 6,  pending_alerts: 2, grade_distribution: [{ grade: 3, count: 128 }, { grade: 4, count: 86 }] },
  { id: 'CAMP-B-GALLE',      children: 178, sessions: 352, avg_composite: 64.2, flagged_sessions: 11, total_alerts: 3,  pending_alerts: 1, grade_distribution: [{ grade: 3, count: 97 }, { grade: 4, count: 81 }] },
  { id: 'CAMP-B-RATHNAPURA', children: 242, sessions: 531, avg_composite: 61.8, flagged_sessions: 29, total_alerts: 9,  pending_alerts: 4, grade_distribution: [{ grade: 3, count: 141 }, { grade: 4, count: 101 }] },
  { id: 'CAMP-B-MATARA',     children: 156, sessions: 288, avg_composite: 71.4, flagged_sessions: 6,  total_alerts: 1,  pending_alerts: 0, grade_distribution: [{ grade: 3, count: 88 }, { grade: 4, count: 68 }] },
  { id: 'CAMP-B-KALUTARA',   children: 190, sessions: 374, avg_composite: 66.9, flagged_sessions: 14, total_alerts: 4,  pending_alerts: 1, grade_distribution: [{ grade: 3, count: 112 }, { grade: 4, count: 78 }] },
  { id: 'CAMP-B-BATTICALOA', children: 205, sessions: 449, avg_composite: 58.7, flagged_sessions: 33, total_alerts: 12, pending_alerts: 3, grade_distribution: [{ grade: 3, count: 120 }, { grade: 4, count: 85 }] },
]

function mockCampDetail(summary) {
  const base = 50 + Math.round(Math.random() * 30)
  const children = Array.from({ length: Math.min(summary.children, 10) }, (_, i) => ({
    child_id: `TEST-CHILD-${String(100000 + i).slice(-6)}`,
    res_id: `RES-${i + 1}`,
    camp_id: summary.id,
    grade: summary.grade_distribution[i]?.grade ?? 3,
    language: ['si', 'ta', 'en'][i % 3],
    baseline_score: Math.round(55 + Math.random() * 15),
    total_sessions: 4 + (i % 8),
    alert_status: i % 4 === 0 ? 'active' : 'none',
    recent_scores: Array.from({ length: 6 }, (_, k) => ({
      score: Math.max(30, Math.min(95, base - 6 + k * 3 + Math.round(Math.random() * 8))),
      date: new Date(Date.now() - (6 - k) * 86400e3).toISOString(),
    })),
  }))

  const sessions = []
  children.forEach((child, ci) => {
    const n = Math.min(child.total_sessions, 4)
    for (let s = 0; s < n; s += 1) {
      sessions.push({
        session_id: `S-${ci}-${s}`,
        child_id: child.child_id,
        composite_score: child.recent_scores[child.recent_scores.length - 1 - s]?.score ?? 60,
        anomaly_flagged: Math.random() < 0.12 ? 1 : 0,
        alert_triggered: 0,
        created_at: new Date(Date.now() - (ci * 3 + s) * 3600e3).toISOString(),
        grade: child.grade,
        language: child.language,
        baseline_score: child.baseline_score,
      })
    }
  })
  sessions.sort((a, b) => b.created_at.localeCompare(a.created_at))

  const alerts = children.filter((child) => child.alert_status === 'active').slice(0, 2).map((child, i) => ({
    alert_id: `AL-${i + 1}`,
    child_id: child.child_id,
    res_id: child.res_id,
    camp_id: summary.id,
    alert_type: '3_of_5_flagged',
    trigger_detail: { recent_scores: [50, 44, 38] },
    triggered_at: new Date(Date.now() - i * 86400e3).toISOString(),
    status: 'pending',
    resolved_at: null,
    resolved_notes: null,
  }))

  return {
    id: summary.id,
    children_count: summary.children,
    sessions_count: sessions.length,
    flagged_sessions: sessions.filter((s) => s.anomaly_flagged).length,
    avg_composite: summary.avg_composite,
    pending_alerts: alerts.length,
    total_alerts: summary.total_alerts,
    grade_distribution: summary.grade_distribution,
    language_distribution: [
      { language: 'si', count: Math.round(summary.children * 0.55) },
      { language: 'ta', count: Math.round(summary.children * 0.3) },
      { language: 'en', count: summary.children - Math.round(summary.children * 0.85) },
    ],
    children,
    sessions,
    alerts,
  }
}

// ── Small premium KPI card ───────────────────────────────────────────────────
function MiniKpi({ label, value, icon, color = '#14B8A6', sub }) {
  const { T } = useTheme()
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(145deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`, borderRadius: 16,
      padding: '1rem 1.1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
    }}>
      <div style={{ position: 'absolute', top: -26, right: -26, width: 92, height: 92, borderRadius: '50%', background: `${color}24`, filter: 'blur(28px)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: `${color}1f`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ marginTop: 6, fontSize: '0.7rem', fontWeight: 600, color: T.muted }}>{sub}</div>}
    </div>
  )
}

// ── Premium score-trend line chart (SVG) ─────────────────────────────────────
function TrendChart({ points, dark = true }) {
  const { T } = useTheme()
  const W = 560
  const H = 180
  const PAD = { top: 18, right: 20, bottom: 28, left: 40 }
  const gridColor = T.border
  const textColor = T.muted

  const data = useMemo(() => {
    if (!points || points.length < 2) return []
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    return points.map((p, i) => {
      const x = PAD.left + (i / (points.length - 1)) * innerW
      const pct = Math.max(0, Math.min(1, p.score / 100))
      const y = PAD.top + innerH * (1 - pct)
      return { ...p, x, y }
    })
  }, [points])

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem', color: T.muted }}>
        <GraduationCap size={34} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Not enough session data to plot a trend yet</p>
      </div>
    )
  }

  const path = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L ${data[data.length - 1].x} ${H - PAD.bottom} L ${data[0].x} ${H - PAD.bottom} Z`

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 420, display: 'block' }}>
        <defs>
          <linearGradient id="eduTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((v) => {
          const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / 100)
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={gridColor} strokeWidth="1" strokeDasharray="4 4" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill={textColor} opacity="0.6">{v}</text>
            </g>
          )
        })}

        <path d={area} fill="url(#eduTrendArea)" />
        <path d={path} fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((p, i) => {
          const dotColor = p.score >= 70 ? T.green : p.score >= 50 ? T.amber : T.red
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill={dotColor} stroke={T.bg} strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="2" fill={dotColor} />
            </g>
          )
        })}

        {data.map((p, i) =>
          i % Math.max(1, Math.floor(data.length / 8)) === 0 ? (
            <text key={`l${i}`} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill={textColor} opacity="0.55">{p.date}</text>
          ) : null,
        )}
      </svg>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
        <span style={{ color: T.green }}>● Strong ≥70</span>
        <span style={{ color: T.amber }}>● Watch 50–70</span>
        <span style={{ color: T.red }}>● Alert &lt;50</span>
      </div>
    </div>
  )
}

function ChildScoreDots({ scores }) {
  const { T } = useTheme()
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {scores.map((s, i) => (
        <span key={i} title={`${s.score}`} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: s.score >= 70 ? T.green : s.score >= 50 ? T.amber : T.red,
          opacity: 0.9,
        }} />
      ))}
    </div>
  )
}

function Chip({ children, color = '#14B8A6', bg }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
      background: bg || `${color}1a`, border: `1px solid ${color}55`, color,
    }}>{children}</span>
  )
}

function Panel({ title, right, children, bodyStyle }) {
  const { T } = useTheme()
  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`, borderRadius: 18,
      boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0.9rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
        {right}
      </div>
      <div style={{ padding: '1rem 1.1rem', ...bodyStyle }}>{children}</div>
    </div>
  )
}

export default function EducationPage() {
  const { T } = useTheme()
  const [camps, setCamps] = useState([])
  const [detail, setDetail] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loadingCamps, setLoadingCamps] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function loadCamps(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoadingCamps(true)
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps`)
      const payload = res.ok ? await res.json() : null
      const list = Array.isArray(payload?.camps) && payload.camps.length > 0 ? payload.camps : MOCK_CAMPS
      setCamps(list.map((c) => ({ ...c, last_session_at: c.last_session_at || new Date(Date.now() - 3600e3 * 4).toISOString() })))
    } catch {
      setCamps(MOCK_CAMPS)
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoadingCamps(false)
    }
  }

  useEffect(() => {
    loadCamps(false)
  }, [])

  async function selectCamp(id) {
    setSelectedId(id)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps/${encodeURIComponent(id)}`)
      const payload = res.ok ? await res.json() : null
      setDetail(payload?.camp ?? mockCampDetail(camps.find((c) => c.id === id) || { id, children: 0, grade_distribution: [] }))
    } catch {
      setDetail(mockCampDetail(camps.find((c) => c.id === id) || { id, children: 0, grade_distribution: [] }))
    } finally {
      setLoadingDetail(false)
    }
  }

  const totals = useMemo(() => camps.reduce((acc, c) => ({
    children: acc.children + (c.children || 0),
    sessions: acc.sessions + (c.sessions || 0),
    alerts: acc.alerts + (c.pending_alerts || 0),
  }), { children: 0, sessions: 0, alerts: 0 }), [camps])

  const avgOverall = useMemo(() => {
    const scored = camps.filter((c) => c.avg_composite != null)
    if (!scored.length) return null
    return Math.round((scored.reduce((s, c) => s + c.avg_composite, 0) / scored.length) * 10) / 10
  }, [camps])

  const trend = useMemo(() => {
    if (!detail) return []
    const asc = [...detail.sessions].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    const byDay = new Map()
    for (const s of asc) {
      if (s.composite_score == null) continue
      const day = s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'now'
      const entry = byDay.get(day) || { total: 0, count: 0 }
      entry.total += s.composite_score
      entry.count += 1
      byDay.set(day, entry)
    }
    return Array.from(byDay.entries()).map(([date, e]) => ({ date, score: Math.round(e.total / e.count) })).slice(-14)
  }, [detail])

  const childAvg = (child) => (child.recent_scores?.length ? Math.round(child.recent_scores.reduce((s, x) => s + x.score, 0) / child.recent_scores.length) : null)

  const ranked = useMemo(() => {
    if (!detail) return { atRisk: [], top: [] }
    const withAvg = detail.children.map((child) => ({ ...child, avg: childAvg(child) }))
    const atRisk = withAvg
      .filter((child) => child.alert_status === 'active' || (child.avg != null && child.avg < 50))
      .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
    const top = [...withAvg]
      .filter((child) => child.avg != null)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
    return { atRisk, top }
  }, [detail])

  const meta = selectedId ? campMeta(selectedId) : null

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius: 9999px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>

      <div style={{ minHeight: '100svh', background: T.bg, fontFamily: "'Inter',sans-serif", color: T.text, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <main style={{ padding: '1.5rem 2rem', width: '100%' }}>

          {/* Page heading */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: T.tealMid, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>PAGES Learning Analytics</div>
              <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                {detail ? meta?.name || 'Camp Details' : 'Education Insights'}
              </h1>
              <p style={{ color: T.muted, fontSize: '0.82rem', marginTop: 4, fontWeight: 600 }}>
                {loadingCamps
                  ? 'Loading camp data…'
                  : detail
                    ? `${meta?.code || ''} · ${meta?.location || 'Sector'} · ${detail.children_count} children tracked`
                    : `${camps.length} camps · ${totals.children.toLocaleString()} children · ${totals.sessions.toLocaleString()} sessions`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999,
                padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: T.green,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.green}`, animation: 'pulse 2s infinite' }} />
                Synced
              </span>
              <button onClick={() => loadCamps(true)} disabled={refreshing} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted,
                borderRadius: '0.75rem', padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              }}>
                <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Camp selector pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <button
              onClick={() => { setSelectedId(null); setDetail(null) }}
              style={{
                border: `1px solid ${!selectedId ? T.tealMid : T.border}`,
                background: !selectedId ? `${T.tealMid}22` : T.bgSoft,
                color: !selectedId ? T.tealMid : T.muted,
                borderRadius: 999, padding: '0.42rem 1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              All Camps
            </button>
            {camps.map((camp) => {
              const active = selectedId === camp.id
              const m = campMeta(camp.id)
              return (
                <button
                  key={camp.id}
                  onClick={() => selectCamp(camp.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    border: `1px solid ${active ? T.tealMid : T.border}`,
                    background: active ? `${T.tealMid}22` : T.bgSoft,
                    color: active ? T.textPrimary : T.muted,
                    borderRadius: 999, padding: '0.42rem 1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                  }}
                >
                  {m.code}
                  {(camp.pending_alerts || 0) > 0 && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.red, boxShadow: `0 0 6px ${T.red}` }} />
                  )}
                </button>
              )
            })}
          </div>

          {loadingCamps ? (
            <div className="grid-kpi">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ background: T.navyCard, borderRadius: '1rem', height: 120, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : detail ? (
            <>
              {/* Camp-level KPIs */}
              <div className="grid-kpi" style={{ marginBottom: '1.1rem' }}>
                <MiniKpi label="Children" value={detail.children_count.toLocaleString()} icon={<Users size={16} />} color="#60A5FA" sub={`Grade ${detail.grade_distribution?.map((g) => `${g.grade}: ${g.count}`).join(' · ') || '—'}`} />
                <MiniKpi label="Sessions" value={detail.sessions_count.toLocaleString()} icon={<BookOpen size={16} />} color="#4ADE80" sub={`${detail.flagged_sessions} flagged anomalies`} />
                <MiniKpi label="Avg Score" value={detail.avg_composite != null ? detail.avg_composite.toFixed(1) : '—'} icon={<TrendingUp size={16} />} color={detail.avg_composite >= 70 ? T.green : detail.avg_composite >= 50 ? T.amber : T.red} sub="composite across sessions" />
                <MiniKpi label="Pending Alerts" value={detail.pending_alerts} icon={<BellRing size={16} />} color={detail.pending_alerts > 0 ? T.red : T.green} sub={`${detail.total_alerts} total alerts`} />
              </div>

              {/* Trend chart */}
              <div className="grid-panel" style={{ marginBottom: '1.1rem' }}>
                <Panel title="Camp Score Trend" right={<Chip color={T.tealMid}>Daily average composite</Chip>}>
                  <TrendChart points={trend} />
                </Panel>
                <Panel title="Distribution">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Grade</div>
                      {detail.grade_distribution?.map((g) => (
                        <div key={g.grade} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                            <span>Grade {g.grade}</span><span style={{ color: T.tealMid }}>{g.count}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: T.bar, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.round((g.count / detail.children_count) * 100))}%`, height: '100%', background: 'linear-gradient(90deg,#0D9488,#14B8A6)', borderRadius: 99 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Language</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {detail.language_distribution?.map((lang) => (
                          <Chip key={lang.language} color={lang.language === 'si' ? T.blue : lang.language === 'ta' ? T.amber : T.purple}>
                            {lang.language.toUpperCase()} · {lang.count}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Flagged Rate</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: T.amber }}>
                        {detail.sessions_count ? Math.round((detail.flagged_sessions / detail.sessions_count) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>

              {/* Children: at risk + top learners */}
              <div className="grid-2" style={{ marginBottom: '1.1rem' }}>
                <Panel title="Needs Attention" right={<Chip color={T.red}>{ranked.atRisk.length} child{ranked.atRisk.length !== 1 ? 'ren' : ''}</Chip>}>
                  {ranked.atRisk.length ? ranked.atRisk.slice(0, 6).map((child) => (
                    <div key={child.child_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0', borderBottom: `1px solid ${T.line}30` }}>
                      <span style={{ width: 30, height: 30, borderRadius: 10, background: `${T.red}1f`, border: `1px solid ${T.red}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⚠️</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.child_id}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                          <Chip color={T.slate}>G{child.grade}</Chip>
                          {child.alert_status === 'active' && <Chip color={T.red}>Active alert</Chip>}
                          <ChildScoreDots scores={child.recent_scores || []} />
                        </div>
                      </div>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: child.avg != null && child.avg < 50 ? T.red : T.amber }}>
                        {child.avg != null ? child.avg : '—'}
                      </span>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '1.6rem', color: T.muted }}>
                      <CheckCircle2 size={30} style={{ margin: '0 auto 8px', color: T.green }} />
                      <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>All children are performing within expected ranges</p>
                    </div>
                  )}
                </Panel>

                <Panel title="Top Learners" right={<Chip color={T.green}>Top 5</Chip>}>
                  {ranked.top.map((child, index) => (
                    <div key={child.child_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0', borderBottom: `1px solid ${T.line}30` }}>
                      <span style={{ width: 28, height: 28, borderRadius: 10, background: `${T.green}1f`, border: `1px solid ${T.green}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: T.green }}>
                        {index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.child_id}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                          <Chip color={T.slate}>G{child.grade}</Chip>
                          <ChildScoreDots scores={child.recent_scores || []} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <TrendingUp size={13} color={T.green} />
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: T.green }}>{child.avg}</span>
                      </div>
                    </div>
                  ))}
                  {!ranked.top.length && <div style={{ textAlign: 'center', padding: '1.6rem', color: T.muted }}>No scored sessions yet</div>}
                </Panel>
              </div>

              {/* Recent sessions */}
              <Panel
                title="Recent Sessions"
                right={<Chip color={T.blue}>{detail.sessions.length} recorded</Chip>}
                bodyStyle={{ padding: 0 }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 560 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: T.muted, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        <th style={{ padding: '0.6rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>Child</th>
                        <th style={{ padding: '0.6rem', borderBottom: `1px solid ${T.line}` }}>Grade</th>
                        <th style={{ padding: '0.6rem', borderBottom: `1px solid ${T.line}` }}>Score</th>
                        <th style={{ padding: '0.6rem', borderBottom: `1px solid ${T.line}` }}>Flag</th>
                        <th style={{ padding: '0.6rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.sessions.slice(0, 8).map((s) => (
                        <tr key={s.session_id} style={{ borderBottom: `1px solid ${T.line}25` }}>
                          <td style={{ padding: '0.6rem 1.1rem', fontWeight: 800 }}>{s.child_id}</td>
                          <td style={{ padding: '0.6rem' }}><Chip color={T.slate}>G{s.grade ?? '—'}</Chip></td>
                          <td style={{ padding: '0.6rem', fontWeight: 800, color: s.composite_score >= 70 ? T.green : s.composite_score >= 50 ? T.amber : T.red }}>
                            {s.composite_score != null ? Math.round(s.composite_score) : '—'}
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            {s.anomaly_flagged ? <span style={{ color: T.red, fontWeight: 800 }}>⚠ flagged</span> : <span style={{ color: T.green, fontWeight: 700 }}>✓ ok</span>}
                          </td>
                          <td style={{ padding: '0.6rem 1.1rem', color: T.muted }}>
                            {s.created_at ? new Date(s.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Alerts */}
              <div style={{ marginTop: '1.1rem' }}>
                <Panel title="Camp Alerts" right={<Chip color={detail.pending_alerts > 0 ? T.red : T.green}>{detail.pending_alerts} pending</Chip>}>
                  {detail.alerts.length ? detail.alerts.slice(0, 6).map((alert) => (
                    <div key={alert.alert_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 0', borderBottom: `1px solid ${T.line}30` }}>
                      <span style={{ width: 32, height: 32, borderRadius: 10, background: `${alert.status === 'pending' ? T.red : T.green}1f`, border: `1px solid ${alert.status === 'pending' ? T.red : T.green}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {alert.status === 'pending' ? <AlertTriangle size={15} color={T.red} /> : <CheckCircle2 size={15} color={T.green} />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>{alert.child_id} · {alert.alert_type.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2 }}>
                          {alert.triggered_at ? new Date(alert.triggered_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          {alert.trigger_detail?.recent_scores ? ` · recent: ${alert.trigger_detail.recent_scores.join(' → ')}` : ''}
                        </div>
                      </div>
                      <Chip color={alert.status === 'pending' ? T.red : T.green}>{alert.status}</Chip>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '1.6rem', color: T.muted }}>
                      <CheckCircle2 size={30} style={{ margin: '0 auto 8px', color: T.green }} />
                      <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>No alerts for this camp</p>
                    </div>
                  )}
                </Panel>
              </div>

              <div style={{ marginTop: '1.2rem', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setSelectedId(null); setDetail(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: `1px solid ${T.border}`, background: T.bgSoft, color: T.textPrimary,
                    borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={15} /> Back to all camps
                </button>
              </div>
            </>
          ) : camps.length ? (
            <>
              {/* Overview KPIs */}
              <div className="grid-kpi" style={{ marginBottom: '1.1rem' }}>
                <MiniKpi label="Total Camps" value={camps.length} icon={<GraduationCap size={16} />} color="#60A5FA" sub="active education camps" />
                <MiniKpi label="Children" value={totals.children.toLocaleString()} icon={<Users size={16} />} color="#4ADE80" sub="grade 3 & 4 tracked" />
                <MiniKpi label="Sessions" value={totals.sessions.toLocaleString()} icon={<BookOpen size={16} />} color="#FACC15" sub="synced from devices" />
                <MiniKpi label="Avg Score" value={avgOverall != null ? avgOverall.toFixed(1) : '—'} icon={<TrendingUp size={16} />} color={avgOverall >= 70 ? T.green : avgOverall >= 50 ? T.amber : T.red} sub="camps aggregate" />
              </div>

              {/* Camp cards */}
              <div className="grid-auto">
                {camps.map((camp) => {
                  const m = campMeta(camp.id)
                  const alertTone = (camp.pending_alerts || 0) > 0 ? T.red : T.green
                  return (
                    <button
                      key={camp.id}
                      onClick={() => selectCamp(camp.id)}
                      style={{
                        textAlign: 'left',
                        background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
                        border: `1px solid ${T.border}`, borderRadius: 16,
                        padding: '1rem 1.1rem', cursor: 'pointer', color: 'inherit',
                        boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
                        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 18px 40px rgba(0,0,0,0.32)'; e.currentTarget.style.borderColor = T.tealMid }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.18)'; e.currentTarget.style.borderColor = T.border }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '1.02rem', fontWeight: 800, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                          <div style={{ marginTop: 3, fontSize: '0.74rem', color: T.muted, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>{m.code}</span>·<span>{m.location}</span>
                          </div>
                        </div>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999,
                          background: `${alertTone}1a`, border: `1px solid ${alertTone}55`,
                          color: alertTone, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                        }}>
                          {(camp.pending_alerts || 0) > 0 ? `${camp.pending_alerts} alerts` : 'clear'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: `1px solid ${T.line}` }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: T.textPrimary }}>{camp.children}</div>
                          <div style={{ marginTop: 3, fontSize: '0.62rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Children</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: T.textPrimary }}>{camp.sessions}</div>
                          <div style={{ marginTop: 3, fontSize: '0.62rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sessions</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: camp.avg_composite >= 70 ? T.green : camp.avg_composite >= 50 ? T.amber : T.red }}>
                            {camp.avg_composite != null ? camp.avg_composite.toFixed(1) : '—'}
                          </div>
                          <div style={{ marginTop: 3, fontSize: '0.62rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg Score</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ background: `linear-gradient(160deg, ${T.card}, ${T.bg})`, border: `1px dashed ${T.border}`, borderRadius: '1.25rem', padding: '3.5rem', textAlign: 'center' }}>
              <GraduationCap size={44} style={{ margin: '0 auto', color: T.tealMid, opacity: 0.7 }} />
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.15rem', fontWeight: 800, marginTop: '0.7rem' }}>No education data synced yet</p>
              <p style={{ color: T.muted, fontSize: '0.85rem', marginTop: '0.35rem' }}>Camp education insights will appear here once the camp devices push session data to the cloud.</p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}