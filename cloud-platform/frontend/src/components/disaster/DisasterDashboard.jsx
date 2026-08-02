'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DONUT_SEGS, DISPLACED_SPARK, AIDED_SPARK, TREND_DATA } from './disasterData'
import { DisasterGeoMap } from './DisasterGeoMap'
import { DisasterCampSummaryPanel } from './DisasterCampSummaryPanel'
import { DonutChart, Ring, Sparkline, ThemeToggle, TrendChart } from './DisasterVisuals'

const DARK = {
  mode: 'dark',
  bg: '#03080f',
  surface: '#06101a',
  panel: '#070e19',
  border: '#0e2030',
  borderHi: '#163448',
  t0: '#e2edf7',
  t1: '#93b7d2',
  t2: '#6790aa',
  t3: '#35556d',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  cyan: '#22d3ee',
  green: '#4ade80',
  mapBg: '#030c18',
  mapLand: '#0d2236',
  mapBorder: '#1a4060',
  mapGrid: '#07182a',
}

const LIGHT = {
  mode: 'light',
  bg: '#eef4f8',
  surface: '#ffffff',
  panel: '#f8fbfe',
  border: '#d3dde7',
  borderHi: '#b3c6d5',
  t0: '#0f2336',
  t1: '#284b67',
  t2: '#5f7f94',
  t3: '#91a9ba',
  red: '#dc2626',
  orange: '#ea6a0a',
  yellow: '#ca8a04',
  cyan: '#0891b2',
  green: '#16a34a',
  mapBg: '#ddeaf5',
  mapLand: '#b8d4e8',
  mapBorder: '#6090b0',
  mapGrid: '#c8daea',
}

function compactStatusLabel(status) {
  return { critical: 'Critical', high: 'High', medium: 'Medium', stable: 'Stable', recovery: 'Recovery' }[status] || 'Unknown'
}

const DISASTER_API_BASE = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || 'http://localhost:3001'

function formatSriLankaTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export default function DisasterDashboard() {
  const router = useRouter()
  const [mode, setMode] = useState('dark')
  const [selected, setSelected] = useState(null)
  const [overview, setOverview] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [selectedDetailLoading, setSelectedDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [utc, setUtc] = useState('')
  const [tick, setTick] = useState(0)
  const theme = mode === 'dark' ? DARK : LIGHT

  useEffect(() => {
    setUtc(formatSriLankaTime())
    const id = setInterval(() => {
      setUtc(formatSriLankaTime())
      setTick((value) => value + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true

    async function loadOverview() {
      setLoading(true)
      setError('')

      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/overview`)
        const payload = res.ok ? await res.json() : null
        if (!active) return
        setOverview(payload)
      } catch (err) {
        if (!active) return
        setOverview(null)
        setError(err instanceof Error ? err.message : 'Failed to load disaster overview')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOverview()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadSelectedDetail() {
      if (!selected) {
        setSelectedDetail(null)
        setSelectedDetailLoading(false)
        return
      }

      // show loading state for the selected camp card
      setSelectedDetail(null)
      setSelectedDetailLoading(true)

      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${selected}`)
        const camp = res.ok ? await res.json() : null
        if (!active) return
        setSelectedDetail(camp?.detail || null)
      } catch {
        if (!active) return
        setSelectedDetail(null)
      } finally {
        if (active) setSelectedDetailLoading(false)
      }
    }

    loadSelectedDetail()

    return () => {
      active = false
    }
  }, [selected])

  const camps = overview?.camps || []
  const mapNodes = overview?.map_nodes || camps
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

  const handleNavigate = () => {
    if (!selectedCamp) return
    router.push(`/admin/disaster/${selectedCamp.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: 18, transition: 'background 0.3s', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto', background: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 36px)', boxShadow: mode === 'dark' ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px #0c1d2e inset' : '0 18px 44px rgba(19,47,74,0.12)', transition: 'all 0.3s' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${theme.bg}; }
          ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 9999px; }
          button:hover { opacity: 0.9; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        <header style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}`, padding: '12px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.red, boxShadow: `0 0 10px ${theme.red}80`, animation: 'blink 1.1s infinite' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', color: theme.t0 }}>DISASTER CAMP TRACKING SYSTEM</div>
              <div style={{ marginTop: 4, fontSize: 10, letterSpacing: '0.16em', color: theme.t2 }}>SRI LANKA REGION · DMCS-01</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: 'TOTAL CAMPS', value: loading ? '—' : String(camps.length), color: theme.t0 },
              { label: 'DISPLACED', value: totalDisplaced.toLocaleString(), color: theme.orange },
              { label: 'AID WORKERS', value: totalWorkers.toLocaleString(), color: theme.cyan },
              { label: 'COVERAGE', value: '89%', color: theme.green },
              { label: 'CRITICAL', value: String(statusCounts.critical || 0), color: theme.red },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center', minWidth: 76 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: item.color, lineHeight: 1.1 }}>{item.value}</div>
                <div style={{ marginTop: 4, fontSize: 9, color: theme.t2, letterSpacing: '0.16em' }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: tick % 2 === 0 ? theme.t1 : theme.t3 }}>●</span>
              LIVE LK {utc}
            </div>
            <ThemeToggle mode={mode} onToggle={() => setMode((value) => value === 'dark' ? 'light' : 'dark')} theme={theme} />
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 320px', flex: 1, minHeight: 720 }}>
          <aside style={{ borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.18em', marginBottom: 10 }}>ACTIVE CAMPS</div>
              <div style={{ maxHeight: 284, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${theme.border} ${theme.bg}` }}>
                {camps.map((camp) => {
                  const isSelected = selected === camp.id
                  const color = { critical: theme.red, high: theme.orange, medium: theme.yellow, stable: theme.cyan, recovery: theme.green }[camp.status]

                  return (
                    <button key={camp.id} onClick={() => setSelected(camp.id === selected ? null : camp.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 10px 10px 8px', background: isSelected ? `${color}10` : 'transparent', border: 'none', borderLeft: `3px solid ${isSelected ? color : 'transparent'}`, borderBottom: `1px solid ${theme.border}20`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? theme.t0 : theme.t1, lineHeight: 1.3 }}>{camp.name}</div>
                          <div style={{ marginTop: 3, fontSize: 9, color: theme.t2, letterSpacing: '0.08em' }}>{camp.code} · {camp.type}</div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.08em' }}>{compactStatusLabel(camp.status)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.18em', marginBottom: 10 }}>SELECTED CAMP</div>
                {selectedCamp ? (
                  selectedDetailLoading ? (
                    <div style={{ textAlign: 'center', color: theme.t3, fontSize: 12, lineHeight: 1.6, letterSpacing: '0.04em', padding: '18px 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, border: `4px solid ${theme.border}`, borderTop: `4px solid ${theme.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <div style={{ fontSize: 12, color: theme.t2, fontWeight: 700 }}>Loading camp details…</div>
                      </div>
                    </div>
                  ) : selectedDetail ? (
                    <DisasterCampSummaryPanel camp={selectedCamp} detail={selectedDetail} theme={theme} onNavigate={handleNavigate} />
                  ) : (
                    <div style={{ textAlign: 'center', color: theme.t3, fontSize: 11, lineHeight: 1.6, letterSpacing: '0.08em' }}>
                      NO CAMP DETAILS
                    </div>
                  )
                ) : loading ? (
                  <div style={{ textAlign: 'center', color: theme.t3, fontSize: 11, lineHeight: 1.6, letterSpacing: '0.08em' }}>
                    LOADING CAMP DATA
                  </div>
                ) : error ? (
                  <div style={{ textAlign: 'center', color: theme.red, fontSize: 11, lineHeight: 1.6, letterSpacing: '0.08em' }}>
                    {error}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: theme.t3, fontSize: 11, lineHeight: 1.6, letterSpacing: '0.08em' }}>
                    SELECT A CAMP<br />TO VIEW DETAILS
                  </div>
                )}
            </div>

            <div style={{ padding: 16, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <div />
             </div>
          </aside>

          <section style={{ display: 'flex', flexDirection: 'column', background: theme.mapBg, borderRight: `1px solid ${theme.border}`, minHeight: 720, maxHeight: 720 }}>
            <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DisasterGeoMap camps={mapNodes} selected={selected} onSelect={setSelected} theme={theme} />
              
              {/* Center Title */}
               {/* Title - Top Left */}
               <div style={{ position: 'absolute', top: 12, left: 58, zIndex: 5 }}>
                 <div style={{ fontSize: 18, fontWeight: 900, color: theme.t0, letterSpacing: '0.08em' }}>RELIEF OPERATIONS GRID</div>
                 <div style={{ marginTop: 2, fontSize: 10, color: theme.cyan, letterSpacing: '0.14em' }}>Terrain reference aligned with live camp nodes</div>
               </div>

               {/* NODE STATUS - Bottom Right */}
               <div style={{ position: 'absolute', bottom: 12, right: 12, background: `${theme.bg}e8`, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', zIndex: 10 }}>
                 <div style={{ textAlign: 'center', color: theme.t3, fontSize: 10, letterSpacing: '0.12em', marginBottom: 8, fontWeight: 700 }}>NODE STATUS</div>
                 <div style={{ display: 'grid', gap: 5 }}>
                   {['critical', 'high', 'medium', 'stable', 'recovery'].map((status) => (
                     <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                       <div style={{ width: 6, height: 6, borderRadius: '50%', background: { critical: theme.red, high: theme.orange, medium: theme.yellow, stable: theme.cyan, recovery: theme.green }[status], flexShrink: 0 }} />
                       <span style={{ color: theme.t1, letterSpacing: '0.08em', flex: 1 }}>{compactStatusLabel(status)}</span>
                       <span style={{ color: theme.t2, fontSize: 9 }}>{statusCounts[status] || 0}</span>
                     </div>
                   ))}
                 </div>
               </div>
              <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 10, color: theme.t2, letterSpacing: '0.12em', background: `${theme.bg}e0`, padding: '5px 12px', border: `1px solid ${theme.border}`, zIndex: 10 }}>DMCS-01 · ACTIVE</div>
            </div>

            <div style={{ borderTop: `1px solid ${theme.border}`, padding: '16px 22px 14px', flexShrink: 0, background: theme.surface }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginBottom: 14, flexWrap: 'wrap' }}>
                <Ring value={87} label="FOOD" color={theme.green} theme={theme} />
                <Ring value={58} label="WATER" color={theme.cyan} theme={theme} />
                <Ring value={41} label="MEDICAL" color={theme.red} theme={theme} />
                <Ring value={75} label="SHELTER" color={theme.orange} theme={theme} />
                <Ring value={65} label="POWER" color={theme.yellow} theme={theme} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {[
                  { label: 'DISPLACED', value: '12,480', tone: theme.orange, fill: theme.orange, percent: 72 },
                  { label: 'EVACUATED', value: '8,340', tone: theme.green, fill: theme.green, percent: 55 },
                  { label: 'TOTAL CAMPS', value: String(camps.length || 0), tone: theme.cyan, fill: theme.cyan, percent: camps.length ? 100 : 0 },
                  { label: 'AID REQ.', value: '89%', tone: theme.yellow, fill: theme.yellow, percent: 89 },
                  { label: 'CRITICAL', value: '3', tone: theme.red, fill: theme.red, percent: 21 },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.1em', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: item.tone, marginBottom: 6 }}>{item.value}</div>
                    <div style={{ height: 2, background: theme.border }}><div style={{ height: '100%', width: `${item.percent}%`, background: item.fill, boxShadow: `0 0 4px ${item.fill}60` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', background: theme.surface }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.18em', marginBottom: 10 }}>DISASTER DISTRIBUTION</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'right' }}>{DONUT_SEGS.slice(2, 4).map((segment) => <div key={segment.code}><div style={{ fontSize: 13, color: theme.t0, fontWeight: 700 }}>{segment.label}</div><div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.1em' }}>{segment.code}</div></div>)}</div>
                <DonutChart segs={DONUT_SEGS} theme={theme} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{DONUT_SEGS.slice(0, 2).map((segment) => <div key={segment.code}><div style={{ fontSize: 13, color: theme.t0, fontWeight: 700 }}>{segment.label}</div><div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.1em' }}>{segment.code}</div></div>)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10 }}>{DONUT_SEGS.slice(4).map((segment) => <div key={segment.code} style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.t1, fontWeight: 700 }}>{segment.label}</div><div style={{ fontSize: 10, color: theme.t3, letterSpacing: '0.1em' }}>{segment.code}</div></div>)}</div>
            </div>

            <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.18em', marginBottom: 10 }}>STATISTICS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'DISPLACED', value: '12,480', arrow: '↑ 8.4%', accent: theme.orange, data: DISPLACED_SPARK, sparkColor: theme.orange },
                  { label: 'AIDED', value: '9,340', arrow: '↑ 12.1%', accent: theme.green, data: AIDED_SPARK, sparkColor: theme.cyan },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.1em', marginBottom: 5 }}>{stat.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}><span style={{ fontSize: 20, fontWeight: 800, color: theme.t0 }}>{stat.value}</span><span style={{ fontSize: 10, color: stat.accent }}>{stat.arrow}</span></div>
                    <Sparkline data={stat.data} color={stat.sparkColor} w={118} h={30} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.18em', marginBottom: 10 }}>LIVE ALERTS</div>
              {[
                { color: theme.red, message: 'Medical critical — Galle C-2', time: '06:42', live: true },
                { color: theme.red, message: 'Water unit failure — Batticaloa', time: '05:18', live: true },
                { color: theme.orange, message: '340 new arrivals — Kandy C-1', time: '04:55', live: false },
                { color: theme.yellow, message: 'Supply delay — Ratnapura', time: '04:10', live: false },
                { color: theme.cyan, message: 'Delivery confirmed — Jaffna North', time: '03:30', live: false },
                { color: theme.green, message: 'Rain forecast — Matara coast', time: '02:00', live: false },
              ].map((alert) => <div key={alert.message} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: `1px solid ${theme.border}20` }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: alert.color, boxShadow: `0 0 4px ${alert.color}80`, marginTop: 5, flexShrink: 0, animation: alert.live ? 'blink 1.1s infinite' : 'none' }} /><span style={{ fontSize: 12, color: theme.t1, flex: 1, lineHeight: 1.5 }}>{alert.message}</span><span style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{alert.time}</span></div>)}
            </div>

            <div style={{ padding: 16, flex: 1 }}>
              <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.18em', marginBottom: 10 }}>DISPLACEMENT TREND</div>
              <TrendChart data={TREND_DATA} color={theme.cyan} theme={theme} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: theme.t3, letterSpacing: '0.08em' }}>{['JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV'].map((month) => <span key={month}>{month}</span>)}</div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }`}</style>
    </div>
  )
}
