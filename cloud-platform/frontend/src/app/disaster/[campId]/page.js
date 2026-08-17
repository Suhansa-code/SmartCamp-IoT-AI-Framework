'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Users, MapPin, HeartHandshake, Gauge, RefreshCw, ArrowLeft,
  Droplets, CloudRain, Wind, Cloud, Activity, ChevronRight,
} from 'lucide-react'
import { STATUS_META, statusColor, getCampById, CAMP_DETAIL } from '@/components/disaster/disasterData'
import SideNav from '@/components/common/SideNav'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import Button from '@/components/common/Button'
import KpiCard from '@/components/dashboard/KpiCard'
import MiniStat from '@/components/dashboard/MiniStat'
import DashboardCard from '@/components/dashboard/DashboardCard'
import { P } from '@/components/alert/alertPalette'

// Applies the global navigation rail + offsets content to the right of it.
function WithRail({ children }) {
  return (
    <div style={{ minHeight: '100vh', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
      <SideNav />
      {children}
    </div>
  )
}

// White "nitec" theme mapped to the shape the detail sections expect.
const W = {
  mode: 'light',
  bg: P.panel,
  surface: P.panel,
  panel: P.panel,
  border: P.border,
  borderHi: '#c9d6e2',
  t0: P.ink,
  t1: P.inkSoft,
  t2: P.muted,
  t3: '#8ba1b5',
  red: P.red,
  orange: '#F97316',
  yellow: P.amber,
  cyan: P.teal,
  green: P.green,
}

const STATUS_COLOR = { critical: P.red, high: '#F97316', medium: P.amber, stable: P.teal, recovery: P.green }

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
  const padding = compact ? 12 : 14
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

// Offline mock — mirrors the dashboard's fallback so the detail page renders
// when the cloud backend is unreachable.
function buildFallbackCamp(campId) {
  const camp = getCampById(campId)
  if (!camp) return null
  return {
    ...camp,
    detail: CAMP_DETAIL[campId] || {
      waterPath: 'Local stream', river: 'Unknown', station: 'Local gauge', stDist: 8000, upDist: 600,
      wl: 0.5, rain: 10, alertL: 4.0, minorL: 5.0, majorL: 6.5,
      gauLat: camp.lat, gauLng: camp.lng, fcLat: camp.lat, fcLng: camp.lng,
      elev: 10, minT: 24, maxT: 31, hum: 85, precip: 10, maxHrPrec: 2, maxWind: 15, avgWind: 6,
      soil: 0.3, pres: 1008, cloud: 80,
    },
    prediction: null,
  }
}

function Chip({ children, color = P.muted, style }) {
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

export default function DisasterCampDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [utc, setUtc] = useState('')
  const [tick, setTick] = useState(0)
  const [camp, setCamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const campId = Array.isArray(params?.campId) ? params.campId[0] : params?.campId

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
        setCamp(payload || buildFallbackCamp(campId))
        if (!payload && !buildFallbackCamp(campId)) setError('Camp not found')
      } catch (err) {
        if (!active) return
        const fb = buildFallbackCamp(campId)
        setCamp(fb)
        if (fb) setError('')
        else setError(err instanceof Error ? err.message : 'Failed to load camp detail')
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
  const predictionTone = prediction ? getPredictionTone(prediction.probability, W) : W.t2

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

  const chartLabels = chartPoints.map((point, index) => {
    const label = point.timestamp ? formatChartTimestamp(point.timestamp) : `${chartPoints.length - index - 1}h`
    return index === chartPoints.length - 1 ? 'NOW' : label || `${chartPoints.length - index - 1}h`
  })

  const refreshCamp = useCallback(async () => {
    if (!campId) return
    setRefreshing(true)
    setError('')
    try {
      const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}`)
      const payload = res.ok ? await res.json() : null
      setCamp(payload || buildFallbackCamp(campId))
      if (!payload && !buildFallbackCamp(campId)) setError('Camp not found')
    } catch (err) {
      const fb = buildFallbackCamp(campId)
      setCamp(fb)
      if (fb) setError('')
      else setError(err instanceof Error ? err.message : 'Failed to reload camp detail')
    } finally {
      setRefreshing(false)
    }
  }, [campId])

  const detailMatch = (label, value) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return String(label).toLowerCase().includes(q) || String(value ?? '').toLowerCase().includes(q)
  }

  const statusPill = camp ? (
    <Chip color={STATUS_COLOR[camp.status]}>{STATUS_META[camp.status]?.label}</Chip>
  ) : null

  const waterTone = detail ? (detail.wl > detail.alertL ? P.red : detail.wl > 0 ? P.amber : P.teal) : P.teal

  const kpis = camp ? [
    { label: 'Displaced', value: camp.displaced.toLocaleString(), color: '#F97316', icon: <Users size={16} />, pct: Math.min(100, Math.round((camp.displaced / camp.capacity) * 100)) },
    { label: 'Capacity', value: camp.capacity.toLocaleString(), color: P.ink, icon: <MapPin size={16} />, pct: 100 },
    { label: 'Occupancy', value: `${occupancy}%`, color: P.amber, icon: <Gauge size={16} />, pct: occupancy },
    { label: 'Aid Coverage', value: `${camp.aid}%`, color: P.green, icon: <HeartHandshake size={16} />, pct: camp.aid },
  ] : []

  if (loading) {
    return (
      <WithRail>
        <div style={{ minHeight: '100vh', background: P.panel, display: 'grid', placeItems: 'center', color: P.ink, fontFamily: "'Inter',sans-serif", padding: 24 }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{  width: '100%', padding: 28, textAlign: 'center',}}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, border: `4px solid ${P.border}`, borderTop: `4px solid ${P.teal}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Loading camp details…</div>
              <div style={{ color: P.muted, lineHeight: 1.6, marginBottom: 8, fontSize: 13 }}>Fetching latest camp data for {campId}</div>
            </div>
          </div>
        </div>
      </WithRail>
    )
  }

  if (!camp) {
    return (
      <WithRail>
        <div style={{ minHeight: '100vh', background: P.outer, display: 'grid', placeItems: 'center', color: P.ink, fontFamily: "'Inter',sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 560, width: '100%', border: `1px solid ${P.border}`, borderRadius: 20, padding: 28, background: P.panel, textAlign: 'center', boxShadow: '0 24px 60px rgba(20,30,40,0.12)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Camp not found</div>
            <div style={{ color: P.muted, lineHeight: 1.7, marginBottom: 18, fontSize: 14 }}>
              {error || `The selected camp id is not available in the disaster dashboard data set.`}
            </div>
            <Button onClick={() => router.push('/disaster')} icon={<ArrowLeft size={15} />}>
              Back to disaster dashboard
            </Button>
          </div>
        </div>
      </WithRail>
    )
  }

  return (
    <WithRail>
      <div style={{ minHeight: '100vh', background: P.outer, fontFamily: "'Inter',sans-serif", color: P.ink }}>
        <style>{`
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 9999px; }
          button:hover { opacity: 0.92; }
          @keyframes disPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          .det-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
          .det-hero { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.25rem; }
          .det-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
          .det-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.9rem; }
          @media (max-width: 1150px) { .det-hero, .det-two { grid-template-columns: 1fr; } }
          @media (max-width: 900px) { .det-kpi { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 560px) {
            .det-kpi { grid-template-columns: 1fr; }
            .det-strip { grid-template-columns: repeat(2, 1fr); }
          }
        `}</style>

        <div className='header-wrapper'>
          <main style={{ background: P.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <HeaderShell>
              <PageHeader
                pendingCount={camp.status === 'high' ? 1 : 0}
                escalatedCount={camp.status === 'critical' ? 1 : 0}
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: 'Search camp detail…',
                  onRefresh: refreshCamp,
                  refreshing: refreshing || loading,
                }}
              />
            </HeaderShell>

            <div style={{ padding: '0rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── Title row ─────────────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: P.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
                    {camp.code} · {camp.type} · Camp Disaster Detail
                  </div>
                  <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: P.ink }}>
                    {camp.name}
                  </h1>
                  <p style={{ color: P.muted, fontSize: '0.82rem', marginTop: 4, fontWeight: 600 }}>
                    Past hourly gauging-station water levels · {detail?.station || 'gauging station'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: P.green, fontFamily: 'monospace' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: P.green, boxShadow: `0 0 8px ${P.green}`, animation: 'disPulse 2s infinite' }} />
                    LIVE LK {utc}
                  </span>
                  {statusPill}
                  <Button variant="circle" onClick={refreshCamp} disabled={refreshing} aria-label="Refresh camp data">
                    <RefreshCw size={16} style={refreshing ? { animation: 'disSpin 0.8s linear infinite' } : undefined} />
                  </Button>
                  <Button onClick={() => router.push('/disaster')} icon={<ArrowLeft size={15} />}>
                    Back to Overview
                  </Button>
                </div>
              </div>

              {/* ── KPI row ────────────────────────────────────────────── */}
              <div className="det-kpi">
                {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
              </div>

              {/* ── Hero — water level + terrain image ─────────────────── */}
              <div className="det-hero">
                {/* water level chart */}
                <DashboardCard
                  title="Water Level Trend"
                  subtitle="Relative scaling for trend clarity · hover a bar for the reading"
                  right={
                    <Chip color={waterTone}>
                      <Droplets size={11} /> {Number(detail?.wl).toFixed(2)} m
                    </Chip>
                  }
                >
                  <div style={{ position: 'relative' }}>
                    {hoveredBarIndex !== null && chartPoints[hoveredBarIndex] ? (
                      <div style={{ position: 'absolute', top: 4, right: 8, padding: '6px 10px', borderRadius: 10, background: `${P.panelSoft}f2`, border: `1px solid ${P.border}`, fontSize: 9, color: P.ink, letterSpacing: '0.04em', zIndex: 2, boxShadow: '0 10px 24px rgba(20,30,40,0.14)' }}>
                        <div style={{ fontSize: 8, color: P.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Water level</div>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{chartPoints[hoveredBarIndex].value.toFixed(2)} m</div>
                        {chartPoints[hoveredBarIndex].timestamp ? (
                          <div style={{ marginTop: 2, fontSize: 8, color: P.muted }}>{formatChartTimestamp(chartPoints[hoveredBarIndex].timestamp)}</div>
                        ) : null}
                      </div>
                    ) : null}
                    <div style={{ position: 'relative', height: 190 }}>
                      <svg viewBox="0 0 170 100" preserveAspectRatio="xMidYMid meet" style={{ width: 'calc(100% + 40px)', height: '100%', display: 'block', marginLeft: '-40px' }}>
                        <defs>
                          <linearGradient id="waterLevelArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.teal} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={P.teal} stopOpacity="0.02" />
                          </linearGradient>
                          <linearGradient id="waterLevelBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.teal} stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#F97316" stopOpacity="0.6" />
                          </linearGradient>
                        </defs>

                        {[0, 25, 50, 75, 100].map((lineY) => (
                          <line key={lineY} x1="10" y1={lineY} x2="150" y2={lineY} stroke={P.border} strokeWidth="0.45" strokeDasharray="1.6 2.8" opacity="0.8" />
                        ))}

                        {thresholdY !== null ? (
                          <line x1="10" y1={thresholdY} x2="150" y2={thresholdY} stroke={P.red} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.8" />
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
                          <path d={chartLinePath} fill="none" stroke={P.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 2px ${P.teal}80)` }} />
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
                              fill={P.panel}
                              stroke={index % 2 === 0 ? P.teal : '#F97316'}
                              strokeWidth="1.4"
                              style={{ cursor: 'pointer', filter: `drop-shadow(0 0 5px ${(index % 2 === 0 ? P.teal : '#F97316')}78)` }}
                              onMouseEnter={() => setHoveredBarIndex(index)}
                              onMouseLeave={() => setHoveredBarIndex(null)}
                            />
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={hoveredBarIndex === index ? 0.9 : 0.75}
                              fill={index % 2 === 0 ? P.teal : '#F97316'}
                              pointerEvents="none"
                            />
                            {index === chartPoints.length - 1 ? (
                              <text
                                x={point.x}
                                y={point.y - 4}
                                textAnchor="middle"
                                fill={P.teal}
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
                        <div key={`${label}-${index}`} style={{ textAlign: 'center', fontSize: 8, color: index === chartLabels.length - 1 ? P.teal : P.muted, letterSpacing: '0.08em', fontWeight: index === chartLabels.length - 1 ? 800 : 600 }}>
                          {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', color: P.muted, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      <span>{waterLevelLoading ? 'loading levels' : 'relative water trend'}</span>
                      <span>{detail?.station || 'gauging station'}</span>
                    </div>
                  </div>
                </DashboardCard>

                {/* terrain reference image card */}
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '1.25rem', border: `1px solid ${P.border}`, minHeight: 320, boxShadow: '0 18px 42px rgba(19,47,74,0.1)', display: 'flex', flexDirection: 'column' }}>
                  <img src="/disaster/terrain-topography-light.png" alt="Terrain reference" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.25) 45%, rgba(15,23,42,0.08) 100%)' }} />
                  <div style={{ position: 'relative', zIndex: 2, padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: P.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>
                        Terrain reference
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>Relief Operations Grid</div>
                      <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em', maxWidth: 300 }}>Terrain-topography alignment for the selected camp and live operational data.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={P.lime} style={{ background: `${P.lime}22`, border: `1px solid ${P.lime}66` }}>{camp.code}</Chip>
                      <Chip color={STATUS_COLOR[camp.status]}>{STATUS_META[camp.status]?.label}</Chip>
                    </div>

                    {/* alert profile */}
                    <div style={{ marginTop: 'auto', padding: '0.7rem 0.85rem', borderRadius: 14, background: 'rgba(255,255,255,0.92)', border: `1px solid ${P.border}`, boxShadow: '0 12px 28px rgba(20,30,40,0.16)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 8, color: P.muted, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>Alert profile</div>
                        <div style={{ fontSize: 8, color: STATUS_COLOR[camp.status], letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{STATUS_META[camp.status]?.label}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, fontSize: 10, color: P.ink }}>
                        <div style={{ padding: '7px 8px', borderRadius: 12, background: P.cardSoft, border: `1px solid ${P.border}` }}><div style={{ color: P.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Level</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.wl} m</div></div>
                        <div style={{ padding: '7px 8px', borderRadius: 12, background: P.cardSoft, border: `1px solid ${P.border}` }}><div style={{ color: P.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rainfall</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.rain} mm</div></div>
                        <div style={{ padding: '7px 8px', borderRadius: 12, background: P.cardSoft, border: `1px solid ${P.border}` }}><div style={{ color: P.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Alert lvl</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.alertL} m</div></div>
                        <div style={{ padding: '7px 8px', borderRadius: 12, background: P.cardSoft, border: `1px solid ${P.border}` }}><div style={{ color: P.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Major flood</div><div style={{ marginTop: 2, fontWeight: 800 }}>{detail.majorL} m</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Snapshot / details + hydrology / operations / model ── */}
              <div className="det-two">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Section title="Camp snapshot" theme={W}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, height: '100%' }}>
                      {detailMatch('Displaced', camp.displaced.toLocaleString()) && <InfoCard label="Displaced" value={camp.displaced.toLocaleString()} tone="#F97316" theme={W} style={{ height: '100%' }} />}
                      {detailMatch('Capacity', camp.capacity.toLocaleString()) && <InfoCard label="Capacity" value={camp.capacity.toLocaleString()} tone={P.ink} theme={W} style={{ height: '100%' }} />}
                      {detailMatch('Occupancy', `${occupancy}%`) && <InfoCard label="Occupancy" value={`${occupancy}%`} tone={P.amber} theme={W} style={{ height: '100%' }} />}
                      {detailMatch('Aid coverage', `${camp.aid}%`) && <InfoCard label="Aid coverage" value={`${camp.aid}%`} tone={P.green} theme={W} style={{ height: '100%' }} />}
                    </div>
                  </Section>

                  <Section title="Camp details" theme={W}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detailMatch('Camp code', camp.code) && <Row label="Camp code" value={camp.code} tone={P.ink} theme={W} />}
                      {detailMatch('Disaster type', camp.type) && <Row label="Disaster type" value={camp.type} tone={P.ink} theme={W} />}
                      {detailMatch('Camp elevation', campElevation) && <Row label="Camp elevation" value={campElevation} tone={P.teal} theme={W} />}
                      {detailMatch('Workers', camp.workers) && <Row label="Workers" value={camp.workers} tone={P.teal} theme={W} />}
                      {detailMatch('Location', `${camp.lat.toFixed(2)}°N, ${camp.lng.toFixed(2)}°E`) && <Row label="Location" value={`${camp.lat.toFixed(2)}°N, ${camp.lng.toFixed(2)}°E`} tone={P.ink} theme={W} />}
                    </div>
                  </Section>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Section title="Hydrology details" theme={W} compact>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, height: '100%' }}>
                      <InfoCard label="Gauge lat" value={`${detail.gauLat.toFixed(4)}°`} tone={P.teal} theme={W} style={{ height: '100%' }} />
                      <InfoCard label="Gauge lng" value={`${detail.gauLng.toFixed(4)}°`} tone={P.teal} theme={W} style={{ height: '100%' }} />
                      <InfoCard label="Upstream" value={`${detail.upDist.toFixed(0)} m`} tone={P.ink} theme={W} style={{ height: '100%' }} />
                      <InfoCard label="Minor flood" value={`${detail.minorL} m`} tone="#F97316" theme={W} style={{ height: '100%' }} />
                    </div>
                  </Section>

                  <Section title="Operational summary" theme={W} compact>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, height: '100%' }}>
                      <InfoCard label="Precip (24h)" value={`${detail.precip.toFixed(1)} mm`} tone="#F97316" theme={W} compact style={{ height: '100%', padding: 16 }} />
                      <InfoCard label="Peak hour" value={`${detail.maxHrPrec} mm`} tone={P.amber} theme={W} compact style={{ height: '100%', padding: 16 }} />
                      <InfoCard label="Max wind" value={`${detail.maxWind} km/h`} tone={P.ink} theme={W} compact style={{ height: '100%', padding: 16 }} />
                      <InfoCard label="Cloud cover" value={`${detail.cloud}%`} tone={P.inkSoft} theme={W} compact style={{ height: '100%', padding: 16 }} />
                    </div>
                  </Section>

                  <Section title="Model output" theme={W} compact>
                  {predResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        <InfoCard label="Flood risk" value={predResult.flood_possibility} tone={predictionTone} theme={W} style={{ height: '100%' }} />
                        <InfoCard label="Category" value={predResult.category} tone={predictionTone} theme={W} style={{ height: '100%' }} />
                        <InfoCard label="Probability" value={`${Math.round(predResult.probability * 100)}%`} tone={predictionTone} theme={W} style={{ height: '100%' }} />
                      </div>
                      <div style={{ border: `1px solid ${P.border}`, borderRadius: 14, padding: 12, background: P.cardSoft, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: P.muted, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Future forecast</div>
                            <div style={{ fontSize: 9, color: predictionTone, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{predResult.future_forecast?.category || 'UNKNOWN'}</div>
                          </div>
                          <div style={{ height: 10, borderRadius: 999, background: `${P.border}`, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round((predResult.future_forecast?.probability || 0) * 100)}%`, height: '100%', background: predictionTone }} />
                          </div>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: P.inkSoft }}>
                          <span>Forecast chance</span>
                          <strong style={{ color: predictionTone }}>{Math.round((predResult.future_forecast?.probability || 0) * 100)}%</strong>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: P.muted, lineHeight: 1.6 }}>Source: {predResult.source}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${P.border}`, borderRadius: 14, padding: 12, background: P.cardSoft, color: P.muted, fontSize: 11, lineHeight: 1.6, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div>
                        <div>Model output is unavailable for this camp.</div>
                        {predError ? <div style={{ marginTop: 6, color: '#F97316' }}>{predError}</div> : null}
                      </div>
                    </div>
                  )}
                  </Section>
                </div>
              </div>

              {/* ── bottom metric strip ────────────────────────────────── */}
              <div className="det-strip">
                <MiniStat label="Water Level" value={`${Number(detail?.wl).toFixed(2)} m`} icon={<Droplets size={12} />} color={waterTone} sub="Gauging station" />
                <MiniStat label="Rainfall" value={`${detail.rain} mm`} icon={<CloudRain size={12} />} color={detail.rain > 20 ? P.red : detail.rain > 5 ? P.amber : P.teal} sub="Last 24h" />
                <MiniStat label="Humidity" value={`${detail.hum}%`} icon={<Cloud size={12} />} color={P.teal} sub="Ambient" />
                <MiniStat label="Pressure" value={`${detail.pres} hPa`} icon={<Activity size={12} />} color={P.ink} sub="Station" />
                <MiniStat label="Precip (24h)" value={`${detail.precip.toFixed(1)} mm`} icon={<CloudRain size={12} />} color="#F97316" sub="Accumulated" />
                <MiniStat label="Responders" value={String(camp.workers)} icon={<Users size={12} />} color={P.purple} sub="Deployed" />
              </div>

              {/* ── footer ──────────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingBottom: '0.5rem' }}>
                <Button onClick={() => router.push('/disaster')} icon={<ChevronRight size={15} />}>
                  Back to Overview
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </WithRail>
  )
}