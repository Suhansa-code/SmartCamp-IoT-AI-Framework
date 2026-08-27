'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { STATUS_COLOR, STATUS_TEXT } from '@/data/disaster.data'
import FilterPills from '@/components/alert/FilterPills'

const PAGE_SIZE = 10

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'stable', label: 'Stable' },
  { key: 'recovery', label: 'Recovery' },
]

const COLUMNS = [
  { key: 'name', label: 'Camp Name', sortable: true },
  { key: 'code', label: 'Code', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'displaced', label: 'Displaced', sortable: true, numeric: true },
  { key: 'capacity', label: 'Capacity', sortable: true, numeric: true },
  { key: 'occupancy', label: 'Occupancy', sortable: true, numeric: true },
  { key: 'aid', label: 'Aid %', sortable: true, numeric: true },
  { key: 'workers', label: 'Workers', sortable: true, numeric: true },
]

function SortIcon({ active, direction }) {
  if (!active) return <span style={{ opacity: 0.25, fontSize: '0.6rem' }}>⇅</span>
  return direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
}

export default function CampDataTable({ camps = [], loading, theme: T, onCampSelect, selected }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState('status')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const filterCounts = useMemo(() => {
    const counts = { all: camps.length }
    FILTER_OPTIONS.slice(1).forEach(({ key }) => {
      counts[key] = camps.filter((c) => c.status === key).length
    })
    return counts
  }, [camps])

  const filtered = useMemo(() => {
    let result = camps
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q)
        || c.code.toLowerCase().includes(q)
        || c.type.toLowerCase().includes(q)
      )
    }
    return result
  }, [camps, statusFilter, searchQuery])

  const sorted = useMemo(() => {
    const data = [...filtered]
    data.sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]
      if (sortKey === 'occupancy') {
        aVal = a.capacity ? Math.round((a.displaced / a.capacity) * 100) : 0
        bVal = b.capacity ? Math.round((b.displaced / b.capacity) * 100) : 0
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  function handleFilterSelect(key) {
    setStatusFilter(key)
    setPage(0)
  }

  return (
    <div suppressHydrationWarning style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '1.25rem', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: T.textPrimary }}>Camp Overview</div>
            <div style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 600, marginTop: 2 }}>
              {sorted.length} camp{sorted.length !== 1 ? 's' : ''} · sorted by {COLUMNS.find((c) => c.key === sortKey)?.label || sortKey} ({sortDir === 'asc' ? '↑' : '↓'})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.panelSoft || T.card, border: `1px solid ${T.border}`, borderRadius: '0.65rem', padding: '6px 10px', minWidth: 180 }}>
              <Search size={13} color={T.muted} />
              <input
                suppressHydrationWarning
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                placeholder="Search camps…"
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: "'Inter',sans-serif", fontSize: '0.75rem', fontWeight: 600, color: T.ink, minWidth: 0 }}
              />
            </span>
          </div>
        </div>
        <div suppressHydrationWarning>
          <FilterPills options={FILTER_OPTIONS} active={statusFilter} onSelect={handleFilterSelect} counts={filterCounts} />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: '0.65rem 0.75rem',
                    textAlign: col.numeric ? 'right' : 'left',
                    fontWeight: 700,
                    fontSize: '0.62rem',
                    color: T.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    borderBottom: `2px solid ${T.border}`,
                    background: T.panelSoft || T.card,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {col.sortable && <SortIcon active={sortKey === col.key} direction={sortDir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {COLUMNS.map((col) => (
                    <td key={col.key} style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${T.cardSoft || T.panel}, ${T.border}, ${T.cardSoft || T.panel})`, backgroundSize: '200% 100%', animation: 'disSkeleton 1.4s ease-in-out infinite', width: col.numeric ? '50%' : '80%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '2rem 0.75rem', textAlign: 'center', color: T.muted, fontWeight: 600, fontSize: '0.82rem' }}>
                  {camps.length === 0 ? 'No camp data available' : 'No camps match your filters'}
                </td>
              </tr>
            ) : paged.map((camp) => {
              const isSelected = selected === camp.id
              const occ = camp.capacity ? Math.round((camp.displaced / camp.capacity) * 100) : 0
              const color = STATUS_COLOR[camp.status] || T.muted
              return (
                <tr
                  key={camp.id}
                  onClick={() => onCampSelect?.(camp.id)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? `${color}0a` : 'transparent',
                    borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = T.cardSoft || `${T.border}33` }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}55`, flexShrink: 0 }} />
                      {camp.name}
                    </div>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, color: T.muted, fontWeight: 600, fontFamily: 'monospace', fontSize: '0.68rem' }}>{camp.code}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
                      fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: `${color}14`, border: `1px solid ${color}44`, color,
                    }}>
                      {STATUS_TEXT[camp.status] || camp.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, color: T.inkSoft, fontWeight: 600 }}>{camp.type}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, textAlign: 'right', fontWeight: 700, color: '#D97706', fontVariantNumeric: 'tabular-nums' }}>{camp.displaced.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, textAlign: 'right', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{camp.capacity.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <div style={{ width: 40, height: 5, borderRadius: 99, background: T.panelSoft || T.border, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(occ, 100)}%`, height: '100%', borderRadius: 99, background: occ > 90 ? T.red : occ > 70 ? '#D97706' : T.green }} />
                      </div>
                      <span style={{ fontWeight: 700, color: occ > 90 ? T.red : occ > 70 ? '#D97706' : T.green, fontSize: '0.72rem' }}>{occ}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, textAlign: 'right', color: T.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{camp.aid}%</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}`, textAlign: 'right', color: T.purple || '#8B5CF6', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{camp.workers}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.25rem', borderTop: `1px solid ${T.border}`, background: T.panelSoft || T.card }}>
          <span style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>
            Page {safePage + 1} of {totalPages} · {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              suppressHydrationWarning
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              style={{
                width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card,
                color: safePage === 0 ? T.muted : T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.4 : 1,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) pageNum = i
              else if (safePage < 3) pageNum = i
              else if (safePage >= totalPages - 3) pageNum = totalPages - 5 + i
              else pageNum = safePage - 2 + i
              return (
                <button
                  suppressHydrationWarning
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    minWidth: 30, height: 30, borderRadius: 8, border: `1px solid ${pageNum === safePage ? T.teal : T.border}`,
                    background: pageNum === safePage ? T.teal : T.card,
                    color: pageNum === safePage ? '#fff' : T.ink,
                    fontSize: '0.68rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              suppressHydrationWarning
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              style={{
                width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card,
                color: safePage >= totalPages - 1 ? T.muted : T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', opacity: safePage >= totalPages - 1 ? 0.4 : 1,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
