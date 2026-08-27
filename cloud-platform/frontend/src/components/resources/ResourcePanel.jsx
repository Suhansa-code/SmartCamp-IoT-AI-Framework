'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, AlertTriangle, Activity, RefreshCw, Filter, Waves } from 'lucide-react'
import DashboardCard from '@/components/dashboard/DashboardCard'
import DataTable from '@/components/common/DataTable/DataTable'
import Button from '@/components/common/Button'
import { useTheme } from '@/components/common/ThemeProvider'

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

export default function ResourcePanel() {
  const { T } = useTheme()
  const [resources, setResources] = useState([])
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [predictions, setPredictions] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      if (selectedStatus) params.set('status', selectedStatus)
      params.set('page', '0')
      params.set('limit', '100')

      const [invRes, sumRes, timeRes, predRes] = await Promise.all([
        fetch(`${API}/api/resources/inventory?${params}`),
        fetch(`${API}/api/resources/resource-summary`),
        fetch(`${API}/api/resources/usage-timeline?days=30`),
        fetch(`${API}/api/resources/predictions?limit=10`),
      ])

      if (!invRes.ok) throw new Error('Failed to load resources')

      const invData = await invRes.json()
      const sumData = await sumRes.json()
      const timeData = await timeRes.json()
      const predData = await predRes.json()

      setResources(invData.data || [])
      setSummary(sumData)
      setTimeline(timeData)
      setPredictions(predData)
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

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${API}/api/resources/categories`)
        if (res.ok) setCategories(await res.json())
      } catch { /* ignore */ }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredResources = useMemo(() => {
    let result = resources
    if (selectedCategory) result = result.filter((r) => r.category === selectedCategory)
    if (selectedStatus) result = result.filter((r) => r.status === selectedStatus)
    return result
  }, [resources, selectedCategory, selectedStatus])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filter Bar */}
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
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
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

        <div style={{ marginLeft: 'auto' }}>
          <Button variant="outline" circleIcon={false} onClick={fetchData} icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.85rem',
          background: `${T.red}10`, border: `1px solid ${T.red}33`,
          color: T.red, fontSize: '0.78rem', fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <StatCard label="Total Resources" value={summary?.total_resources ?? (loading ? '—' : '0')} icon={Package} color="#16A34A" subtitle="unique resource types" />
        <StatCard label="Available Qty" value={summary?.available_quantity != null ? parseFloat(summary.available_quantity).toLocaleString() : (loading ? '—' : '0')} icon={Activity} color="#2563EB" subtitle={`of ${summary?.total_quantity != null ? parseFloat(summary.total_quantity).toLocaleString() : '—'} total`} />
        <StatCard label="Low Stock" value={summary?.below_threshold ?? (loading ? '—' : '0')} icon={AlertTriangle} color="#D97706" subtitle="below minimum threshold" />
        <StatCard label="Utilization" value={`${utilizationPct}%`} icon={Activity} color={utilizationPct > 80 ? '#16A34A' : utilizationPct > 50 ? '#D97706' : '#DC2626'} subtitle="stock consumed" />
      </div>

      {/* Status Breakdown */}
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

      {/* Usage Timeline + Flood Predictions */}
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
          subtitle="Active forecasts from IoT sensors"
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

      {/* Resource Inventory Table */}
      <DataTable
        columns={COLUMNS}
        data={filteredResources}
        title="Resource Inventory"
        subtitle={`${filteredResources.length} resources · ${selectedCategory || 'All categories'}${selectedStatus ? ` · ${selectedStatus}` : ''}`}
        searchKeys={['resource_name', 'category']}
        searchPlaceholder="Search by name or category…"
        loading={loading}
        emptyMessage={resources.length === 0 ? 'No resources found in the database' : 'No resources match your filters'}
        rowKey="id"
      />
    </div>
  )
}
