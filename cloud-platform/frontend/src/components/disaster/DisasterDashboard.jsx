'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CAMPS, CAMP_DETAIL, DONUT_SEGS, DISPLACED_SPARK, AIDED_SPARK, TREND_DATA } from './disasterData'
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

export default function DisasterDashboard() {
  const router = useRouter()
  const [mode, setMode] = useState('dark')
  const [selected, setSelected] = useState(null)
  const [utc, setUtc] = useState('')
  const [tick, setTick] = useState(0)
  const theme = mode === 'dark' ? DARK : LIGHT

  useEffect(() => {
    const id = setInterval(() => {
      setUtc(new Date().toUTCString().slice(17, 25))
      setTick((value) => value + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const selectedCamp = useMemo(() => CAMPS.find((camp) => camp.id === selected) || null, [selected])
  const selectedDetail = selectedCamp ? CAMP_DETAIL[selectedCamp.id] : null
  const totalDisplaced = CAMPS.reduce((sum, camp) => sum + camp.displaced, 0)

  const handleNavigate = () => {
    if (!selectedCamp) return
    router.push(`/admin/disaster/${selectedCamp.id}`)
  }

  return (
    <div className="min-h-screen font-['Inter','Segoe_UI',sans-serif] transition-colors duration-300 p-4.5" style={{ background: theme.bg }}>
      <div className="w-full max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-36px)] transition-all duration-300" style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: mode === 'dark' ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px #0c1d2e inset' : '0 18px 44px rgba(19,47,74,0.12)' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${theme.bg}; }
          ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 9999px; }
          button:hover { opacity: 0.9; }
        `}</style>

        <header className="flex items-center justify-between gap-4 shrink-0 py-3 px-5.5" style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full animate-blink" style={{ background: theme.red, boxShadow: `0 0 10px ${theme.red}80` }} />
            <div>
              <div className="text-xs font-black tracking-widest" style={{ color: theme.t0 }}>DISASTER CAMP TRACKING SYSTEM</div>
              <div className="mt-1 text-[10px] tracking-wide" style={{ color: theme.t2 }}>SRI LANKA REGION · DMCS-01</div>
            </div>
          </div>

          <div className="flex gap-4.5 items-center flex-wrap justify-center">
            {[
              { label: 'TOTAL CAMPS', value: '14', color: theme.t0 },
              { label: 'DISPLACED', value: totalDisplaced.toLocaleString(), color: theme.orange },
              { label: 'AID WORKERS', value: '847', color: theme.cyan },
              { label: 'COVERAGE', value: '89%', color: theme.green },
              { label: 'CRITICAL', value: '3', color: theme.red },
            ].map((item) => (
              <div key={item.label} className="text-center min-w-[76px]">
                <div className="text-xl font-black leading-tight" style={{ color: item.color }}>{item.value}</div>
                <div className="mt-1 text-[9px] tracking-widest" style={{ color: theme.t2 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[10px] tracking-wider flex items-center gap-1.5" style={{ color: theme.t2 }}>
              <span style={{ color: tick % 2 === 0 ? theme.t1 : theme.t3 }}>●</span>
              LIVE UTC {utc}
            </div>
            <ThemeToggle mode={mode} onToggle={() => setMode((value) => value === 'dark' ? 'light' : 'dark')} theme={theme} />
          </div>
        </header>

        <div className="grid grid-cols-[250px_1fr_320px] flex-1 min-h-[720px]">
          <aside className="flex flex-col" style={{ borderRight: `1px solid ${theme.border}` }}>
            <div className="p-4 border-b shrink-0" style={{ borderColor: theme.border }}>
              <div className="text-[10px] tracking-widest mb-2.5" style={{ color: theme.t2 }}>ACTIVE CAMPS</div>
              <div className="max-h-[284px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${theme.border} ${theme.bg}` }}>
                {CAMPS.map((camp) => {
                  const isSelected = selected === camp.id
                  const color = { critical: theme.red, high: theme.orange, medium: theme.yellow, stable: theme.cyan, recovery: theme.green }[camp.status]

                  return (
                    <button key={camp.id} onClick={() => setSelected(camp.id === selected ? null : camp.id)} className="w-full text-left p-2.5 pl-2 border-l-[3px] border-b transition-colors hover:opacity-90" style={{ background: isSelected ? `${color}10` : 'transparent', borderLeft: `3px solid ${isSelected ? color : 'transparent'}`, borderBottom: `1px solid ${theme.border}20` }}>
                      <div className="flex items-center justify-between gap-2.5">
                        <div>
                          <div className="text-xs font-bold leading-tight" style={{ color: isSelected ? theme.t0 : theme.t1 }}>{camp.name}</div>
                          <div className="mt-0.75 text-[9px] tracking-wide" style={{ color: theme.t2 }}>{camp.code} · {camp.type}</div>
                        </div>
                        <span className="text-[9px] font-black tracking-wide" style={{ color }}>{compactStatusLabel(camp.status)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-b shrink-0" style={{ borderColor: theme.border }}>
              <div className="text-[10px] tracking-widest mb-2.5" style={{ color: theme.t2 }}>SELECTED CAMP</div>
              {selectedCamp && selectedDetail ? <DisasterCampSummaryPanel camp={selectedCamp} detail={selectedDetail} theme={theme} onNavigate={handleNavigate} /> : (
                <div className="text-center text-xs leading-relaxed tracking-wide" style={{ color: theme.t3 }}>
                  SELECT A CAMP<br />TO VIEW DETAILS
                </div>
              )}
            </div>

            <div className="p-4 flex-1 min-h-0 flex items-center justify-center">
               <div />
             </div>
          </aside>

          <section className="flex flex-col min-h-[720px] max-h-[720px] border-r" style={{ background: theme.mapBg, borderColor: theme.border }}>
            <div className="flex-1 relative min-h-0 flex items-center justify-center">
              <DisasterGeoMap camps={CAMPS} selected={selected} onSelect={setSelected} theme={theme} />
              
              {/* Title - Top Left */}
              <div className="absolute top-3 left-14.5 z-5">
                <div className="text-lg font-black tracking-wide" style={{ color: theme.t0 }}>RELIEF OPERATIONS GRID</div>
                <div className="mt-0.5 text-[10px] tracking-widest" style={{ color: theme.cyan }}>Terrain reference aligned with live camp nodes</div>
              </div>

              {/* NODE STATUS - Bottom Right */}
              <div className="absolute bottom-3 right-3 z-10 rounded-[10px] p-3 border" style={{ background: `${theme.bg}e8`, borderColor: theme.border }}>
                <div className="text-center text-[10px] font-bold tracking-widest mb-2" style={{ color: theme.t3 }}>NODE STATUS</div>
                <div className="grid gap-1.25">
                  {['critical', 'high', 'medium', 'stable', 'recovery'].map((status) => (
                    <div key={status} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: { critical: theme.red, high: theme.orange, medium: theme.yellow, stable: theme.cyan, recovery: theme.green }[status] }} />
                      <span className="tracking-wide flex-1" style={{ color: theme.t1 }}>{compactStatusLabel(status)}</span>
                      <span className="text-[9px]" style={{ color: theme.t2 }}>{CAMPS.filter((camp) => camp.status === status).length}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute top-2.5 right-3 z-10 text-[10px] tracking-widest px-3 py-1.25 border rounded" style={{ color: theme.t2, background: `${theme.bg}e0`, borderColor: theme.border }}>DMCS-01 · ACTIVE</div>
            </div>

            <div className="border-t py-3.5 px-5.5 shrink-0" style={{ background: theme.surface, borderColor: theme.border }}>
              <div className="flex justify-center gap-5.5 mb-3.5 flex-wrap">
                <Ring value={87} label="FOOD" color={theme.green} theme={theme} />
                <Ring value={58} label="WATER" color={theme.cyan} theme={theme} />
                <Ring value={41} label="MEDICAL" color={theme.red} theme={theme} />
                <Ring value={75} label="SHELTER" color={theme.orange} theme={theme} />
                <Ring value={65} label="POWER" color={theme.yellow} theme={theme} />
              </div>

              <div className="grid grid-cols-5 gap-2.5">
                {[
                  { label: 'DISPLACED', value: '12,480', tone: theme.orange, fill: theme.orange, percent: 72 },
                  { label: 'EVACUATED', value: '8,340', tone: theme.green, fill: theme.green, percent: 55 },
                  { label: 'TOTAL CAMPS', value: '14', tone: theme.cyan, fill: theme.cyan, percent: 100 },
                  { label: 'AID REQ.', value: '89%', tone: theme.yellow, fill: theme.yellow, percent: 89 },
                  { label: 'CRITICAL', value: '3', tone: theme.red, fill: theme.red, percent: 21 },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-[10px] tracking-widest mb-1" style={{ color: theme.t2 }}>{item.label}</div>
                    <div className="text-lg font-black mb-1.5" style={{ color: item.tone }}>{item.value}</div>
                    <div className="h-0.5 rounded" style={{ background: theme.border }}><div className="h-full rounded" style={{ width: `${item.percent}%`, background: item.fill, boxShadow: `0 0 4px ${item.fill}60` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="flex flex-col">
            <div className="p-4 border-b" style={{ borderColor: theme.border }}>
              <div className="text-[10px] tracking-widest mb-2.5" style={{ color: theme.t2 }}>DISASTER DISTRIBUTION</div>
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-col gap-2.5 text-right">{DONUT_SEGS.slice(2, 4).map((segment) => <div key={segment.code}><div className="text-sm font-bold" style={{ color: theme.t0 }}>{segment.label}</div><div className="text-[10px] tracking-widest" style={{ color: theme.t2 }}>{segment.code}</div></div>)}</div>
                <DonutChart segs={DONUT_SEGS} theme={theme} />
                <div className="flex flex-col gap-2.5">{DONUT_SEGS.slice(0, 2).map((segment) => <div key={segment.code}><div className="text-sm font-bold" style={{ color: theme.t0 }}>{segment.label}</div><div className="text-[10px] tracking-widest" style={{ color: theme.t2 }}>{segment.code}</div></div>)}</div>
              </div>
              <div className="flex justify-around mt-2.5">{DONUT_SEGS.slice(4).map((segment) => <div key={segment.code} className="text-center"><div className="text-xs font-bold" style={{ color: theme.t1 }}>{segment.label}</div><div className="text-[10px] tracking-widest" style={{ color: theme.t3 }}>{segment.code}</div></div>)}</div>
            </div>

            <div className="p-4 border-b" style={{ borderColor: theme.border }}>
              <div className="text-[10px] tracking-widest mb-2.5" style={{ color: theme.t2 }}>STATISTICS</div>
              <div className="grid grid-cols-2 gap-3.5">
                {[
                  { label: 'DISPLACED', value: '12,480', arrow: '↑ 8.4%', accent: theme.orange, data: DISPLACED_SPARK, sparkColor: theme.orange },
                  { label: 'AIDED', value: '9,340', arrow: '↑ 12.1%', accent: theme.green, data: AIDED_SPARK, sparkColor: theme.cyan },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-[10px] tracking-widest mb-1.25" style={{ color: theme.t2 }}>{stat.label}</div>
                    <div className="flex items-baseline gap-1.5 mb-1.5"><span className="text-xl font-black" style={{ color: theme.t0 }}>{stat.value}</span><span className="text-[10px]" style={{ color: stat.accent }}>{stat.arrow}</span></div>
                    <Sparkline data={stat.data} color={stat.sparkColor} w={118} h={30} />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-b" style={{ borderColor: theme.border }}>
              <div className="text-[10px] tracking-widest mb-2.5" style={{ color: theme.t2 }}>LIVE ALERTS</div>
              {[
                { color: theme.red, message: 'Medical critical — Galle C-2', time: '06:42', live: true },
                { color: theme.red, message: 'Water unit failure — Batticaloa', time: '05:18', live: true },
                { color: theme.orange, message: '340 new arrivals — Kandy C-1', time: '04:55', live: false },
                { color: theme.yellow, message: 'Supply delay — Ratnapura', time: '04:10', live: false },
                { color: theme.cyan, message: 'Delivery confirmed — Jaffna North', time: '03:30', live: false },
                { color: theme.green, message: 'Rain forecast — Matara coast', time: '02:00', live: false },
              ].map((alert) => <div key={alert.message} className="flex items-start gap-2 py-1.5 border-b" style={{ borderColor: `${theme.border}20` }}><div className="w-1.5 h-1.5 rounded-full mt-1.25 shrink-0" style={{ background: alert.color, boxShadow: `0 0 4px ${alert.color}80`, animation: alert.live ? 'blink 1.1s infinite' : 'none' }} /><span className="text-sm leading-relaxed flex-1" style={{ color: theme.t1 }}>{alert.message}</span><span className="text-[10px] tracking-wide whitespace-nowrap" style={{ color: theme.t2 }}>{alert.time}</span></div>)}
            </div>

            <div className="p-4 flex-1">
              <div className="text-[10px] tracking-widest mb-2.5" style={{ color: theme.t2 }}>DISPLACEMENT TREND</div>
              <TrendChart data={TREND_DATA} color={theme.cyan} theme={theme} />
              <div className="flex justify-between mt-1.5 text-[10px] tracking-wide" style={{ color: theme.t3 }}>{['JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV'].map((month) => <span key={month}>{month}</span>)}</div>
            </div>
          </aside>
        </div>
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }`}</style>
    </div>
  )
}
