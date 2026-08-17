'use client'

import { P } from './alertPalette'

// Rounded pill filter buttons (matching the alert dashboard design).
// `options`: [{ key, label }], `counts`: { [key]: number }.
export default function FilterPills({ options, active, onSelect, counts = {} }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {options.map((f) => {
        const isActive = active === f.key
        return (
          <button
            key={f.key}
            onClick={() => onSelect(f.key)}
            style={{
              background: isActive ? P.dark : P.card, color: isActive ? '#fff' : P.inkSoft,
              border: `2px solid ${isActive ? P.dark : P.border}`, borderRadius: '9999px',
              padding: '4px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            {f.label}
            {counts[f.key] !== undefined && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : P.cardSoft, borderRadius: '9999px',
                padding: '0 6px', fontSize: '0.7rem', fontWeight: 800, color: isActive ? '#fff' : P.muted,
              }}>{counts[f.key]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}