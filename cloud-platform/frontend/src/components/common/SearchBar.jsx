'use client'

import { Search, RefreshCw } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import Button from '@/components/common/Button'

// Pill-style search bar (matching the alert dashboard design).
// Optional `onRefresh` renders a round refresh button on the right.
export default function SearchBar({
  value, onChange, placeholder, onRefresh, refreshing, style,
}) {
  const { T } = useTheme()
  return (
    <>
      <style>{`
        @keyframes searchSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .smartcamp-search input::placeholder { color: ${T.muted}; opacity: 1; }
      `}</style>
      <div
        className="smartcamp-search"
        style={{
          display: 'flex', alignItems: 'center', background: T.card,
          borderRadius: '9999px', padding: '4px 4px 4px 18px', border: `1px solid ${T.border}`,
          flex: '1 1 200px', minWidth: 200, maxWidth: 480,
          ...style,
        }}
      >
        <Search size={16} color={T.muted} style={{ flexShrink: 0 }} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          suppressHydrationWarning
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            padding: '8px 10px', fontSize: '0.84rem', fontWeight: 600, color: T.textPrimary,
          }}
        />
        {onRefresh && (
          <Button
            variant="circleRefresh"
            size={34}
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'searchSpin 0.8s linear infinite' } : undefined} />
          </Button>
        )}
      </div>
    </>
  )
}