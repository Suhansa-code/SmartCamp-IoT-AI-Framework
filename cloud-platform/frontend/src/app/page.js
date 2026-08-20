'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import SideNav from '@/components/common/SideNav'
import { useTheme } from '@/components/common/ThemeProvider'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import DashboardCard from '@/components/dashboard/DashboardCard'
import KpiCard from '@/components/dashboard/KpiCard'
import MiniStat from '@/components/dashboard/MiniStat'
import ProgressBar from '@/components/dashboard/ProgressBar'
import StatusDonut from '@/components/dashboard/StatusDonut'
import ArrowChip from '@/components/alert/ArrowChip'
import { P } from '@/data/theme.data'
import { MOCK_CAMPS, MOCK_EDUCATION, MOCK_RESOURCES, MOCK_DISASTER, DISASTER_MATCH, CAMP_STATUS, DIS_STATUS } from '@/data/dashboard.data'
import { Droplets, Users, BookOpen, Bell, Radio, Tent } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function eduCode(id) {
  const known = {
    'CAMP-B-HOMAGAMA': 'HMG', 'CAMP-B-GALLE': 'GAL', 'CAMP-B-RATHNAPURA': 'RTP',
    'CAMP-B-MATARA': 'MAT', 'CAMP-B-KALUTARA': 'KAL', 'CAMP-B-BATTICALOA': 'BAT',
  }
  return known[id] || id.replace(/^CAMP-B-/, '').slice(0, 3).toUpperCase()
}

export default function DashboardPage() {
  const { T, mode } = useTheme()
  const dark = mode === 'dark'
  const chip = (label, value, color) => (
    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: `${color}14`, borderRadius: '9999px', padding: '4px 10px', fontSize: '0.72rem' }}>
      <span style={{ fontWeight: 800, color }}>{value}</span>
      <span style={{ fontWeight: 600, color: T.muted }}>{label}</span>
    </span>
  )

  const [camps, setCamps] = useState([])
  const [education, setEducation] = useState([])
  const [resources, setResources] = useState(null)
  const [disaster, setDisaster] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedCampId, setSelectedCampId] = useState('all')

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const tryJson = async (p) => (p.status === 'fulfilled' && p.value?.ok ? (await p.value.json()) : null)

    const [campsP, eduP, resP, disP] = await Promise.allSettled([
      fetch(`${API_BASE}/api/admin/camps`),
      fetch(`${API_BASE}/api/alerts/education/camps`),
      fetch(`${API_BASE}/api/resources/overview`),
      fetch(`${API_BASE}/api/disaster/overview`),
    ])

    const campsPayload = await tryJson(campsP)
    const eduPayload = await tryJson(eduP)
    const resPayload = await tryJson(resP)
    const disPayload = await tryJson(disP)

    setCamps(Array.isArray(campsPayload) && campsPayload.length ? campsPayload : MOCK_CAMPS)
    setEducation(Array.isArray(eduPayload?.camps) && eduPayload.camps.length ? eduPayload.camps : Array.isArray(eduPayload) && eduPayload.length ? eduPayload : MOCK_EDUCATION)
    setResources(resPayload?.population ? resPayload : MOCK_RESOURCES)
    setDisaster(Array.isArray(disPayload?.camps) && disPayload.camps.length ? disPayload : MOCK_DISASTER)

    if (isRefresh) setRefreshing(false)
    else setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const normalizedCamps = useMemo(() => camps.map((camp) => {
    const alertCount = camp.alerts?.length ?? 0
    const status = alertCount === 0 ? 'clear' : alertCount <= 2 ? 'watch' : 'urgent'
    return {
      ...camp,
      alertCount,
      status,
      childCount: Number(camp.childCount ?? 0),
      sessionCount: Number(camp.sessionCount ?? 0),
    }
  }), [camps])

  const overallAlerts = useMemo(() => normalizedCamps.reduce((s, c) => s + c.alertCount, 0), [normalizedCamps])

  const res = resources || MOCK_RESOURCES
  const disCamps = (disaster || MOCK_DISASTER).camps || []

  const campRows = useMemo(() => normalizedCamps.map((camp) => ({
    ...camp,
    edu: education.find((e) => eduCode(e.id) === camp.code) || null,
    dis: DISASTER_MATCH[camp.code] ? disCamps.find((d) => d.id === DISASTER_MATCH[camp.code]) || null : null,
  })), [normalizedCamps, education, disCamps])

  const selectedRow = useMemo(() => campRows.find((c) => c.id === selectedCampId) || null, [campRows, selectedCampId])

  const scope = useMemo(() => {
    if (selectedRow) return [selectedRow]
    const q = searchText.trim().toLowerCase()
    if (!q) return campRows
    return campRows.filter((c) =>
      c.name?.toLowerCase().includes(q)
      || c.code?.toLowerCase().includes(q)
      || c.location?.toLowerCase().includes(q),
    )
  }, [campRows, selectedRow, searchText])

  const scopeStats = useMemo(() => {
    const children = scope.reduce((s, c) => s + c.childCount, 0)
    const sessions = scope.reduce((s, c) => s + c.sessionCount, 0)
    const alerts = scope.reduce((s, c) => s + c.alertCount, 0)
    const clear = scope.filter((c) => c.status === 'clear').length
    const watch = scope.filter((c) => c.status === 'watch').length
    const urgent = scope.filter((c) => c.status === 'urgent').length
    return { camps: scope.length, children, sessions, alerts, clear, watch, urgent }
  }, [scope])

  const eduRows = useMemo(() => scope.map((r) => r.edu).filter(Boolean), [scope])
  const eduTotals = useMemo(() => eduRows.reduce((a, c) => ({
    children: a.children + (c.children || 0),
    sessions: a.sessions + (c.sessions || 0),
    flagged: a.flagged + (c.flagged_sessions || 0),
    pending: a.pending + (c.pending_alerts || 0),
  }), { children: 0, sessions: 0, flagged: 0, pending: 0 }), [eduRows])
  const eduAvg = useMemo(() => {
    const scored = eduRows.filter((c) => c.avg_composite != null)
    if (!scored.length) return null
    return Math.round((scored.reduce((s, c) => s + c.avg_composite, 0) / scored.length) * 10) / 10
  }, [eduRows])

  const disRows = useMemo(() => (selectedRow ? (selectedRow.dis ? [selectedRow.dis] : []) : disCamps), [selectedRow, disCamps])
  const disTotals = useMemo(() => {
    const displaced = disRows.reduce((s, c) => s + (c.displaced || 0), 0)
    const workers = disRows.reduce((s, c) => s + (c.workers || 0), 0)
    const counts = { critical: 0, high: 0, medium: 0, stable: 0, recovery: 0 }
    disRows.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1 })
    return { displaced, workers, camps: disRows.length, ...counts }
  }, [disRows])
  const criticalCamps = useMemo(() => disRows
    .filter((c) => c.status === 'critical' || c.status === 'high')
    .sort((a, b) => b.displaced - a.displaced)
    .slice(0, 4), [disRows])

  const servedAny = Object.values(res.distribution_today).reduce((s, d) => s + (d.served || 0), 0)
  const totalPrepared = Object.values(res.distribution_today).reduce((s, d) => s + (d.prepared || 0), 0)
  const fedPct = totalPrepared > 0 ? Math.round((servedAny / totalPrepared) * 100) : 0
  const attendance = res.population?.attendance_rate_pct ?? 0

  const perfData = scope.map((c) => ({ code: c.code, children: c.childCount, sessions: c.sessionCount }))
  const eduChartData = eduRows.map((c) => ({ code: eduCode(c.id), score: c.avg_composite }))
  const statusList = [
    { label: 'Clear',  color: T.green, value: scopeStats.clear },
    { label: 'Watch',  color: T.amber, value: scopeStats.watch },
    { label: 'Urgent', color: T.red,   value: scopeStats.urgent },
  ]
  const donutSegs = statusList.map((s) => ({ color: s.color, value: s.value }))
  const pctOf = (n) => (scopeStats.camps ? Math.round((n / scopeStats.camps) * 100) : 0)

  const tooltipStyle = {
    background: dark ? T.card : '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: '0.75rem',
    fontSize: '0.78rem', fontWeight: 600, color: T.textPrimary,
  }

  const sparkFor = (key) => scope.map((c) => c[key])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes dashPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes dashSpin { to { transform: rotate(360deg); } }
        .dash-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .dash-charts { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
        .dash-domains { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        @media (max-width: 1150px) {
          .dash-charts { grid-template-columns: 1fr; }
          .dash-domains { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .dash-kpi { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .dash-kpi { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{
        minHeight: '100svh',
        background: dark ? 'linear-gradient(180deg, #0A0A0B 0%, #0E0E10 100%)' : P.outer,
        fontFamily: "'Inter', sans-serif",
        paddingLeft: 'var(--rail-width, 236px)',
        transition: 'padding-left 0.2s ease',
      }}>
        <SideNav />

<div className='header-wrapper'>


        <main style={{background: dark ? T.bg : P.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
                  <HeaderShell>
          <PageHeader
            title="Dashboard"
            subtitle={
              loading ? 'Loading live overview…' : `Unified view across ${campRows.length} camps · Education · Resources · Disaster`
            }
            search={{
              value: searchText,
              onChange: setSearchText,
              placeholder: 'Search by camp name, code, or location…',
              onRefresh: () => loadAll(true),
              refreshing,
            }}
            pendingCount={overallAlerts}
          />
        </HeaderShell>

        <div style={{ padding: '0rem 2rem', gap: '1.25rem', display: 'flex', flexDirection: 'column',}}>
          {/* ── Filter toolbar ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.muted }}>Camp</span>
              <select
                value={selectedCampId}
                onChange={(e) => setSelectedCampId(e.target.value)}
                aria-label="Select camp"
                style={{
                  minWidth: 220,
                  background: T.card,
                  color: T.textPrimary,
                  border: `1px solid ${T.border}`,
                  borderRadius: '0.75rem',
                  padding: '9px 12px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="all">All Camps</option>
                {campRows.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {statusList.map((s) => chip(s.label, s.value, s.color))}
              </div>
            </div>
            <span style={{ fontSize: '0.74rem', color: T.muted, fontWeight: 700 }}>
              Showing {scope.length} of {campRows.length} camp{scope.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ── KPI row ── */}
          <div className="dash-kpi">
            <KpiCard label="Total Camps" value={scopeStats.camps} icon={<Tent size={17} />} color={T.blue} delta="relief sites" pct={100} spark={sparkFor('alertCount').map((_, i) => i + 1)} />
            <KpiCard label="Children" value={scopeStats.children.toLocaleString()} icon={<Users size={17} />} color={T.teal} delta="tracked" pct={Math.min(100, Math.round((scopeStats.children / 1500) * 100))} spark={sparkFor('childCount')} />
            <KpiCard label="Learning Sessions" value={scopeStats.sessions.toLocaleString()} icon={<BookOpen size={17} />} color={T.purple} delta="synced" pct={Math.min(100, Math.round((scopeStats.sessions / 900) * 100))} spark={sparkFor('sessionCount')} />
            <KpiCard label="Open Alerts" value={scopeStats.alerts} icon={<Bell size={17} />} color={scopeStats.alerts > 0 ? T.red : T.green} delta={scopeStats.urgent > 0 ? `${scopeStats.urgent} urgent` : 'all clear'} pct={Math.min(100, Math.round((scopeStats.alerts / 8) * 100))} spark={sparkFor('alertCount')} />
          </div>

          {/* ── Charts row ── */}
          <div className="dash-charts">
            <DashboardCard
              title="Camp Performance"
              subtitle={selectedRow ? `${selectedRow.name} · children vs sessions` : 'Children vs sessions per camp'}
              bodyStyle={{ height: 260 }}
            >
              {perfData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfData} barGap={4} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke={T.border} vertical={false} />
                    <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 700, fill: T.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: `${T.bar}` }} contentStyle={tooltipStyle} />
                    <Bar dataKey="children" name="Children" fill={T.teal} radius={[6, 6, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="sessions" name="Sessions" fill={T.purple} radius={[6, 6, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.muted, fontSize: '0.84rem', fontWeight: 600 }}>No camp data</div>
              )}
            </DashboardCard>

            <DashboardCard
              title="Camp Status"
              subtitle="Clear · Watch · Urgent"
              bodyStyle={{ height: 260, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}
            >
              <StatusDonut segments={donutSegs} size={150} center={scopeStats.watch + scopeStats.urgent} label="At Risk" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', flex: 1, maxWidth: 170 }}>
                {statusList.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.textSoft, flex: 1 }}>{s.label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: T.muted, width: 34, textAlign: 'right' }}>{pctOf(s.value)}%</span>
                  </div>
                ))}
              </div>
            </DashboardCard>
          </div>

          {/* ── Domain row ── */}
          <div className="dash-domains">
            {/* Education */}
            <DashboardCard
              title="Education"
              subtitle="Learning analytics & alerts"
              right={(
                <Link href="/education" aria-label="Open Education">
                  <ArrowChip dark={dark} />
                </Link>
              )}
            >
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <MiniStat label="Children" value={eduTotals.children.toLocaleString()} icon={<Users size={12} />} />
                <MiniStat label="Sessions" value={eduTotals.sessions.toLocaleString()} icon={<BookOpen size={12} />} />
                <MiniStat label="Avg Score" value={eduAvg ?? '—'} icon="📊" sub="composite" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {chip('flagged sessions', eduTotals.flagged, T.amber)}
                {chip('total alerts', eduRows.reduce((s, c) => s + (c.total_alerts || 0), 0), T.muted)}
              </div>
              <div style={{ height: 130 }}>
                {eduChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eduChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 8" stroke={T.border} vertical={false} />
                      <XAxis dataKey="code" tick={{ fontSize: 10, fontWeight: 700, fill: T.muted }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: `${T.bar}` }} contentStyle={tooltipStyle} />
                      <Bar dataKey="score" name="Avg composite" fill={T.teal} radius={[5, 5, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.muted, fontSize: '0.78rem', fontWeight: 600 }}>No education data for this camp</div>
                )}
              </div>
            </DashboardCard>

            {/* Resource Management */}
            <DashboardCard
              title="Resource Management"
              subtitle="Camp overview & distribution"
              right={(
                <Link href="/resources" aria-label="Open Resources">
                  <ArrowChip dark={dark} />
                </Link>
              )}
            >
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <MiniStat label="Registered" value={res.population?.total.toLocaleString()} icon={<Users size={12} />} sub={`${res.population?.families} families`} />
                <MiniStat label="Attendance" value={`${attendance}%`} icon="📊" />
                <MiniStat label="Fed Today" value={`${fedPct}%`} icon="🍽️" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.9rem', padding: '0.8rem 0.9rem' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today's distribution</div>
                {Object.entries(res.distribution_today).map(([key, d]) => {
                  const pct = d.prepared > 0 ? Math.round((d.served / d.prepared) * 100) : 0
                  const icon = { breakfast: '☕', lunch: '🍛', dinner: '🍲', water: '💧' }[key] || '🍽️'
                  return <ProgressBar key={key} icon={icon} label={key.charAt(0).toUpperCase() + key.slice(1)} value={`${d.served}/${d.prepared}`} pct={pct} tone={pct > 85 ? T.green : T.teal} />
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: T.muted, fontWeight: 600 }}>
                <Radio size={13} color={res.mqtt?.network_state === 'GOOD' ? T.green : T.amber} />
                {res.mqtt?.network_state} · 🔮 tomorrow {res.prediction_tomorrow?.expected_persons} expected
              </div>
            </DashboardCard>

            {/* Disaster */}
            <DashboardCard
              title="Disaster"
              subtitle="Camp tracking & relief overview"
              right={(
                <Link href="/disaster" aria-label="Open Disaster">
                  <ArrowChip dark={dark} />
                </Link>
              )}
            >
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <MiniStat label="Displaced" value={disTotals.displaced.toLocaleString()} icon={<Users size={12} />} />
                <MiniStat label="Aid Workers" value={disTotals.workers.toLocaleString()} icon="👷" />
                <MiniStat label="Active Camps" value={disTotals.camps} icon={<Droplets size={12} />} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.9rem', padding: '0.8rem 0.9rem' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status distribution</div>
                {Object.entries(DIS_STATUS).map(([status, meta]) => {
                  const count = disTotals[status]
                  if (!count) return null
                  return <ProgressBar key={status} label={meta.label} value={count} pct={disTotals.camps ? Math.round((count / disTotals.camps) * 100) : 0} tone={meta.color} />
                })}
              </div>
              {criticalCamps.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {criticalCamps.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0', borderBottom: i < criticalCamps.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: DIS_STATUS[c.status].color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: T.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: T.textPrimary }}>{c.displaced.toLocaleString()}</span>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: DIS_STATUS[c.status].color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DIS_STATUS[c.status].label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.25rem 0', color: T.muted, fontSize: '0.78rem', fontWeight: 600 }}>
                  {disRows.length === 0 ? 'No disaster data for this camp' : 'No critical camps right now'}
                </div>
              )}
            </DashboardCard>
          </div></div>
        </main>
        </div>
      </div>
    </>
  )
}