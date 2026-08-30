'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, AlertTriangle, Activity, RefreshCw, Filter, Waves, MapPin } from 'lucide-react'
import * as MapLibreGL from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import DashboardCard from '@/components/dashboard/DashboardCard'
import DataTable from '@/components/common/DataTable/DataTable'
import Button from '@/components/common/Button'
import { useTheme } from '@/components/common/ThemeProvider'
import {
  MOCK_RESOURCES, MOCK_TIMELINE, MOCK_PREDICTIONS, MOCK_RESOURCE_LOCATIONS,
  MOCK_CATEGORIES, computeMockSummary,
} from '@/data/resources.data'

const API = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || 'http://localhost:3002'

const CATEGORY_COLORS = {
  food: '#16A34A',
  water: '#2563EB',
  medical: '#8B5CF6',
  hygiene: '#D97706',
  shelter: '#DC2626',
  other: '#64748B',
}

const STATUS_COLORS = {
  AVAILABLE: '#16A34A',
  LOW: '#D97706',
  CRITICAL: '#DC2626',
  UNAVAILABLE: '#64748B',
}

const RESOURCE_STATUS_COLOR = {
  critical: '#DC2626',
  high: '#D97706',
  medium: '#D97706',
  stable: '#16A34A',
  recovery: '#16A34A',
}

const COLOMBO_HUB = { name: 'Disaster Management Center', lat: 6.905756541552449, lng: 79.87149345240267 }

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, subtitle }) {
  const { T } = useTheme()
  return (
    <div style={{
      padding: '1rem 1.25rem', borderRadius: '1rem',
      background: `linear-gradient(135deg, ${color}08, ${color}02)`,
      border: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <Icon size={14} color={color} />
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>{subtitle}</div>}
    </div>
  )
}

// ── Usage Timeline Chart ───────────────────────────────────────────────────

function UsageTimelineChart({ data, theme: T }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.muted, fontSize: 12, fontWeight: 600 }}>
        No usage data available
      </div>
    )
  }

  const grouped = useMemo(() => {
    const byDate = {}
    data.forEach((row) => {
      const date = row.date?.slice(0, 10) || 'Unknown'
      if (!byDate[date]) byDate[date] = { date }
      byDate[date][row.category] = parseFloat(row.total_used) || 0
    })
    return Object.values(byDate).slice(-14)
  }, [data])

  const categories = useMemo(() => {
    const cats = new Set(data.map((r) => r.category).filter(Boolean))
    return Array.from(cats)
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={grouped} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }} tickFormatter={(v) => v?.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: T.muted }} />
        <Tooltip
          contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: T.ink }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {categories.map((cat) => (
          <Bar key={cat} dataKey={cat} fill={CATEGORY_COLORS[cat?.toLowerCase()] || '#64748B'} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Prediction Card ────────────────────────────────────────────────────────

function PredictionCard({ pred, T }) {
  const prob = pred.flood_probability != null ? Math.round(Number(pred.flood_probability) * 100) : 0
  const cat = pred.flood_category || 'Unknown'
  const catColor = cat === 'HIGH' ? T.red : cat === 'MEDIUM' ? T.amber : cat === 'LOW' ? T.green : T.muted

  return (
    <div style={{
      padding: '0.85rem 1rem', borderRadius: '0.85rem',
      background: T.card, border: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: `${catColor}14`, border: `1px solid ${catColor}44`, color: catColor,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {cat}
        </span>
        <span style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>
          {pred.forecast_hours != null ? `${pred.forecast_hours}h forecast` : '—'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: catColor, fontFamily: "'Inter',sans-serif" }}>
          {prob}%
        </span>
        <span style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>probability</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {pred.rainfall != null && (
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: T.inkSoft, background: T.cardSoft || T.panelSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '2px 8px' }}>
            Rain: {Math.round(Number(pred.rainfall))}mm
          </span>
        )}
        {pred.elevation != null && (
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: T.inkSoft, background: T.cardSoft || T.panelSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '2px 8px' }}>
            Elev: {Math.round(Number(pred.elevation))}m
          </span>
        )}
        {pred.river_distance != null && (
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: T.inkSoft, background: T.cardSoft || T.panelSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '2px 8px' }}>
            River: {Number(pred.river_distance).toFixed(1)}km
          </span>
        )}
      </div>
      {pred.predicted_at && (
        <div style={{ fontSize: '0.62rem', color: T.muted, fontWeight: 600 }}>
          {new Date(pred.predicted_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ── Resource Map (inline, reuses MapLibreGL) ───────────────────────────────

function ResourceMap({ locations, T, dark }) {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const styleUrl = dark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

    const map = new MapLibreGL.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [80.5, 7.5],
      zoom: 6.5,
      pitch: 0,
      attributionControl: false,
    })

    map.addControl(new MapLibreGL.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      // Add arc lines to Colombo hub
      if (locations.length > 0) {
        const features = locations.map((loc) => ({
          type: 'Feature',
          properties: { id: loc.id, name: loc.name, status: loc.status },
          geometry: {
            type: 'LineString',
            coordinates: [
              [loc.lng, loc.lat],
              [COLOMBO_HUB.lng, COLOMBO_HUB.lat],
            ],
          },
        }))

        map.addSource('resource-arcs', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        })

        map.addLayer({
          id: 'resource-arcs-layer',
          type: 'line',
          source: 'resource-arcs',
          paint: {
            'line-color': dark ? 'rgba(34,197,94,0.45)' : 'rgba(22,163,74,0.4)',
            'line-width': 1.5,
            'line-opacity': 0.7,
          },
        })
      }

      // Add camp markers
      locations.forEach((loc) => {
        const color = RESOURCE_STATUS_COLOR[loc.status] || '#64748B'
        const el = document.createElement('div')
        el.style.cssText = `
          width:12px; height:12px; border-radius:50%;
          background:${color}; border:2px solid rgba(255,255,255,0.6);
          box-shadow: 0 0 8px ${color}66; cursor:pointer; transition: all 0.2s ease;
        `
        el.title = `${loc.name} (${loc.code})`

        const popup = new MapLibreGL.Popup({ offset: 16, closeButton: false, maxWidth: '260px' })
          .setLngLat([loc.lng, loc.lat])
          .setHTML(`
            <div style="font-family:'Inter',sans-serif;padding:2px 0;min-width:180px">
              <div style="font-size:0.78rem;font-weight:800;color:#0f2336;margin-bottom:4px;display:flex;align-items:center;gap:6px">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};flex-shrink:0"></span>
                ${loc.name}
              </div>
              <div style="font-size:0.65rem;color:#64748b;line-height:1.6">
                <div style="display:flex;justify-content:space-between"><span>Type</span><span style="font-weight:700;color:#0f2336">${loc.type}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Displaced</span><span style="font-weight:700;color:#0f2336">${loc.displaced?.toLocaleString()}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Capacity</span><span style="font-weight:700;color:#0f2336">${loc.capacity?.toLocaleString()}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Status</span><span style="font-weight:700;color:${color}">${loc.status?.toUpperCase()}</span></div>
              </div>
            </div>
          `)

        el.addEventListener('mouseenter', () => popup.addTo(map))
        el.addEventListener('mouseleave', () => popup.remove())

        new MapLibreGL.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .addTo(map)
      })

      // Add Colombo hub marker
      const hubEl = document.createElement('div')
      hubEl.style.cssText = `
        width:20px; height:20px; border-radius:50%;
        background: radial-gradient(circle, #16A34A 30%, rgba(22,163,74,0.3) 70%, transparent 100%);
        border:3px solid #fff; box-shadow: 0 0 20px rgba(22,163,74,0.6);
        cursor:default;
      `
      new MapLibreGL.Marker({ element: hubEl })
        .setLngLat([COLOMBO_HUB.lng, COLOMBO_HUB.lat])
        .setPopup(new MapLibreGL.Popup({ offset: 16, closeButton: false }).setHTML(`
          <div style="font-family:'Inter',sans-serif;text-align:center">
            <div style="font-size:0.75rem;font-weight:800;color:#16A34A">Colombo Hub</div>
            <div style="font-size:0.6rem;color:#64748b;font-weight:600">Central Operations Center</div>
          </div>
        `))
        .addTo(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [locations, dark, T])

  return (
    <div style={{
      position: 'relative', borderRadius: '1.25rem', overflow: 'hidden',
      border: `1px solid ${T.border}`, minHeight: 320,
      background: dark ? '#0F172A' : '#F0F4F8',
    }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
      {/* Legend overlay */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: dark ? 'rgba(4,10,17,0.78)' : 'rgba(255,255,255,0.88)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(60,110,150,0.18)'}`,
        borderRadius: 10, padding: '6px 10px', backdropFilter: 'blur(8px)',
      }}>
        {['critical', 'high', 'medium', 'stable', 'recovery'].map((s) => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: RESOURCE_STATUS_COLOR[s] }} />
            <span style={{ color: dark ? '#f0f7ff' : '#0f2336', textTransform: 'capitalize' }}>{s}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', border: '1.5px solid #fff' }} />
          <span style={{ color: dark ? '#f0f7ff' : '#0f2336' }}>Hub</span>
        </span>
      </div>
    </div>
  )
}

// ── Table Columns ──────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'resource_name', label: 'Resource', sortable: true, render: (v) => (
    <span style={{ fontWeight: 700, color: '#16A34A' }}>{v || '—'}</span>
  )},
  { key: 'category', label: 'Category', sortable: true, render: (v) => {
    const color = CATEGORY_COLORS[v?.toLowerCase()] || '#64748B'
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        background: `${color}14`, border: `1px solid ${color}44`, color,
      }}>
        {v}
      </span>
    )
  }},
  { key: 'unit', label: 'Unit', sortable: true },
  { key: 'total_quantity', label: 'Total', sortable: true, numeric: true, render: (v) => (
    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{parseFloat(v)?.toLocaleString()}</span>
  )},
  { key: 'available_quantity', label: 'Available', sortable: true, numeric: true, render: (v, row) => {
    const available = parseFloat(v) || 0
    const total = parseFloat(row.total_quantity) || 1
    const pct = Math.round((available / total) * 100)
    const color = pct <= 10 ? '#DC2626' : pct <= 30 ? '#D97706' : '#16A34A'
    return (
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>
        {available.toLocaleString()}
        <span style={{ fontSize: '0.6rem', color: '#64748B', marginLeft: 4 }}>({pct}%)</span>
      </span>
    )
  }},
  { key: 'minimum_threshold', label: 'Min', sortable: true, numeric: true, render: (v) => (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{parseFloat(v)?.toLocaleString()}</span>
  )},
  { key: 'status', label: 'Status', sortable: true, render: (v) => {
    const color = STATUS_COLORS[v] || '#64748B'
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        background: `${color}14`, border: `1px solid ${color}44`, color,
      }}>
        {v}
      </span>
    )
  }},
]

// ── Main Component ─────────────────────────────────────────────────────────

export default function ResourcePanel() {
  const { mode, T } = useTheme()
  const dark = mode === 'dark'

  // Data source toggle
  const [useMockData, setUseMockData] = useState(false)
  const isFirstRender = useRef(true)

  // Live data state
  const [resources, setResources] = useState([])
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [predictions, setPredictions] = useState([])
  const [categories, setCategories] = useState([])

  // UI state
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Reset state when toggling modes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setResources([])
    setSummary(null)
    setTimeline([])
    setPredictions([])
    setCategories([])
    setLoading(true)
    setError('')
  }, [useMockData])

  // Fetch live data
  const fetchLiveData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      if (selectedStatus) params.set('status', selectedStatus)
      params.set('page', '0')
      params.set('limit', '100')

      const [invRes, sumRes, timeRes, predRes, catRes] = await Promise.all([
        fetch(`${API}/api/resources/inventory?${params}`),
        fetch(`${API}/api/resources/resource-summary`),
        fetch(`${API}/api/resources/usage-timeline?days=30`),
        fetch(`${API}/api/resources/predictions?limit=10`),
        fetch(`${API}/api/resources/categories`),
      ])

      if (!invRes.ok) throw new Error('Failed to load resources')

      const invData = await invRes.json()
      const sumData = await sumRes.json()
      const timeData = await timeRes.json()
      const predData = await predRes.json()
      const catData = catRes.ok ? await catRes.json() : []

      setResources(invData.data || [])
      setSummary(sumData)
      setTimeline(timeData)
      setPredictions(predData)
      setCategories(catData)
    } catch (err) {
      setError(err.message || 'Failed to load data')
      setResources([])
      setSummary(null)
      setTimeline([])
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedStatus])

  // Load mock data
  const loadMockData = useCallback(() => {
    setLoading(true)
    setError('')
    // Simulate brief loading for UX consistency
    setTimeout(() => {
      setResources(MOCK_RESOURCES)
      setSummary(computeMockSummary())
      setTimeline(MOCK_TIMELINE)
      setPredictions(MOCK_PREDICTIONS)
      setCategories(MOCK_CATEGORIES)
      setLoading(false)
    }, 300)
  }, [])

  // Initial load
  useEffect(() => {
    if (useMockData) {
      loadMockData()
    } else {
      fetchLiveData()
    }
  }, [useMockData, fetchLiveData, loadMockData])

  // Filtered resources (client-side for both modes)
  const filteredResources = useMemo(() => {
    let result = resources
    if (selectedCategory) result = result.filter((r) => r.category === selectedCategory)
    if (selectedStatus) result = result.filter((r) => r.status === selectedStatus)
    return result
  }, [resources, selectedCategory, selectedStatus])

  // Derived metrics
  const utilizationPct = useMemo(() => {
    if (!summary) return 0
    const total = parseFloat(summary.total_quantity) || 1
    const available = parseFloat(summary.available_quantity) || 0
    return Math.round(((total - available) / total) * 100)
  }, [summary])

  const statusBreakdown = useMemo(() => {
    if (!summary) return []
    return [
      { label: 'Available', count: summary.available_count, color: STATUS_COLORS.AVAILABLE },
      { label: 'Low', count: summary.low_count, color: STATUS_COLORS.LOW },
      { label: 'Critical', count: summary.critical_count, color: STATUS_COLORS.CRITICAL },
      { label: 'Unavailable', count: summary.unavailable_count, color: STATUS_COLORS.UNAVAILABLE },
    ].filter((s) => Number(s.count) > 0)
  }, [summary])

  // Map locations
  const mapLocations = useMemo(() => {
    if (useMockData) return MOCK_RESOURCE_LOCATIONS
    // In live mode, derive locations from camp data if available
    // For now, use mock locations as placeholder until camp API is wired
    return MOCK_RESOURCE_LOCATIONS
  }, [useMockData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Filter Bar + Toggle ──────────────────────────────────── */}
      <div style={{
        padding: '1rem 1.25rem', borderRadius: '1.25rem',
        background: T.card, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color={T.muted} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filters</span>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          suppressHydrationWarning
          style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.panelSoft || T.card, color: T.ink, fontSize: '0.78rem',
            fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: 'pointer', minWidth: 140,
          }}
        >
          <option value="">All Categories</option>
          {(useMockData ? MOCK_CATEGORIES : categories).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          suppressHydrationWarning
          style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.panelSoft || T.card, color: T.ink, fontSize: '0.78rem',
            fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: 'pointer', minWidth: 140,
          }}
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button variant="outline" circleIcon={false} onClick={useMockData ? loadMockData : fetchLiveData} icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}>
            Refresh
          </Button>

          {/* ── Mock / Live toggle ──────────────────────────────── */}
          <label
            suppressHydrationWarning
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
              background: useMockData ? 'rgba(245,158,11,0.12)' : `${T.green}12`,
              border: `1px solid ${useMockData ? 'rgba(245,158,11,0.45)' : `${T.green}44`}`,
              color: useMockData ? '#D97706' : T.green,
              transition: 'all 0.2s ease',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              style={{ display: 'none' }}
            />
            <span style={{
              width: 32, height: 18, borderRadius: 9, position: 'relative',
              background: useMockData ? '#D97706' : T.green,
              transition: 'background 0.2s ease',
            }}>
              <span style={{
                position: 'absolute', top: 2,
                left: useMockData ? 16 : 2,
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </span>
            {useMockData ? 'Mock' : 'Live'}
          </label>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────── */}
      {error && !useMockData && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.85rem',
          background: `${T.red}10`, border: `1px solid ${T.red}33`,
          color: T.red, fontSize: '0.78rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <Button variant="danger" circleIcon={false} onClick={() => { setUseMockData(true); setError('') }} style={{ fontSize: '0.68rem', padding: '4px 12px', whiteSpace: 'nowrap' }}>
            Use Mock Data
          </Button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!loading && !error && !useMockData && resources.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: '1.25rem',
          padding: '2rem 1.5rem', textAlign: 'center',
        }}>
          <Package size={40} color={T.muted} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink, marginBottom: 4 }}>No resource data in Cloud DB</div>
          <div style={{ fontSize: '0.75rem', color: T.muted, marginBottom: 12, maxWidth: 400, margin: '0 auto 12px' }}>
            The resources table is empty. Seed the database with resource records or enable mock data to preview the dashboard.
          </div>
          <Button variant="teal" circleIcon={false} onClick={() => setUseMockData(true)} style={{ fontSize: '0.78rem', padding: '8px 20px' }}>
            Load Mock Data
          </Button>
        </div>
      )}

      {/* ── Summary Cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <StatCard label="Total Resources" value={summary?.total_resources ?? (loading ? '—' : '0')} icon={Package} color="#16A34A" subtitle="unique resource types" />
        <StatCard label="Available Qty" value={summary?.available_quantity != null ? parseFloat(summary.available_quantity).toLocaleString() : (loading ? '—' : '0')} icon={Activity} color="#2563EB" subtitle={`of ${summary?.total_quantity != null ? parseFloat(summary.total_quantity).toLocaleString() : '—'} total`} />
        <StatCard label="Low Stock" value={summary?.below_threshold ?? (loading ? '—' : '0')} icon={AlertTriangle} color="#D97706" subtitle="below minimum threshold" />
        <StatCard label="Utilization" value={`${utilizationPct}%`} icon={Activity} color={utilizationPct > 80 ? '#16A34A' : utilizationPct > 50 ? '#D97706' : '#DC2626'} subtitle="stock consumed" />
      </div>

      {/* ── Status Breakdown ─────────────────────────────────────── */}
      {statusBreakdown.length > 0 && (
        <div style={{
          padding: '0.85rem 1.25rem', borderRadius: '1.25rem',
          background: T.card, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span>
          {statusBreakdown.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink }}>{s.label}</span>
              <span style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>({Number(s.count)})</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Map ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.teal, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        <MapPin size={14} /> Resource Distribution Map
      </div>
      {loading ? (
        <div style={{
          height: 320, borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.card, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12,
        }}>
          <RefreshCw size={14} className="animate-spin" style={{ marginRight: 8 }} /> Loading map…
        </div>
      ) : (
        <ResourceMap locations={mapLocations} T={T} dark={dark} />
      )}

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <DashboardCard
          title="Resource Usage Timeline"
          subtitle={`Daily consumption · ${selectedCategory || 'All categories'} · last 30 days`}
          style={{ flex: '1 1 400px' }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.muted, fontSize: 12 }}>
              <RefreshCw size={14} className="animate-spin" style={{ marginRight: 8 }} /> Loading chart data…
            </div>
          ) : (
            <UsageTimelineChart data={timeline} theme={T} />
          )}
        </DashboardCard>

        <DashboardCard
          title="Flood Predictions"
          subtitle={useMockData ? 'Simulated forecasts for demonstration' : 'Active forecasts from IoT sensors'}
          right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Waves size={14} color={T.blue} />
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: T.blue }}>{predictions.length} active</span>
            </span>
          }
          style={{ flex: '1 1 320px' }}
          bodyStyle={{ gap: '0.6rem' }}
        >
          {predictions.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: T.muted, textAlign: 'center', padding: '1rem 0', fontWeight: 600 }}>
              No active flood predictions
            </div>
          ) : (
            predictions.map((pred) => <PredictionCard key={pred.id} pred={pred} T={T} />)
          )}
        </DashboardCard>
      </div>

      {/* ── Resource Inventory Table ─────────────────────────────── */}
      <DataTable
        columns={COLUMNS}
        data={filteredResources}
        title="Resource Inventory"
        subtitle={`${filteredResources.length} resources · ${useMockData ? 'Mock data' : 'Live data'} · ${selectedCategory || 'All categories'}${selectedStatus ? ` · ${selectedStatus}` : ''}`}
        searchKeys={['resource_name', 'category']}
        searchPlaceholder="Search by name or category…"
        loading={loading}
        emptyMessage={resources.length === 0 ? (useMockData ? 'No mock resources' : 'No resources found in the database') : 'No resources match your filters'}
        rowKey="id"
      />
    </div>
  )
}
