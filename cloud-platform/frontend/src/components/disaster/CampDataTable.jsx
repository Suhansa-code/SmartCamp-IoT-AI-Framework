'use client'

import { STATUS_COLOR, STATUS_TEXT } from '@/data/disaster.data'
import DataTable from '@/components/common/DataTable/DataTable'

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'stable', label: 'Stable' },
  { key: 'recovery', label: 'Recovery' },
]

const COLUMNS = [
  { key: 'name', label: 'Camp Name', sortable: true, render: (v, row) => {
    const color = STATUS_COLOR[row.status] || '#64748B'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}55`, flexShrink: 0 }} />
        {v}
      </div>
    )
  }},
  { key: 'code', label: 'Code', sortable: true, render: (v) => (
    <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.68rem' }}>{v}</span>
  )},
  { key: 'status', label: 'Status', sortable: true, render: (v) => {
    const color = STATUS_COLOR[v] || '#64748B'
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        background: `${color}14`, border: `1px solid ${color}44`, color,
      }}>
        {STATUS_TEXT[v] || v}
      </span>
    )
  }},
  { key: 'type', label: 'Type', sortable: true },
  { key: 'displaced', label: 'Displaced', sortable: true, numeric: true, render: (v) => (
    <span style={{ color: '#D97706', fontWeight: 700 }}>{v?.toLocaleString()}</span>
  )},
  { key: 'capacity', label: 'Capacity', sortable: true, numeric: true, render: (v) => v?.toLocaleString() },
  { key: 'occupancy', label: 'Occupancy', sortable: true, numeric: true, render: (_v, row) => {
    const occ = row.capacity ? Math.round((row.displaced / row.capacity) * 100) : 0
    const color = occ > 90 ? '#DC2626' : occ > 70 ? '#D97706' : '#16A34A'
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <div style={{ width: 40, height: 5, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(occ, 100)}%`, height: '100%', borderRadius: 99, background: color }} />
        </div>
        <span style={{ fontWeight: 700, color, fontSize: '0.72rem' }}>{occ}%</span>
      </div>
    )
  }},
  { key: 'aid', label: 'Aid %', sortable: true, numeric: true, render: (v) => (
    <span style={{ color: '#16A34A', fontWeight: 700 }}>{v}%</span>
  )},
  { key: 'workers', label: 'Workers', sortable: true, numeric: true, render: (v) => (
    <span style={{ color: '#8B5CF6', fontWeight: 600 }}>{v}</span>
  )},
]

export default function CampDataTable({ camps = [], loading, theme: T, onCampSelect, selected }) {
  const dataWithOcc = camps.map((c) => ({
    ...c,
    occupancy: c.capacity ? Math.round((c.displaced / c.capacity) * 100) : 0,
    _color: STATUS_COLOR[c.status],
  }))

  return (
    <DataTable
      columns={COLUMNS}
      data={dataWithOcc}
      title="Camp Overview"
      filterOptions={FILTER_OPTIONS}
      filterKey="status"
      searchKeys={['name', 'code', 'type']}
      searchPlaceholder="Search camps…"
      loading={loading}
      emptyMessage={camps.length === 0 ? 'No camp data available' : 'No camps match your filters'}
      onRowClick={(row) => onCampSelect?.(row.id)}
      selectedRow={selected}
      rowKey="id"
    />
  )
}
