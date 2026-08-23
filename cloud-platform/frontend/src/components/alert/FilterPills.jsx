'use client'

import { useTheme } from '@/components/common/ThemeProvider'

export default function FilterPills({ options, active, onSelect, counts = {} }) {
  const { T } = useTheme()
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {options.map((f) => {
        const isActive = active === f.key
        return (
          <button
            key={f.key}
            onClick={() => onSelect(f.key)}
            style={{
              background: isActive ? T.textPrimary : T.card, color: isActive ? T.bg : T.textSoft,
              border: `2px solid ${isActive ? T.textPrimary : T.border}`, borderRadius: '9999px',
              padding: '4px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              transition: 'all 0.2s',
            }}
          >
            {f.label}
            {counts[f.key] !== undefined && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : T.bar, borderRadius: '9999px',
                padding: '0 6px', fontSize: '0.7rem', fontWeight: 800, color: isActive ? '#fff' : T.muted,
              }}>{counts[f.key]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}