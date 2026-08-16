'use client'

import { C } from './theme'

// Reusable dark navy page header (PAGES / Smart Camp chrome).
// Design preserved from the original admin pages.
export default function PageHeader({ logoText = 'P', title, subtitle, right, height = 60, adminName, adminRole = 'Administrator', fixed = false }) {
  const big = height >= 72

  return (
    <header className="smartcamp-header" style={{
      background: C.navyDeep,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 1.5rem',
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      zIndex: 100,
      transition: 'left 0.2s ease',
      ...(fixed ? { position: 'fixed', top: 0, left: 'var(--rail-width, 236px)', right: 0 } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: big ? 44 : 34, height: big ? 44 : 34, borderRadius: big ? '0.8rem' : '0.6rem',
          background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: big ? '1.3rem' : '1rem', color: 'white',
        }}>
          {logoText}
        </div>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: big ? '1.4rem' : '1.15rem' }}>
          {title}{' '}
          {subtitle && <span style={{ fontSize: big ? '0.9rem' : '0.72rem', color: C.textMuted, fontWeight: 600 }}>{subtitle}</span>}
        </span>
      </div>

      {right ?? (
        adminName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: big ? '1rem' : '0.85rem', fontWeight: 700 }}>{adminName}</p>
              <p style={{ fontSize: big ? '0.85rem' : '0.72rem', color: C.textMuted }}>{adminRole}</p>
            </div>
            <div style={{
              width: big ? 44 : 36, height: big ? 44 : 36, borderRadius: '50%',
              background: C.navyCard, border: `2px solid ${C.teal}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: big ? '1.3rem' : '1.1rem',
            }}>👤</div>
          </div>
        ) : null
      )}
    </header>
  )
}