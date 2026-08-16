'use client'

import { C } from './theme'

// Dark sidebar listing camps. Used by the alerts + welfare dashboards.
// `counts` is optional — a map of campId → badge count (e.g. open alerts).
export default function CampSidebar({ camps, selectedCamp, onSelect, counts }) {
  return (
    <aside style={{
      width: '240px',
      background: '#071B30',
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '1.25rem 1rem 0.75rem' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Camps
        </p>
      </div>

      {camps.map(camp => {
        const count  = counts?.[camp.id] ?? camp.count
        const active = selectedCamp === camp.id
        return (
          <button
            key={camp.id}
            onClick={() => onSelect(camp.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: active ? C.navyCard : 'transparent',
              border: 'none',
              borderLeft: active ? `3px solid ${C.teal}` : '3px solid transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: active ? 700 : 600, color: active ? 'white' : C.textMuted, fontSize: '0.9rem' }}>
              {camp.name}
            </span>
            {count > 0 && (
              <span style={{
                background: C.amber,
                color: '#1C1917',
                borderRadius: '9999px',
                padding: '1px 8px',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </aside>
  )
}