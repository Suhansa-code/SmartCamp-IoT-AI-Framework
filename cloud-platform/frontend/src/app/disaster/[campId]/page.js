'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { STATUS_META, statusColor } from '@/components/disaster/disasterData'
import SideNav from '@/components/common/SideNav'

// Applies the global navigation rail + offsets content to the right of it.
function WithRail({ children }) {
  return (
    <div style={{ minHeight: '100vh', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
      <SideNav />
      {children}
    </div>
  )
}

const DARK = {
  mode: 'dark',
  bg: '#03080f',
  surface: '#06101a',
  border: '#0e2030',
  t0: '#e2edf7',
  t1: '#93b7d2',
  t2: '#6790aa',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  cyan: '#22d3ee',
  green: '#4ade80',
}

const LIGHT = {
  mode: 'light',
  bg: '#eef4f8',
  surface: '#ffffff',
  border: '#d3dde7',
  t0: '#0f2336',
  t1: '#284b67',
  t2: '#5f7f94',
  red: '#dc2626',
  orange: '#ea6a0a',
  yellow: '#ca8a04',
  cyan: '#0891b2',
  green: '#16a34a',
}

function InfoCard({ label, value, tone, theme, style, compact }) {
  const labelSize = compact ? 8 : 9
  const valueSize = compact ? 16 : 20
  const minH = compact ? 72 : 84
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.surface, padding: 12, minHeight: minH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...style }}>
      <div style={{ fontSize: labelSize, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: valueSize, fontWeight: 800, color: tone || theme.t0, lineHeight: 1.08 }}>{value}</div>
    </div>
  )
}

function Section({ title, children, theme, compact }) {
  const padding = compact ? 10 : 14
  const titleSize = compact ? 8 : 9
  return (
    <section style={{ border: `1px solid ${theme.border}`, borderRadius: 16, background: theme.surface, padding, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: titleSize, color: theme.t2, letterSpacing: '0.16em', marginBottom: compact ? 8 : 10, textTransform: 'uppercase', fontWeight: 800 }}>{title}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  )
}

function Row({ label, value, tone, theme }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: `1px solid ${theme.border}18`, fontSize: 12 }}><span style={{ color: theme.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span><span style={{ color: tone || theme.t0, fontWeight: 700, textAlign: 'right' }}>{value}</span></div>
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

function getPredictionTone(probability, theme) {
  if (probability >= 0.7) return theme.red
  if (probability >= 0.4) return theme.orange
  return theme.green
}

export default function DisasterCampDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [mode, setMode] = useState('dark')
  const [utc, setUtc] = useState('')
  const [tick, setTick] = useState(0)
  const [camp, setCamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const campId = Array.isArray(params?.campId) ? params.campId[0] : params?.campId
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

    async function loadCamp() {
      if (campId === 'overview') {
        router.replace('/disaster')
        return
      }

      if (!campId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}`)
        const payload = res.ok ? await res.json() : null
        if (!active) return
        setCamp(payload)
        if (!payload) setError('Camp not found')
      } catch (err) {
        if (!active) return
        setCamp(null)
        setError(err instanceof Error ? err.message : 'Failed to load camp detail')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCamp()

    return () => {
      active = false
    }
  }, [campId, router])

  const detail = camp?.detail || null
  const prediction = camp?.prediction || null
  const predictionError = camp?.prediction_error || ''
  const occupancy = camp ? Math.round((camp.displaced / camp.capacity) * 100) : 0
  const campElevation = Number.isFinite(Number(detail?.elev)) ? `${Math.round(Number(detail.elev))} m` : 'N/A'
  const waterTone = detail ? (detail.wl > detail.alertL ? theme.red : detail.wl > 0 ? theme.yellow : theme.cyan) : theme.cyan
  const predictionTone = prediction ? getPredictionTone(prediction.probability, theme) : theme.t2

  const [predLoading, setPredLoading] = useState(false)
  const [predResult, setPredResult] = useState(prediction)
  const [predError, setPredError] = useState(predictionError)
  const [waterLevelHistory, setWaterLevelHistory] = useState([])
  const [waterLevelLoading, setWaterLevelLoading] = useState(false)
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null)

  useEffect(() => {
    let active = true
    async function loadPrediction() {
      if (!camp || camp.prediction) {
        setPredResult(camp?.prediction || null)
        setPredError(camp?.prediction_error || '')
        return
      }

      setPredLoading(true)
      setPredError('')
      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}/predict`)
        if (!active) return
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Prediction failed' }))
          setPredError(err.error || 'Prediction failed')
          setPredResult(null)
        } else {
          const body = await res.json()
          setPredResult(body.prediction || null)
        }
      } catch (err) {
        if (!active) return
        setPredError(err instanceof Error ? err.message : 'Prediction failed')
        setPredResult(null)
      } finally {
        if (active) setPredLoading(false)
      }
    }

    loadPrediction()
    return () => {
      active = false
    }
  }, [camp, campId])

  useEffect(() => {
    let active = true

    async function loadWaterLevelHistory() {
      if (!campId) return

      setWaterLevelLoading(true)
      try {
        const response = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}/water-level-history?hours=8`)
        const payload = response.ok ? await response.json() : null
        if (!active) return

        const points = Array.isArray(payload?.points) ? payload.points : []
        const history = points
          .map((point) => {
            const value = Number(point?.water_level)
            if (!Number.isFinite(value)) return null
            return {
              value,
              timestamp: point?.timestamp || null,
            }
          })
          .filter(Boolean)

        setWaterLevelHistory(history.slice(-8))
      } catch {
        if (!active) return
        setWaterLevelHistory([])
      } finally {
        if (active) setWaterLevelLoading(false)
      }
    }

    loadWaterLevelHistory()

    return () => {
      active = false
    }
  }, [campId])

  const chartSeries = waterLevelHistory.length
    ? waterLevelHistory
    : Array.from({ length: 8 }, (_, idx) => ({ value: Number(detail?.wl || 0) + idx * 0.03, timestamp: null }))

  const chartValues = chartSeries.map((point) => point.value)
  const minChart = Math.min(...chartValues)
  const maxChart = Math.max(...chartValues)
  const chartRange = Math.max(maxChart - minChart, 0.01)
  const chartBars = chartSeries.map((point) => {
    const value = point.value
    const normalized = (value - minChart) / chartRange
    return {
      value,
      timestamp: point.timestamp,
      height: Math.round(20 + normalized * 72),
      normalized,
    }
  })
  const chartWidth = 196
  const chartHeight = 100
  const chartPaddingX = 10
  const chartPaddingY = 11
  const chartPoints = chartBars.map((bar, index) => {
    const x = chartBars.length > 1
      ? chartPaddingX + (index / (chartBars.length - 1)) * (chartWidth - chartPaddingX * 2)
      : chartWidth / 2
    const y = chartHeight - chartPaddingY - bar.normalized * (chartHeight - chartPaddingY * 2)
    const baseY = chartHeight - chartPaddingY
    const barHeight = Math.max(2.5, baseY - y)
    return { x, y, baseY, barHeight, ...bar }
  })
  const chartLinePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const alertThreshold = Number(detail?.alertL)
  const thresholdY = Number.isFinite(alertThreshold)
    ? chartHeight - chartPaddingY - ((alertThreshold - minChart) / chartRange) * (chartHeight - chartPaddingY * 2)
    : null

  const chartLabels = chartPoints.map((point, index) => {
    const label = point.timestamp ? formatChartTimestamp(point.timestamp) : `${chartPoints.length - index - 1}h`
    return index === chartPoints.length - 1 ? 'NOW' : label || `${chartPoints.length - index - 1}h`
  })

  function formatChartTimestamp(timestamp) {
    if (!timestamp) return ''
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(timestamp))
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <WithRail>
        <div style={{ minHeight: '100vh', background: theme.bg, display: 'grid', placeItems: 'center', color: theme.t0, fontFamily: "'Inter','Segoe UI',sans-serif", padding: 24, transition: 'background 0.3s' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ maxWidth: 560, width: '100%', border: `1px solid ${theme.border}`, borderRadius: 20, padding: 28, background: theme.surface, textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, border: `4px solid ${theme.border}`, borderTop: `4px solid ${theme.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Loading camp details…</div>
              <div style={{ color: theme.t2, lineHeight: 1.6, marginBottom: 8, fontSize: 13 }}>Fetching latest camp data for {campId}</div>
            </div>
          </div>
        </div>
      </WithRail>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'grid', placeItems: 'center', color: theme.t0, fontFamily: "'Inter','Segoe UI',sans-serif", padding: 24, transition: 'background 0.3s' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ maxWidth: 560, width: '100%', border: `1px solid ${theme.border}`, borderRadius: 20, padding: 28, background: theme.surface, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, border: `5px solid ${theme.border}`, borderTop: `5px solid ${theme.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 18, fontWeight: 800 }}>Loading camp details…</div>
            <div style={{ color: theme.t2, lineHeight: 1.7, marginTop: 8, fontSize: 14 }}>Fetching latest camp data before showing details.</div>
            <button onClick={() => router.push('/disaster')} style={{ marginTop: 12, border: 'none', borderRadius: 8, padding: '10px 18px', background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`, color: '#07111b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Back to disaster dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  if (!camp) {
    return <WithRail><div style={{ minHeight: '100vh', background: theme.bg, display: 'grid', placeItems: 'center', color: theme.t0, fontFamily: "'Inter','Segoe UI',sans-serif", padding: 24, transition: 'background 0.3s' }}><div style={{ maxWidth: 560, width: '100%', border: `1px solid ${theme.border}`, borderRadius: 20, padding: 28, background: theme.surface, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Camp not found</div><div style={{ color: theme.t2, lineHeight: 1.7, marginBottom: 18, fontSize: 14 }}>The selected camp id is not available in the disaster dashboard data set.</div><button onClick={() => router.push('/disaster')} style={{ border: 'none', borderRadius: 8, padding: '11px 20px', background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`, color: '#07111b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Back to disaster dashboard</button></div></div></WithRail>
  }

  return (
    <WithRail>
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: "'Inter','Segoe UI',sans-serif", transition: 'background 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${theme.bg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 9999px; }
        button:hover { opacity: 0.9; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
      `}</style>

      {/* Header */}
      <header style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, transition: 'all 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.red, boxShadow: `0 0 10px ${theme.red}80`, animation: 'blink 1.1s infinite' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', color: theme.t0 }}>{camp.name.toUpperCase()}</div>
            <div style={{ marginTop: 2, fontSize: 10, letterSpacing: '0.14em', color: theme.t2 }}>{camp.code} · {camp.type} · CAMP DETAIL VIEW</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 10, color: theme.t2, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: tick % 2 === 0 ? theme.t1 : theme.t2 }}>●</span>
            LIVE LK {utc}
          </div>
          <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: `1px solid ${theme.border}`, borderRadius: 999, background: theme.surface, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: theme.t1, letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s' }}>
            <span style={{ fontSize: 12 }}>{mode === 'dark' ? '☀' : '🌙'}</span>
            {mode === 'dark' ? 'LIGHT' : 'DARK'}
          </button>
          <button onClick={() => router.push('/disaster')} style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.t1, borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>← Back</button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'stretch' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
            <div style={{ position: 'relative', minHeight: 320, borderRadius: 18, overflow: 'hidden', border: `1px solid ${theme.border}`, background: `linear-gradient(180deg, ${theme.surface} 0%, ${theme.bg} 100%)`, boxShadow: mode === 'dark' ? '0 18px 42px rgba(0,0,0,0.28)' : '0 18px 42px rgba(19,47,74,0.1)' }}>
              <div style={{ position: 'absolute', inset: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.18em', color: theme.cyan, textTransform: 'uppercase', marginBottom: 6 }}>{camp.code} · {camp.type}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, color: theme.t0 }}>{camp.name}</div>
                    <div style={{ marginTop: 6, fontSize: 10, color: theme.t2, letterSpacing: '0.08em' }}>Past hourly gauging-station water levels with relative scaling for trend clarity.</div>
                  </div>
                  <div style={{ padding: '5px 10px', borderRadius: 999, background: `${statusColor(camp.status, theme)}18`, border: `1px solid ${statusColor(camp.status, theme)}44`, color: statusColor(camp.status, theme), fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{STATUS_META[camp.status].label}</div>
                </div>

                <div style={{ borderRadius: 18, border: `1px solid ${theme.border}`, background: mode === 'dark' ? 'linear-gradient(180deg, rgba(7,18,29,0.92) 0%, rgba(4,10,17,0.96) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,253,0.98) 100%)', padding: 14, position: 'relative', boxShadow: mode === 'dark' ? '0 14px 30px rgba(0,0,0,0.2)' : '0 14px 30px rgba(19,47,74,0.08)' }}>
                  {hoveredBarIndex !== null && chartPoints[hoveredBarIndex] ? (
                    <div style={{ position: 'absolute', top: 10, right: 10, padding: '6px 10px', borderRadius: 10, background: `${theme.bg}f0`, border: `1px solid ${theme.border}`, fontSize: 9, color: theme.t0, letterSpacing: '0.04em', zIndex: 2, boxShadow: '0 10px 24px rgba(0,0,0,0.18)' }}>
                      <div style={{ fontSize: 8, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Water level</div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{chartPoints[hoveredBarIndex].value.toFixed(2)} m</div>
                      {chartPoints[hoveredBarIndex].timestamp ? (
                        <div style={{ marginTop: 2, fontSize: 8, color: theme.t2 }}>{formatChartTimestamp(chartPoints[hoveredBarIndex].timestamp)}</div>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ position: 'relative', height: 176 }}>
                    <svg viewBox="0 0 170 100" preserveAspectRatio="xMidYMid meet" style={{ width: 'calc(100% + 40px)', height: '100%', display: 'block', marginLeft: '-40px' }}>
                      <defs>
                        <linearGradient id="waterLevelArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={theme.cyan} stopOpacity="0.34" />
                          <stop offset="100%" stopColor={theme.cyan} stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="waterLevelBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={theme.cyan} stopOpacity="0.92" />
                          <stop offset="100%" stopColor={theme.orange} stopOpacity="0.62" />
                        </linearGradient>
                      </defs>

                      {[0, 25, 50, 75, 100].map((lineY) => (
                        <line key={lineY} x1="10" y1={lineY} x2="150" y2={lineY} stroke={theme.border} strokeWidth="0.45" strokeDasharray="1.6 2.8" opacity="0.7" />
                      ))}

                      {thresholdY !== null ? (
                        <line x1="10" y1={thresholdY} x2="150" y2={thresholdY} stroke={theme.red} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.8" />
                      ) : null}

                      {chartPoints.length > 1 ? (
                        <path d={`M ${chartPoints[0].x} ${chartPoints[0].baseY} L ${chartPoints[0].x} ${chartPoints[0].y} ${chartPoints.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ')} L ${chartPoints[chartPoints.length - 1].x} ${chartPoints[chartPoints.length - 1].baseY} Z`} fill="url(#waterLevelArea)" />
                      ) : null}

                      {chartPoints.map((point, index) => (
                        <rect
                          key={`bar-${index}`}
                          x={point.x - 2.0}
                          y={point.baseY - point.barHeight}
                          width="4"
                          height={point.barHeight}
                          rx="2"
                          fill="url(#waterLevelBar)"
                          opacity="0.6"
                        />
                      ))}

                      {chartPoints.length > 1 ? (
                        <path d={chartLinePath} fill="none" stroke={theme.cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 2px ${theme.cyan}80)` }} />
                      ) : null}

                      {chartPoints.map((point, index) => (
                        <g key={index}>
                          <rect
                            x={point.x - 5}
                            y="0"
                            width="10"
                            height="100"
                            fill="transparent"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredBarIndex(index)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                          />
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={hoveredBarIndex === index ? 2.6 : 2.15}
                            fill={theme.surface}
                            stroke={index % 2 === 0 ? theme.cyan : theme.orange}
                            strokeWidth="1.4"
                            style={{ cursor: 'pointer', filter: `drop-shadow(0 0 5px ${(index % 2 === 0 ? theme.cyan : theme.orange)}78)` }}
                            onMouseEnter={() => setHoveredBarIndex(index)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                          />
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={hoveredBarIndex === index ? 0.9 : 0.75}
                            fill={index % 2 === 0 ? theme.cyan : theme.orange}
                            pointerEvents="none"
                          />
                          {index === chartPoints.length - 1 ? (
                            <text
                              x={point.x}
                              y={point.y - 4}
                              textAnchor="middle"
                              fill={theme.cyan}
                              fontSize="4.8"
                              fontWeight="800"
                              letterSpacing="0.12em"
                            >
                              NOW
                            </text>
                          ) : null}
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${chartLabels.length}, minmax(0, 1fr))`, gap: 4, marginTop: 6, paddingLeft: 2, paddingRight: 2 }}>
                    {chartLabels.map((label, index) => (
                      <div key={`${label}-${index}`} style={{ textAlign: 'center', fontSize: 8, color: index === chartLabels.length - 1 ? theme.cyan : theme.t3, letterSpacing: '0.08em', fontWeight: index === chartLabels.length - 1 ? 800 : 600 }}>
                        {label}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', color: theme.t2, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    <span>{waterLevelLoading ? 'loading levels' : 'relative water trend'}</span>
                    <span>{detail?.station || 'gauging station'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <Section title="Camp snapshot" theme={theme}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, height: '100%' }}>
                    <InfoCard label="Displaced" value={camp.displaced.toLocaleString()} tone={theme.orange} theme={theme} style={{ height: '100%' }} />
                    <InfoCard label="Capacity" value={camp.capacity.toLocaleString()} tone={theme.t0} theme={theme} style={{ height: '100%' }} />
                    <InfoCard label="Occupancy" value={`${occupancy}%`} tone={theme.yellow} theme={theme} style={{ height: '100%' }} />
                    <InfoCard label="Aid coverage" value={`${camp.aid}%`} tone={theme.green} theme={theme} style={{ height: '100%' }} />
                  </div>
                </Section>

                <Section title="Camp details" theme={theme}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Row label="Camp code" value={camp.code} tone={theme.t0} theme={theme} />
                    <Row label="Disaster type" value={camp.type} tone={theme.t0} theme={theme} />
                    <Row label="Camp elevation" value={campElevation} tone={theme.cyan} theme={theme} />
                    <Row label="Workers" value={camp.workers} tone={theme.cyan} theme={theme} />
                    <Row label="Location" value={`${camp.lat.toFixed(2)}°N, ${camp.lng.toFixed(2)}°E`} tone={theme.t0} theme={theme} />
                  </div>
                </Section>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ position: 'relative', minHeight: 232, borderRadius: 18, overflow: 'hidden', border: `1px solid ${theme.border}`, background: theme.surface, boxShadow: mode === 'dark' ? '0 18px 42px rgba(0,0,0,0.22)' : '0 18px 42px rgba(19,47,74,0.08)' }}>
              <img src={mode === 'light' ? '/disaster/terrain-topography-light.png' : '/disaster/terrain-topography.jpg'} alt="Terrain reference" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(3,8,15,0.86) 0%, rgba(3,8,15,0.56) 50%, rgba(3,8,15,0.12) 100%)' }} />
              <div style={{ position: 'absolute', inset: 0, padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 328px', gap: 14, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div>
                    <div style={{ fontSize: 9, color: theme.cyan, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Terrain reference</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#f4fbff', lineHeight: 1.06 }}>Relief Operations Grid</div>
                    <div style={{ marginTop: 5, fontSize: 10, color: '#cfe7f5', letterSpacing: '0.06em', maxWidth: 290 }}>Terrain-topography alignment for the selected camp and live operational data.</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 9px', borderRadius: 999, background: `${theme.bg}cc`, border: `1px solid ${theme.border}`, color: theme.t0, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{camp.code}</span>
                      <span style={{ padding: '4px 9px', borderRadius: 999, background: `${statusColor(camp.status, theme)}20`, border: `1px solid ${statusColor(camp.status, theme)}55`, color: statusColor(camp.status, theme), fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{STATUS_META[camp.status].label}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, alignContent: 'end' }}>
                  <div style={{ padding: '10px 12px', borderRadius: 16, background: 'rgba(7,14,25,0.72)', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 8, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Alert profile</div>
                      <div style={{ fontSize: 8, color: statusColor(camp.status, theme), letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{STATUS_META[camp.status].label}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, fontSize: 10, color: '#e7f4fb' }}>
                      <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Level</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.wl} m</div></div>
                      <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rainfall</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.rain} mm</div></div>
                      <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Alert lvl</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.alertL} m</div></div>
                      <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Major flood</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.majorL} m</div></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Positioned water network (top-right) and weather snapshot (bottom-left) inside terrain card */}
              <div style={{ position: 'absolute', right: 18, top: 18, width: 300, maxWidth: 320, padding: '10px 12px', borderRadius: 12, background: 'rgba(7,14,25,0.88)', border: `1px solid ${theme.border}`, boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Water network</div>
                  <div style={{ fontSize: 8, color: theme.cyan, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{detail.station}</div>
                </div>
                <div style={{ display: 'grid', gap: 6, fontSize: 10, color: '#e7f4fb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Path</span><strong style={{ color: theme.cyan }}>{detail.waterPath}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>River</span><strong>{detail.river}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Distance</span><strong>{(detail.stDist / 1000).toFixed(2)} km</strong></div>
                </div>
              </div>

              {/* Positioned weather snapshot inside terrain card (bottom-left) */}
              <div style={{ position: 'absolute', left: 18, bottom: 18, width: 260, padding: '10px 12px', borderRadius: 12, background: 'rgba(7,14,25,0.88)', border: `1px solid ${theme.border}`, boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Weather snapshot</div>
                  <div style={{ fontSize: 8, color: theme.orange, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{detail.rain} mm rain</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, fontSize: 10, color: '#e7f4fb' }}>
                  <div style={{ padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Min</div><div style={{ marginTop: 2, fontWeight: 800, fontSize: 11 }}>{detail.minT}°</div></div>
                  <div style={{ padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Max</div><div style={{ marginTop: 2, fontWeight: 800, fontSize: 11 }}>{detail.maxT}°</div></div>
                  <div style={{ padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Humidity</div><div style={{ marginTop: 2, fontWeight: 800, fontSize: 11 }}>{detail.hum}%</div></div>
                  <div style={{ padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}><div style={{ color: theme.t2, fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pressure</div><div style={{ marginTop: 2, fontWeight: 800, fontSize: 11 }}>{detail.pres}hPa</div></div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {[
                { label: 'Displaced', value: camp.displaced.toLocaleString(), color: theme.orange },
                { label: 'Capacity', value: camp.capacity.toLocaleString(), color: theme.t0 },
                { label: 'Occupancy', value: `${occupancy}%`, color: theme.orange },
                { label: 'Aid Coverage', value: `${camp.aid}%`, color: theme.green },
                { label: 'Responders', value: camp.workers, color: theme.cyan },
              ].map((item) => (
                <div key={item.label} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, padding: 11, textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1.08 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'stretch' }}>
              <Section title="Hydrology details" theme={theme} compact>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, height: '100%' }}>
                  <InfoCard label="Gauge lat" value={`${detail.gauLat.toFixed(4)}°`} tone={theme.cyan} theme={theme} style={{ height: '100%' }} />
                  <InfoCard label="Gauge lng" value={`${detail.gauLng.toFixed(4)}°`} tone={theme.cyan} theme={theme} style={{ height: '100%' }} />
                  <InfoCard label="Upstream" value={`${detail.upDist.toFixed(0)} m`} tone={theme.t0} theme={theme} style={{ height: '100%' }} />
                  <InfoCard label="Minor flood" value={`${detail.minorL} m`} tone={theme.orange} theme={theme} style={{ height: '100%' }} />
                </div>
              </Section>

              <Section title="Operational summary" theme={theme} compact>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, height: '100%' }}>
                  <InfoCard label="Precip (24h)" value={`${detail.precip.toFixed(1)} mm`} tone={theme.orange} theme={theme} compact style={{ height: '100%', padding: 16 }} />
                  <InfoCard label="Peak hour" value={`${detail.maxHrPrec} mm`} tone={theme.yellow} theme={theme} compact style={{ height: '100%', padding: 16 }} />
                  <InfoCard label="Max wind" value={`${detail.maxWind} km/h`} tone={theme.t0} theme={theme} compact style={{ height: '100%', padding: 16 }} />
                  <InfoCard label="Cloud cover" value={`${detail.cloud}%`} tone={theme.t1} theme={theme} compact style={{ height: '100%', padding: 16 }} />
                </div>
              </Section>

              <Section title="Model output" theme={theme} compact>
              {prediction ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <InfoCard label="Flood risk" value={prediction.flood_possibility} tone={predictionTone} theme={theme} style={{ height: '100%' }} />
                    <InfoCard label="Category" value={prediction.category} tone={predictionTone} theme={theme} style={{ height: '100%' }} />
                    <InfoCard label="Probability" value={`${Math.round(prediction.probability * 100)}%`} tone={predictionTone} theme={theme} style={{ height: '100%' }} />
                  </div>
                  <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: theme.mode === 'dark' ? '#07121d' : '#f5f9fc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Future forecast</div>
                        <div style={{ fontSize: 9, color: predictionTone, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{prediction.future_forecast?.category || 'UNKNOWN'}</div>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: `${theme.border}44`, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((prediction.future_forecast?.probability || 0) * 100)}%`, height: '100%', background: predictionTone }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: theme.t1 }}>
                      <span>Forecast chance</span>
                      <strong style={{ color: predictionTone }}>{Math.round((prediction.future_forecast?.probability || 0) * 100)}%</strong>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: theme.t2, lineHeight: 1.6 }}>Source: {prediction.source}</div>
                  </div>
                </div>
              ) : (
                <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: theme.mode === 'dark' ? '#07121d' : '#f5f9fc', color: theme.t2, fontSize: 11, lineHeight: 1.6, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div>
                    <div>Model output is unavailable for this camp.</div>
                    {predictionError ? <div style={{ marginTop: 6, color: theme.orange }}>{predictionError}</div> : null}
                  </div>
                </div>
              )}
              </Section>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => router.push('/disaster')} style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.t1, borderRadius: 6, padding: '10px 20px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Back to overview</button>
        </div>
      </div>

      {/* weather snapshot moved into terrain card */}
    </div>
    </WithRail>
  )
}
