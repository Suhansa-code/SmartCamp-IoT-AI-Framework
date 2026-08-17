'use client'

import { Search, RefreshCw } from 'lucide-react'
import { P } from '@/components/alert/alertPalette'

// Pill-style search bar (matching the alert dashboard design).
// Optional `onRefresh` renders a round refresh button on the right.
export default function SearchBar({
  value, onChange, placeholder, onRefresh, refreshing, style,
}) {
  return (
    <>
      <style>{`
        @keyframes searchSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div
        className="smartcamp-search"
        style={{
          display: 'flex', alignItems: 'center', background: P.card,
          borderRadius: '9999px', padding: '4px 4px 4px 18px', border: `1px solid ${P.border}`,
          flex: '1 1 200px', minWidth: 200, maxWidth: 480,
          ...style,
        }}
      >
        <Search size={16} color={P.muted} style={{ flexShrink: 0 }} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            padding: '8px 10px', fontSize: '0.84rem', fontWeight: 600, color: P.ink,
          }}
        />
        {onRefresh && (
          <button
            onClick={onRefresh}
            aria-label="Refresh"
            style={{
              width: 34, height: 34, borderRadius: '50%', background: P.dark, border: 'none',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'searchSpin 0.8s linear infinite' } : undefined} />
          </button>
        )}
      </div>
    </>
  )
}