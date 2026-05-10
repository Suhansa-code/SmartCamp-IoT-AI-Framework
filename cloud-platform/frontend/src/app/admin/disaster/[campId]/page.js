'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { STATUS_META, statusColor } from '@/components/disaster/disasterData'

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

function InfoCard({ label, value, tone, theme }) {
  return <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.surface, padding: 12, minHeight: 84, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div style={{ fontSize: 9, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color: tone || theme.t0, lineHeight: 1.08 }}>{value}</div></div>
}

function Section({ title, children, theme }) {
  return <section style={{ border: `1px solid ${theme.border}`, borderRadius: 16, background: theme.surface, padding: 14 }}><div style={{ fontSize: 9, color: theme.t2, letterSpacing: '0.16em', marginBottom: 10, textTransform: 'uppercase', fontWeight: 800 }}>{title}</div>{children}</section>
}

function Row({ label, value, tone, theme }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: `1px solid ${theme.border}18`, fontSize: 12 }}><span style={{ color: theme.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span><span style={{ color: tone || theme.t0, fontWeight: 700, textAlign: 'right' }}>{value}</span></div>
}

const DISASTER_API_BASE = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || 'http://localhost:3001'

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
    const id = setInterval(() => {
      setUtc(new Date().toUTCString().slice(17, 25))
      setTick((value) => value + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true

    async function loadCamp() {
      if (campId === 'overview') {
        router.replace('/admin/disaster')
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
  const waterTone = detail ? (detail.wl > detail.alertL ? theme.red : detail.wl > 0 ? theme.yellow : theme.cyan) : theme.cyan
  const predictionTone = prediction ? getPredictionTone(prediction.probability, theme) : theme.t2

  const [predLoading, setPredLoading] = useState(false)
  const [predResult, setPredResult] = useState(prediction)
  const [predError, setPredError] = useState(predictionError)

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

  if (loading) {
    return (
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
            <button onClick={() => router.push('/admin/disaster')} style={{ marginTop: 12, border: 'none', borderRadius: 8, padding: '10px 18px', background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`, color: '#07111b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Back to disaster dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  if (!camp) {
    return <div style={{ minHeight: '100vh', background: theme.bg, display: 'grid', placeItems: 'center', color: theme.t0, fontFamily: "'Inter','Segoe UI',sans-serif", padding: 24, transition: 'background 0.3s' }}><div style={{ maxWidth: 560, width: '100%', border: `1px solid ${theme.border}`, borderRadius: 20, padding: 28, background: theme.surface, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Camp not found</div><div style={{ color: theme.t2, lineHeight: 1.7, marginBottom: 18, fontSize: 14 }}>The selected camp id is not available in the disaster dashboard data set.</div><button onClick={() => router.push('/admin/disaster')} style={{ border: 'none', borderRadius: 8, padding: '11px 20px', background: `linear-gradient(135deg, ${theme.cyan}, ${theme.green})`, color: '#07111b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Back to disaster dashboard</button></div></div>
  }

  return (
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
            LIVE {utc}
          </div>
          <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: `1px solid ${theme.border}`, borderRadius: 999, background: theme.surface, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: theme.t1, letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s' }}>
            <span style={{ fontSize: 12 }}>{mode === 'dark' ? '☀' : '🌙'}</span>
            {mode === 'dark' ? 'LIGHT' : 'DARK'}
          </button>
          <button onClick={() => router.push('/admin/disaster')} style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.t1, borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>← Back</button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: 1560, margin: '0 auto', padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Left Column */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ position: 'relative', minHeight: 320, borderRadius: 18, overflow: 'hidden', border: `1px solid ${theme.border}`, background: `linear-gradient(180deg, ${theme.surface} 0%, ${theme.bg} 100%)`, boxShadow: mode === 'dark' ? '0 18px 42px rgba(0,0,0,0.28)' : '0 18px 42px rgba(19,47,74,0.1)' }}>
              <div style={{ position: 'absolute', inset: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.18em', color: theme.cyan, textTransform: 'uppercase', marginBottom: 6 }}>{camp.code} · {camp.type}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, color: theme.t0 }}>{camp.name}</div>
                    <div style={{ marginTop: 6, fontSize: 10, color: theme.t2, letterSpacing: '0.08em' }}>Operational snapshot with displacement trend and aid readiness.</div>
                  </div>
                  <div style={{ padding: '5px 10px', borderRadius: 999, background: `${statusColor(camp.status, theme)}18`, border: `1px solid ${statusColor(camp.status, theme)}44`, color: statusColor(camp.status, theme), fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{STATUS_META[camp.status].label}</div>
                </div>

                <div style={{ borderRadius: 16, border: `1px solid ${theme.border}`, background: mode === 'dark' ? 'rgba(6,16,26,0.86)' : 'rgba(255,255,255,0.92)', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'end', gap: 10, height: 142 }}>
                    {[28, 38, 33, 47, 62, 56, 68, 74].map((bar, index) => (
                      <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: 6 }}>
                        <div style={{ height: `${bar}%`, minHeight: 14, borderRadius: 10, background: `linear-gradient(180deg, ${index % 2 === 0 ? theme.cyan : theme.orange} 0%, ${theme.bg} 100%)`, boxShadow: `0 0 12px ${(index % 2 === 0 ? theme.cyan : theme.orange)}30` }} />
                        <div style={{ height: 2, background: theme.border, borderRadius: 999 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', color: theme.t2, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    <span>24h load</span>
                    <span>response trend</span>
                  </div>
                </div>
              </div>
            </div>

            <Section title="Camp snapshot" theme={theme}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                <InfoCard label="Displaced" value={camp.displaced.toLocaleString()} tone={theme.orange} theme={theme} />
                <InfoCard label="Capacity" value={camp.capacity.toLocaleString()} tone={theme.t0} theme={theme} />
                <InfoCard label="Occupancy" value={`${occupancy}%`} tone={theme.yellow} theme={theme} />
                <InfoCard label="Aid coverage" value={`${camp.aid}%`} tone={theme.green} theme={theme} />
              </div>
            </Section>

            <Section title="Camp details" theme={theme}>
              <Row label="Camp code" value={camp.code} tone={theme.t0} theme={theme} />
              <Row label="Disaster type" value={camp.type} tone={theme.t0} theme={theme} />
              <Row label="Workers" value={camp.workers} tone={theme.cyan} theme={theme} />
              <Row label="Location" value={`${camp.lat.toFixed(2)}°N, ${camp.lng.toFixed(2)}°E`} tone={theme.t0} theme={theme} />
            </Section>

            <Section title="Model output" theme={theme}>
              {predLoading ? (
                <div style={{ color: theme.t2 }}>Running model prediction…</div>
              ) : predError ? (
                <div style={{ color: theme.red }}>{predError}</div>
              ) : predResult ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <Row label="Category" value={predResult.category || '—'} tone={predictionTone} theme={theme} />
                  <Row label="Probability" value={`${Math.round((predResult.probability || 0) * 100)}%`} tone={predictionTone} theme={theme} />
                  <Row label="Flood possibility" value={String(predResult.flood_possibility)} tone={predictionTone} theme={theme} />
                </div>
              ) : (
                <div style={{ color: theme.t2 }}>No prediction available</div>
              )}
            </Section>
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

            <Section title="Overview" theme={theme}><Row label="Status" value={STATUS_META[camp.status].label} tone={statusColor(camp.status, theme)} theme={theme} /><Row label="Camp code" value={camp.code} tone={theme.t1} theme={theme} /><Row label="Location" value={`${camp.lat.toFixed(2)}°N, ${camp.lng.toFixed(2)}°E`} tone={theme.t0} theme={theme} /></Section>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
              <Section title="Hydrology details" theme={theme}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}><InfoCard label="Gauge lat" value={`${detail.gauLat.toFixed(4)}°`} tone={theme.cyan} theme={theme} /><InfoCard label="Gauge lng" value={`${detail.gauLng.toFixed(4)}°`} tone={theme.cyan} theme={theme} /><InfoCard label="Upstream" value={`${detail.upDist.toFixed(0)} m`} tone={theme.t0} theme={theme} /><InfoCard label="Minor flood" value={`${detail.minorL} m`} tone={theme.orange} theme={theme} /></div></Section>
            </div>

            <Section title="Operational summary" theme={theme}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}><InfoCard label="Precip 24h" value={`${detail.precip.toFixed(1)} mm`} tone={theme.orange} theme={theme} /><InfoCard label="Peak hour" value={`${detail.maxHrPrec} mm`} tone={theme.yellow} theme={theme} /><InfoCard label="Max wind" value={`${detail.maxWind} km/h`} tone={theme.t0} theme={theme} /><InfoCard label="Cloud cover" value={`${detail.cloud}%`} tone={theme.t1} theme={theme} /></div></Section>

            <Section title="Model output" theme={theme}>
              {prediction ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <InfoCard label="Flood risk" value={prediction.flood_possibility} tone={predictionTone} theme={theme} />
                    <InfoCard label="Category" value={prediction.category} tone={predictionTone} theme={theme} />
                    <InfoCard label="Probability" value={`${Math.round(prediction.probability * 100)}%`} tone={predictionTone} theme={theme} />
                  </div>
                  <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: theme.mode === 'dark' ? '#07121d' : '#f5f9fc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 8, color: theme.t2, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Future forecast</div>
                      <div style={{ fontSize: 8, color: predictionTone, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>{prediction.future_forecast?.category || 'UNKNOWN'}</div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: `${theme.border}44`, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((prediction.future_forecast?.probability || 0) * 100)}%`, height: '100%', background: predictionTone }} />
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 10, color: theme.t1 }}>
                      <span>Forecast chance</span>
                      <strong style={{ color: predictionTone }}>{Math.round((prediction.future_forecast?.probability || 0) * 100)}%</strong>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10, color: theme.t2, lineHeight: 1.6 }}>Source: {prediction.source}</div>
                  </div>
                </div>
              ) : (
                <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: theme.mode === 'dark' ? '#07121d' : '#f5f9fc', color: theme.t2, fontSize: 11, lineHeight: 1.6 }}>
                  Model output is unavailable for this camp.
                  {predictionError ? <div style={{ marginTop: 6, color: theme.orange }}>{predictionError}</div> : null}
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* Footer Button */}
        <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => router.push('/admin/disaster')} style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.t1, borderRadius: 6, padding: '10px 20px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Back to overview</button>
        </div>
      </div>

      {/* weather snapshot moved into terrain card */}
    </div>
  )
}
