'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Users, MapPin, HeartHandshake, Gauge, ArrowLeft,
  Droplets, CloudRain, Wind, Cloud, Activity, AlertTriangle,
  Mountain, Layers, Box, Triangle, ChevronRight, RefreshCw,
  Thermometer, Eye, Radio, Shield, Waves, TreePine,
} from 'lucide-react'
import * as MapLibreGL from 'maplibre-gl'
import { STATUS_META, statusColor, getCampById, CAMP_DETAIL, STATUS_COLOR } from '@/data/disaster.data'
import SideNav from '@/components/common/SideNav'
import Button from '@/components/common/Button'
import { useTheme } from '@/components/common/ThemeProvider'
import { Map, MapControls, useMap } from '@/components/ui/map'

const DISASTER_API_BASE = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || 'http://localhost:3002'

const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const TERRAIN_SOURCE = 'camp-detail-dem'
const TERRAIN_EXAGGERATION = 1.5
const HILLSHADE_LAYER = 'camp-detail-hillshade'

const VIEW_MODES = ['2d', '3d', 'terrain', 'slope']

/* ── Skeleton primitives ────────────────────────────────────────────────── */

function SkeletonLine({ w = '100%', h = 14, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 9999,
      background: 'linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

function SkeletonBlock({ w = '100%', h = 120, r = 14, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

function SkeletonCard({ children, delay = 0 }) {
  const { T } = useTheme()
  return (
    <div style={{
      border: `1px solid ${T.border}`, borderRadius: 14, background: T.card,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      '--sk-base': T.cardSoft, '--sk-shine': T.border,
      animationDelay: `${delay}s`,
    }}>
      {children}
    </div>
  )
}

function CampSkeleton() {
  const { T } = useTheme()
  return (
    <div style={{ minHeight: '100vh', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
      <SideNav />
      <style>{`
        @keyframes skeletonShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div style={{ minHeight: '100vh', background: T.outer, fontFamily: "'Inter',sans-serif", color: T.ink }}>
        <main style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Header skeleton */}
          <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonLine w={260} h={10} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SkeletonLine w={300} h={24} style={{ borderRadius: 6 }} />
                <SkeletonLine w={180} h={12} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <SkeletonBlock w={90} h={30} r={8} />
                <SkeletonBlock w={90} h={30} r={8} />
              </div>
            </div>
          </div>

          {/* Map skeleton */}
          <div style={{ padding: '12px 24px' }}>
            <SkeletonBlock h={480} r={16} />
          </div>

          {/* Stats skeleton */}
          <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[0, 1, 2, 3].map(i => (
                <SkeletonCard key={i} delay={i * 0.1}>
                  <SkeletonLine w={80} h={10} />
                  <SkeletonLine w={60} h={22} style={{ borderRadius: 6 }} />
                  <SkeletonLine w={100} h={8} />
                </SkeletonCard>
              ))}
            </div>

            {/* Two-col skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SkeletonCard delay={0.4}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={140} r={10} />
              </SkeletonCard>
              <SkeletonCard delay={0.5}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={140} r={10} />
              </SkeletonCard>
            </div>

            {/* Environment + operational skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SkeletonCard delay={0.6}>
                <SkeletonLine w={100} h={10} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} h={60} r={10} />)}
                </div>
              </SkeletonCard>
              <SkeletonCard delay={0.7}>
                <SkeletonLine w={100} h={10} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} h={60} r={10} />)}
                </div>
              </SkeletonCard>
            </div>

            {/* Alerts + hydrology skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SkeletonCard delay={0.8}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={80} r={10} />
              </SkeletonCard>
              <SkeletonCard delay={0.9}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={100} r={10} />
              </SkeletonCard>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ── Map sub-components ──────────────────────────────────────────────── */

function CampMapView({ camp, dark, viewMode }) {
  const { map, isLoaded } = useMap()
  const markerRef = useRef(null)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!map || !isLoaded || !camp) return

    map.easeTo({
      center: [camp.lng, camp.lat],
      zoom: 12,
      pitch: viewMode !== '2d' ? 55 : 0,
      bearing: viewMode !== '2d' ? 25 : 0,
      duration: 1200,
      easing: (t) => t * (2 - t),
    })
  }, [map, isLoaded, camp, viewMode])

  useEffect(() => {
    if (!map || !isLoaded || !camp) return

    if (markerRef.current) markerRef.current.remove()

    const el = document.createElement('div')
    el.style.cssText = `
      width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
      background: ${STATUS_COLOR[camp.status]}; border: 3px solid #fff;
      box-shadow: 0 0 16px ${STATUS_COLOR[camp.status]}aa, 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s ease;
    `
    el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
    el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

    const popup = new MapLibreGL.Popup({ offset: 18, closeButton: false, className: 'camp-detail-popup' })
      .setHTML(`
        <div style="padding: 8px 12px; font-family: Inter, sans-serif;">
          <div style="font-size: 13px; font-weight: 800; color: ${dark ? '#FAFAFA' : '#0F2540'}; margin-bottom: 2px;">${camp.name}</div>
          <div style="font-size: 11px; color: ${dark ? '#A1A1AA' : '#5B7184'};">${camp.code} · ${camp.type}</div>
        </div>
      `)

    const marker = new MapLibreGL.Marker({ element: el })
      .setLngLat([camp.lng, camp.lat])
      .setPopup(popup)
      .addTo(map)

    markerRef.current = marker
    popupRef.current = popup

    el.addEventListener('click', () => popup.addTo(map))

    return () => {
      marker.remove()
      popup.remove()
    }
  }, [map, isLoaded, camp, dark])

  return null
}

function CampDetailTerrain({ viewMode }) {
  const { map, isLoaded } = useMap()
  const enableTerrain = viewMode !== '2d'
  const enableHillshade = viewMode === 'terrain' || viewMode === 'slope'

  useEffect(() => {
    if (!map || !isLoaded) return

    if (enableTerrain) {
      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: 'raster-dem',
          url: TERRAIN_TILES,
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 12,
        })
      }
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION })

      if (enableHillshade && !map.getLayer(HILLSHADE_LAYER)) {
        map.addLayer({
          id: HILLSHADE_LAYER,
          type: 'hillshade',
          source: TERRAIN_SOURCE,
          paint: {
            'hillshade-exaggeration': viewMode === 'slope' ? 1.0 : 0.8,
            'hillshade-shadow-color': viewMode === 'slope' ? '#1e293b' : '#334155',
            'hillshade-highlight-color': viewMode === 'slope' ? '#fef3c7' : '#e2e8f0',
            'hillshade-accent-color': viewMode === 'slope' ? '#f59e0b' : '#94a3b8',
          },
        }, 'waterway')
      } else if (!enableHillshade && map.getLayer(HILLSHADE_LAYER)) {
        map.removeLayer(HILLSHADE_LAYER)
      }
    } else {
      map.setTerrain(null)
      if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER)
    }
  }, [map, isLoaded, enableTerrain, enableHillshade, viewMode])

  return null
}

function MapViewController({ viewMode }) {
  const { map, isLoaded } = useMap()
  const is3D = viewMode !== '2d'

  useEffect(() => {
    if (!map || !isLoaded) return
    map.easeTo({
      pitch: is3D ? 55 : 0,
      bearing: is3D ? 25 : 0,
      duration: 800,
      easing: (t) => t * (2 - t),
    })
  }, [map, isLoaded, is3D])

  return null
}

/* ── UI primitives ────────────────────────────────────────────────────── */

function StatusBadge({ status, T }) {
  const meta = STATUS_META[status]
  const color = STATUS_COLOR[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: `${color}18`, border: `1px solid ${color}44`, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88` }} />
      {meta?.label || status}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, color, T, sub }) {
  return (
    <div style={{
      border: `1px solid ${T.border}`, borderRadius: 14, background: T.card,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}14`, border: `1px solid ${color}33`,
        }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span style={{ fontSize: '0.6rem', color: T.muted, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: -2 }}>{sub}</div>}
    </div>
  )
}

function DataRow({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${tone ? 'transparent' : 'currentColor'}12` }}>
      <span style={{ fontSize: 11, color: 'inherit', opacity: 0.55, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: tone || 'inherit' }}>{value}</span>
    </div>
  )
}

function RiskBar({ label, level, color, T }) {
  const pct = { critical: 95, high: 80, medium: 55, stable: 30, recovery: 15 }[level] || 50
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: T.ink, fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 800, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>{level}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: `${T.border}`, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function SectionHeading({ label, T }) {
  return (
    <div style={{ fontSize: '0.6rem', color: T.muted, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800, marginBottom: 12 }}>
      {label}
    </div>
  )
}

function InfoCard({ label, value, color, T }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: T.cardSoft, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function DisasterCampDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { T } = useTheme()
  const [camp, setCamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('terrain')

  const campId = Array.isArray(params?.campId) ? params.campId[0] : params?.campId
  const dark = T.mode === 'dark'

  useEffect(() => {
    let active = true

    async function loadCamp() {
      if (campId === 'overview') { router.replace('/disaster'); return }
      if (!campId) { setLoading(false); return }

      setLoading(true)
      setError('')

      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}`)
        const payload = res.ok ? await res.json() : null
        if (!active) return
        if (payload) {
          setCamp(payload)
        } else {
          setCamp(null)
          setError('Camp not found')
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load camp detail')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCamp()
    return () => { active = false }
  }, [campId, router])

  const detail = camp?.detail || null
  const prediction = camp?.prediction || null
  const occupancy = camp ? Math.round((camp.displaced / camp.capacity) * 100) : 0

  const [predResult, setPredResult] = useState(null)
  const [predLoading, setPredLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function loadPrediction() {
      if (!camp || camp.prediction) {
        setPredResult(camp?.prediction || null)
        return
      }
      setPredLoading(true)
      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}/predict`)
        if (!active) return
        if (!res.ok) { setPredResult(null); return }
        const body = await res.json()
        setPredResult(body.prediction || null)
      } catch {
        if (!active) return
        setPredResult(null)
      } finally {
        if (active) setPredLoading(false)
      }
    }
    loadPrediction()
    return () => { active = false }
  }, [camp, campId])

  const refreshCamp = useCallback(async () => {
    if (!campId) return
    setRefreshing(true)
    try {
      const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}`)
      const payload = res.ok ? await res.json() : null
      if (payload) {
        setCamp(payload)
      } else {
        setError('Camp not found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload')
    } finally {
      setRefreshing(false)
    }
  }, [campId])

  const waterTone = detail ? (detail.wl > detail.alertL ? T.red : detail.wl > 0 ? T.amber : T.teal) : T.teal

  /* ── Loading ── */
  if (loading) return <CampSkeleton />

  /* ── Not found ── */
  if (!camp) {
    return (
      <div style={{ minHeight: '100vh', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
        <SideNav />
        <div style={{ minHeight: '100vh', background: T.outer, display: 'grid', placeItems: 'center', color: T.ink, fontFamily: "'Inter',sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 480, width: '100%', border: `1px solid ${T.border}`, borderRadius: 20, padding: 32, background: T.card, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Camp Not Found</div>
            <div style={{ color: T.muted, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              The requested disaster camp could not be found.
            </div>
            <Button onClick={() => router.push('/disaster')} icon={<ArrowLeft size={15} />}>Back to Camps</Button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main content ── */
  return (
    <div style={{ minHeight: '100vh', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
      <SideNav />
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 9999px; }
        .camp-detail-popup .maplibregl-popup-content { border-radius: 12px !important; padding: 0 !important; box-shadow: 0 12px 32px rgba(0,0,0,0.2) !important; border: 1px solid ${T.border} !important; background: ${T.card} !important; }
        .camp-detail-popup .maplibregl-popup-tip { border-top-color: ${T.card} !important; }
        .cd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .cd-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .cd-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 1100px) { .cd-grid { grid-template-columns: repeat(2, 1fr); } .cd-two { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .cd-grid { grid-template-columns: 1fr; } .cd-three { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ minHeight: '100vh', background: T.panel, fontFamily: "'Inter',sans-serif", color: T.ink }}>
        <main style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── Breadcrumb + Header ─────────────────────────────── */}
          <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
              <button onClick={() => router.push('/disaster')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <ArrowLeft size={12} /> Disaster Operations
              </button>
              <span style={{ opacity: 0.4 }}>/</span>
              <button onClick={() => router.push('/disaster')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 11 }}>Camps</button>
              <span style={{ opacity: 0.4 }}>/</span>
              <span style={{ color: T.ink, fontWeight: 600 }}>{camp.name}</span>
            </div>

            {/* header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.15 }}>{camp.name}</h1>
                  <StatusBadge status={camp.status} T={T} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.muted }}>
                  <span style={{ fontWeight: 700, color: T.teal }}>{camp.code}</span>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span>{camp.type}</span>
                  {detail?.station && (<><span style={{ opacity: 0.3 }}>·</span><span>{detail.station} station</span></>)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={refreshCamp}
                  disabled={refreshing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.card, color: T.ink,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: refreshing ? 0.5 : 1,
                  }}
                >
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
                <button
                  onClick={() => router.push('/disaster')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.card, color: T.ink,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={12} /> Overview
                </button>
              </div>
            </div>
          </div>

          {/* ── Large Interactive Map ────────────────────────────── */}
          <div style={{ padding: '12px 24px' }}>
            <div style={{
              position: 'relative', borderRadius: 16, overflow: 'hidden',
              border: `1px solid ${T.border}`,
              height: 'clamp(400px, 50vh, 600px)',
              background: dark ? '#030c18' : '#ddeaf5',
            }}>
              <Map
                center={[camp.lng, camp.lat]}
                zoom={12}
                className="absolute inset-0"
                theme={dark ? 'dark' : 'light'}
              >
                <MapControls showZoom showLocate showCompass />
                <MapViewController viewMode={viewMode} />
                <CampDetailTerrain viewMode={viewMode} />
                <CampMapView camp={camp} dark={dark} viewMode={viewMode} />
              </Map>

              {/* View mode toggle */}
              <div className="absolute z-[13] top-3 right-3 flex items-center rounded-full overflow-hidden" style={{ background: dark ? 'rgba(13,13,16,0.85)' : 'rgba(255,255,255,0.85)', border: `1px solid ${T.border}`, backdropFilter: 'blur(10px)' }}>
                {VIEW_MODES.map((m) => {
                  const active = viewMode === m
                  const icon = m === '2d' ? <Layers size={10} /> : m === '3d' ? <Box size={10} /> : m === 'terrain' ? <Mountain size={10} /> : <Triangle size={10} />
                  return (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      title={m.toUpperCase()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '5px 10px', fontSize: '0.55rem', fontWeight: 800,
                        letterSpacing: '0.06em', cursor: 'pointer', border: 'none',
                        background: active ? (dark ? 'rgba(34,211,238,0.2)' : 'rgba(8,145,178,0.18)') : 'transparent',
                        color: active ? (dark ? '#22d3ee' : '#0891b2') : T.muted,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {icon} {m.toUpperCase()}
                    </button>
                  )
                })}
              </div>

              {/* Camp label overlay */}
              <div className="absolute z-[13] bottom-3 left-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: dark ? 'rgba(13,13,16,0.85)' : 'rgba(255,255,255,0.85)', border: `1px solid ${T.border}`, backdropFilter: 'blur(10px)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[camp.status], boxShadow: `0 0 10px ${STATUS_COLOR[camp.status]}88` }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>{camp.code}</div>
                  <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{STATUS_META[camp.status]?.label}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Content grid ─────────────────────────────────────── */}
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Key Stats ── */}
            <div className="cd-grid">
              <StatCard label="Displaced" value={camp.displaced.toLocaleString()} icon={Users} color="#F97316" T={T} sub={`${occupancy}% occupancy`} />
              <StatCard label="Capacity" value={camp.capacity.toLocaleString()} icon={MapPin} color={T.ink} T={T} sub="Maximum" />
              <StatCard label="Aid Coverage" value={`${camp.aid}%`} icon={HeartHandshake} color={T.green} T={T} sub="Active aid" />
              <StatCard label="Workers" value={String(camp.workers)} icon={Shield} color={T.purple} T={T} sub="Deployed" />
            </div>

            {/* ── Two-column: Prediction + Location ── */}
            <div className="cd-two">
              {/* Prediction + Risk */}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, padding: 16 }}>
                <SectionHeading label="Flood Prediction" T={T} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <RiskBar label="Flood Risk" level={prediction?.flood_possibility?.toLowerCase() || camp.status} color={STATUS_COLOR[prediction?.flood_possibility?.toLowerCase() || camp.status] || T.amber} T={T} />
                  <RiskBar label="Camp Status" level={camp.status} color={STATUS_COLOR[camp.status]} T={T} />
                  {detail?.rain > 20 && <RiskBar label="Rainfall Alert" level="high" color={T.red} T={T} />}
                </div>
                {predResult && (
                  <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: T.cardSoft, border: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Flood Probability</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: predResult.probability >= 0.7 ? T.red : predResult.probability >= 0.4 ? T.amber : T.green }}>
                        {Math.round(predResult.probability * 100)}%
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: T.border, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(predResult.probability * 100)}%`, height: '100%', background: predResult.probability >= 0.7 ? T.red : predResult.probability >= 0.4 ? T.amber : T.green, borderRadius: 999 }} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 10, color: T.muted }}>Source: {predResult.source}</div>
                  </div>
                )}
                {predLoading && (
                  <div style={{ marginTop: 10, fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={11} className="animate-spin" /> Running flood model…
                  </div>
                )}
              </div>

              {/* Location info */}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, padding: 16 }}>
                <SectionHeading label="Location" T={T} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <DataRow label="Latitude" value={`${camp.lat.toFixed(4)}°`} tone={T.teal} />
                  <DataRow label="Longitude" value={`${camp.lng.toFixed(4)}°`} tone={T.teal} />
                  {detail?.elev != null && <DataRow label="Elevation" value={`${detail.elev} m AMSL`} tone={T.ink} />}
                  {detail?.river && <DataRow label="Water body" value={detail.river} tone={T.ink} />}
                  {detail?.upDist != null && <DataRow label="Upstream dist." value={`${detail.upDist} m`} tone={T.ink} />}
                </div>
              </div>
            </div>

            {/* ── Environmental ── */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, padding: 16 }}>
              <SectionHeading label="Environment" T={T} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {detail?.wl != null && (
                  <InfoCard label="Water Level" value={`${detail.wl} m`} color={waterTone} T={T} />
                )}
                {detail?.rain != null && (
                  <InfoCard label="Rainfall" value={`${detail.rain} mm`} color={detail.rain > 20 ? T.red : detail.rain > 5 ? T.amber : T.teal} T={T} />
                )}
                {detail?.hum != null && (
                  <InfoCard label="Humidity" value={`${detail.hum}%`} color={T.teal} T={T} />
                )}
                {detail?.pres != null && (
                  <InfoCard label="Pressure" value={`${detail.pres} hPa`} color={T.ink} T={T} />
                )}
                {detail?.minT != null && detail?.maxT != null && (
                  <InfoCard label="Temperature" value={`${detail.minT}–${detail.maxT}°C`} color={T.coral} T={T} />
                )}
                {detail?.soil != null && (
                  <InfoCard label="Soil Moisture" value={`${Math.round(detail.soil * 100)}%`} color={T.teal} T={T} />
                )}
              </div>
            </div>

            {/* ── Operational ── */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, padding: 16 }}>
              <SectionHeading label="Operational" T={T} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {detail?.precip != null && (
                  <InfoCard label="Precip (24h)" value={`${detail.precip.toFixed(1)} mm`} color={detail.precip > 15 ? T.red : T.amber} T={T} />
                )}
                {detail?.maxWind != null && (
                  <InfoCard label="Max Wind" value={`${detail.maxWind} km/h`} color={T.ink} T={T} />
                )}
                {detail?.cloud != null && (
                  <InfoCard label="Cloud Cover" value={`${detail.cloud}%`} color={T.inkSoft} T={T} />
                )}
                {detail?.maxHrPrec != null && (
                  <InfoCard label="Peak Hourly" value={`${detail.maxHrPrec} mm/hr`} color={T.amber} T={T} />
                )}
              </div>
            </div>

            {/* ── Alerts + Hydrology ── */}
            <div className="cd-two">
              {/* Active alerts */}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, padding: 16 }}>
                <SectionHeading label="Active Alerts" T={T} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail?.wl > detail?.alertL && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: `${T.red}10`, border: `1px solid ${T.red}33` }}>
                      <AlertTriangle size={14} style={{ color: T.red, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Water level above alert threshold</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Current: {detail.wl} m · Alert: {detail.alertL} m</div>
                      </div>
                    </div>
                  )}
                  {detail?.rain > 20 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: `${T.amber}10`, border: `1px solid ${T.amber}33` }}>
                      <CloudRain size={14} style={{ color: T.amber, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.amber }}>Heavy rainfall detected</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{detail.rain} mm accumulated</div>
                      </div>
                    </div>
                  )}
                  {camp.status === 'critical' && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: `${T.red}10`, border: `1px solid ${T.red}33` }}>
                      <Shield size={14} style={{ color: T.red, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Critical status active</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Camp requires immediate attention</div>
                      </div>
                    </div>
                  )}
                  {!(detail?.wl > detail?.alertL) && !(detail?.rain > 20) && camp.status !== 'critical' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', borderRadius: 10, background: `${T.green}10`, border: `1px solid ${T.green}33`, color: T.green, fontSize: 12, fontWeight: 600 }}>
                      <Activity size={14} /> No active alerts
                    </div>
                  )}
                </div>
              </div>

              {/* Hydrology details */}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, padding: 16 }}>
                <SectionHeading label="Hydrology" T={T} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {detail?.station && <DataRow label="Station" value={detail.station} />}
                  {detail?.river && <DataRow label="River" value={detail.river} />}
                  {detail?.alertL != null && <DataRow label="Alert level" value={`${detail.alertL} m`} tone={T.amber} />}
                  {detail?.minorL != null && <DataRow label="Minor flood" value={`${detail.minorL} m`} />}
                  {detail?.majorL != null && <DataRow label="Major flood" value={`${detail.majorL} m`} tone={T.red} />}
                  {detail?.gauLat != null && <DataRow label="Gauge coords" value={`${detail.gauLat.toFixed(4)}°, ${detail.gauLng.toFixed(4)}°`} />}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingTop: 8, paddingBottom: 24 }}>
              <Button onClick={() => router.push('/disaster')} icon={<ArrowLeft size={15} />}>Back to Overview</Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
