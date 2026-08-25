'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, HeartHandshake, TriangleAlert, MapPin, ChevronRight, X,
  Droplets, Radio, ShieldAlert, Crosshair, ChevronDown,
} from 'lucide-react'
import { CAMPS, CAMP_DETAIL, DISPLACED_SPARK, AIDED_SPARK, TREND_DATA, MAP_DARK, MAP_LIGHT, STATUS_COLOR, STATUS_TEXT, FILTER_OPTIONS } from '@/data/disaster.data'
import MainMap from './MainMap'
import { Ring, Sparkline, TrendChart } from './DisasterVisuals'
import SideNav from '@/components/common/SideNav'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import Button from '@/components/common/Button'
import MiniStat from '@/components/dashboard/MiniStat'
import DashboardCard from '@/components/dashboard/DashboardCard'
import StatusDonut from '@/components/dashboard/StatusDonut'
import ArrowChip from '@/components/alert/ArrowChip'
import FilterPills from '@/components/alert/FilterPills'
import { useTheme } from '@/components/common/ThemeProvider'

// Map themes — the relief image follows the app's light/dark mode.
const DISASTER_API_BASE = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || 'http://localhost:3002'

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

export default function DisasterDashboard() {
  const router = useRouter()
  const { mode, T } = useTheme()
  const [selected, setSelected] = useState(null)
  const [overview, setOverview] = useState(null)
  const [disasterAlerts, setDisasterAlerts] = useState([])
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [selectedDetailLoading, setSelectedDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [search, setSearch] = useState('')
  const [showAllCamps, setShowAllCamps] = useState(false)
  const [campFilter, setCampFilter] = useState('all')
  const [campQuery, setCampQuery] = useState('')

  const dark = mode === 'dark'
  const MAP_THEME = dark ? MAP_DARK : MAP_LIGHT
  const hudInk = dark ? '#f0f7ff' : '#0f2336'
  const hudMuted = dark ? 'rgba(214,235,250,0.72)' : 'rgba(47,84,112,0.75)'
  const hudFaint = dark ? 'rgba(214,235,250,0.5)' : 'rgba(60,100,130,0.6)'
  const hudCardBg = dark ? 'rgba(4,10,17,0.72)' : 'rgba(255,255,255,0.85)'
  const hudCardBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(60,110,150,0.18)'

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${DISASTER_API_BASE}/api/disaster/overview`)
      const payload = res.ok ? await res.json() : null
      setOverview(payload)
      try {
        const alertRes = await fetch(`${DISASTER_API_BASE}/api/disaster/alerts?status=ACTIVE`)
        const alertPayload = alertRes.ok ? await alertRes.json() : null
        setDisasterAlerts(Array.isArray(alertPayload?.alerts) ? alertPayload.alerts : [])
      } catch {
        setDisasterAlerts([])
      }
    } catch (err) {
      setOverview(null)
      setError(err instanceof Error ? err.message : 'Failed to load disaster overview')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setTick((value) => value + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    let active = true

    async function loadSelectedDetail() {
      if (!selected) {
        setSelectedDetail(null)
        setSelectedDetailLoading(false)
        return
      }

      setSelectedDetail(null)
      setSelectedDetailLoading(true)

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 6000)
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${selected}`, { signal: controller.signal })
        clearTimeout(timer)
        const camp = res.ok ? await res.json() : null
        if (!active) return
        setSelectedDetail(camp?.detail || CAMP_DETAIL[selected] || null)
      } catch {
        if (!active) return
        setSelectedDetail(CAMP_DETAIL[selected] || null)
      } finally {
        if (active) setSelectedDetailLoading(false)
      }
    }

    loadSelectedDetail()

    return () => {
      active = false
    }
  }, [selected])

  const camps = (overview?.camps && overview.camps.length ? overview.camps : CAMPS)
  const mapNodes = overview?.map_nodes || camps
  const filteredCamps = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return camps
    return camps.filter((camp) =>
      camp.name.toLowerCase().includes(q)
      || camp.code.toLowerCase().includes(q)
      || camp.type.toLowerCase().includes(q),
    )
  }, [camps, search])
  const criticalCamps = useMemo(() => camps.filter((camp) => camp.status === 'critical'), [camps])
  const activeAlerts = useMemo(() => disasterAlerts.filter((alert) => ['ACTIVE', 'ACKNOWLEDGED'].includes(alert.status)), [disasterAlerts])
  const modalCamps = useMemo(() => {
    const q = campQuery.trim().toLowerCase()
    return camps.filter((camp) => {
      if (campFilter !== 'all' && camp.status !== campFilter) return false
      if (!q) return true
      return camp.name.toLowerCase().includes(q)
        || camp.code.toLowerCase().includes(q)
        || camp.type.toLowerCase().includes(q)
    })
  }, [camps, campFilter, campQuery])
  const filterCounts = useMemo(() => {
    const counts = { all: camps.length }
    FILTER_OPTIONS.slice(1).forEach(({ key }) => {
      counts[key] = camps.filter((camp) => camp.status === key).length
    })
    return counts
  }, [camps])
  const selectedCamp = useMemo(() => camps.find((camp) => camp.id === selected) || null, [camps, selected])
  const totalDisplaced = overview?.total_displaced || camps.reduce((sum, camp) => sum + camp.displaced, 0)
  const totalWorkers = overview?.total_workers || camps.reduce((sum, camp) => sum + camp.workers, 0)
  const statusCounts = overview?.status_counts || {
    critical: camps.filter((camp) => camp.status === 'critical').length,
    high: camps.filter((camp) => camp.status === 'high').length,
    medium: camps.filter((camp) => camp.status === 'medium').length,
    stable: camps.filter((camp) => camp.status === 'stable').length,
    recovery: camps.filter((camp) => camp.status === 'recovery').length,
  }

  const donutSegs = [
    { color: T.red, value: statusCounts.critical || 0 },
    { color: '#D97706', value: statusCounts.high || 0 },
    { color: T.amber, value: statusCounts.medium || 0 },
    { color: T.teal, value: statusCounts.stable || 0 },
    { color: T.green, value: statusCounts.recovery || 0 },
  ]

  const selColor = selectedCamp ? STATUS_COLOR[selectedCamp.status] : T.teal
  const selOccupancy = selectedCamp ? Math.round((selectedCamp.displaced / selectedCamp.capacity) * 100) : 0

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 9999px; }
        @keyframes disPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes disSpin { to { transform: rotate(360deg); } }
        @keyframes disGlow { 0%,100%{opacity:0.5; transform: translate(-50%,-50%) scale(1);} 50%{opacity:0.9; transform: translate(-50%,-50%) scale(1.12);} }
        @keyframes disRise { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform: translateY(0); } }
        @keyframes disPop { from { opacity:0; transform: translateY(14px) scale(0.98); } to { opacity:1; transform: translateY(0) scale(1); } }

        /* ── hero: map left · right side panel ── */
        .dis-hero-grid { display: grid; grid-template-columns: minmax(0,1fr) clamp(320px, 26vw, 380px); gap: 1rem; align-items: stretch; }
        .map-col { position: relative; overflow: hidden; border-radius: 1.75rem;
          border: 1px solid rgba(80,140,190,0.22);
          background: #030c18; min-height: 640px; }
        .map-scrim { position:absolute; inset:0; pointer-events:none; border-radius: inherit; z-index: 5; }
        .map-canvas-wrap { position: absolute; inset: 0; }
        .hero-glow { position:absolute; top:50%; left:50%; width: 62%; height: 90%; border-radius:50%;
          background: radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0.05) 45%, transparent 70%);
          animation: disGlow 6s ease-in-out infinite; pointer-events:none; }

        .hud { position: absolute; z-index: 13; pointer-events: none; }
        .hud-interactive { pointer-events: auto; }
        .hud-title { top: 25px; left: 58px; max-width: 420px; animation: disRise 0.6s ease both; }
        .hud-live { top: 30px; right: 16px; display: flex; align-items: center; gap: 8px; animation: disRise 0.6s 0.08s ease both; }
        .hud-legend { bottom: 10px; right: 16px; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; animation: disRise 0.6s 0.16s ease both; }

        .rings-dock { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); z-index: 12; animation: disRise 0.6s 0.2s ease both; }

        .dis-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .dis-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.9rem; }

        /* ── right side panel ── */
        .right-panel { display: flex; flex-direction: column; overflow: hidden; background: ${T.card};
          border: 1px solid ${T.border}; border-radius: 1.75rem; box-shadow: 0 30px 70px rgba(20,30,40,0.12); }
        .right-section { display: flex; flex-direction: column; min-height: 0; }
        .right-head { display: flex; align-items: center; gap: 0.6rem; padding: 0.85rem 1rem; border-bottom: 1px solid ${T.border}; flex-shrink: 0; }
        .right-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: ${T.border} transparent; }

        .camp-row { width:100%; text-align:left; display:flex; align-items:center; gap:10px; padding: 0.62rem 0.9rem; cursor:pointer; font-family:inherit;
          background: transparent; border: none; border-bottom: 1px solid ${T.border}; transition: background 0.15s ease; }
        .camp-row:hover { background: ${T.cardSoft}; }

        /* ── all camps modal ── */
        .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(15,23,42,0.55); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 1.25rem; animation: disPop 0.22s ease both; }
        .modal-card { background: ${T.panel}; border: 1px solid ${T.border}; border-radius: 1.5rem; width: min(680px, 100%); max-height: 84vh;
          display: flex; flex-direction: column; box-shadow: 0 50px 120px rgba(15,23,42,0.35); overflow: hidden; }
        .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.4rem; border-bottom: 1px solid ${T.border}; }
        .modal-body { padding: 1rem 1.4rem; overflow-y: auto; flex: 1; }

        @media (max-width: 1280px) {
          .dis-hero-grid { grid-template-columns: 1fr; }
          .map-col { min-height: 460px; }
          .right-panel { max-height: none; }
          .rings-dock { position: static; transform: none; }
        }
        @media (max-width: 700px) {
          .map-col { min-height: 400px; }
          .hud-legend { display: none; }
          .hud-title { left: 52px; top: 52px; }
          .rings-dock { display: none; }
        }
        @media (max-width: 900px) { .dis-two { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .dis-strip { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <div style={{ minHeight: '100svh', background: T.outer, fontFamily: "'Inter',sans-serif", color: T.ink, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
        <SideNav />

        <div className='header-wrapper'>

          <main style={{ background: T.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <HeaderShell>
              <PageHeader
                title="Disaster Relief Operations"
                subtitle={
                  loading
                    ? 'Connecting to the cloud backend…'
                    : `Interactive relief grid · ${camps.length} camps · click a node or camp to inspect`
                }
                pendingCount={statusCounts.high}
                escalatedCount={statusCounts.critical}
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: 'Search active camps…',
                  onRefresh: () => {
                    setRefreshing(true)
                    loadOverview()
                  },
                  refreshing: refreshing || loading,
                }}
              />
            </HeaderShell>

            <div style={{ padding: '0rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── HERO: map (left) + side panel (right) ─────────────── */}
              <div className="dis-hero-grid">
                {/* Map (left) */}
                <MainMap
                  camps={camps}
                  mapNodes={mapNodes}
                  selected={selected}
                  onSelect={setSelected}
                  statusCounts={statusCounts}
                  error={error}
                />

                {/* Right side panel — Active Camps + Selected Camp */}
                <aside className="right-panel">
                  {/* Active camps (critical only) */}
                  <div className="right-section" style={{ flex: '1 1 46%' }}>
                    <div className="right-head">
                       <button
                        onClick={() => setShowAllCamps(true)}
                        aria-label="Show all camps"
                        title="Show all camps"
                        suppressHydrationWarning
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <ArrowChip dark={false} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Active Camps</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: T.ink, marginTop: 1 }}>Critical only</div>
                      </div>
                      <Chip color={T.red} style={{ background: `${T.red}14`, border: `1px solid ${T.red}44` }}>{criticalCamps.length} CRITICAL</Chip>
                    </div>
                    <div className="right-scroll" style={{ flex: 1 }}>
                      {criticalCamps.length === 0 ? (
                        <div style={{ textAlign: 'center', color: T.muted, padding: '1.5rem 0.5rem', fontSize: '0.78rem', fontWeight: 600 }}>
                          No critical camps right now
                        </div>
                      ) : criticalCamps.map((camp) => {
                        const isSelected = selected === camp.id
                        const occ = Math.round((camp.displaced / camp.capacity) * 100)
                        return (
                          <button
                            key={camp.id}
                            onClick={() => { setSelected(camp.id === selected ? null : camp.id); setShowAllCamps(false) }}
                            className="camp-row"
                            suppressHydrationWarning
                            style={{
                              background: isSelected ? `${T.red}12` : 'transparent',
                              borderLeft: isSelected ? `3px solid ${T.red}` : '3px solid transparent',
                              borderBottom: `1px solid ${T.border}`,
                            }}
                          >
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[camp.status], boxShadow: `0 0 8px ${STATUS_COLOR[camp.status]}`, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{camp.name}</div>
                              <div style={{ fontSize: '0.62rem', color: T.muted, fontWeight: 600, marginTop: 1 }}>{camp.code} · {camp.type} · {occ}%</div>
                            </div>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: T.red, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>CRITICAL</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Selected camp */}
                  <div className="right-section" style={{ flex: '1 1 54%', borderTop: `1px solid ${T.border}` }}>
                    <div className="right-head">
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.cardSoft, border: `1px solid ${T.border}`, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MapPin size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Selected Camp</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: T.ink, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedCamp ? selectedCamp.name : 'Pick a camp'}</div>
                      </div>
                      {selectedCamp && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
                          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap',
                          background: `${selColor}14`, border: `1px solid ${selColor}44`, color: selColor,
                        }}>
                          {STATUS_TEXT[selectedCamp.status]}
                        </span>
                      )}
                    </div>
                    <div className="right-scroll" style={{ flex: 1 }}>
                      {!selectedCamp ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.muted, textAlign: 'center', padding: '1rem' }}>
                          <MapPin size={36} style={{ opacity: 0.3 }} />
                          <p style={{ fontWeight: 600, fontSize: '0.84rem', marginTop: 10, color: T.inkSoft }}>No camp selected</p>
                          <p style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: 2, fontWeight: 500 }}>Click a node on the map or a camp in the list above</p>
                        </div>
                      ) : selectedDetailLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.muted, textAlign: 'center' }}>
                          <div style={{ width: 32, height: 32, border: `3px solid ${T.border}`, borderTop: `3px solid ${T.textPrimary}`, borderRadius: '50%', animation: 'disSpin 1s linear infinite' }} />
                          <p style={{ fontWeight: 600, fontSize: '0.8rem', marginTop: 12, color: T.inkSoft }}>Loading camp details…</p>
                        </div>
                      ) : (
                        <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          <div style={{ fontSize: '0.64rem', color: T.muted, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {selectedCamp.code} · {selectedCamp.type} · {selectedCamp.lat.toFixed(2)}°N, {selectedCamp.lng.toFixed(2)}°E
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            {[
                              { label: 'Displaced', value: selectedCamp.displaced.toLocaleString(), accent: '#D97706' },
                              { label: 'Capacity', value: selectedCamp.capacity.toLocaleString(), accent: T.inkSoft },
                              { label: 'Aid', value: `${selectedCamp.aid}%`, accent: T.green },
                              { label: 'Occupancy', value: `${selOccupancy}%`, accent: T.amber },
                            ].map((s) => (
                              <div key={s.label} style={{ padding: '0.6rem 0.75rem', borderRadius: 12, background: T.panelSoft, border: `1px solid ${T.border}`, borderLeft: `3px solid ${s.accent}` }}>
                                <div style={{ fontSize: '0.56rem', fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: s.accent, marginTop: 3, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{s.value}</div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'grid', gap: 4 }}>
                            {[
                              { label: 'Nearest river', value: selectedDetail?.river || '—', color: T.teal },
                              { label: 'Station', value: selectedDetail?.station || '—', color: T.inkSoft },
                            ].map((row) => (
                              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.25rem', borderBottom: `1px solid ${T.border}`, fontSize: '0.68rem' }}>
                                <span style={{ color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{row.label}</span>
                                <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
                              </div>
                            ))}
                          </div>

                          <Button href={`/disaster/${selectedCamp.id}`} icon={<ChevronRight size={15} />}>
                            View Full Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>

              {/* ── Live alerts + distribution ────────────────────────── */}
              <div className="dis-two">
                <DashboardCard
                  title="Disaster Distribution"
                  subtitle="Live camp status profile"
                  right={<Chip color={T.teal}>{camps.length} CAMPS</Chip>}
                  bodyStyle={{ alignItems: 'center' }}
                >
                  <StatusDonut
                    segments={donutSegs}
                    size={176}
                    center={loading ? '—' : String(camps.length)}
                    label="Active Camps"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
                    {['critical', 'high', 'medium', 'stable', 'recovery'].map((s) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.4rem 0.6rem', borderRadius: 10, background: T.cardSoft, border: `1px solid ${T.border}` }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', fontWeight: 700, color: T.inkSoft, textTransform: 'capitalize' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s] }} /> {s}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: STATUS_COLOR[s] }}>{statusCounts[s] || 0}</span>
                      </div>
                    ))}
                  </div>
                </DashboardCard>

                <div style={{ background: dark ? '#0F172A' : '#1E293B', color: '#fff', borderRadius: '1.25rem', padding: '1.1rem 1.25rem', boxShadow: dark ? '0 30px 70px rgba(0,0,0,0.5)' : '0 30px 70px rgba(20,30,40,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Live Alerts
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.62rem', fontWeight: 800, color: T.red }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.red, boxShadow: `0 0 8px ${T.red}`, animation: 'disPulse 1.5s infinite' }} />
                      LIVE
                    </span>
                  </div>
                  {activeAlerts.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', padding: '0.8rem 0' }}>No active disaster alerts</div> : activeAlerts.slice(0, 4).map((alert) => {
                    const alertColor = alert.severity === 'CRITICAL' ? T.red : '#D97706'
                    return <div key={alert.event_id || alert.alert_id || alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.42rem 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: alertColor, boxShadow: `0 0 5px ${alertColor}`, marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.82)', flex: 1, lineHeight: 1.45 }}><strong>{alert.severity}</strong> · {alert.camp_name || alert.camp_id} · {alert.flood_probability_percent == null ? '—' : `${Math.round(alert.flood_probability_percent)}%`}</span>
                      <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                  })}
                </div>
              </div>

              {/* ── Trend + relief statistics ──────────────────────────── */}
              <div className="dis-two">
                <DashboardCard
                  title="Displacement Trend"
                  subtitle="Persons displaced across the network · 12-month view"
                  right={<Chip color={T.teal}>12-MONTH</Chip>}
                >
                  <TrendChart data={TREND_DATA} color={T.teal} theme={MAP_THEME} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: T.muted, fontWeight: 700, letterSpacing: '0.1em', marginTop: 2 }}>
                    {['JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV'].map((month) => <span key={month}>{month}</span>)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: T.ink, marginTop: 4 }}>
                    <span>Last reading <span style={{ color: T.teal }}>1,982</span></span>
                    <span>↑ 12.1% YoY</span>
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="Relief Statistics"
                  subtitle="Displacement vs. aided persons"
                  right={<Chip color={T.green}>ON TRACK</Chip>}
                >
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {[
                      { label: 'Displaced', value: '12,480', arrow: '↑ 8.4%', accent: '#D97706', data: DISPLACED_SPARK, sparkColor: '#D97706' },
                      { label: 'Aided', value: '9,340', arrow: '↑ 12.1%', accent: T.green, data: AIDED_SPARK, sparkColor: T.teal },
                    ].map((stat) => (
                      <div key={stat.label} style={{ padding: '0.7rem 0.85rem', borderRadius: '0.9rem', background: T.cardSoft, border: `1px solid ${T.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink }}>{stat.value}</span>
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: stat.accent }}>{stat.arrow}</span>
                            </div>
                          </div>
                          <Sparkline data={stat.data} color={stat.sparkColor} w={110} h={30} />
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: T.panel, overflow: 'hidden' }}>
                          <div style={{ width: `${stat.label === 'Displaced' ? 72 : 88}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${stat.sparkColor}88, ${stat.sparkColor})` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </DashboardCard>
              </div>

              {/* ── bottom metric strip ────────────────────────────────── */}
              <div className="dis-strip">
                <MiniStat label="Total Camps" value={String(camps.length || 0)} icon={<MapPin size={12} />} color={T.teal} sub="Active sites" />
                <MiniStat label="Displaced" value={totalDisplaced.toLocaleString()} icon={<Users size={12} />} color="#D97706" sub="Region-wide" />
                <MiniStat label="Aid Workers" value={totalWorkers.toLocaleString()} icon={<HeartHandshake size={12} />} color={T.purple} sub="Deployed" />
                <MiniStat label="Critical" value={String(statusCounts.critical || 0)} icon={<TriangleAlert size={12} />} color={T.red} sub="Needs attention" />
                <MiniStat label="Coverage" value="89%" icon={<ShieldAlert size={12} />} color={T.green} sub="Aid coverage" />
                <MiniStat label="Tick" value={String(tick)} icon={<Radio size={12} />} color={T.muted} sub="Live refresh" />
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── ALL CAMPS MODAL (alert-page style) ─────────────────────────── */}
      {showAllCamps && (
        <div className="modal-overlay" onClick={() => setShowAllCamps(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
                  Disaster Relief Operations
                </div>
                <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.25rem', fontWeight: 800, margin: 0, color: T.ink }}>All Active Camps</h2>
                <p style={{ fontSize: '0.78rem', color: T.muted, margin: '2px 0 0', fontWeight: 600 }}>{camps.length} camps in the network · select one to inspect</p>
              </div>
              <button
                onClick={() => setShowAllCamps(false)}
                aria-label="Close"
                suppressHydrationWarning
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: `1px solid ${T.border}`, background: T.cardSoft,
                  color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ padding: '0.85rem 1.4rem', borderBottom: `1px solid ${T.border}`, background: T.panelSoft, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200, background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.75rem', padding: '8px 12px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    value={campQuery}
                    onChange={(e) => setCampQuery(e.target.value)}
                    placeholder="Search camps, codes or types…"
                    suppressHydrationWarning
                    style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: "'Inter',sans-serif", fontSize: '0.78rem', fontWeight: 600, color: T.ink }}
                  />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 800, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  <ChevronDown size={13} /> Filter by status
                </span>
              </div>
              <FilterPills options={FILTER_OPTIONS} active={campFilter} onSelect={setCampFilter} counts={filterCounts} />
            </div>

            <div className="modal-body">
              {modalCamps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: T.muted, fontSize: '0.85rem', fontWeight: 600 }}>
                  No camps match your filters
                </div>
              ) : modalCamps.map((camp) => {
                const isSelected = selected === camp.id
                const color = STATUS_COLOR[camp.status]
                const occ = Math.round((camp.displaced / camp.capacity) * 100)
                return (
                  <button
                    key={camp.id}
                    onClick={() => {
                      setSelected(camp.id === selected ? null : camp.id)
                      setShowAllCamps(false)
                    }}
                    suppressHydrationWarning
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      background: isSelected ? `${color}12` : T.card, border: `1px solid ${isSelected ? `${color}66` : T.border}`,
                      borderRadius: '1rem', padding: '0.85rem 1rem', marginBottom: '0.6rem', fontFamily: 'inherit',
                      transition: 'border-color 0.15s ease', boxShadow: '0 2px 8px rgba(20,30,40,0.05)',
                    }}
                  >
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: T.ink }}>{camp.name}</span>
                        <Chip color={color}>{STATUS_TEXT[camp.status]}</Chip>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600, marginTop: 3 }}>
                        {camp.code} · {camp.type} · {occ}% occupancy · {camp.lat.toFixed(2)}°N, {camp.lng.toFixed(2)}°E
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: T.ink, textAlign: 'right' }}>
                        <span style={{ display: 'block', color: T.muted, fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Displaced</span>
                        {camp.displaced.toLocaleString()}
                      </span>
                      <ChevronRight size={16} color={T.muted} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}