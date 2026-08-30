'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Users, Activity, RefreshCw, Filter, Search } from 'lucide-react'
import DashboardCard from '@/components/dashboard/DashboardCard'
import DataTable from '@/components/common/DataTable/DataTable'
import Button from '@/components/common/Button'
import { useTheme } from '@/components/common/ThemeProvider'

const API = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || 'http://localhost:3002'

const RESOURCE_COLORS = {
  breakfast: '#16A34A',
  lunch: '#D97706',
  dinner: '#DC2626',
  water: '#2563EB',
  food: '#16A34A',
  medical: '#8B5CF6',
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

function DistributionTimelineChart({ data, theme: T }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.muted, fontSize: 12, fontWeight: 600 }}>
        No timeline data available
      </div>
    )
  }

  const grouped = useMemo(() => {
    const byDate = {}
    data.forEach((row) => {
      const date = row.date?.slice(0, 10) || 'Unknown'
      if (!byDate[date]) byDate[date] = { date }
      byDate[date][row.resource_type] = parseFloat(row.total_quantity) || 0
    })
    return Object.values(byDate).slice(-14)
  }, [data])

  const resourceTypes = useMemo(() => {
    const types = new Set(data.map((r) => r.resource_type).filter(Boolean))
    return Array.from(types)
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
        {resourceTypes.map((type) => (
          <Bar key={type} dataKey={type} fill={RESOURCE_COLORS[type] || '#64748B'} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

const COLUMNS = [
  { key: 'id', label: 'ID', sortable: true, numeric: true },
  { key: 'resource_type', label: 'Resource', sortable: true, render: (v) => {
    const color = RESOURCE_COLORS[v?.toLowerCase()] || '#64748B'
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
  { key: 'quantity', label: 'Quantity', sortable: true, numeric: true, render: (v) => (
    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{parseFloat(v)?.toLocaleString()}</span>
  )},
  { key: 'wristband_barcode', label: 'Wristband', sortable: true, render: (v) => (
    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#64748B' }}>{v || '—'}</span>
  )},
  { key: 'distributed_at', label: 'Date/Time', sortable: true, render: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    return (
      <div style={{ fontSize: '0.72rem' }}>
        <div style={{ fontWeight: 600 }}>{d.toLocaleDateString()}</div>
        <div style={{ color: '#64748B', fontSize: '0.65rem' }}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    )
  }},
  { key: 'device_id', label: 'Device', sortable: true, render: (v) => (
    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{v || '—'}</span>
  )},
  { key: 'camp_id', label: 'Camp', sortable: true, render: (v) => (
    <span style={{ fontWeight: 600, color: '#16A34A' }}>{v || '—'}</span>
  )},
]

export default function DistributionPanel() {
  const { T } = useTheme()
  const [distributions, setDistributions] = useState([])
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [camps, setCamps] = useState([])
  const [resourceTypes, setResourceTypes] = useState([])
  const [selectedCamp, setSelectedCamp] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [page, setPage] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)

  const fetchData = useCallback(async (campId) => {
    setLoading(true)
    setError('')
    try {
      const campParam = campId ? `?campId=${campId}` : ''
      const [distRes, summaryRes, timelineRes] = await Promise.all([
        fetch(`${API}/api/resources/distributions${campParam}&page=0&limit=100`),
        fetch(`${API}/api/resources/distributions/summary${campParam}`),
        fetch(`${API}/api/resources/distributions/timeline${campParam}&days=30`),
      ])

      if (!distRes.ok) throw new Error('Failed to load distributions')

      const distData = await distRes.json()
      const summaryData = await summaryRes.json()
      const timelineData = await timelineRes.json()

      setDistributions(distData.data || [])
      setTotalRecords(distData.total || 0)
      setSummary(summaryData)
      setTimeline(timelineData)
    } catch (err) {
      setError(err.message || 'Failed to load data')
      setDistributions([])
      setSummary(null)
      setTimeline([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function loadInitial() {
      try {
        const [campsRes, typesRes] = await Promise.all([
          fetch(`${API}/api/resources/distributions/camps`),
          fetch(`${API}/api/resources/distributions/resource-types`),
        ])
        if (campsRes.ok) setCamps(await campsRes.json())
        if (typesRes.ok) setResourceTypes(await typesRes.json())
      } catch { /* ignore */ }
    }
    loadInitial()
    fetchData('')
  }, [fetchData])

  useEffect(() => {
    fetchData(selectedCamp)
  }, [selectedCamp, fetchData])

  const filteredDistributions = useMemo(() => {
    if (!resourceFilter) return distributions
    return distributions.filter((d) => d.resource_type === resourceFilter)
  }, [distributions, resourceFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Camp Selector */}
      <div style={{
        padding: '1rem 1.25rem', borderRadius: '1.25rem',
        background: T.card, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color={T.muted} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Camp</span>
        </div>
        <select
          value={selectedCamp}
          onChange={(e) => setSelectedCamp(e.target.value)}
          suppressHydrationWarning
          style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.panelSoft || T.card, color: T.ink, fontSize: '0.78rem',
            fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: 'pointer', minWidth: 160,
          }}
        >
          <option value="">All Camps</option>
          {camps.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {resourceTypes.length > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted }}>Resource:</span>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                suppressHydrationWarning
                style={{
                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${T.border}`,
                  background: T.panelSoft || T.card, color: T.ink, fontSize: '0.72rem',
                  fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: 'pointer',
                }}
              >
                <option value="">All Types</option>
                {resourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <Button variant="outline" circleIcon={false} onClick={() => fetchData(selectedCamp)} icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}>
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
        <StatCard label="Total Records" value={summary?.total_records ?? (loading ? '—' : '0')} icon={Package} color="#16A34A" subtitle="distribution events" />
        <StatCard label="Total Quantity" value={summary?.total_quantity != null ? parseFloat(summary.total_quantity).toLocaleString() : (loading ? '—' : '0')} icon={Activity} color="#D97706" subtitle="units distributed" />
        <StatCard label="Unique Recipients" value={summary?.unique_recipients ?? (loading ? '—' : '0')} icon={Users} color="#2563EB" subtitle="wristband holders" />
        <StatCard label="Active Devices" value={summary?.active_devices ?? (loading ? '—' : '0')} icon={Package} color="#8B5CF6" subtitle="reporting devices" />
      </div>

      {/* Timeline Chart */}
      <DashboardCard title="Distribution Timeline" subtitle={`Daily distribution volume · ${selectedCamp || 'All camps'} · last 30 days`}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.muted, fontSize: 12 }}>
            <RefreshCw size={14} className="animate-spin" style={{ marginRight: 8 }} /> Loading chart data…
          </div>
        ) : (
          <DistributionTimelineChart data={timeline} theme={T} />
        )}
      </DashboardCard>

      {/* Data Table */}
      <DataTable
        columns={COLUMNS}
        data={filteredDistributions}
        title="Distribution Records"
        subtitle={`${filteredDistributions.length} records · ${selectedCamp || 'All camps'}${resourceFilter ? ` · ${resourceFilter}` : ''}`}
        searchKeys={['wristband_barcode', 'device_id', 'camp_id', 'resource_type']}
        searchPlaceholder="Search by wristband, device, or camp…"
        loading={loading}
        emptyMessage={distributions.length === 0 ? 'No distribution records found' : 'No records match your filters'}
        rowKey="id"
      />
    </div>
  )
}
