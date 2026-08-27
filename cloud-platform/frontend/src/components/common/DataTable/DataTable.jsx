'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import FilterPills from '@/components/alert/FilterPills'
import { useTheme } from '@/components/common/ThemeProvider'

const PAGE_SIZE = 10

/**
 * Reusable DataTable component.
 *
 * Props:
 *   columns     - Array of { key, label, sortable, numeric, render?(value, row) }
 *   data        - Array of row objects
 *   title       - Table title string
 *   subtitle    - Table subtitle string
 *   filterOptions - Array of { key, label } for filter pills (optional)
 *   filterKey   - Column key to filter on (optional)
 *   searchKeys  - Array of keys to search across (optional)
 *   searchPlaceholder - Search input placeholder
 *   loading     - Boolean loading state
 *   emptyMessage - Message when no data
 *   onRowClick  - Callback when row clicked (optional)
 *   selectedRow - Currently selected row id (optional)
 *   rowKey      - Key to use as row identifier (default: 'id')
 *   pageSize    - Items per page (default: 10)
 */
export default function DataTable({
  columns = [],
  data = [],
  title = 'Data Table',
  subtitle = '',
  filterOptions,
  filterKey,
  searchKeys = [],
  searchPlaceholder = 'Search…',
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  selectedRow,
  rowKey = 'id',
  pageSize = PAGE_SIZE,
}) {
  const { T } = useTheme()
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState(columns[0]?.key || '')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const filterCounts = useMemo(() => {
    if (!filterOptions || !filterKey) return {}
    const counts = { all: data.length }
    filterOptions.slice(1).forEach(({ key }) => {
      counts[key] = data.filter((r) => r[filterKey] === key).length
    })
    return counts
  }, [data, filterOptions, filterKey])

  const filtered = useMemo(() => {
    let result = data
    if (filterOptions && filterKey && statusFilter !== 'all') {
      result = result.filter((r) => r[filterKey] === statusFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q && searchKeys.length > 0) {
      result = result.filter((r) =>
        searchKeys.some((key) => {
          const val = r[key]
          return val != null && String(val).toLowerCase().includes(q)
        })
      )
    }
    return result
  }, [data, filterOptions, filterKey, statusFilter, searchQuery, searchKeys])

  const sorted = useMemo(() => {
    const d = [...filtered]
    d.sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return d
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)

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
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: T.textPrimary }}>{title}</div>
            <div style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 600, marginTop: 2 }}>
              {subtitle || `${sorted.length} record${sorted.length !== 1 ? 's' : ''} · sorted by ${columns.find((c) => c.key === sortKey)?.label || sortKey} (${sortDir === 'asc' ? '↑' : '↓'})`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {searchKeys.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.panelSoft || T.card, border: `1px solid ${T.border}`, borderRadius: '0.65rem', padding: '6px 10px', minWidth: 180 }}>
                <Search size={13} color={T.muted} />
                <input
                  suppressHydrationWarning
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                  placeholder={searchPlaceholder}
                  style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: "'Inter',sans-serif", fontSize: '0.75rem', fontWeight: 600, color: T.ink, minWidth: 0 }}
                />
              </span>
            )}
          </div>
        </div>
        {filterOptions && filterKey && (
          <div suppressHydrationWarning>
            <FilterPills options={filterOptions} active={statusFilter} onSelect={handleFilterSelect} counts={filterCounts} />
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              {columns.map((col) => (
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
                    {col.sortable && (
                      sortKey === col.key
                        ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
                        : <span style={{ opacity: 0.25, fontSize: '0.6rem' }}>⇅</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: '0.6rem 0.75rem', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${T.cardSoft || T.panel}, ${T.border}, ${T.cardSoft || T.panel})`, backgroundSize: '200% 100%', animation: 'disSkeleton 1.4s ease-in-out infinite', width: col.numeric ? '50%' : '80%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '2rem 0.75rem', textAlign: 'center', color: T.muted, fontWeight: 600, fontSize: '0.82rem' }}>
                  {data.length === 0 ? emptyMessage : 'No results match your filters'}
                </td>
              </tr>
            ) : paged.map((row) => {
              const isSelected = selectedRow != null && row[rowKey] === selectedRow
              const rowColor = row.status ? (row._color || T.muted) : undefined
              return (
                <tr
                  key={row[rowKey]}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: isSelected ? `${rowColor || T.teal}0a` : 'transparent',
                    borderLeft: isSelected ? `3px solid ${rowColor || T.teal}` : '3px solid transparent',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = T.cardSoft || `${T.border}33` }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={{
                      padding: '0.6rem 0.75rem',
                      borderBottom: `1px solid ${T.border}`,
                      textAlign: col.numeric ? 'right' : 'left',
                      fontWeight: col.render ? 400 : 600,
                      color: col.numeric ? T.inkSoft : T.ink,
                      fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
                      whiteSpace: 'nowrap',
                    }}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
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
