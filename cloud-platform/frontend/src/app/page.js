'use client'

import { useState, useEffect, useMemo } from 'react'
import SideNav from '@/components/common/SideNav'
import SearchBar from '@/components/common/SearchBar'
import { useTheme } from '@/components/common/ThemeProvider'

// ── Demo fallback data (used when the cloud backend endpoint is unreachable) ──
const MOCK_CAMPS = [
  { id: 'hmg',  name: 'Homagama Relief',    code: 'HMG', location: 'Colombo',       childCount: 214, sessionCount: 128, alerts: [{}, {}],       updated: 4 },
  { id: 'gal',  name: 'Galle Seafront',     code: 'GAL', location: 'Galle',         childCount: 178, sessionCount: 96,  alerts: [{}],           updated: 12 },
  { id: 'rtp',  name: 'Rathnapura Valley',  code: 'RTP', location: 'Sabaragamuwa',  childCount: 242, sessionCount: 151, alerts: [{}, {}, {}],   updated: 2 },
  { id: 'mat',  name: 'Matara East',        code: 'MAT', location: 'Matara',        childCount: 156, sessionCount: 88,  alerts: [],             updated: 26 },
  { id: 'kal',  name: 'Kalutara South',     code: 'KAL', location: 'Kalutara',      childCount: 190, sessionCount: 117, alerts: [{}, {}],       updated: 9 },
  { id: 'bat',  name: 'Batticaloa North',   code: 'BAT', location: 'Eastern',       childCount: 205, sessionCount: 132, alerts: [{}],           updated: 1 },
]

const statusMeta = (T, s) => ({
  clear:  { label: 'Clear',  color: T.green },
  watch:  { label: 'Watch',  color: T.amber },
  urgent: { label: 'Urgent', color: T.red },
}[s] || { label: 'Clear', color: T.green })

function KpiCard({ label, value, icon, color, delta, pct = 100 }) {
  const { T } = useTheme()
  const deltaTone = (delta ?? '').startsWith('-') ? T.red : T.green
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(145deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '1.05rem 1.15rem',
      boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
    }}>
      <div style={{ position: 'absolute', top: -26, right: -26, width: 96, height: 96, borderRadius: '50%', background: `${color}24`, filter: 'blur(28px)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `${color}1f`, border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</span>
        {delta && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: deltaTone }}>{delta}</span>}
      </div>
      <div style={{ marginTop: 14, height: 4, borderRadius: 99, background: T.bar, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function CampCard({ camp }) {
  const { T } = useTheme()
  const meta = statusMeta(T, camp.status)
  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '1rem 1.1rem',
      boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-3px)'
      e.currentTarget.style.boxShadow = '0 18px 40px rgba(0,0,0,0.32)'
      e.currentTarget.style.borderColor = meta.color
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.18)'
      e.currentTarget.style.borderColor = T.border
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 800, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{camp.name}</div>
          <div style={{ marginTop: 3, fontSize: '0.74rem', color: T.muted, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{camp.code}</span>·<span>{camp.location}</span>
          </div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 999,
          background: `${meta.color}1a`, border: `1px solid ${meta.color}55`,
          color: meta.color, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>{meta.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: `1px solid ${T.line}` }}>
        {[
          { label: 'Children', value: camp.childCount, icon: '🧒' },
          { label: 'Sessions', value: camp.sessionCount, icon: '📋' },
          { label: 'Alerts', value: camp.alertCount, icon: '⚠️', tone: camp.alertCount > 0 ? T.red : T.muted },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: s.tone || T.textPrimary, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ marginTop: 3, fontSize: '0.62rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { T } = useTheme()
  const [camps, setCamps]        = useState([])
  const [loading, setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('alertsDesc')

  async function loadCamps(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const r = await fetch('/api/admin/camps')
      const payload = r.ok ? await r.json() : []
      setCamps(Array.isArray(payload) && payload.length > 0 ? payload : MOCK_CAMPS)
    } catch {
      setCamps(MOCK_CAMPS)
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    loadCamps(false)
  }, [])

  const normalizedCamps = useMemo(() => {
    return camps.map((camp) => {
      const alertCount = camp.alerts?.length ?? 0
      const status = alertCount === 0 ? 'clear' : alertCount <= 2 ? 'watch' : 'urgent'
      return {
        ...camp,
        alertCount,
        status,
        childCount: Number(camp.childCount ?? 0),
        sessionCount: Number(camp.sessionCount ?? 0),
      }
    })
  }, [camps])

  const stats = useMemo(() => {
    const totalCamps = normalizedCamps.length
    const totalChildren = normalizedCamps.reduce((s, c) => s + c.childCount, 0)
    const totalSessions = normalizedCamps.reduce((s, c) => s + c.sessionCount, 0)
    const totalAlerts = normalizedCamps.reduce((s, c) => s + c.alertCount, 0)
    const urgent = normalizedCamps.filter((c) => c.status === 'urgent').length
    return { totalCamps, totalChildren, totalSessions, totalAlerts, urgent }
  }, [normalizedCamps])

  const filteredCamps = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    let list = normalizedCamps.filter((camp) => {
      const matchesText = !q
        || camp.name?.toLowerCase().includes(q)
        || camp.code?.toLowerCase().includes(q)
        || camp.location?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || camp.status === statusFilter
      return matchesText && matchesStatus
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'sessionsDesc') return b.sessionCount - a.sessionCount
      if (sortBy === 'childrenDesc') return b.childCount - a.childCount
      return b.alertCount - a.alertCount
    })

    return list
  }, [normalizedCamps, searchText, statusFilter, sortBy])

  const today = useMemo(() => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), [])

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
          {/* Welcome strip */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Camp Command Center</div>
              <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                All Camps Overview
              </h1>
              <p style={{ color: T.muted, fontSize: '0.82rem', marginTop: 4, fontWeight: 600 }}>
                {loading ? 'Loading camp data…' : `${filteredCamps.length} of ${stats.totalCamps} camp${stats.totalCamps !== 1 ? 's' : ''} shown · ${stats.urgent} urgent`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 600 }}>{today}</span>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999,
                padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: T.green,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.green}`, animation: 'pulse 2s infinite' }} />
                Live
              </span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid-kpi" style={{ marginBottom: '1.25rem' }}>
            <KpiCard label="Total Camps"  value={stats.totalCamps}  icon="🏕️" color="#60A5FA" delta="+2 this month" pct={100} />
            <KpiCard label="Children"     value={stats.totalChildren} icon="🧒" color="#4ADE80" delta="+8.4%" pct={Math.min(100, Math.round((stats.totalChildren / 1500) * 100))} />
            <KpiCard label="Sessions"     value={stats.totalSessions} icon="📋" color="#FACC15" delta="+12.1%" pct={Math.min(100, Math.round((stats.totalSessions / 900) * 100))} />
            <KpiCard label="Open Alerts"  value={stats.totalAlerts}  icon="⚠️" color="#F87171" delta={stats.totalAlerts > 0 ? `${stats.urgent} urgent` : 'all clear'} pct={Math.min(100, Math.round((stats.totalAlerts / 8) * 100))} />
          </div>

          {/* Toolbar */}
          <div className="grid-toolbar" style={{ marginBottom: '0.9rem' }}>
            <SearchBar
              value={searchText}
              onChange={setSearchText}
              placeholder="Search by camp name, code, or location…"
              style={{ maxWidth: 'none', width: '100%' }}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%', border: `1px solid ${T.border}`, background: T.bgSoft, color: T.textPrimary,
                borderRadius: '0.75rem', padding: '0.65rem 0.9rem', outline: 'none', fontSize: '0.88rem',
              }}
            >
              <option value="alertsDesc">Sort: Alerts (high to low)</option>
              <option value="sessionsDesc">Sort: Sessions (high to low)</option>
              <option value="childrenDesc">Sort: Children (high to low)</option>
              <option value="nameAsc">Sort: Name (A–Z)</option>
            </select>
            <button
              onClick={() => loadCamps(true)}
              disabled={refreshing}
              style={{
                border: `1px solid ${T.teal}`, background: refreshing ? T.tealDim : T.teal, color: 'white',
                borderRadius: '0.75rem', padding: '0.65rem 1rem', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>

          {/* Status quick filters */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'urgent', label: 'Urgent' },
              { key: 'watch', label: 'Watch' },
              { key: 'clear', label: 'Clear' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  border: `1px solid ${statusFilter === f.key ? T.teal : T.border}`,
                  background: statusFilter === f.key ? `${T.teal}22` : T.bgSoft,
                  color: statusFilter === f.key ? T.tealMid : T.muted,
                  borderRadius: '9999px',
                  padding: '0.38rem 0.9rem',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Loading skeletons */}
          {loading ? (
            <div className="grid-auto">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ background: T.navyCard, borderRadius: '1rem', height: 180, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filteredCamps.length === 0 ? (
            <div style={{ background: 'linear-gradient(160deg, ' + T.card + ', ' + T.bg + ')', border: `1px dashed ${T.border}`, borderRadius: '1.25rem', padding: '3.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2.6rem', margin: 0 }}>🏕️</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.15rem', fontWeight: 800, marginTop: '0.6rem' }}>No camps match the current filters</p>
              <p style={{ color: T.muted, fontSize: '0.85rem', marginTop: '0.35rem' }}>Try clearing the search or switching the status filter.</p>
            </div>
          ) : (
            <div className="grid-auto">
              {filteredCamps.map((camp) => <CampCard key={camp.id} camp={camp} />)}
            </div>
          )}
        </main>
      </div>
    </>
  )
}